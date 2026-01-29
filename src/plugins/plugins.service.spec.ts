import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PluginsService } from './plugins.service';
import { PluginsRepository } from './plugins.repository';
import { PluginVersionsRepository } from './plugin-versions.repository';
import { StorageService } from '../storage/storage.service';
import { PluginStatus } from '../common/enums/plugin-status.enum';
import { ResourceNotFoundException, VersionConflictException } from '../common/exceptions';
import { Plugin, CreatePluginDto } from '../common/entities/plugin.entity';
import { PluginVersion } from '../common/entities/plugin-version.entity';
import { VersionStatus } from '../common/enums/version-status.enum';

describe('PluginsService', () => {
  let service: PluginsService;
  let pluginsRepository: jest.Mocked<PluginsRepository>;
  let versionsRepository: jest.Mocked<PluginVersionsRepository>;
  let storageService: jest.Mocked<StorageService>;
  let configService: jest.Mocked<ConfigService>;

  const mockPlugin: Plugin = {
    id: 'plugin-1',
    packageId: 'com.example.plugin',
    name: 'Test Plugin',
    description: 'Test Description',
    author: 'Test Author',
    iconKey: 'icon-key',
    status: PluginStatus.PUBLISHED,
    latestVersionId: 'version-1',
    category: 'productivity',
    tags: 'test,plugin',
    sourceUrl: 'https://github.com/test',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockVersion: PluginVersion = {
    id: 'version-1',
    pluginId: 'plugin-1',
    version: '1.0.0',
    manifest: { name: 'Test Plugin', version: '1.0.0' },
    minAppVersion: '1.0.0',
    releaseNotes: 'First release',
    status: VersionStatus.PUBLISHED,
    rejectionReason: null,
    reviewedBy: null,
    reviewedAt: null,
    publishedAt: new Date('2024-01-01'),
    downloadCount: 100,
    isFlagged: false,
    storagePath: 'path/to/plugin.zip',
    storageBucket: 'artifacts',
    fileSizeBytes: 1024,
    checksumSha256: 'abc123',
    tempStoragePath: null,
    createdAt: new Date('2024-01-01'),
    flagReason: null,
  };

  beforeEach(async () => {
    const mockPluginsRepository = {
      findByPackageId: jest.fn(),
      findByStatus: jest.fn(),
      searchPublishedPlugins: jest.fn(),
      findByCategoryAndStatus: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    const mockVersionsRepository = {
      findById: jest.fn(),
      findByPluginIdAndVersion: jest.fn(),
      findByPluginIdOrderByCreatedAtDesc: jest.fn(),
      findLatestCompatibleVersion: jest.fn(),
      create: jest.fn(),
      incrementDownloadCount: jest.fn(),
      countByPluginIdAndStatus: jest.fn(),
    };

    const mockStorageService = {
      uploadArtifact: jest.fn(),
      getSignedUrl: jest.fn(),
      moveArtifact: jest.fn(),
      deleteArtifact: jest.fn(),
      calculateChecksum: jest.fn(),
      uploadIcon: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'app.pagination') {
          return { defaultPageSize: 20, maxPageSize: 100 };
        }
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PluginsService,
        {
          provide: PluginsRepository,
          useValue: mockPluginsRepository,
        },
        {
          provide: PluginVersionsRepository,
          useValue: mockVersionsRepository,
        },
        {
          provide: StorageService,
          useValue: mockStorageService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<PluginsService>(PluginsService);
    pluginsRepository = module.get(PluginsRepository);
    versionsRepository = module.get(PluginVersionsRepository);
    storageService = module.get(StorageService);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('listPublishedPlugins', () => {
    it('should return paginated published plugins', async () => {
      const plugins = [mockPlugin, { ...mockPlugin, id: 'plugin-2', packageId: 'com.example.plugin2' }];
      pluginsRepository.findByStatus.mockResolvedValue(plugins);

      const result = await service.listPublishedPlugins(undefined, undefined, 0, 10);

      expect(result).toEqual({
        data: expect.any(Array),
        total: 2,
        page: 0,
        pageSize: 10,
        totalPages: 1,
      });
      expect(pluginsRepository.findByStatus).toHaveBeenCalledWith(PluginStatus.PUBLISHED);
    });

    it('should search plugins when search term is provided', async () => {
      const plugins = [mockPlugin];
      pluginsRepository.searchPublishedPlugins.mockResolvedValue(plugins);

      const result = await service.listPublishedPlugins(undefined, 'test', 0, 10);

      expect(result.total).toBe(1);
      expect(pluginsRepository.searchPublishedPlugins).toHaveBeenCalledWith('test', PluginStatus.PUBLISHED);
    });

    it('should filter by category when category is provided', async () => {
      const plugins = [mockPlugin];
      pluginsRepository.findByCategoryAndStatus.mockResolvedValue(plugins);

      const result = await service.listPublishedPlugins('productivity', undefined, 0, 10);

      expect(result.total).toBe(1);
      expect(pluginsRepository.findByCategoryAndStatus).toHaveBeenCalledWith('productivity', PluginStatus.PUBLISHED);
    });

    it('should cap page size at maxPageSize', async () => {
      const plugins = Array(150).fill(mockPlugin);
      pluginsRepository.findByStatus.mockResolvedValue(plugins);

      const result = await service.listPublishedPlugins(undefined, undefined, 0, 200);

      expect(result.pageSize).toBe(100); // maxPageSize
      expect(result.data.length).toBe(100);
    });
  });

  describe('getPluginByPackageId', () => {
    it('should return plugin with latest version when no app version specified', async () => {
      pluginsRepository.findByPackageId.mockResolvedValue(mockPlugin);
      versionsRepository.findById.mockResolvedValue(mockVersion);
      storageService.getSignedUrl.mockResolvedValue({
        signedUrl: 'https://signed-url',
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      });

      const result = await service.getPluginByPackageId('com.example.plugin');

      expect(result.packageId).toBe('com.example.plugin');
      expect(result.version).toBe('1.0.0');
      expect(versionsRepository.incrementDownloadCount).toHaveBeenCalledWith('version-1');
    });

    it('should return compatible version when app version is specified', async () => {
      pluginsRepository.findByPackageId.mockResolvedValue(mockPlugin);
      versionsRepository.findLatestCompatibleVersion.mockResolvedValue(mockVersion);
      storageService.getSignedUrl.mockResolvedValue({
        signedUrl: 'https://signed-url',
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      });

      const result = await service.getPluginByPackageId('com.example.plugin', '1.5.0');

      expect(result.version).toBe('1.0.0');
      expect(versionsRepository.findLatestCompatibleVersion).toHaveBeenCalledWith('plugin-1', '1.5.0');
    });

    it('should throw ResourceNotFoundException when plugin not found', async () => {
      pluginsRepository.findByPackageId.mockResolvedValue(null);

      await expect(
        service.getPluginByPackageId('nonexistent'),
      ).rejects.toThrow(ResourceNotFoundException);
    });

    it('should throw ResourceNotFoundException when plugin is not published', async () => {
      const unpublishedPlugin = { ...mockPlugin, status: PluginStatus.PENDING_REVIEW };
      pluginsRepository.findByPackageId.mockResolvedValue(unpublishedPlugin);

      await expect(
        service.getPluginByPackageId('com.example.plugin'),
      ).rejects.toThrow(ResourceNotFoundException);
    });

    it('should throw InvalidVersionException when no compatible version found', async () => {
      pluginsRepository.findByPackageId.mockResolvedValue(mockPlugin);
      versionsRepository.findLatestCompatibleVersion.mockResolvedValue(null);

      await expect(
        service.getPluginByPackageId('com.example.plugin', '0.5.0'),
      ).rejects.toThrow('No compatible version found');
    });
  });

  describe('submitPlugin', () => {
    it('should create new plugin when packageId does not exist', async () => {
      const newPlugin = { ...mockPlugin, id: 'new-plugin', packageId: 'com.example.newplugin', name: 'New Plugin' };
      pluginsRepository.findByPackageId.mockResolvedValue(null);
      pluginsRepository.create.mockResolvedValue(newPlugin);
      versionsRepository.create.mockResolvedValue(mockVersion);
      storageService.getSignedUrl.mockResolvedValue({
        signedUrl: 'https://signed-url',
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      });

      const result = await service.submitPlugin(
        'com.example.newplugin',
        'New Plugin',
        'Description',
        'Author',
        undefined,
        undefined,
        undefined,
        undefined,
        '1.0.0',
        { name: 'New Plugin', version: '1.0.0' },
        '1.0.0',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );

      expect(pluginsRepository.create).toHaveBeenCalled();
      expect(versionsRepository.create).toHaveBeenCalled();
      expect(result.packageId).toBe('com.example.newplugin');
    });

    it('should create new version for existing plugin', async () => {
      pluginsRepository.findByPackageId.mockResolvedValue(mockPlugin);
      versionsRepository.findByPluginIdAndVersion.mockResolvedValue(null);
      versionsRepository.create.mockResolvedValue(mockVersion);
      storageService.getSignedUrl.mockResolvedValue({
        signedUrl: 'https://signed-url',
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      });

      await service.submitPlugin(
        'com.example.plugin',
        'Test Plugin',
        'Description',
        'Author',
        undefined,
        undefined,
        undefined,
        undefined,
        '2.0.0',
        { name: 'Test Plugin', version: '2.0.0' },
        '1.0.0',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );

      expect(pluginsRepository.create).not.toHaveBeenCalled();
      expect(versionsRepository.create).toHaveBeenCalled();
    });

    it('should throw VersionConflictException when version already exists', async () => {
      pluginsRepository.findByPackageId.mockResolvedValue(mockPlugin);
      versionsRepository.findByPluginIdAndVersion.mockResolvedValue(mockVersion);

      await expect(
        service.submitPlugin(
          'com.example.plugin',
          'Test Plugin',
          'Description',
          'Author',
          undefined,
          undefined,
          undefined,
          undefined,
          '1.0.0',
          { name: 'Test Plugin', version: '1.0.0' },
          '1.0.0',
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
        ),
      ).rejects.toThrow(VersionConflictException);
    });
  });

  describe('getPluginVersions', () => {
    it('should return all versions for a plugin', async () => {
      pluginsRepository.findByPackageId.mockResolvedValue(mockPlugin);
      versionsRepository.findByPluginIdOrderByCreatedAtDesc.mockResolvedValue([mockVersion]);

      const result = await service.getPluginVersions('com.example.plugin');

      expect(result).toHaveLength(1);
      expect(result[0].version).toBe('1.0.0');
    });

    it('should throw ResourceNotFoundException when plugin not found', async () => {
      pluginsRepository.findByPackageId.mockResolvedValue(null);

      await expect(
        service.getPluginVersions('nonexistent'),
      ).rejects.toThrow(ResourceNotFoundException);
    });
  });

  describe('getVersionById', () => {
    it('should return version by ID', async () => {
      versionsRepository.findById.mockResolvedValue(mockVersion);

      const result = await service.getVersionById('version-1');

      expect(result.id).toBe('version-1');
      expect(result.version).toBe('1.0.0');
    });

    it('should throw ResourceNotFoundException when version not found', async () => {
      versionsRepository.findById.mockResolvedValue(null);

      await expect(
        service.getVersionById('nonexistent'),
      ).rejects.toThrow(ResourceNotFoundException);
    });
  });

  describe('getPluginStatistics', () => {
    it('should return plugin statistics', async () => {
      pluginsRepository.findByPackageId.mockResolvedValue(mockPlugin);
      versionsRepository.findByPluginIdOrderByCreatedAtDesc.mockResolvedValue([mockVersion]);
      versionsRepository.countByPluginIdAndStatus.mockResolvedValue(1);

      const result = await service.getPluginStatistics('com.example.plugin');

      expect(result.packageId).toBe('com.example.plugin');
      expect(result.totalDownloads).toBe(100);
      expect(result.totalVersions).toBe(1);
      expect(result.publishedVersions).toBe(1);
    });

    it('should throw ResourceNotFoundException when plugin not found', async () => {
      pluginsRepository.findByPackageId.mockResolvedValue(null);

      await expect(
        service.getPluginStatistics('nonexistent'),
      ).rejects.toThrow(ResourceNotFoundException);
    });
  });

  describe('incrementDownloadCount', () => {
    it('should increment download count for version', async () => {
      versionsRepository.incrementDownloadCount.mockResolvedValue(undefined);

      await service.incrementDownloadCount('version-1');

      expect(versionsRepository.incrementDownloadCount).toHaveBeenCalledWith('version-1');
    });
  });
});
