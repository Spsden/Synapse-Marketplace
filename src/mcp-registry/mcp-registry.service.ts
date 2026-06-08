import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  McpRegistryEntryResponseDto,
  McpRegistryReviewItemDto,
  McpRegistrySnapshotResponseDto,
  ReviewMcpRegistrySubmissionRequestDto,
  SubmitMcpRegistryServerRequestDto,
} from '../common/dto';
import {
  CreateMcpRegistryEntryDto,
  CreateMcpRegistrySubmissionDto,
  McpRegistryEntry,
  McpRegistrySubmission,
} from '../common/entities/mcp-registry.entity';
import {
  McpRegistryChangeType,
  McpRegistryReviewDecision,
  McpRegistrySubmissionStatus,
} from '../common/enums/mcp-registry-submission-status.enum';
import {
  InvalidTransitionException,
  PluginStoreException,
  ResourceNotFoundException,
} from '../common/exceptions';
import { McpRegistryEntriesRepository } from './mcp-registry-entries.repository';
import { McpRegistrySubmissionsRepository } from './mcp-registry-submissions.repository';

@Injectable()
export class McpRegistryService {
  private readonly logger = new Logger(McpRegistryService.name);

  constructor(
    private readonly entriesRepository: McpRegistryEntriesRepository,
    private readonly submissionsRepository: McpRegistrySubmissionsRepository,
  ) {}

  async getPublishedRegistrySnapshot(): Promise<McpRegistrySnapshotResponseDto> {
    const entries = await this.entriesRepository.listPublished();
    const updatedAt = entries.reduce<Date | null>((latest, entry) => {
      if (!latest || entry.updatedAt > latest) {
        return entry.updatedAt;
      }
      return latest;
    }, null);

    return new McpRegistrySnapshotResponseDto({
      version: '1',
      updatedAt: (updatedAt ?? new Date()).toISOString(),
      servers: entries.map((entry) => this.toResponse(entry)),
    });
  }

  async listPublishedEntries(): Promise<McpRegistryEntryResponseDto[]> {
    const entries = await this.entriesRepository.listPublished();
    return entries.map((entry) => this.toResponse(entry));
  }

  async getPublishedEntry(serverId: string): Promise<McpRegistryEntryResponseDto> {
    const entry = await this.entriesRepository.findByServerId(serverId);
    if (!entry) {
      throw new ResourceNotFoundException('McpRegistryEntry', 'serverId', serverId);
    }
    return this.toResponse(entry);
  }

  async submitServerDefinition(
    dto: SubmitMcpRegistryServerRequestDto,
  ): Promise<McpRegistryReviewItemDto> {
    const openSubmission = await this.submissionsRepository.findOpenByServerId(
      dto.serverId,
    );
    if (openSubmission) {
      throw new PluginStoreException(
        `An MCP registry submission for serverId ${dto.serverId} is already pending review.`,
        HttpStatus.CONFLICT,
      );
    }

    const existingEntry = await this.entriesRepository.findByServerId(dto.serverId);
    const submission = await this.submissionsRepository.create(
      this.buildSubmissionDto(dto, existingEntry),
    );

    this.logger.log(
      `Created MCP registry submission ${submission.id} for serverId ${submission.serverId}`,
    );

    return this.toReviewItem(submission);
  }

  async getReviewQueue(): Promise<McpRegistryReviewItemDto[]> {
    const submissions = await this.submissionsRepository.findInReviewQueue();
    return submissions.map((submission) => this.toReviewItem(submission));
  }

  async submitReviewDecision(
    submissionId: string,
    dto: ReviewMcpRegistrySubmissionRequestDto,
  ): Promise<void> {
    const submission = await this.submissionsRepository.findById(submissionId);
    if (!submission) {
      throw new ResourceNotFoundException(
        'McpRegistrySubmission',
        'id',
        submissionId,
      );
    }

    if (!this.canReview(submission.status)) {
      throw new InvalidTransitionException(
        `Submission status is ${submission.status}, cannot transition to ${dto.decision}`,
      );
    }

    switch (dto.decision) {
      case McpRegistryReviewDecision.PUBLISH:
        await this.handlePublishDecision(submission, dto);
        return;
      case McpRegistryReviewDecision.REJECT:
        await this.handleRejectDecision(submission, dto);
        return;
    }
  }

