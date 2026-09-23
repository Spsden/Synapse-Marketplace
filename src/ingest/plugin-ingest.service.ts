import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PluginStoreException } from '../common/exceptions';
import { PluginVersionSource } from '../common/entities/plugin-version.entity';
import { StorageService } from '../storage/storage.service';
import { SynxBuilderService, OPTIONAL_SYNX_FILES, REQUIRED_SYNX_FILES } from '../storage/synx-builder.service';
import { PluginsService } from '../plugins/plugins.service';
import { GitHubSourceClient, GitTreeEntry, ResolvedSource } from './github-source.client';

/** Why a plugin folder did or did not produce a submitted version. */
export type IngestOutcome =
  | 'submitted'
  | 'skipped-identical'
  | 'skipped-invalid'
  | 'rejected-immutable'
  | 'failed';

export interface IngestedPluginResult {
  path: string;
  packageId?: string;
  version?: string;
  outcome: IngestOutcome;
  checksumSha256?: string;
  sizeBytes?: number;
  message?: string;
}

export interface IngestReport {
  repository: string;
  commitSha: string;
  dryRun: boolean;
  submitted: number;
  skipped: number;
  failed: number;
  results: IngestedPluginResult[];
}

export interface IngestRequest {
  /** Branch, tag, or commit-ish to resolve. Defaults to the repository HEAD. */
  ref?: string;
  /** Explicit commit SHA. Takes precedence over `ref` and is never resolved. */
  commitSha?: string;
  /** Restrict the run to these plugin folder names. */
  plugins?: string[];
  /** Resolve, fetch, validate, and build without writing to storage or the database. */
  dryRun?: boolean;
}

const COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/;

/**
 * Builds plugin versions from reviewed source in a git repository.
 *
 * Replaces developer archive uploads: the artifact is compiled here from a
 * pinned commit, so the stored digest describes bytes that can be reproduced
 * from an immutable revision. Every version still enters the normal admin
 * review queue; ingest never publishes.
 */
@Injectable()
export class PluginIngestService {
  private readonly logger = new Logger(PluginIngestService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly sourceClient: GitHubSourceClient,
    private readonly builder: SynxBuilderService,
    private readonly storageService: StorageService,
    private readonly pluginsService: PluginsService,
  ) {}

  /**
   * Ingests every plugin folder at the requested revision.
   *
   * A single failing plugin does not abort the run; per-plugin outcomes are
   * returned in the report.
   */
  async ingest(request: IngestRequest): Promise<IngestReport> {
    const source = await this.resolveSource(request);
    const dryRun = request.dryRun === true;

    this.logger.log(
      `Ingesting ${this.sourceClient.repository}@${source.shortSha}` +
        `${dryRun ? ' (dry run)' : ''}`,
    );

    const entries = await this.sourceClient.listPluginFiles(source);
    const folders = this.groupByPluginFolder(entries, request.plugins);

    const results: IngestedPluginResult[] = [];
    for (const [folder, files] of folders) {
      results.push(await this.ingestFolder(folder, files, source, dryRun));
    }

    const report: IngestReport = {
      repository: this.sourceClient.repository,
      commitSha: source.commitSha,
      dryRun,
      submitted: results.filter((r) => r.outcome === 'submitted').length,
      skipped: results.filter((r) => r.outcome.startsWith('skipped')).length,
      failed: results.filter(
        (r) => r.outcome === 'failed' || r.outcome === 'rejected-immutable',
      ).length,
      results: results.sort((a, b) => a.path.localeCompare(b.path)),
    };

    this.logger.log(
      `Ingest complete: ${report.submitted} submitted, ${report.skipped} skipped, ${report.failed} failed`,
    );

    return report;
  }

