import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SupabaseStorageService } from './supabase-storage.service';
import { StorageService } from './storage.service';
import axios from 'axios';

// Mock Supabase client
const mockSupabase = {
  storage: {
    from: jest.fn(),
  },
};

// Mock createClient
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

// Mock axios
jest.mock('axios');

describe('SupabaseStorageService', () => {
  let service: SupabaseStorageService;
  let configService: ConfigService;

  const mockConfig = {
    get: jest.fn((key: string) => {
      if (key === 'supabase') {
        return {
          projectUrl: 'https://test.supabase.co',
          anonKey: 'test-anon-key',
          serviceRoleKey: 'test-service-role-key',
          signedUrlTtlSeconds: 3600,
          pluginsBucket: 'plugins',
          iconsBucket: 'icons',
          tempUploadsBucket: 'temp-uploads',
        };
      }
      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupabaseStorageService,
        {
          provide: ConfigService,
          useValue: mockConfig,
        },
        {
          provide: StorageService,
          useClass: SupabaseStorageService,
        },
      ],
    }).compile();

    service = module.get<SupabaseStorageService>(SupabaseStorageService);
    configService = module.get<ConfigService>(ConfigService);

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('uploadArtifact', () => {
    it('should upload an artifact successfully', async () => {
      const mockUpload = jest.fn().mockResolvedValue({
        data: { path: 'test-path' },
        error: null,
      });

      const mockBucket = {
        upload: mockUpload,
      };

      (mockSupabase.storage.from as jest.Mock).mockReturnValue(mockBucket);
      (axios.post as jest.Mock).mockResolvedValue({
        data: { signedURL: '/test-signed-url' },
      });

      const buffer = Buffer.from('test content');
      const contentType = 'application/zip';
      const packageId = 'com.example.plugin';
      const version = '1.0.0';

      const result = await service.uploadArtifact(buffer, contentType, packageId, version);

      expect(result).toHaveProperty('storagePath');
      expect(result).toHaveProperty('bucket');
      expect(result).toHaveProperty('fileSizeBytes');
      expect(result).toHaveProperty('checksumSha256');
      expect(result).toHaveProperty('contentType');
      expect(result).toHaveProperty('tempPath');
      expect(result.bucket).toBe('temp-uploads');
      expect(result.fileSizeBytes).toBe(buffer.length);
    });

    it('should throw error if upload fails', async () => {
      const mockUpload = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Upload failed' },
      });

      const mockBucket = {
        upload: mockUpload,
      };

      (mockSupabase.storage.from as jest.Mock).mockReturnValue(mockBucket);

      const buffer = Buffer.from('test content');
      const contentType = 'application/zip';
      const packageId = 'com.example.plugin';
      const version = '1.0.0';

      await expect(
        service.uploadArtifact(buffer, contentType, packageId, version),
      ).rejects.toThrow('Artifact upload failed');
    });
  });

  describe('getSignedUrl', () => {
    it('should return a signed URL result', async () => {
      (axios.post as jest.Mock).mockResolvedValue({
        data: { signedURL: '/test-signed-url' },
      });

      const result = await service.getSignedUrl('test-path', 'plugins');

      expect(result).toHaveProperty('signedUrl');
      expect(result).toHaveProperty('expiresAt');
      expect(result.signedUrl).toContain('https://test.supabase.co/storage');
      expect(result.expiresAt).toBeGreaterThan(Date.now() / 1000);
    });

    it('should throw error if storage path is empty', async () => {
      await expect(
        service.getSignedUrl('', 'plugins'),
      ).rejects.toThrow('Storage path cannot be null or empty');
    });

    it('should use default plugins bucket when bucket is not provided', async () => {
      (axios.post as jest.Mock).mockResolvedValue({
        data: { signedURL: '/test-signed-url' },
      });

      await service.getSignedUrl('test-path', '');

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/plugins/'),
        expect.any(Object),
        expect.any(Object),
      );
    });
  });

  describe('moveArtifact', () => {
    it('should move artifact from temp to permanent storage', async () => {
      const fileData = Buffer.from('test-file');

      const mockDownload = jest.fn().mockResolvedValue({
        data: fileData,
        error: null,
      });

      const mockUpload = jest.fn().mockResolvedValue({
        data: { path: 'new-path' },
        error: null,
      });

      const mockRemove = jest.fn().mockResolvedValue({
        data: {},
        error: null,
      });

      const mockTempBucket = {
        download: mockDownload,
        remove: mockRemove,
      };

      const mockPluginsBucket = {
        upload: mockUpload,
      };

      (mockSupabase.storage.from as jest.Mock)
        .mockReturnValueOnce(mockTempBucket) // for download
        .mockReturnValueOnce(mockPluginsBucket) // for upload
        .mockReturnValueOnce(mockTempBucket); // for remove (deleteArtifact uses temp bucket)

      const result = await service.moveArtifact('temp-path', 'com.example.plugin', '1.0.0');

      expect(result).toHaveProperty('storagePath');
      expect(mockDownload).toHaveBeenCalledWith('temp-path');
      expect(mockUpload).toHaveBeenCalled();
      expect(mockRemove).toHaveBeenCalledWith(['temp-path']);
    });

    it('should throw error if download fails', async () => {
      const mockDownload = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Download failed' },
      });

      const mockTempBucket = {
        download: mockDownload,
      };

      (mockSupabase.storage.from as jest.Mock).mockReturnValue(mockTempBucket);

      await expect(
        service.moveArtifact('temp-path', 'com.example.plugin', '1.0.0'),
      ).rejects.toThrow('Failed to download source file');
    });
  });

  describe('deleteArtifact', () => {
    it('should delete an artifact', async () => {
      const mockRemove = jest.fn().mockResolvedValue({
        data: {},
        error: null,
      });

      const mockBucket = {
        remove: mockRemove,
      };

      (mockSupabase.storage.from as jest.Mock).mockReturnValue(mockBucket);

      await service.deleteArtifact('test-path', 'plugins');

      expect(mockRemove).toHaveBeenCalledWith(['test-path']);
    });

    it('should throw error if delete fails', async () => {
      const mockRemove = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Delete failed' },
      });

      const mockBucket = {
        remove: mockRemove,
      };

      (mockSupabase.storage.from as jest.Mock).mockReturnValue(mockBucket);

      await expect(
        service.deleteArtifact('test-path', 'plugins'),
      ).rejects.toThrow('Artifact deletion failed');
    });
  });

  describe('calculateChecksum', () => {
    it('should calculate SHA-256 checksum', async () => {
      const buffer = Buffer.from('test content');
      const checksum = await service.calculateChecksum(buffer);

      // This is the correct SHA-256 hash of "test content"
      expect(checksum).toBe('6ae8a75555209fd6c44157c0aed8016e763ff435a19cf186f76863140143ff72');
    });
  });

  describe('uploadIcon', () => {
    it('should upload a new icon', async () => {
      const mockUpload = jest.fn().mockResolvedValue({
        data: { path: 'icons/test.png' },
        error: null,
      });

      const mockBucket = {
        upload: mockUpload,
      };

      (mockSupabase.storage.from as jest.Mock).mockReturnValue(mockBucket);
      (axios.post as jest.Mock).mockRejectedValue(new Error('Not found')); // getSignedUrl will fail

      const iconData = Buffer.from('png-data');
      const iconName = 'test.png';
      const iconKey = 'test-icon-key';

      const result = await service.uploadIcon(iconData, iconName, iconKey);

      expect(result).toBe('test-icon-key.png');
      expect(mockUpload).toHaveBeenCalledWith(
        'test-icon-key.png',
        iconData,
        expect.objectContaining({
          contentType: 'image/png',
        }),
      );
    });

    it('should reuse existing icon if it exists', async () => {
      const mockUpload = jest.fn().mockResolvedValue({
        data: { path: 'icons/test.png' },
        error: null,
      });

      const mockBucket = {
        upload: mockUpload,
      };

      (mockSupabase.storage.from as jest.Mock).mockReturnValue(mockBucket);
      (axios.post as jest.Mock).mockResolvedValue({
        data: { signedURL: '/test-icon-key.png' },
      });

      const iconData = Buffer.from('png-data');
      const iconName = 'test.png';
      const iconKey = 'test-icon-key';

      const result = await service.uploadIcon(iconData, iconName, iconKey);

      expect(result).toBe('test-icon-key.png');
      expect(mockUpload).not.toHaveBeenCalled(); // Should not upload if exists
    });

    it('should detect correct content type for jpg', async () => {
      const mockUpload = jest.fn().mockResolvedValue({
        data: { path: 'icons/test.jpg' },
        error: null,
      });

      const mockBucket = {
        upload: mockUpload,
      };

      (mockSupabase.storage.from as jest.Mock).mockReturnValue(mockBucket);
      (axios.post as jest.Mock).mockRejectedValue(new Error('Not found'));

      const iconData = Buffer.from('jpg-data');
      const iconName = 'test.jpg';
      const iconKey = 'test-icon-key';

      await service.uploadIcon(iconData, iconName, iconKey);

      expect(mockUpload).toHaveBeenCalledWith(
        'test-icon-key.jpg',
        iconData,
        expect.objectContaining({
          contentType: 'image/jpeg',
        }),
      );
    });

    it('should detect correct content type for svg', async () => {
      const mockUpload = jest.fn().mockResolvedValue({
        data: { path: 'icons/test.svg' },
        error: null,
      });

      const mockBucket = {
        upload: mockUpload,
      };

      (mockSupabase.storage.from as jest.Mock).mockReturnValue(mockBucket);
      (axios.post as jest.Mock).mockRejectedValue(new Error('Not found'));

      const iconData = Buffer.from('svg-data');
      const iconName = 'test.svg';
      const iconKey = 'test-icon-key';

      await service.uploadIcon(iconData, iconName, iconKey);

      expect(mockUpload).toHaveBeenCalledWith(
        'test-icon-key.svg',
        iconData,
        expect.objectContaining({
          contentType: 'image/svg+xml',
        }),
      );
    });
  });
});