  private buildSubmissionDto(
    dto: SubmitMcpRegistryServerRequestDto,
    existingEntry: McpRegistryEntry | null,
  ): CreateMcpRegistrySubmissionDto {
    return {
      serverId: dto.serverId,
      targetEntryId: existingEntry?.id ?? null,
      changeType: existingEntry
        ? McpRegistryChangeType.UPDATE
        : McpRegistryChangeType.NEW,
      displayName: dto.displayName,
      description: dto.description ?? null,
      currentVersion: dto.currentVersion,
      maintainerName: dto.maintainerName,
      maintainerKind: dto.maintainerKind,
      trustLevel: dto.trustLevel,
      documentationUrl: dto.documentationUrl ?? null,
      source: dto.source,
      auth: dto.auth ?? null,
      tools: [...dto.tools],
      runtimeTargets: [...dto.runtimeTargets],
      platforms: [...dto.platforms],
      desktop: dto.desktop ?? null,
      cloud: dto.cloud ?? null,
      capabilities: dto.capabilities ?? null,
      submissionNotes: dto.submissionNotes ?? null,
      createdBy: dto.createdBy,
    };
  }

  private async handlePublishDecision(
    submission: McpRegistrySubmission,
    dto: ReviewMcpRegistrySubmissionRequestDto,
  ): Promise<void> {
    const publishedAt = new Date();
    let entryId = submission.targetEntryId ?? null;

    if (submission.targetEntryId) {
      await this.entriesRepository.update(
        submission.targetEntryId,
        this.buildEntryDto(submission, submission.createdBy, dto.reviewedBy, publishedAt),
      );
      entryId = submission.targetEntryId;
    } else {
      const created = await this.entriesRepository.create(
        this.buildEntryDto(submission, submission.createdBy, dto.reviewedBy, publishedAt),
      );
      entryId = created.id;
    }

    await this.submissionsRepository.update(submission.id, {
      targetEntryId: entryId,
      status: McpRegistrySubmissionStatus.APPROVED,
      reviewedBy: dto.reviewedBy,
      reviewNotes: dto.reviewNotes ?? null,
      reviewedAt: new Date(),
    });

    this.logger.log(
      `Published MCP registry submission ${submission.id} as entry ${entryId}`,
    );
  }

  private async handleRejectDecision(
    submission: McpRegistrySubmission,
    dto: ReviewMcpRegistrySubmissionRequestDto,
  ): Promise<void> {
    await this.submissionsRepository.update(submission.id, {
      status: McpRegistrySubmissionStatus.REJECTED,
      reviewedBy: dto.reviewedBy,
      reviewNotes: dto.reviewNotes ?? null,
      reviewedAt: new Date(),
    });

    this.logger.warn(`Rejected MCP registry submission ${submission.id}`);
  }

  private buildEntryDto(
    submission: McpRegistrySubmission,
    createdBy: string,
    updatedBy: string,
    publishedAt: Date,
  ): CreateMcpRegistryEntryDto {
    return {
      serverId: submission.serverId,
      displayName: submission.displayName,
      description: submission.description ?? null,
      currentVersion: submission.currentVersion,
      maintainerName: submission.maintainerName,
      maintainerKind: submission.maintainerKind,
      trustLevel: submission.trustLevel,
      documentationUrl: submission.documentationUrl ?? null,
      source: submission.source,
      auth: submission.auth ?? null,
      tools: [...submission.tools],
      runtimeTargets: [...submission.runtimeTargets],
      platforms: [...submission.platforms],
      desktop: submission.desktop ?? null,
      cloud: submission.cloud ?? null,
      capabilities: submission.capabilities ?? null,
      createdBy,
      updatedBy,
      publishedAt,
    };
  }

  private canReview(status: McpRegistrySubmissionStatus): boolean {
    return (
      status === McpRegistrySubmissionStatus.SUBMITTED ||
      status === McpRegistrySubmissionStatus.PENDING_REVIEW
    );
  }

  private toResponse(entry: McpRegistryEntry): McpRegistryEntryResponseDto {
    return new McpRegistryEntryResponseDto({
      id: entry.id,
      serverId: entry.serverId,
      displayName: entry.displayName,
      description: entry.description ?? null,
      currentVersion: entry.currentVersion,
      maintainerName: entry.maintainerName,
      maintainerKind: entry.maintainerKind,
      trustLevel: entry.trustLevel,
      documentationUrl: entry.documentationUrl ?? null,
      source: entry.source,
      auth: entry.auth ?? null,
      tools: [...entry.tools],
      runtimeTargets: [...entry.runtimeTargets],
      platforms: [...entry.platforms],
      desktop: entry.desktop ?? null,
      cloud: entry.cloud ?? null,
      capabilities: entry.capabilities ?? null,
      publishedAt: entry.publishedAt,
    });
  }

  private toReviewItem(
    submission: McpRegistrySubmission,
  ): McpRegistryReviewItemDto {
    return new McpRegistryReviewItemDto({
      id: submission.id,
      serverId: submission.serverId,
      targetEntryId: submission.targetEntryId ?? null,
      changeType: submission.changeType,
      displayName: submission.displayName,
      currentVersion: submission.currentVersion,
      maintainerName: submission.maintainerName,
      createdBy: submission.createdBy,
      createdAt: submission.createdAt,
      status: submission.status,
    });
  }
}
