import { Injectable, Logger } from '@nestjs/common';
import { PluginsService } from '../plugins/plugins.service';
import { SynxPackageService } from '../storage/synx-package.service';
import { StorageService } from '../storage/storage.service';
import { PluginDetailResponse } from '../common/dto/plugin-detail-response.dto';

// Extend Express namespace for Multer types
declare global {
  namespace Express {
    interface Multer {
      File: {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        size: number;
        buffer: Buffer;
        destination?: string;
        filename?: string;
        path?: string;
      };
    }
  }
}

/**
 * Service for developer operations.
 * Handles plugin submissions from developers with proper error handling and cleanup.
 */
@Injectable()
export class DeveloperService {
  private readonly logger = new Logger(DeveloperService.name);

  constructor(
    private readonly pluginsService: PluginsService,
    private readonly synxPackageService: SynxPackageService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Submits a plugin via .synx file upload.
   *
   * @param file The .synx file
   * @param packageId Package identifier
   * @returns Plugin detail response
   */
  async submitPluginSynx(
    file: Express.Multer.File,
    packageId: string,
  ): Promise<PluginDetailResponse> {
    this.logger.log(`Received .synx submission: ${file.originalname} (${file.size} bytes)`);

    // Track uploaded resources for cleanup on failure
    const state: PartialUploadState = {
      packageId,
      uploadedIconKey: null,
      artifactUploadResult: null,
    };

    console.log("kanak")

    try {
      // 1. Extract and validate the .synx package
      const pkg = await this.synxPackageService.extractPackage(file.buffer);
      this.logger.log(
        `Extracted .synx package: manifest=${pkg.manifest.name}, jsCode=${pkg.jsCode.length} bytes`,
      );

      // 2. Get metadata from manifest
      const manifest = pkg.manifest;
      const version = manifest.version || '1.0.0';
      const name = manifest.name || packageId;
      const description = manifest.description || '';
      const author = manifest.author || 'Unknown';
      const minAppVersion = manifest.minAppVersion || '1.0.0';

      // 3. Upload icon if present
      if (pkg.iconData && pkg.iconName) {
        const iconHash = await this.storageService.calculateChecksum(pkg.iconData);
        const iconKey = await this.storageService.uploadIcon(pkg.iconData, pkg.iconName, iconHash);
        state.uploadedIconKey = iconKey;
        this.logger.log(`Uploaded icon: ${pkg.iconName} with key: ${iconKey}`);
      }

      // 4. Upload artifact to storage and create database records
      const uploadResult = await this.storageService.uploadArtifact(
        file.buffer,
        file.mimetype,
        packageId,
        version,
      );
      state.artifactUploadResult = uploadResult;
      this.logger.log(`Uploaded artifact to TEMP storage: ${uploadResult.tempPath}`);

      // 5. Create plugin and version records
      const response = await this.pluginsService.submitPlugin(
        packageId,
        name,
        description,
        author,
        state.uploadedIconKey || undefined,
        undefined, // category
        undefined, // tags
        undefined, // sourceUrl
        version,
        manifest,
        minAppVersion,
        undefined, // releaseNotes
        uploadResult.storagePath,
        uploadResult.bucket,
        uploadResult.tempPath,
        uploadResult.fileSizeBytes,
        uploadResult.checksumSha256,
      );

      // Clear state after successful submission
      this.clearState(state);

      this.logger.log(`Successfully submitted plugin ${packageId} version ${version}`);
      return response;
    } catch (error) {
      this.logger.error(`Failed to submit plugin: ${error.message}`, error.stack);
      await this.cleanupFailedUpload(state);
      throw error;
    }
  }

  /**
   * Cleanup method for compensating transaction.
   * Removes uploaded files if database operations fail.
   */
  private async cleanupFailedUpload(state: PartialUploadState): Promise<void> {
    this.logger.warn(`Cleanup triggered for failed submission of package: ${state.packageId}`);

    // Delete icon if uploaded
    if (state.uploadedIconKey) {
      try {
        await this.storageService.deleteArtifact(state.uploadedIconKey, 'icons');
        this.logger.log(`Cleaned up icon: ${state.uploadedIconKey}`);
      } catch (error) {
        this.logger.error(`Failed to cleanup icon ${state.uploadedIconKey}: ${error.message}`);
      }
    }

    // Delete temp artifact if still in temp storage
    if (state.artifactUploadResult?.tempPath) {
      try {
        await this.storageService.deleteArtifact(
          state.artifactUploadResult.tempPath,
          'temp_uploads',
        );
        this.logger.log(`Cleaned up temp artifact: ${state.artifactUploadResult.tempPath}`);
      } catch (error) {
        this.logger.error(
          `Failed to cleanup temp artifact ${state.artifactUploadResult.tempPath}: ${error.message}`,
        );
      }
    }
  }

  /**
   * Clears the state after successful completion.
   */
  private clearState(state: PartialUploadState): void {
    state.uploadedIconKey = null;
    state.artifactUploadResult = null;
  }
}

/**
 * Container for tracking partial upload state during execution.
 */
interface PartialUploadState {
  packageId: string;
  uploadedIconKey?: string | null;
  artifactUploadResult?: {
    tempPath: string;
  } | null;
}
