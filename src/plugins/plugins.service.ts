import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PluginResponse,
  PluginDetailResponse,
  PluginVersionResponse,
  PluginStatisticsResponse,
  PaginatedResponse,
} from '../common/dto';
import { Plugin, CreatePluginDto } from '../common/entities/plugin.entity';
import { PluginVersion } from '../common/entities/plugin-version.entity';
import { PluginStatus } from '../common/enums/plugin-status.enum';
import { PluginsRepository } from './plugins.repository';
import { PluginVersionsRepository } from './plugin-versions.repository';
import { StorageService } from '../storage/storage.service';
import {
  ResourceNotFoundException,
  InvalidVersionException,
  VersionConflictException,
} from '../common/exceptions';

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
 * Core service for plugin management operations.
 * Handles plugin submission, retrieval, and version compatibility logic.
 */
@Injectable()
export class PluginsService {
  private readonly logger = new Logger(PluginsService.name);
  private readonly defaultPageSize: number;
  private readonly maxPageSize: number;

  constructor(
    private readonly pluginsRepository: PluginsRepository,
    private readonly versionsRepository: PluginVersionsRepository,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
  ) {
    const paginationConfig = this.configService.get('app.pagination');
    this.defaultPageSize = paginationConfig.defaultPageSize;
    this.maxPageSize = paginationConfig.maxPageSize;
  }

  /**
   * Retrieves all published plugins, optionally filtered by category and search term.
   * Returns paginated results.
   */
  async listPublishedPlugins(
    category: string | undefined,
    search: string | undefined,
    page = 0,
    pageSize = this.defaultPageSize,
  ): Promise<PaginatedResponse<PluginResponse>> {
    this.logger.debug(`Listing published plugins - category: ${category}, search: ${search}`);

    // Cap page size
    const actualPageSize = Math.min(pageSize, this.maxPageSize);
    const start = page * actualPageSize;

    let plugins: Plugin[];

    if (search && search.trim().length > 0) {
      plugins = await this.pluginsRepository.searchPublishedPlugins(search, PluginStatus.PUBLISHED);
    } else if (category && category.trim().length > 0) {
      plugins = await this.pluginsRepository.findByCategoryAndStatus(category, PluginStatus.PUBLISHED);
    } else {
      plugins = await this.pluginsRepository.findByStatus(PluginStatus.PUBLISHED);
    }

    // Apply pagination
    const paginatedPlugins = plugins.slice(start, start + actualPageSize);
    const totalCount = plugins.length;
    const totalPages = Math.ceil(totalCount / actualPageSize);

    return {
      data: paginatedPlugins.map((p) => this.toPluginResponse(p)),
      total: totalCount,
      page,
      pageSize: actualPageSize,
      totalPages,
    };
  }

  /**
   * Retrieves a plugin by its package ID, returning the latest compatible version.
   */
  async getPluginByPackageId(packageId: string, appVersion?: string): Promise<PluginDetailResponse> {
    this.logger.debug(`Fetching plugin ${packageId} for app version ${appVersion || 'latest'}`);

    const plugin = await this.pluginsRepository.findByPackageId(packageId);
    if (!plugin || plugin.status !== PluginStatus.PUBLISHED) {
      throw new ResourceNotFoundException('Plugin', 'packageId', packageId);
    }

    let version: PluginVersion;

    if (appVersion) {
      // Find the latest compatible version
      const compatible = await this.versionsRepository.findLatestCompatibleVersion(
        plugin.id,
        appVersion,
      );
      if (!compatible) {
        throw new InvalidVersionException(
          `No compatible version found for plugin '${packageId}' with app version '${appVersion}'. ` +
            `The plugin requires a newer version of the app.`,
        );
      }
      version = compatible;
    } else {
      // Get the latest published version
      if (!plugin.latestVersionId) {
        throw new ResourceNotFoundException(
          'PluginVersion',
          'id',
          '<none>',
        );
      }
      const latest = await this.versionsRepository.findById(plugin.latestVersionId);
      if (!latest) {
        throw new InvalidVersionException(
          'No published version available for plugin: ' + packageId,
        );
      }
      version = latest;
    }

    // Increment download count asynchronously
    this.incrementDownloadCount(version.id).catch((err) => {
      this.logger.error(`Failed to increment download count: ${err.message}`);
    });

    return await this.toPluginDetailResponse(plugin, version);
  }

