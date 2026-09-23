import JSZip from 'jszip';
import { SynxBuilderService, PLUGIN_JS_MAX_BYTES } from './synx-builder.service';
import { PluginStoreException } from '../common/exceptions';

/**
 * Fixed source used across cases. The manifest is kept as raw bytes because the
 * builder must archive the committed bytes verbatim, not a re-serialization.
 */
const MANIFEST = Buffer.from(
  JSON.stringify({
    manifestVersion: 2,
    id: 'com.example.probe',
    name: 'Probe',
    version: '1.0.0',
    actions: [{ id: 'run' }],
  }),
);

const PLUGIN_JS = Buffer.from('export const actions = {};\n');
const README = Buffer.from('# Probe\n');

describe('SynxBuilderService', () => {
  let service: SynxBuilderService;

  beforeEach(() => {
    service = new SynxBuilderService();
  });

  describe('build', () => {
    it('produces a byte-stable artifact for identical source', async () => {
      // The digest is the immutability anchor: ingest refuses to overwrite a
      // published version whose checksum differs. If zip settings or entry
      // order change, every stored digest stops matching — this pins them.
      const built = await service.build({
        manifestBuffer: MANIFEST,
        pluginJs: PLUGIN_JS,
        readme: README,
      });

      expect(built.size).toBe(451);
      expect(built.sha256).toBe(
        'ea43dd1e07a8251644af106fb68a319c74d14bf4ba83baf2c72b6d7203921352',
      );

      const again = await service.build({
        manifestBuffer: MANIFEST,
        pluginJs: PLUGIN_JS,
        readme: README,
      });
      expect(again.sha256).toBe(built.sha256);
    });

    it('archives the committed manifest bytes and optional files', async () => {
      const icon = Buffer.from('icon-bytes');
      const built = await service.build({
        manifestBuffer: MANIFEST,
        pluginJs: PLUGIN_JS,
        readme: README,
        icon: { name: 'icon.png', data: icon },
      });

      const zip = await JSZip.loadAsync(built.buffer);
      expect(Object.keys(zip.files).sort()).toEqual([
        'README.md',
        'icon.png',
        'manifest.json',
        'plugin.js',
      ]);
      expect(await zip.file('manifest.json')!.async('string')).toBe(
        MANIFEST.toString('utf8'),
      );
    });

    it('rejects a plugin.js above the size limit', async () => {
      await expect(
        service.build({
          manifestBuffer: MANIFEST,
          pluginJs: Buffer.alloc(PLUGIN_JS_MAX_BYTES + 1, 0x61),
        }),
      ).rejects.toThrow(PluginStoreException);
    });
  });

  describe('parseManifest', () => {
    it('rejects manifest v1 top-level fields', () => {
      const legacy = Buffer.from(
        JSON.stringify({
          manifestVersion: 2,
          id: 'com.example.legacy',
          name: 'Legacy',
          version: '1.0.0',
          triggers: ['x'],
          actions: [{ id: 'run' }],
        }),
      );

      expect(() => service.parseManifest(legacy)).toThrow(/triggers/);
    });

    it('rejects an id that is not reverse-domain', () => {
      const badId = Buffer.from(
        JSON.stringify({
          manifestVersion: 2,
          id: 'Probe',
          name: 'Probe',
          version: '1.0.0',
          actions: [{ id: 'run' }],
        }),
      );

      expect(() => service.parseManifest(badId)).toThrow(/reverse-domain/);
    });

    it('accepts hyphens in the id', () => {
      const hyphenated = Buffer.from(
        JSON.stringify({
          manifestVersion: 2,
          id: 'com.github.create-issue',
          name: 'Create Issue',
          version: '1.1.0',
          actions: [{ id: 'run' }],
        }),
      );

      expect(service.parseManifest(hyphenated).id).toBe('com.github.create-issue');
    });
  });
});
