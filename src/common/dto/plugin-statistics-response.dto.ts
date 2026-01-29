import { PluginStatus } from '../enums/plugin-status.enum';

/**
 * Response DTO for plugin statistics.
 * Contains download counts, version info, and publishing status.
 */
export class PluginStatisticsResponse {
  constructor(
    public packageId: string,
    public name: string,
    public status: PluginStatus,
    public totalVersions: number,
    public publishedVersions: number,
    public totalDownloads: number,
    public createdAt: Date,
    public updatedAt: Date,
  ) {}
}
