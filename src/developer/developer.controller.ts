import { Controller, Post, UseInterceptors, UploadedFile, UsePipes, ValidationPipe, Body, Param } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { DeveloperService } from './developer.service';
import { PluginDetailResponse } from '../common/dto/plugin-detail-response.dto';

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
}
