import { VersionStatus } from '../enums/version-status.enum';

/**
 * Where an ingested version was built from.
 *
 * Populated for versions built by the GitHub ingest path, where the artifact is
 * compiled from a pinned commit. Absent for legacy developer uploads.
 */
export interface PluginVersionSource {
  /** Source host, e.g. 'github'. */
  provider: string;

  /** Repository in `owner/name` form. */
  repository: string;

  /** Pinned commit the artifact was built from. */
  commitSha: string;

  /** Directory within the repository, e.g. 'plugins/notion'. */
  path: string;

  /** Per-file git blob SHAs used for the build (path -> sha). */
  blobShas: Record<string, string>;

  /** Raw upstream manifest as committed. */
  upstream: Record<string, any>;
}

/**
 * Represents a specific version release of a plugin.
 *
 * Table: plugin_versions
 *
 * Storage Approach:
 * - Plugin artifacts (.synx files) are stored in Supabase Storage
 * - This entity stores metadata and references to the storage location
 * - Clients download via signed URLs generated from storage path
 */
export interface PluginVersion {
  /** Primary key - UUID identifier for this specific version. */
  id: string;

  /** Foreign key reference to the parent plugin record. */
  pluginId: string;

  /** Semantic version string for this release. */
  version: string;

  /** Storage path within the bucket (e.g., "com.synapse.tictic/v1.0.0/plugin.synx") */
  storagePath?: string | null;

  /** Storage bucket name (e.g., "plugins") */
  storageBucket?: string | null;

  /** Temporary storage path (used before approval). */
  tempStoragePath?: string | null;

  /** Size of the artifact file in bytes. */
  fileSizeBytes?: number | null;

  /** SHA-256 checksum for integrity verification. */
  checksumSha256?: string | null;

  /** JSON document containing plugin configuration. */
  manifest: Record<string, any>;

  /** Minimum required version of the Synapse mobile app. */
  minAppVersion: string;

  /** Version-specific release notes from the developer. */
  releaseNotes?: string | null;

  /** Status of this specific version in the review workflow. */
  status: VersionStatus;

  /** Admin feedback message if this version was rejected. */
  rejectionReason?: string | null;

  /** Identifier of the admin who last reviewed this version. */
  reviewedBy?: string | null;

  /** Timestamp when this version was submitted. */
  createdAt: Date;

  /** Timestamp when this version was reviewed (null if not yet reviewed). */
  reviewedAt?: Date | null;

  /** Timestamp of when this version was published to the store. */
  publishedAt?: Date | null;

  /** Download count for this specific version. */
  downloadCount: number;

  /** Indicates if this version has been flagged for security issues. */
  isFlagged: boolean;

  /** Notes about why this version was flagged. */
  flagReason?: string | null;

  /** Provenance for versions built from a pinned source revision. */
  source?: PluginVersionSource | null;
}

/**
 * Input type for creating a new plugin version.
 */
export interface CreatePluginVersionDto {
  pluginId: string;
  version: string;
  manifest: Record<string, any>;
  minAppVersion: string;
  releaseNotes?: string;
  storagePath?: string;
  storageBucket?: string;
  tempStoragePath?: string;
  fileSizeBytes?: number;
  checksumSha256?: string;
  source?: PluginVersionSource;
}
