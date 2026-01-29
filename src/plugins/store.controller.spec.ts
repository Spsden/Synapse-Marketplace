import { Test, TestingModule } from '@nestjs/testing';
import { StoreController } from './store.controller';
import { PluginsService } from './plugins.service';
import { PluginStatus } from '../common/enums/plugin-status.enum';
import { VersionStatus } from '../common/enums/version-status.enum';
import { PluginDetailResponse, PluginVersionResponse, PluginStatisticsResponse } from '../common/dto';

describe('StoreController', () => {
  let controller: StoreController;
  let service: jest.Mocked<PluginsService>;

  const mockPluginResponse = {
    id: 'plugin-1',
    packageId: 'com.example.plugin',
    name: 'Test Plugin',
    description: 'Test Description',
    author: 'Test Author',
    iconKey: 'icon-key',
    status: PluginStatus.PUBLISHED,
    latestVersionId: 'version-1',
    category: 'productivity',
    tags: 'test,tags', // String, not array
    sourceUrl: 'https://github.com/test',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPluginDetailResponse: PluginDetailResponse = {
    id: 'plugin-1',
    packageId: 'com.example.plugin',
    name: 'Test Plugin',
    description: 'Test Description',
    author: 'Test Author',
    iconKey: 'icon-key',
    status: PluginStatus.PUBLISHED,
    category: 'productivity',
    tags: 'test,tags',
    sourceUrl: 'https://github.com/test',
    pluginCreatedAt: new Date(),
    versionId: 'version-1',
    version: '1.0.0',
    manifest: { name: 'Test Plugin' },
    minAppVersion: '1.0.0',
    releaseNotes: 'First release',
    versionCreatedAt: new Date(),
    downloadCount: 100,
    downloadUrl: 'https://signed-url',
    expiresAt: Date.now() + 3600000,
    fileSizeBytes: 1024,
    checksumSha256: 'abc123',
    storageBucket: 'artifacts',
    storagePath: 'path/to/plugin.zip',
  };

  const mockVersionResponse: PluginVersionResponse = {
    id: 'version-1',
    pluginId: 'plugin-1',
    version: '1.0.0',
    manifest: { name: 'Test Plugin' },
    minAppVersion: '1.0.0',
    releaseNotes: 'First release',
    status: VersionStatus.PUBLISHED, // Proper enum type
    rejectionReason: null,
    reviewedBy: null,
    createdAt: new Date(),
    reviewedAt: null,
    publishedAt: new Date(),
    downloadCount: 100,
    isFlagged: false,
    storagePath: 'path/to/plugin.zip',
    storageBucket: 'artifacts',
    fileSizeBytes: 1024,
    checksumSha256: 'abc123',
  };

  const mockStatisticsResponse: PluginStatisticsResponse = {
    packageId: 'com.example.plugin',
    name: 'Test Plugin',
    status: PluginStatus.PUBLISHED,
    totalVersions: 1,
    publishedVersions: 1,
    totalDownloads: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPluginsService = {
      listPublishedPlugins: jest.fn(),
      getPluginByPackageId: jest.fn(),
      getPluginVersions: jest.fn(),
      getVersionById: jest.fn(),
      getPluginStatistics: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StoreController],
      providers: [
        {
          provide: PluginsService,
          useValue: mockPluginsService,
        },
      ],
    }).compile();

    controller = module.get<StoreController>(StoreController);
    service = module.get(PluginsService) as jest.Mocked<PluginsService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('listPlugins', () => {
    it('should return paginated list of plugins', async () => {
      service.listPublishedPlugins.mockResolvedValue({
        data: [mockPluginResponse],
        total: 1,
        page: 0,
        pageSize: 20,
        totalPages: 1,
      });

      const result = await controller.listPlugins(undefined, undefined, 0, 20);

      expect(result).toEqual({
        data: [mockPluginResponse],
        total: 1,
        page: 0,
        pageSize: 20,
        totalPages: 1,
      });
      expect(service.listPublishedPlugins).toHaveBeenCalledWith(undefined, undefined, 0, 20);
    });

    it('should pass category and search parameters to service', async () => {
      service.listPublishedPlugins.mockResolvedValue({
        data: [],
        total: 0,
        page: 0,
        pageSize: 20,
        totalPages: 0,
      });

      await controller.listPlugins('productivity', 'test', 0, 20);

      expect(service.listPublishedPlugins).toHaveBeenCalledWith('productivity', 'test', 0, 20);
    });
  });

  describe('getPlugin', () => {
    it('should return plugin details', async () => {
      service.getPluginByPackageId.mockResolvedValue(mockPluginDetailResponse);

      const result = await controller.getPlugin('com.example.plugin', undefined);

      expect(result).toEqual(mockPluginDetailResponse);
      expect(service.getPluginByPackageId).toHaveBeenCalledWith('com.example.plugin', undefined);
    });

    it('should pass appVersion parameter to service', async () => {
      service.getPluginByPackageId.mockResolvedValue(mockPluginDetailResponse);

      await controller.getPlugin('com.example.plugin', '1.5.0');

      expect(service.getPluginByPackageId).toHaveBeenCalledWith('com.example.plugin', '1.5.0');
    });
  });

  describe('getPluginVersions', () => {
    it('should return all versions of a plugin', async () => {
      service.getPluginVersions.mockResolvedValue([mockVersionResponse]);

      const result = await controller.getPluginVersions('com.example.plugin');

      expect(result).toEqual([mockVersionResponse]);
      expect(service.getPluginVersions).toHaveBeenCalledWith('com.example.plugin');
    });
  });

  describe('getVersion', () => {
    it('should return version by ID', async () => {
      service.getVersionById.mockResolvedValue(mockVersionResponse);

      const result = await controller.getVersion('version-1');

      expect(result).toEqual(mockVersionResponse);
      expect(service.getVersionById).toHaveBeenCalledWith('version-1');
    });
  });

  describe('getStatistics', () => {
    it('should return plugin statistics', async () => {
      service.getPluginStatistics.mockResolvedValue(mockStatisticsResponse);

      const result = await controller.getStatistics('com.example.plugin');

      expect(result).toEqual(mockStatisticsResponse);
      expect(service.getPluginStatistics).toHaveBeenCalledWith('com.example.plugin');
    });
  });
});