  /**
   * Submits a new plugin or a new version of an existing plugin.
   */
  async submitPlugin(
    packageId: string,
    name: string,
    description: string,
    author: string,
    iconKey: string | undefined,
    category: string | undefined,
    tags: string | undefined,
    sourceUrl: string | undefined,
    version: string,
    manifest: Record<string, any>,
    minAppVersion: string,
    releaseNotes: string | undefined,
    storagePath: string | undefined,
    storageBucket: string | undefined,
    tempStoragePath: string | undefined,
    fileSizeBytes: number | undefined,
    checksumSha256: string | undefined,
  ): Promise<PluginDetailResponse> {
    this.logger.log(`Submitting plugin ${packageId} version ${version}`);

    let plugin = await this.pluginsRepository.findByPackageId(packageId);

    if (!plugin) {
      // Create new plugin
      const createDto: CreatePluginDto = {
        packageId,
        name,
        description,
        author,
        iconKey,
        category,
        tags,
        sourceUrl,
      };
      plugin = await this.pluginsRepository.create(createDto);
      this.logger.log(`Created new plugin ${packageId}`);
    } else {
      // Check if this version already exists
      const existing = await this.versionsRepository.findByPluginIdAndVersion(
        plugin.id,
        version,
      );
      if (existing) {
        this.logger.warn(`Version ${version} already exists for plugin ${packageId}`);
        throw new VersionConflictException(packageId, version);
      }
    }

    // Create the new version
    const versionData = await this.versionsRepository.create({
      pluginId: plugin.id,
      version,
      manifest,
      minAppVersion,
      releaseNotes,
      storagePath,
      storageBucket,
      tempStoragePath,
      fileSizeBytes,
      checksumSha256,
    });

    // Update plugin status to PENDING_REVIEW if it was SUBMITTED
    if (plugin.status === PluginStatus.SUBMITTED) {
      plugin = await this.pluginsRepository.update(plugin.id, {
        status: PluginStatus.PENDING_REVIEW,
      });
    }

    this.logger.log(`Successfully submitted version ${version} of plugin ${packageId}`);

    return await this.toPluginDetailResponse(plugin, versionData);
  }

