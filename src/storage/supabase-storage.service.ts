import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';
import axios, { AxiosError } from 'axios';
import { StorageService, ArtifactUploadResult, SignedUrlResult } from './storage.service';
import { SupabaseUrls } from '../config/supabase.config';

/**
 * Implementation of StorageService using Supabase Storage REST API.
 *
 * This service:
 * - Uploads .synx files to Supabase Storage
 * - Generates signed URLs for secure downloads
 * - Manages file lifecycle (move, delete)
 * - Calculates SHA-256 checksums for integrity verification
 */
@Injectable()
export class SupabaseStorageService extends StorageService {
  private readonly logger = new Logger(SupabaseStorageService.name);
  private readonly supabase: SupabaseClient;
  private readonly projectUrl: string;
  private readonly anonKey: string;
  private readonly serviceRoleKey: string;
  private readonly signedUrlTtlSeconds: number;
  private readonly pluginsBucket: string;
  private readonly iconsBucket: string;
  private readonly tempUploadsBucket: string;

  constructor(@Inject(ConfigService) private configService: ConfigService) {
    super();

    const supabaseConfig = this.configService.get('supabase');
    this.projectUrl = supabaseConfig.projectUrl;
    this.anonKey = supabaseConfig.anonKey;
    this.serviceRoleKey = supabaseConfig.serviceRoleKey;
    this.signedUrlTtlSeconds = supabaseConfig.signedUrlTtlSeconds;
    this.pluginsBucket = supabaseConfig.pluginsBucket;
    this.iconsBucket = supabaseConfig.iconsBucket;
    this.tempUploadsBucket = supabaseConfig.tempUploadsBucket;

    // Initialize Supabase client with service role key for admin operations
    this.supabase = createClient(this.projectUrl, this.serviceRoleKey, {
      auth: { persistSession: false },
    });
  }

