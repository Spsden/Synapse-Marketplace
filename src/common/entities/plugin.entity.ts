import { PluginStatus } from '../enums/plugin-status.enum';

/**
 * Represents the index/master record for a plugin package.
 * This table stores the metadata and current status, while actual versions
 * are stored in the plugin_versions table.
 *
 * Table: plugins
 */
export interface Plugin {
  /** Primary key - UUID identifier for this plugin record. */
  id: string;

  /** Unique package identifier in reverse domain notation. */
  packageId: string;

  /** Human-readable display name for the plugin. */
  name: string;

  /** Detailed description of plugin functionality. */
  description?: string | null;

  /** Developer or organization name that created this plugin. */
  author: string;

  /** Storage key reference for the plugin icon asset. */
  iconKey?: string | null;

  /** Current workflow status of this plugin. */
  status: PluginStatus;

  /** Foreign key reference to the currently published version. */
  latestVersionId?: string | null;

  /** Primary category for plugin organization and filtering. */
  category?: string | null;

  /** Comma-separated list of tags for search and discovery. */
  tags?: string | null;

  /** URL to the plugin's documentation or source repository. */
  sourceUrl?: string | null;

  /** Timestamp when this plugin record was first created. */
  createdAt: Date;

  /** Timestamp when this record was last updated. */
  updatedAt: Date;

  /** Optimistic locking version to prevent concurrent modification conflicts. */
  version?: number;
}

/**
 * Input type for creating a new plugin.
 */
export interface CreatePluginDto {
  packageId: string;
  name: string;
  description?: string;
  author: string;
  iconKey?: string;
  category?: string;
  tags?: string;
  sourceUrl?: string;
}

/**
 * Input type for updating an existing plugin.
 */
export interface UpdatePluginDto {
  name?: string;
  description?: string | null;
  iconKey?: string | null;
  category?: string | null;
  tags?: string | null;
  sourceUrl?: string | null;
  status?: PluginStatus;
  latestVersionId?: string | null;
}
