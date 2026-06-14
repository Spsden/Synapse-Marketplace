import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
  McpRegistryReviewItemDto,
  ReviewMcpRegistrySubmissionRequestDto,
} from '../common/dto';
import { McpRegistryService } from './mcp-registry.service';
import { MarketplaceAdminGuard } from '../common/guards/marketplace-api-token.guard';

@ApiTags('Admin', 'MCP Registry')
@Controller('admin/mcp')
@UseGuards(MarketplaceAdminGuard)
export class McpRegistryAdminController {
  constructor(private readonly mcpRegistryService: McpRegistryService) {}

  @Get('review-queue')
  @ApiOperation({
    summary: 'Get MCP registry submission review queue',
    description:
      'Returns MCP registry submissions that are awaiting admin review.',
  })
  async getReviewQueue(): Promise<McpRegistryReviewItemDto[]> {
    return this.mcpRegistryService.getReviewQueue();
  }

  @Patch('submissions/:submissionId/review')
  @ApiOperation({
    summary: 'Approve or reject an MCP registry submission',
  })
  @ApiParam({ name: 'submissionId', description: 'Submission ID to review' })
  async reviewSubmission(
    @Param('submissionId') submissionId: string,
    @Body() body: ReviewMcpRegistrySubmissionRequestDto,
  ): Promise<void> {
    await this.mcpRegistryService.submitReviewDecision(submissionId, body);
  }
}