  private async resolveSource(request: IngestRequest): Promise<ResolvedSource> {
    const pinned = request.commitSha ?? (request.ref && COMMIT_SHA_PATTERN.test(request.ref) ? request.ref : undefined);

    if (request.commitSha && !COMMIT_SHA_PATTERN.test(request.commitSha)) {
      throw new PluginStoreException(
        `commitSha must be a full 40-character hex SHA; received '${request.commitSha}'.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    if (pinned) {
      return {
        repository: this.sourceClient.repository,
        commitSha: pinned,
        shortSha: pinned.slice(0, 12),
      };
    }

    return this.sourceClient.resolveCommit(request.ref ?? 'HEAD');
  }

  /** Groups tree entries into `plugins/<name>` folders holding their direct files. */
  private groupByPluginFolder(
    entries: GitTreeEntry[],
    only?: string[],
  ): Map<string, Map<string, GitTreeEntry>> {
    const prefix = `${this.sourceClient.pluginsDirectory}/`;
    const folders = new Map<string, Map<string, GitTreeEntry>>();
    const wanted = only && only.length > 0 ? new Set(only) : null;

    for (const entry of entries) {
      const remainder = entry.path.slice(prefix.length);
      const segments = remainder.split('/');
      if (segments.length !== 2 || segments[0].length === 0 || segments[1].length === 0) {
        continue;
      }

      const [folderName, fileName] = segments;
      if (wanted && !wanted.has(folderName)) {
        continue;
      }

      const folder = `${prefix}${folderName}`;
      const files = folders.get(folder) ?? new Map<string, GitTreeEntry>();
      files.set(fileName, entry);
      folders.set(folder, files);
    }

    if (wanted) {
      for (const name of wanted) {
        const folder = `${prefix}${name}`;
        if (!folders.has(folder)) {
          folders.set(folder, new Map<string, GitTreeEntry>());
        }
      }
    }

    return folders;
  }

  private async ingestFolder(
    folder: string,
    files: Map<string, GitTreeEntry>,
    source: ResolvedSource,
    dryRun: boolean,
  ): Promise<IngestedPluginResult> {
    const manifestEntry = files.get(REQUIRED_SYNX_FILES.manifest);
    const pluginEntry = files.get(REQUIRED_SYNX_FILES.plugin);

    if (!manifestEntry || !pluginEntry) {
      const missing = [
        !manifestEntry ? REQUIRED_SYNX_FILES.manifest : null,
        !pluginEntry ? REQUIRED_SYNX_FILES.plugin : null,
      ].filter(Boolean);
      return {
        path: folder,
        outcome: 'skipped-invalid',
        message: `Missing required file(s): ${missing.join(', ')}`,
      };
    }

    try {
      const manifestBuffer = await this.sourceClient.readBlob(manifestEntry.sha, manifestEntry.path);
      const pluginJs = await this.sourceClient.readBlob(pluginEntry.sha, pluginEntry.path);

      const readmeEntry = files.get(OPTIONAL_SYNX_FILES.readme);
      const licenseEntry = files.get(OPTIONAL_SYNX_FILES.license);
      const iconName = OPTIONAL_SYNX_FILES.icons.find((candidate) => files.has(candidate));
      const iconEntry = iconName ? files.get(iconName) : undefined;

      const built = await this.builder.build({
        manifestBuffer,
        pluginJs,
        readme: readmeEntry
          ? await this.sourceClient.readBlob(readmeEntry.sha, readmeEntry.path)
          : undefined,
        license: licenseEntry
          ? await this.sourceClient.readBlob(licenseEntry.sha, licenseEntry.path)
          : undefined,
        icon:
          iconName && iconEntry
            ? { name: iconName, data: await this.sourceClient.readBlob(iconEntry.sha, iconEntry.path) }
            : undefined,
      });

      const packageId = built.manifest.id;
      const version = built.manifest.version;

      const base = {
        path: folder,
        packageId,
        version,
        checksumSha256: built.sha256,
        sizeBytes: built.size,
      };

      const existing = await this.pluginsService.findExistingVersion(packageId, version);
      if (existing) {
        if (existing.checksumSha256 === built.sha256) {
          return { ...base, outcome: 'skipped-identical', message: 'Already ingested at this digest.' };
        }
        return {
          ...base,
          outcome: 'rejected-immutable',
          message:
            `Version ${version} is already published from different bytes ` +
            `(stored ${existing.checksumSha256}). Bump the manifest version instead of rewriting it.`,
        };
      }

      if (dryRun) {
        return { ...base, outcome: 'submitted', message: 'Dry run: validated and built, nothing written.' };
      }

      const upload = await this.storageService.uploadArtifact(
        built.buffer,
        'application/zip',
        packageId,
        version,
      );

      const iconKey =
        iconName && iconEntry ? await this.uploadIcon(iconName, iconEntry) : undefined;

      const provenance: PluginVersionSource = {
        provider: 'github',
        repository: source.repository,
        commitSha: source.commitSha,
        path: folder,
        blobShas: this.collectBlobShas(files),
        upstream: built.manifest,
      };

      try {
        await this.pluginsService.submitPlugin({
          packageId,
          version,
          name: built.manifest.name,
          description: built.manifest.description,
          author: built.manifest.author ?? source.repository.split('/')[0],
          iconKey,
          category: built.manifest.category ?? built.manifest.categories?.[0],
          tags: built.manifest.tags ?? built.manifest.keywords?.join(','),
          sourceUrl: `https://github.com/${source.repository}/tree/${source.commitSha}/${folder}`,
          manifest: built.manifest,
          minAppVersion:
            built.manifest.minAppVersion ?? built.manifest.minSynapseVersion ?? '1.0.0',
          storagePath: upload.storagePath,
          storageBucket: upload.bucket,
          tempStoragePath: upload.tempPath,
          fileSizeBytes: built.size,
          checksumSha256: built.sha256,
          source: provenance,
        });
      } catch (error) {
        // Database writes are not transactional with storage; drop what we uploaded.
        await this.cleanupFailedSubmission(upload.tempPath, upload.bucket, iconKey);
        throw error;
      }

