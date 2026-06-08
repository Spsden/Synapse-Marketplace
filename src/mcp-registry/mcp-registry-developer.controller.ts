import { Body, Controller, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  McpRegistryReviewItemDto,
  SubmitMcpRegistryServerRequestDto,
} from '../common/dto';
import { McpRegistryService } from './mcp-registry.service';

@ApiTags('Developer', 'MCP Registry')
@Controller('dev/mcp')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
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
}