  /**
   * Uploads a plugin artifact buffer to Supabase Storage.
   */
  async uploadArtifact(
    buffer: Buffer,
    contentType: string,
    packageId: string,
    version: string,
  ): Promise<ArtifactUploadResult> {
    try {
      // 1. Calculate checksum
      const checksum = await this.calculateChecksum(buffer);

      // 2. Build storage path
      const storagePath = this.getArtifactPath(packageId, version);

      // 3. Upload to temp-uploads first
      const tempPath = `temp_${Date.now()}/${storagePath}`;

      const { error } = await this.supabase.storage
        .from(this.tempUploadsBucket)
        .upload(tempPath, buffer, {
          contentType,
          upsert: true,
          cacheControl: 'public, max-age=31536000, immutable',
        });

      if (error) {
        this.logger.error(`Failed to upload artifact: ${error.message}`);
        throw new Error(`Artifact upload failed: ${error.message}`);
      }

      this.logger.log(`Uploaded artifact to temp storage: ${tempPath}`);

      return {
        storagePath,
        bucket: this.tempUploadsBucket,
        fileSizeBytes: buffer.length,
        checksumSha256: checksum,
        contentType,
        tempPath,
      };
    } catch (error) {
      this.logger.error(`Failed to upload artifact: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Generates a signed URL for secure file download.
   */
  async getSignedUrl(storagePath: string, bucket: string): Promise<SignedUrlResult> {
    if (!storagePath || storagePath.trim().length === 0) {
      throw new Error('Storage path cannot be null or empty');
    }

    const actualBucket = bucket || this.pluginsBucket;

//quite a big problem here.
// so when request comnes to generate a signed url for a plugin from bucket 
// this.pluginsBucket, the url formed is 
// ""https://vdgiktjrprjxfkrrmjdp.supabase.co/storage/v1/object/sign/plugins/plugins/com.synapse.test/v1.0.0/plugin.synx""
// two plugins i.e plugins/plugins in the url

// but for




    try {
      // Use Supabase REST API to create signed URL
      const url = SupabaseUrls.getSignUrl(this.projectUrl);
      const signUrl = `${url}/${actualBucket}/${storagePath}`;

      const response = await axios.post(
        signUrl,
        { expiresIn: this.signedUrlTtlSeconds },
        {
          headers: {
            Authorization: `Bearer ${this.anonKey}`,
            apikey: this.anonKey,
            'Content-Type': 'application/json',
          },
        },
      );

      if (response.data && response.data.signedURL) {
        const signedUrl = `${SupabaseUrls.getStorageUrl(this.projectUrl)}${response.data.signedURL}`;
        const expiresAt = Math.floor(Date.now() / 1000) + this.signedUrlTtlSeconds;

        return { signedUrl, expiresAt };
      }

      throw new Error('Invalid response from Supabase');
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        this.logger.error(
          `Failed to generate signed URL for ${storagePath}: ${axiosError.message}`,
          axiosError.response?.data,
        );
      } else {
        this.logger.error(`Failed to generate signed URL: ${error.message}`);
      }
      throw new Error('Signed URL generation failed');
    }
  }

  /**
   * Moves an artifact from temporary storage to permanent location.
   */
  async moveArtifact(
    sourcePath: string,
    packageId: string,
    version: string,
  ): Promise<{ storagePath: string }> {
    try {
      const targetPath = this.getArtifactPath(packageId, version);

      // Download from source
      const { data: sourceData, error: downloadError } = await this.supabase.storage
        .from(this.tempUploadsBucket)
        .download(sourcePath);

      if (downloadError) {
        throw new Error(`Failed to download source file: ${downloadError.message}`);
      }

      // Upload to target
      const { error: uploadError } = await this.supabase.storage
        .from(this.pluginsBucket)
        .upload(targetPath, sourceData, {
          contentType: 'application/zip',
          upsert: true,
          cacheControl: 'public, max-age=31536000, immutable',
        });

      if (uploadError) {
        throw new Error(`Failed to upload to permanent storage: ${uploadError.message}`);
      }

      // Delete from temp
      await this.deleteArtifact(sourcePath, this.tempUploadsBucket);

      this.logger.log(`Moved artifact from ${sourcePath} to ${targetPath}`);

      return { storagePath: targetPath };
    } catch (error) {
      this.logger.error(`Failed to move artifact: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Deletes an artifact from storage.
   */
  async deleteArtifact(storagePath: string, bucket: string): Promise<void> {
    try {
      this.logger.log(`Deleting artifact: ${bucket}/${storagePath}`);

      const { error } = await this.supabase.storage.from(bucket).remove([storagePath]);

      if (error) {
        this.logger.error(`Failed to delete artifact: ${error.message}`);
        throw new Error(`Artifact deletion failed: ${error.message}`);
      }

      this.logger.log(`Successfully deleted artifact: ${bucket}/${storagePath}`);
    } catch (error) {
      this.logger.error(`Failed to delete artifact ${bucket}/${storagePath}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calculates SHA-256 checksum of a buffer.
   */
  async calculateChecksum(buffer: Buffer): Promise<string> {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Uploads an icon from byte array to the icons bucket.
   */
  async uploadIcon(iconData: Buffer, iconName: string, iconKey: string): Promise<string> {
    const extension = iconName.includes('.') ? iconName.substring(iconName.lastIndexOf('.')) : '';
    const storagePath = `${iconKey}${extension}`;
    const contentType = this.detectContentType(iconName, extension);

    // Check if icon already exists (de-duplication)
    try {
      await this.getSignedUrl(storagePath, this.iconsBucket);
      this.logger.log(`Icon already exists, reusing: ${storagePath}`);
      return storagePath;
    } catch {
      // File doesn't exist, proceed with upload
      this.logger.debug(`Icon does not exist, uploading: ${storagePath}`);
    }

    const { error } = await this.supabase.storage
      .from(this.iconsBucket)
      .upload(storagePath, iconData, {
        contentType,
        upsert: true,
        cacheControl: 'public, max-age=31536000, immutable',
      });

    if (error) {
      this.logger.error(`Failed to upload icon: ${error.message}`);
      throw new Error(`Icon upload failed: ${error.message}`);
    }

    return storagePath;
  }

  /**
   * Detects content type based on icon filename/extension.
   */
  private detectContentType(_iconName: string, extension: string): string {
    const ext = extension.toLowerCase();
    switch (ext) {
      case '.png':
        return 'image/png';
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.svg':
        return 'image/svg+xml';
      case '.webp':
        return 'image/webp';
      case '.gif':
        return 'image/gif';
      default:
        this.logger.warn(`Unknown icon extension: ${ext}, using default`);
        return 'image/png';
    }
  }
}
