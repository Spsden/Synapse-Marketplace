import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  UseInterceptors,
  UploadedFile,
  UsePipes,
  ValidationPipe,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { DeveloperService } from './developer.service';
import { PluginDetailResponse } from '../common/dto/plugin-detail-response.dto';
import { OAuthProvider } from '../common/enums/oauth-provider.enum';

/**
 * Developer API controller for plugin submissions.
 * Endpoints for developers to upload and manage their plugins.
 *
 * Base path: /api/v1/dev
 */
@ApiTags('Developer')
@Controller('dev')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class DeveloperController {
  constructor(private readonly developerService: DeveloperService) {}

  /**
   * Submits a new plugin or a new version of an existing plugin via .synx file upload.
   *
   * .synx Format (ZIP archive):
   * - manifest.json (Required): Metadata, permissions, configuration
   * - plugin.js (Required): The JavaScript code
   * - icon.png (Optional): 128x128px icon
   * - README.md (Optional): Documentation
   */
  @Post('plugins/submit')
  @ApiOperation({
    summary: 'Submit a plugin via .synx file',
    description:
      'Uploads a .synx package containing manifest.json and plugin.js. Extracts, validates, and stores the plugin artifact.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'The .synx package file',
        },
        packageId: {
          type: 'string',
          description: 'Package identifier (e.g., com.synapse.tictic)',
        },
      },
      required: ['file', 'packageId'],
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async submitPluginSynx(
    @UploadedFile() file: Express.Multer.File,
    @Body('packageId') packageId: string,
  ): Promise<PluginDetailResponse> {
    return this.developerService.submitPluginSynx(file, packageId);
  }

  // ============================================================
  // OAuth Credentials Management Endpoints
  // ============================================================

  /**
   * Submit OAuth credentials for a plugin.
   *
   * Developers submit their OAuth client ID and secret for each provider
   * their plugin needs to authenticate with.
   */
  @Post('plugins/oauth/credentials')
  @ApiOperation({
    summary: 'Submit OAuth credentials for a plugin',
    description: `Register OAuth client credentials (client_id, client_secret) for a plugin
                 to authenticate with a specific provider (e.g., Notion, Google, GitHub).
                 Credentials are encrypted at rest.`,
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        plugin_id: {
          type: 'string',
          description: 'Plugin ID (UUID)',
        },
        provider: {
          type: 'string',
          description: 'OAuth provider name',
          enum: Object.values(OAuthProvider),
        },
        client_id: {
          type: 'string',
          description: 'OAuth client ID from provider',
        },
        client_secret: {
          type: 'string',
          description: 'OAuth client secret from provider',
        },
        redirect_url: {
          type: 'string',
          description: 'OAuth redirect URL registered with provider',
        },
        scopes: {
          type: 'array',
          items: { type: 'string' },
          description: 'OAuth scopes to request',
        },
        created_by: {
          type: 'string',
          description: 'Developer user ID',
        },
      },
      required: ['plugin_id', 'provider', 'client_id', 'client_secret', 'redirect_url', 'created_by'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'OAuth credentials stored successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 409, description: 'Credentials already exist for this plugin/provider' })
  async submitOAuthCredentials(@Body() body: {
    plugin_id: string;
    provider: OAuthProvider;
    client_id: string;
    client_secret: string;
    redirect_url: string;
    scopes?: string[];
    created_by: string;
  }) {
    return this.developerService.submitOAuthCredentials(body);
  }

  /**
   * Get OAuth credentials for a plugin.
   */
  @Get('plugins/:pluginId/oauth/credentials')
  @ApiOperation({
    summary: 'Get OAuth credentials for a plugin',
    description: 'Retrieve all OAuth credentials for a plugin (secret is not returned).',
  })
  @ApiParam({ name: 'pluginId', description: 'Plugin ID (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'OAuth credentials retrieved successfully',
  })
  async getOAuthCredentials(@Param('pluginId') pluginId: string) {
    return this.developerService.getOAuthCredentials(pluginId);
  }

  /**
   * Update OAuth credentials for a plugin.
   */
  @Put('plugins/oauth/credentials/:credentialId')
  @ApiOperation({
    summary: 'Update OAuth credentials',
    description: 'Update OAuth credentials for a plugin. Only non-null fields are updated.',
  })
  @ApiParam({ name: 'credentialId', description: 'Credential ID (UUID)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        client_id: { type: 'string' },
        client_secret: { type: 'string' },
        redirect_url: { type: 'string' },
        scopes: { type: 'array', items: { type: 'string' } },
        is_active: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'OAuth credentials updated successfully',
  })
  async updateOAuthCredentials(
    @Param('credentialId') credentialId: string,
    @Body() body: {
      client_id?: string;
      client_secret?: string;
      redirect_url?: string;
      scopes?: string[];
      is_active?: boolean;
    },
  ) {
    return this.developerService.updateOAuthCredentials(credentialId, body);
  }

  /**
   * Deactivate OAuth credentials for a plugin.
   */
  @Delete('plugins/oauth/credentials/:credentialId')
  @ApiOperation({
    summary: 'Deactivate OAuth credentials',
    description: 'Deactivate (soft delete) OAuth credentials for a plugin.',
  })
  @ApiParam({ name: 'credentialId', description: 'Credential ID (UUID)' })
  @ApiResponse({ status: 204, description: 'OAuth credentials deactivated successfully' })
  async deactivateOAuthCredentials(@Param('credentialId') credentialId: string): Promise<void> {
    return this.developerService.deactivateOAuthCredentials(credentialId);
  }
}
