import { PluginStatus } from '../enums/plugin-status.enum';

/**
 * Combined response DTO containing plugin metadata and version details.
 * Returned when fetching a specific plugin for download/use.
 *
 * Uses Supabase Storage signed URLs for artifact downloads.
 */
export class PluginDetailResponse {
  constructor(
    // ===== Plugin metadata =====
    public id: string,
    public packageId: string,
    public name: string,
    public description: string | null,
    public author: string,
    public iconKey: string | null,
    public status: PluginStatus,
    public category: string | null,
    public tags: string | null,
    public sourceUrl: string | null,
    public pluginCreatedAt: Date,

    // ===== Version details =====
    public versionId: string,
    public version: string,
    public manifest: Record<string, any>,
    public minAppVersion: string,
    public releaseNotes: string | null,
    public versionCreatedAt: Date,
    public downloadCount: number,

    // ===== Download information (Supabase Storage) =====
    /** Signed URL for downloading the .synx artifact from Supabase Storage */
    public downloadUrl: string | null,

    /** Expiration timestamp of the signed URL (Unix epoch seconds) */
    public expiresAt: number | null,

    /** Size of the artifact file in bytes */
    public fileSizeBytes: number | null,

    /** SHA-256 checksum for integrity verification */
    public checksumSha256: string | null,

    /** Storage bucket where the artifact is located */
    public storageBucket: string | null,

    /** Storage path within the bucket */
    public storagePath: string | null,
  ) {}
}
