import { Injectable } from '@nestjs/common';

/**
 * Result of an artifact upload operation.
 */
export interface ArtifactUploadResult {
  storagePath: string;
  bucket: string;
  fileSizeBytes: number;
  checksumSha256: string;
  contentType: string;
  tempPath: string;
}

/**
 * Result of a signed URL generation.
 */
export interface SignedUrlResult {
  signedUrl: string;
  expiresAt: number;
}

/**
 * Service interface for Supabase Storage operations.
 *
 * This service handles:
 * - Uploading plugin artifacts (.synx files)
 * - Generating signed URLs for secure downloads
 * - Managing file lifecycle (move, delete)
 * - Calculating file checksums for integrity verification
 */
export abstract class StorageService {
  /**
   * Uploads a plugin artifact buffer to Supabase Storage.
   *
   * @param buffer The file buffer
   * @param contentType The MIME type
   * @param packageId The plugin package ID
   * @param version The version string
   * @returns Storage information including path and checksum
   */
  abstract uploadArtifact(
    buffer: Buffer,
    contentType: string,
    packageId: string,
    version: string,
  ): Promise<ArtifactUploadResult>;

  /**
   * Generates a signed URL for secure file download.
   *
   * @param storagePath The storage path of the file
   * @param bucket The bucket name
   * @returns Signed URL with expiry information
   */
  abstract getSignedUrl(storagePath: string, bucket: string): Promise<SignedUrlResult>;

  /**
   * Moves an artifact from temporary storage to permanent location.
   *
   * @param sourcePath Source path in temp storage
   * @param packageId Target package ID
   * @param version Target version
   */
  abstract moveArtifact(
    sourcePath: string,
    packageId: string,
    version: string,
  ): Promise<{ storagePath: string }>;

  /**
   * Deletes an artifact from storage.
   *
   * @param storagePath The path to the file
   * @param bucket The bucket name
   */
  abstract deleteArtifact(storagePath: string, bucket: string): Promise<void>;

  /**
   * Calculates SHA-256 checksum of a buffer.
   *
   * @param buffer The buffer to calculate checksum for
   * @returns Hex-encoded SHA-256 checksum
   */
  abstract calculateChecksum(buffer: Buffer): Promise<string>;

  /**
   * Uploads an icon from byte array to the icons bucket.
   *
   * @param iconData The icon data as buffer
   * @param iconName The icon filename
   * @param iconKey Unique key for the icon
   * @returns Storage path of the uploaded icon
   */
  abstract uploadIcon(iconData: Buffer, iconName: string, iconKey: string): Promise<string>;

  /**
   * Generates the standard storage path for a plugin artifact.
   *
   * @param packageId The plugin package ID
   * @param version The version string
   * @returns Storage path (e.g., "com.synapse.tictic/v1.0.0/plugin.synx")
   */
  getArtifactPath(packageId: string, version: string): string {
    return `${packageId}/v${version}/plugin.synx`;
  }
}
