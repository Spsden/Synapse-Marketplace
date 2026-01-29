import { Controller, Get, Param, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { PluginsService } from './plugins.service';
import {
  PluginResponse,
  PluginDetailResponse,
  PluginVersionResponse,
  PluginStatisticsResponse,
  PaginatedResponse,
} from '../common/dto';

/**
 * Public API controller for the Synapse Plugin Store.
 * Endpoints accessible by mobile apps and public users.
 * All endpoints return only PUBLISHED plugins.
 *
 * Base path: /api/v1/store
 */
@ApiTags('Store')
@Controller('store')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class StoreController {
  constructor(private readonly pluginsService: PluginsService) {}

  /**
   * Lists all published plugins with optional filtering and pagination.
   */
  @Get('plugins')
  @ApiOperation({
    summary: 'List published plugins',
    description:
      'Returns a paginated list of all published plugins. Can be filtered by category or search term.',
  })
  @ApiQuery({ name: 'category', required: false, description: 'Filter by category (e.g., PRODUCTIVITY, SOCIAL)' })
  @ApiQuery({ name: 'search', required: false, description: 'Search term for name and description' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (0-based)', example: 0 })
  @ApiQuery({ name: 'pageSize', required: false, description: 'Page size (max 100)', example: 20 })
  async listPlugins(
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('page') page = 0,
    @Query('pageSize') pageSize = 20,
  ): Promise<PaginatedResponse<PluginResponse>> {
    return this.pluginsService.listPublishedPlugins(category, search, Number(page), Number(pageSize));
  }

  /**
   * Retrieves a plugin by its package ID with version compatibility check.
   */
  @Get('plugins/:packageId')
  @ApiOperation({
    summary: 'Get plugin by package ID',
    description: 'Returns the plugin with the latest compatible version for the specified app version.',
  })
  @ApiParam({ name: 'packageId', description: 'Package ID in reverse domain notation (e.g., com.synapse.tictic)' })
  @ApiQuery({ name: 'appVersion', required: false, description: 'App version for compatibility check (e.g., 1.0.0)' })
  async getPlugin(
    @Param('packageId') packageId: string,
    @Query('appVersion') appVersion?: string,
  ): Promise<PluginDetailResponse> {
    return this.pluginsService.getPluginByPackageId(packageId, appVersion);
  }

  /**
   * Retrieves all versions of a plugin.
   */
  @Get('plugins/:packageId/versions')
  @ApiOperation({
    summary: 'Get plugin versions',
    description: 'Returns all versions of a plugin, ordered by creation date (newest first).',
  })
  @ApiParam({ name: 'packageId', description: 'Package ID in reverse domain notation' })
  async getPluginVersions(@Param('packageId') packageId: string): Promise<PluginVersionResponse[]> {
    return this.pluginsService.getPluginVersions(packageId);
  }

  /**
   * Retrieves a specific version by its ID.
   */
  @Get('versions/:versionId')
  @ApiOperation({
    summary: 'Get version by ID',
    description: 'Returns detailed information about a specific plugin version.',
  })
  @ApiParam({ name: 'versionId', description: 'Version UUID' })
  async getVersion(@Param('versionId') versionId: string): Promise<PluginVersionResponse> {
    return this.pluginsService.getVersionById(versionId);
  }

  /**
   * Retrieves statistics for a plugin.
   */
  @Get('plugins/:packageId/statistics')
  @ApiOperation({
    summary: 'Get plugin statistics',
    description: 'Returns statistics including download counts, version counts, and status.',
  })
  @ApiParam({ name: 'packageId', description: 'Package ID in reverse domain notation' })
  async getStatistics(@Param('packageId') packageId: string): Promise<PluginStatisticsResponse> {
    return this.pluginsService.getPluginStatistics(packageId);
  }
}
