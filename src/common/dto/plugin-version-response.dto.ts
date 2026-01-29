import { VersionStatus } from '../enums/version-status.enum';

/**
 * Response DTO for plugin version details.
 * Includes download information for Supabase Storage.
 */
export class PluginVersionResponse {
  constructor(
    public id: string,
    public pluginId: string,
    public version: string,
    public manifest: Record<string, any>,
    public minAppVersion: string,
    public releaseNotes: string | null,
    public status: VersionStatus,
    public rejectionReason: string | null,
    public reviewedBy: string | null,
    public createdAt: Date,
    public reviewedAt: Date | null,
    public publishedAt: Date | null,
    public downloadCount: number,
    public isFlagged: boolean,
    // ===== Storage information (Supabase) =====
    public storagePath: string | null,
    public storageBucket: string | null,
    public fileSizeBytes: number | null,
    public checksumSha256: string | null,
  ) {}
}
