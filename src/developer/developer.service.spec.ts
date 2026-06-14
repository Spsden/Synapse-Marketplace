import { BadRequestException } from '@nestjs/common';
import { DeveloperService } from './developer.service';

describe('DeveloperService', () => {
  const pluginsService = {
    submitPlugin: jest.fn(),
  };
  const synxPackageService = {
    extractPackage: jest.fn(),
  };
  const storageService = {
    uploadArtifact: jest.fn(),
    uploadIcon: jest.fn(),
    calculateChecksum: jest.fn(),
    deleteArtifact: jest.fn(),
  };

  let service: DeveloperService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DeveloperService(
      pluginsService as never,
      synxPackageService as never,
      storageService as never,
    );
  });

  it('rejects a multipart packageId that differs from manifest.id before upload', async () => {
    synxPackageService.extractPackage.mockResolvedValue({
      manifest: {
        id: 'com.synapse.notion',
        name: 'Notion',
        version: '1.0.2',
      },
      jsCode: 'synapse.register("add_to_notion", async () => {});',
      iconData: null,
      iconName: null,
    });

    await expect(
      service.submitPluginSynx(
        {
          fieldname: 'file',
          originalname: 'notion.synx',
          encoding: '7bit',
          mimetype: 'application/zip',
          size: 3,
          buffer: Buffer.from('zip'),
        } as Express.Multer.File,
        'com.notion.add',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(storageService.uploadArtifact).not.toHaveBeenCalled();
    expect(storageService.uploadIcon).not.toHaveBeenCalled();
    expect(pluginsService.submitPlugin).not.toHaveBeenCalled();
  });

  it('requires an uploaded file and packageId', async () => {
    await expect(
      service.submitPluginSynx(undefined as never, 'com.synapse.notion'),
    ).rejects.toThrow('A .synx file is required.');
    await expect(
      service.submitPluginSynx(
        {
          buffer: Buffer.from('zip'),
        } as Express.Multer.File,
        ' ',
      ),
    ).rejects.toThrow('packageId is required.');
  });
});
