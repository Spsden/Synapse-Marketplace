import { Controller, Get, Patch, Post, Delete, Param, Query, Body, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { PluginReviewService } from '../plugins/plugin-review.service';
import { PluginReviewItem } from '../common/dto/plugin-review-item.dto';
import { ReviewDecisionRequestDto } from '../common/dto/review-decision-request.dto';

/**
 * Admin API controller for plugin review and management.
 * Endpoints for administrators to review, approve, and reject plugins.
 *
 * In production, these endpoints should be protected with authentication
 * and authorization (e.g., using guards).
 *
 * Base path: /api/v1/admin
 */
@ApiTags('Admin')
@Controller('admin')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class AdminController {
  constructor(private readonly reviewService: PluginReviewService) {}

  /**
   * Retrieves the review queue - all plugin versions awaiting review.
   */
  @Get('review-queue')
  @ApiOperation({
    summary: 'Get review queue',
    description:
      'Returns all plugin versions currently in the review queue (SUBMITTED or PENDING_REVIEW status), ordered by submission date.',
  })
  async getReviewQueue(): Promise<PluginReviewItem[]> {
    return this.reviewService.getReviewQueue();
  }

  /**
   * Submits a review decision for a plugin version.
   */
  @Patch('plugins/:versionId/verify')
  @ApiOperation({
    summary: 'Submit review decision',
    description:
      'Approves or rejects a plugin version. When approved, updates the plugin\'s latest_version_id. When rejected, stores the rejection reason.',
  })
  @ApiParam({ name: 'versionId', description: 'Version ID to review' })
  async submitReviewDecision(
    @Param('versionId') versionId: string,
    @Body() decision: ReviewDecisionRequestDto,
  ): Promise<void> {
    return this.reviewService.submitReviewDecision(versionId, decision);
  }

  /**
   * Flags a plugin version for security violations.
   */
  @Post('plugins/:versionId/flag')
  @ApiOperation({
    summary: 'Flag plugin for security',
    description: 'Flags a plugin version for security violations. Flagged versions are immediately removed from the marketplace.',
  })
  @ApiParam({ name: 'versionId', description: 'Version ID to flag' })
  @ApiQuery({ name: 'reason', description: 'Security violation reason', required: true })
  @ApiQuery({ name: 'flaggedBy', description: 'Admin identifier', required: true })
  async flagVersion(
    @Param('versionId') versionId: string,
    @Query('reason') reason: string,
    @Query('flaggedBy') flaggedBy: string,
  ): Promise<void> {
    return this.reviewService.flagVersion(versionId, reason, flaggedBy);
  }

  /**
   * Unflags a previously flagged version.
   */
  @Delete('plugins/:versionId/flag')
  @ApiOperation({
    summary: 'Unflag plugin',
    description: 'Removes security flag from a plugin version.',
  })
  @ApiParam({ name: 'versionId', description: 'Version ID to unflag' })
  async unflagVersion(@Param('versionId') versionId: string): Promise<void> {
    return this.reviewService.unflagVersion(versionId);
  }
}
