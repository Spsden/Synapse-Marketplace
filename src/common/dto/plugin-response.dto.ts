import { PluginStatus } from '../enums/plugin-status.enum';

/**
 * Response DTO for plugin metadata.
 * Returned by public API endpoints when listing or fetching plugin details.
 */
export class PluginResponse {
  constructor(
    public id: string,
    public packageId: string,
    public name: string,
    public description: string | null,
    public author: string,
    public iconKey: string | null,
    public status: PluginStatus,
    public latestVersionId: string | null,
    public category: string | null,
    public tags: string | null,
    public sourceUrl: string | null,
    public createdAt: Date,
    public updatedAt: Date,
  ) {}
}

/**
 * Paginated response wrapper.
 */
export class PaginatedResponse<T> {
  constructor(
    public data: T[],
    public total: number,
    public page: number,
    public pageSize: number,
    public totalPages: number,
  ) {}
}