  /**
   * Submits a plugin with storage upload.
   */
  async submitPluginWithStorage(
    file: Express.Multer.File,
    packageId: string,
    manifest: Record<string, any>,
    jsCode: string,
    name: string,
    description: string,
    author: string,
    minAppVersion: string,
  ): Promise<PluginDetailResponse> {
    this.logger.log(`Submitting plugin ${packageId} with storage upload`);

    const version = manifest.version || '1.0.0';

    // Check for duplicates before any storage operations
    const plugin = await this.pluginsRepository.findByPackageId(packageId);
    if (plugin) {
      const existing = await this.versionsRepository.findByPluginIdAndVersion(
        plugin.id,
        version,
      );
      if (existing) {
        this.logger.warn(`Version ${version} already exists for plugin ${packageId}`);
        throw new VersionConflictException(packageId, version);
      }
    }

    // Upload artifact to storage
    const uploadResult = await this.storageService.uploadArtifact(
      file.buffer,
      file.mimetype,
      packageId,
      version,
    );
    this.logger.log(`Uploaded artifact to TEMP storage: ${uploadResult.tempPath}`);

    // Create database records
    return await this.submitPlugin(
      packageId,
      name,
      description,
      author,
      undefined, // iconKey - will be set separately if needed
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
  }

  /**
   * Retrieves all versions of a plugin.
   */
  async getPluginVersions(packageId: string): Promise<PluginVersionResponse[]> {
    this.logger.debug(`Fetching versions for plugin ${packageId}`);

    const plugin = await this.pluginsRepository.findByPackageId(packageId);
    if (!plugin) {
      throw new ResourceNotFoundException('Plugin', 'packageId', packageId);
    }

    const versions = await this.versionsRepository.findByPluginIdOrderByCreatedAtDesc(plugin.id);

    return versions.map((v) => this.toPluginVersionResponse(v));
  }

  /**
   * Retrieves a specific version by ID.
   */
  async getVersionById(versionId: string): Promise<PluginVersionResponse> {
    this.logger.debug(`Fetching version ${versionId}`);

    const version = await this.versionsRepository.findById(versionId);
    if (!version) {
      throw new ResourceNotFoundException('PluginVersion', 'id', versionId);
    }

    return this.toPluginVersionResponse(version);
  }

  /**
   * Increments the download count for a version.
   */
  async incrementDownloadCount(versionId: string): Promise<void> {
    await this.versionsRepository.incrementDownloadCount(versionId);
    this.logger.debug(`Incremented download count for version ${versionId}`);
  }

  /**
   * Retrieves statistics about a plugin.
   */
  async getPluginStatistics(packageId: string): Promise<PluginStatisticsResponse> {
    this.logger.debug(`Fetching statistics for plugin ${packageId}`);

    const plugin = await this.pluginsRepository.findByPackageId(packageId);
    if (!plugin) {
      throw new ResourceNotFoundException('Plugin', 'packageId', packageId);
    }

    const allVersions = await this.versionsRepository.findByPluginIdOrderByCreatedAtDesc(plugin.id);
    const totalDownloads = allVersions.reduce((sum, v) => sum + v.downloadCount, 0);

    const publishedVersions = await this.versionsRepository.countByPluginIdAndStatus(
      plugin.id,
      'PUBLISHED' as any,
    );

    return new PluginStatisticsResponse(
      plugin.packageId,
      plugin.name,
      plugin.status,
      allVersions.length,
      publishedVersions,
      totalDownloads,
      plugin.createdAt,
      plugin.updatedAt,
    );
  }

  // ===== Private helper methods =====

  private toPluginResponse(plugin: Plugin): PluginResponse {
    return new PluginResponse(
      plugin.id,
      plugin.packageId,
      plugin.name,
      plugin.description || null,
      plugin.author,
      plugin.iconKey || null,
      plugin.status,
      plugin.latestVersionId || null,
      plugin.category || null,
      plugin.tags || null,
      plugin.sourceUrl || null,
      plugin.createdAt,
      plugin.updatedAt,
    );
  }

  private async toPluginDetailResponse(
    plugin: Plugin,
    version: PluginVersion,
  ): Promise<PluginDetailResponse> {
    // Generate signed URL for download
    let downloadUrl: string | null = null;
    let expiresAt: number | null = null;

    const storagePath = version.storagePath;
    const storageBucket = version.storageBucket;

    if (storagePath && storageBucket) {
      try {
        const signedUrl = await this.storageService.getSignedUrl(storagePath, storageBucket);
        downloadUrl = signedUrl.signedUrl;
        expiresAt = signedUrl.expiresAt;
      } catch (error) {
        this.logger.warn(`Failed to generate signed URL for version ${version.id}: ${error.message}`);
      }
    }

    return new PluginDetailResponse(
      // Plugin metadata
      plugin.id,
      plugin.packageId,
      plugin.name,
      plugin.description || null,
      plugin.author,
      plugin.iconKey || null,
      plugin.status,
      plugin.category || null,
      plugin.tags || null,
      plugin.sourceUrl || null,
      plugin.createdAt,
      // Version details
      version.id,
      version.version,
      version.manifest,
      version.minAppVersion,
      version.releaseNotes || null,
      version.createdAt,
      version.downloadCount,
      // Download information
      downloadUrl,
      expiresAt,
      version.fileSizeBytes || null,
      version.checksumSha256 || null,
      storageBucket || null,
      storagePath || null,
    );
  }

  private toPluginVersionResponse(version: PluginVersion): PluginVersionResponse {
    return new PluginVersionResponse(
      version.id,
      version.pluginId,
      version.version,
      version.manifest,
      version.minAppVersion,
      version.releaseNotes || null,
      version.status,
      version.rejectionReason || null,
      version.reviewedBy || null,
      version.createdAt,
      version.reviewedAt || null,
      version.publishedAt || null,
      version.downloadCount,
      version.isFlagged,
      // Storage information
      version.storagePath || null,
      version.storageBucket || null,
      version.fileSizeBytes || null,
      version.checksumSha256 || null,
    );
  }
}
