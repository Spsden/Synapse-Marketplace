import { Readable } from 'stream';

/**
 * Interface for storage service operations.
 * Provides abstraction for file storage operations.
 */
export interface IStorageService {
  /**
   * Upload an artifact file to storage.
   * @param file - The file buffer to upload
   * @param filename - The name to give the file in storage
   * @param bucket - The storage bucket name
   * @returns Promise with storage path and checksum
   */
  uploadArtifact(
    file: Buffer,
    filename: string,
    bucket: string,
  ): Promise<{ storagePath: string; checksumSha256: string }>;

  /**
   * Get a signed URL for downloading a file.
   * @param storagePath - The path to the file in storage
   * @param bucket - The storage bucket name
   * @returns Promise with the signed URL
   */
  getSignedUrl(storagePath: string, bucket: string): Promise<string>;

  /**
   * Move an artifact from temporary to permanent storage.
   * @param tempPath - The temporary storage path
   * @param permanentPath - The permanent storage path
   * @param bucket - The storage bucket name
   * @returns Promise that resolves when the move is complete
   */
  moveArtifact(
    tempPath: string,
    permanentPath: string,
    bucket: string,
  ): Promise<void>;

  /**
   * Delete an artifact from storage.
   * @param storagePath - The path to the file in storage
   * @param bucket - The storage bucket name
   * @returns Promise that resolves when deletion is complete
   */
  deleteArtifact(storagePath: string, bucket: string): Promise<void>;

  /**
   * Calculate SHA-256 checksum of a buffer.
   * @param buffer - The buffer to calculate checksum for
   * @returns Promise with the hex-encoded checksum
   */
  calculateChecksum(buffer: Buffer): Promise<string>;

  /**
   * Upload an icon file to storage.
   * @param file - The file buffer to upload
   * @param filename - The name to give the file in storage
   * @returns Promise with the storage path
   */
  uploadIcon(file: Buffer, filename: string): Promise<string>;

  /**
   * Upload a file from a stream to storage.
   * @param stream - The readable stream to upload
   * @param filename - The name to give the file in storage
   * @param bucket - The storage bucket name
   * @returns Promise with the storage path
   */
  uploadFromStream(
    stream: Readable,
    filename: string,
    bucket: string,
  ): Promise<string>;
}

export const IStorageService = Symbol('IStorageService');
