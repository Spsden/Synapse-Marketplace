import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import JSZip from 'jszip';

import { PluginStoreException } from '../common/exceptions';

/**
 * Required and optional members of a .synx archive.
 *
 * These mirror `@synapse/pack` (`registry/packages/pack/src/manifest.ts`) so
 * that a package which passes the registry toolchain is byte-identical to the
 * one the Marketplace builds during ingest.
 */
export const REQUIRED_SYNX_FILES = {
  manifest: 'manifest.json',
  plugin: 'plugin.js',
} as const;

export const OPTIONAL_SYNX_FILES = {
  icons: ['icon.png', 'icon.jpg', 'icon.jpeg', 'icon.svg'],
  readme: 'README.md',
  license: 'LICENSE',
} as const;

/** Hard limit on plugin.js size, matching `@synapse/pack`. */
export const PLUGIN_JS_MAX_BYTES = 500 * 1024;

/** Top-level manifest v1 fields that are rejected in v2. */
export const LEGACY_MANIFEST_FIELDS = [
  'triggers',
  'inputSchema',
  'auth',
  'mcpServers',
] as const;

const PACKAGE_ID_PATTERN = /^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*)+$/;
const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
const MIN_APP_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/**
 * Fixed epoch for every zip entry. Identical source must produce a
 * byte-identical archive so `checksum_sha256` is reproducible across the
 * Marketplace, CI, and a developer's local `synx build`.
 */
const EPOCH = new Date(0);

/** Source files for one plugin, already read as bytes. */
export interface SynxSourceFiles {
  /** Raw bytes of manifest.json exactly as committed (never re-serialized). */
  manifestBuffer: Buffer;
  pluginJs: Buffer;
  readme?: Buffer;
  license?: Buffer;
  icon?: { name: string; data: Buffer };
}

export interface BuiltSynx {
  buffer: Buffer;
  sha256: string;
  size: number;
  manifest: Record<string, any>;
}

/**
 * Builds and validates .synx plugin packages.
 *
 * Used by the GitHub ingest path, which builds artifacts from reviewed source
 * instead of accepting uploaded archives. The build is deterministic: fixed
 * entry order, STORE compression (no platform-dependent DEFLATE), and a fixed
 * entry timestamp.
 */
@Injectable()
export class SynxBuilderService {
  private readonly logger = new Logger(SynxBuilderService.name);

  /**
   * Parses and validates a manifest, returning it typed as a plain object.
   *
   * @throws PluginStoreException (400) when the manifest is not a valid v2 manifest.
   */
  parseManifest(manifestBuffer: Buffer): Record<string, any> {
    let manifest: Record<string, any>;
    try {
      manifest = JSON.parse(manifestBuffer.toString('utf8'));
    } catch {
      throw new PluginStoreException(
        `${REQUIRED_SYNX_FILES.manifest} is not valid JSON.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)) {
      throw new PluginStoreException(
        `${REQUIRED_SYNX_FILES.manifest} must contain a JSON object.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const legacy = LEGACY_MANIFEST_FIELDS.filter((field) => field in manifest);
    if (legacy.length > 0) {
      throw new PluginStoreException(
        `Manifest v1 fields are not supported: ${legacy.join(', ')}. ` +
          'Declare triggers and input schemas per action instead.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (manifest.manifestVersion !== 2) {
      throw new PluginStoreException(
        `Unsupported manifestVersion '${manifest.manifestVersion}'. Only manifest v2 is accepted.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const id = manifest.id;
    if (typeof id !== 'string' || !PACKAGE_ID_PATTERN.test(id)) {
      throw new PluginStoreException(
        `Manifest 'id' must be a reverse-domain package id (e.g. com.example.plugin); received '${id}'.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    if (typeof manifest.name !== 'string' || manifest.name.trim().length === 0) {
      throw new PluginStoreException(
        "Manifest 'name' is required.",
        HttpStatus.BAD_REQUEST,
      );
    }

    if (typeof manifest.version !== 'string' || !SEMVER_PATTERN.test(manifest.version)) {
      throw new PluginStoreException(
        `Manifest 'version' must be a semantic version; received '${manifest.version}'.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!Array.isArray(manifest.actions) || manifest.actions.length === 0) {
      throw new PluginStoreException(
        "Manifest 'actions' must be a non-empty array.",
        HttpStatus.BAD_REQUEST,
      );
    }

    for (const action of manifest.actions) {
      if (!action || typeof action !== 'object' || typeof action.id !== 'string' || action.id.length === 0) {
        throw new PluginStoreException(
          'Every action must declare a non-empty string id.',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    if (manifest.minAppVersion !== undefined && !MIN_APP_VERSION_PATTERN.test(String(manifest.minAppVersion))) {
      throw new PluginStoreException(
        `Manifest 'minAppVersion' must be x.y.z; received '${manifest.minAppVersion}'.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    return manifest;
  }

  /**
   * Builds a deterministic .synx archive from validated source bytes.
   *
   * Entry order: manifest.json, plugin.js, icon, README.md, LICENSE.
   */
  async build(files: SynxSourceFiles): Promise<BuiltSynx> {
    if (files.pluginJs.length === 0) {
      throw new PluginStoreException(
        `${REQUIRED_SYNX_FILES.plugin} is empty.`,
        HttpStatus.BAD_REQUEST,
      );
    }
    if (files.pluginJs.length > PLUGIN_JS_MAX_BYTES) {
      throw new PluginStoreException(
        `${REQUIRED_SYNX_FILES.plugin} is ${files.pluginJs.length} bytes; limit is ${PLUGIN_JS_MAX_BYTES} bytes.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const manifest = this.parseManifest(files.manifestBuffer);

    const zip = new JSZip();
    zip.file(REQUIRED_SYNX_FILES.manifest, files.manifestBuffer, { date: EPOCH });
    zip.file(REQUIRED_SYNX_FILES.plugin, files.pluginJs, { date: EPOCH });
    if (files.icon) {
      zip.file(files.icon.name, files.icon.data, { date: EPOCH });
    }
    if (files.readme) {
      zip.file(OPTIONAL_SYNX_FILES.readme, files.readme, { date: EPOCH });
    }
    if (files.license) {
      zip.file(OPTIONAL_SYNX_FILES.license, files.license, { date: EPOCH });
    }

    const bytes = await zip.generateAsync({
      type: 'uint8array',
      compression: 'STORE',
    });
    const buffer = Buffer.from(bytes);
    const sha256 = createHash('sha256').update(buffer).digest('hex');

    this.logger.debug(
      `Built ${manifest.id}@${manifest.version}: ${buffer.byteLength} bytes, sha256 ${sha256}`,
    );

    return { buffer, sha256, size: buffer.byteLength, manifest };
  }
}
