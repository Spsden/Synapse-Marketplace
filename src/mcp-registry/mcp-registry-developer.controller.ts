import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ImportOfficialMcpServerRequestDto,
  McpRegistryReviewItemDto,
  SubmitMcpRegistryServerRequestDto,
} from '../common/dto';
import { McpRegistryService } from './mcp-registry.service';
import { MarketplaceDeveloperGuard } from '../common/guards/marketplace-api-token.guard';

@ApiTags('Developer', 'MCP Registry')
@Controller('dev/mcp')
@UseGuards(MarketplaceDeveloperGuard)
export class McpRegistryDeveloperController {
  constructor(private readonly mcpRegistryService: McpRegistryService) {}

  @Post('servers/submit')
  @ApiOperation({
    summary: 'Submit a new MCP server definition for registry review',
    description:
      'Creates a reviewed MCP registry submission. Synapse admins can later approve it into the published registry.',
  })
  async submitServerDefinition(
    @Body() body: SubmitMcpRegistryServerRequestDto,
  ): Promise<McpRegistryReviewItemDto> {
    return this.mcpRegistryService.submitServerDefinition(body);
  }

  @Post('servers/import-official')
  @ApiOperation({
    summary: 'Import official MCP server.json with a Synapse review overlay',
    description:
      'Converts official remote and npm stdio metadata into a schema v2 submission. Python and unresolved command inputs are rejected.',
  })
  async importOfficialServerDefinition(
    @Body() body: ImportOfficialMcpServerRequestDto,
  ): Promise<McpRegistryReviewItemDto> {
    return this.mcpRegistryService.importOfficialServerDefinition(body);
  }
}