      return { ...base, outcome: 'submitted' };
    } catch (error) {
      if (error instanceof PluginStoreException) {
        return { path: folder, outcome: 'skipped-invalid', message: error.message };
      }

      this.logger.error(`Ingest failed for ${folder}: ${(error as Error).message}`);
      return { path: folder, outcome: 'failed', message: (error as Error).message };
    }
  }

  /**
   * Icons are keyed by content hash so identical icons are stored once.
   */
  private async uploadIcon(iconName: string, iconEntry: GitTreeEntry): Promise<string | undefined> {
    try {
      const data = await this.sourceClient.readBlob(iconEntry.sha, iconEntry.path);
      const iconKey = await this.storageService.calculateChecksum(data);
      return await this.storageService.uploadIcon(data, iconName, iconKey);
    } catch (error) {
      this.logger.warn(`Icon upload failed for ${iconEntry.path}: ${(error as Error).message}`);
      return undefined;
    }
  }

  /** Best-effort removal of artifacts uploaded before a submission failed. */
  private async cleanupFailedSubmission(
    tempPath: string,
    tempBucket: string,
    iconKey?: string,
  ): Promise<void> {
    const removals: Array<Promise<void>> = [
      this.storageService.deleteArtifact(tempPath, tempBucket),
    ];

    if (iconKey) {
      const iconsBucket = this.configService.get('supabase').iconsBucket;
      removals.push(this.storageService.deleteArtifact(iconKey, iconsBucket));
    }

    const outcomes = await Promise.allSettled(removals);
    for (const outcome of outcomes) {
      if (outcome.status === 'rejected') {
        this.logger.warn(`Cleanup after failed submission left an orphan: ${outcome.reason}`);
      }
    }
  }

  private collectBlobShas(files: Map<string, GitTreeEntry>): Record<string, string> {
    const blobShas: Record<string, string> = {};
    for (const [name, entry] of files) {
      blobShas[name] = entry.sha;
    }
    return blobShas;
  }
}
