import { Test, TestingModule } from '@nestjs/testing';
import { SynxPackageService, SynxPackage } from './synx-package.service';
import AdmZip from 'adm-zip';

// Mock AdmZip module
jest.mock('adm-zip');

describe('SynxPackageService', () => {
  let service: SynxPackageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SynxPackageService],
    }).compile();

    service = module.get<SynxPackageService>(SynxPackageService);

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('extractPackage', () => {
    it('should extract a valid .synx package with manifest and plugin.js', async () => {
      const mockEntries = [
        {
          entryName: 'manifest.json',
          isDirectory: false,
          getData: jest.fn().mockReturnValue(
            Buffer.from(
              JSON.stringify({
                name: 'Test Plugin',
                version: '1.0.0',
                description: 'Test description',
              }),
            ),
          ),
        },
        {
          entryName: 'plugin.js',
          isDirectory: false,
          getData: jest.fn().mockReturnValue(Buffer.from('console.log("hello");')),
        },
      ];

      const mockZipInstance = {
        getEntries: jest.fn().mockReturnValue(mockEntries),
      };

      (AdmZip as jest.MockedClass<typeof AdmZip>).mockImplementation(() => mockZipInstance as any);

      const buffer = Buffer.from('zip-data');
      const result = await service.extractPackage(buffer);

      expect(result.manifest).toEqual({
        name: 'Test Plugin',
        version: '1.0.0',
        description: 'Test description',
      });
      expect(result.jsCode).toBe('console.log("hello");');
      expect(result.iconData).toBeUndefined();
      expect(result.readme).toBeUndefined();
    });

    it('should extract package with icon and readme', async () => {
      const iconBuffer = Buffer.from('png-data');

      const mockEntries = [
        {
          entryName: 'manifest.json',
          isDirectory: false,
          getData: jest.fn().mockReturnValue(
            Buffer.from(
              JSON.stringify({
                name: 'Test Plugin',
                version: '1.0.0',
              }),
            ),
          ),
        },
        {
          entryName: 'plugin.js',
          isDirectory: false,
          getData: jest.fn().mockReturnValue(Buffer.from('code')),
        },
        {
          entryName: 'icon.png',
          isDirectory: false,
          getData: jest.fn().mockReturnValue(iconBuffer),
        },
        {
          entryName: 'README.md',
          isDirectory: false,
          getData: jest.fn().mockReturnValue(Buffer.from('# Readme')),
        },
      ];

      const mockZipInstance = {
        getEntries: jest.fn().mockReturnValue(mockEntries),
      };

      (AdmZip as jest.MockedClass<typeof AdmZip>).mockImplementation(() => mockZipInstance as any);

      const buffer = Buffer.from('zip-data');
      const result = await service.extractPackage(buffer);

      expect(result.iconData).toEqual(iconBuffer);
      expect(result.iconName).toBe('icon.png');
      expect(result.readme).toBe('# Readme');
    });

    it('should throw error if manifest.json is missing', async () => {
      const mockEntries = [
        {
          entryName: 'plugin.js',
          isDirectory: false,
          getData: jest.fn().mockReturnValue(Buffer.from('code')),
        },
      ];

      const mockZipInstance = {
        getEntries: jest.fn().mockReturnValue(mockEntries),
      };

      (AdmZip as jest.MockedClass<typeof AdmZip>).mockImplementation(() => mockZipInstance as any);

      const buffer = Buffer.from('zip-data');

      await expect(service.extractPackage(buffer)).rejects.toThrow(
        "Required file 'manifest.json' not found in .synx package",
      );
    });

    it('should throw error if plugin.js is missing', async () => {
      const mockEntries = [
        {
          entryName: 'manifest.json',
          isDirectory: false,
          getData: jest.fn().mockReturnValue(
            Buffer.from(
              JSON.stringify({
                name: 'Test Plugin',
                version: '1.0.0',
              }),
            ),
          ),
        },
      ];

      const mockZipInstance = {
        getEntries: jest.fn().mockReturnValue(mockEntries),
      };

      (AdmZip as jest.MockedClass<typeof AdmZip>).mockImplementation(() => mockZipInstance as any);

      const buffer = Buffer.from('zip-data');

      await expect(service.extractPackage(buffer)).rejects.toThrow(
        "Required file 'plugin.js' not found in .synx package",
      );
    });

    it('should throw error for invalid zip', async () => {
      (AdmZip as jest.MockedClass<typeof AdmZip>).mockImplementation(() => {
        throw new Error('Invalid ZIP');
      });

      const buffer = Buffer.from('not-a-zip');

      await expect(service.extractPackage(buffer)).rejects.toThrow('File must be a valid ZIP archive');
    });

    it('should throw error for invalid manifest.json', async () => {
      const mockEntries = [
        {
          entryName: 'manifest.json',
          isDirectory: false,
          getData: jest.fn().mockReturnValue(Buffer.from('not valid json')),
        },
        {
          entryName: 'plugin.js',
          isDirectory: false,
          getData: jest.fn().mockReturnValue(Buffer.from('code')),
        },
      ];

      const mockZipInstance = {
        getEntries: jest.fn().mockReturnValue(mockEntries),
      };

      (AdmZip as jest.MockedClass<typeof AdmZip>).mockImplementation(() => mockZipInstance as any);

      const buffer = Buffer.from('zip-data');

      await expect(service.extractPackage(buffer)).rejects.toThrow('manifest.json is not valid JSON');
    });

    it('should throw error for manifest missing required name field', async () => {
      const mockEntries = [
        {
          entryName: 'manifest.json',
          isDirectory: false,
          getData: jest.fn().mockReturnValue(
            Buffer.from(
              JSON.stringify({
                version: '1.0.0',
              }),
            ),
          ),
        },
        {
          entryName: 'plugin.js',
          isDirectory: false,
          getData: jest.fn().mockReturnValue(Buffer.from('code')),
        },
      ];

      const mockZipInstance = {
        getEntries: jest.fn().mockReturnValue(mockEntries),
      };

      (AdmZip as jest.MockedClass<typeof AdmZip>).mockImplementation(() => mockZipInstance as any);

      const buffer = Buffer.from('zip-data');

      await expect(service.extractPackage(buffer)).rejects.toThrow(
        "manifest.json missing required field: 'name'",
      );
    });

    it('should throw error for manifest missing required version field', async () => {
      const mockEntries = [
        {
          entryName: 'manifest.json',
          isDirectory: false,
          getData: jest.fn().mockReturnValue(
            Buffer.from(
              JSON.stringify({
                name: 'Test Plugin',
              }),
            ),
          ),
        },
        {
          entryName: 'plugin.js',
          isDirectory: false,
          getData: jest.fn().mockReturnValue(Buffer.from('code')),
        },
      ];

      const mockZipInstance = {
        getEntries: jest.fn().mockReturnValue(mockEntries),
      };

      (AdmZip as jest.MockedClass<typeof AdmZip>).mockImplementation(() => mockZipInstance as any);

      const buffer = Buffer.from('zip-data');

      await expect(service.extractPackage(buffer)).rejects.toThrow(
        "manifest.json missing required field: 'version'",
      );
    });

    it('should detect zip slip vulnerability', async () => {
      const mockEntries = [
        {
          entryName: '../manifest.json',
          isDirectory: false,
          getData: jest.fn().mockReturnValue(Buffer.from('data')),
        },
        {
          entryName: 'plugin.js',
          isDirectory: false,
          getData: jest.fn().mockReturnValue(Buffer.from('code')),
        },
      ];

      const mockZipInstance = {
        getEntries: jest.fn().mockReturnValue(mockEntries),
      };

      (AdmZip as jest.MockedClass<typeof AdmZip>).mockImplementation(() => mockZipInstance as any);

      const buffer = Buffer.from('zip-data');

      await expect(service.extractPackage(buffer)).rejects.toThrow('Invalid file path in archive');
    });
  });

  describe('extractPackageFromFile', () => {
    it('should throw error for non-existent file', () => {
      expect(() => service.extractPackageFromFile('/non-existent/file.synx')).toThrow();
    });
  });
});
