import { VersionStatus } from '../enums/version-status.enum';

/**
 * Response DTO for items in the admin review queue.
 * Contains summary information for pending plugin versions.
 */
export class PluginReviewItem {
  constructor(
    public id: string,
    public pluginId: string,
    public packageId: string,
    public name: string,
    public description: string,
    public version: string,
    public author: string,
    public createdAt: Date,
    public status: VersionStatus,
    public isFlagged: boolean,
    public flagReason: string | null,
  ) {}
}
