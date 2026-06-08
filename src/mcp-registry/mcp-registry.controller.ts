import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
  McpRegistryEntryResponseDto,
  McpRegistrySnapshotResponseDto,
} from '../common/dto';
import { McpRegistryService } from './mcp-registry.service';

@ApiTags('MCP Registry')
@Controller('mcp')
export class McpRegistryController {
  constructor(private readonly mcpRegistryService: McpRegistryService) {}

  @Get('registry')
  @ApiOperation({
    summary: 'Get the published MCP registry snapshot',
    description:
      'Returns the current published runtime registry used by Synapse desktop and cloud runtimes.',
  })
  async getRegistry(): Promise<McpRegistrySnapshotResponseDto> {
    return this.mcpRegistryService.getPublishedRegistrySnapshot();
  }

  @Get('servers')
  @ApiOperation({
    summary: 'List published MCP registry entries',
    description:
      'Returns the published MCP server definitions in expanded form.',
  })
  async listPublishedServers(): Promise<McpRegistryEntryResponseDto[]> {
    return this.mcpRegistryService.listPublishedEntries();
  }

  @Get('servers/:serverId')
  @ApiOperation({
    summary: 'Get a published MCP registry entry by serverId',
  })
  @ApiParam({ name: 'serverId', description: 'Stable MCP registry server identifier' })
  async getPublishedServer(
    @Param('serverId') serverId: string,
  ): Promise<McpRegistryEntryResponseDto> {
    return this.mcpRegistryService.getPublishedEntry(serverId);
  }
}
