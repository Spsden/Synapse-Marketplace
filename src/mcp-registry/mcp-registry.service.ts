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
      version: '2',
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
    this.validateServerDefinition(dto);
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
      schemaVersion: dto.schemaVersion ?? 1,
      upstream: dto.upstream ?? null,
      upstreamHash: dto.upstreamHash ?? null,
      authProfiles: dto.authProfiles ? [...dto.authProfiles] : [],
      artifacts: dto.artifacts ? [...dto.artifacts] : [],
      deployments: dto.deployments
        ? [...dto.deployments]
        : this.buildLegacyDeployments(dto),
      capabilityCatalog: dto.capabilityCatalog ?? {
        tools: [...dto.tools],
      },
      cloudCertification: dto.cloudCertification ?? null,
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
      schemaVersion: submission.schemaVersion,
      upstream: submission.upstream ?? null,
      upstreamHash: submission.upstreamHash ?? null,
      authProfiles: [...submission.authProfiles],
      artifacts: [...submission.artifacts],
      deployments: [...submission.deployments],
      capabilityCatalog: submission.capabilityCatalog,
      cloudCertification: submission.cloudCertification ?? null,
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
      schemaVersion: entry.schemaVersion,
      upstream: entry.upstream ?? null,
      upstreamHash: entry.upstreamHash ?? null,
      authProfiles: [...entry.authProfiles],
      artifacts: [...entry.artifacts],
      deployments: [...entry.deployments],
      capabilityCatalog: entry.capabilityCatalog,
      cloudCertification: entry.cloudCertification ?? null,
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

  private validateServerDefinition(dto: SubmitMcpRegistryServerRequestDto): void {
    if ((dto.schemaVersion ?? 1) !== 2) {
      return;
    }

    if (!dto.deployments?.length) {
      throw new PluginStoreException(
        'MCP registry schema v2 requires at least one deployment.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const artifactIds = new Set<string>();
    for (const [index, artifact] of (dto.artifacts ?? []).entries()) {
      const id = this.readRequiredString(artifact, 'id', `artifacts[${index}]`);
      if (artifactIds.has(id)) {
        throw new PluginStoreException(
          `Duplicate MCP artifact id "${id}".`,
          HttpStatus.BAD_REQUEST,
        );
      }
      artifactIds.add(id);

      const runtime = this.readRequiredString(
        artifact,
        'runtime',
        `artifacts[${index}]`,
      );
      if (runtime !== 'node') {
        throw new PluginStoreException(
          `Unsupported MCP artifact runtime "${runtime}". Only Node artifacts are accepted.`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const deploymentIds = new Set<string>();
    for (const [index, deployment] of dto.deployments.entries()) {
      const path = `deployments[${index}]`;
      const id = this.readRequiredString(deployment, 'id', path);
      if (deploymentIds.has(id)) {
        throw new PluginStoreException(
          `Duplicate MCP deployment id "${id}".`,
          HttpStatus.BAD_REQUEST,
        );
      }
      deploymentIds.add(id);

      const kind = this.readRequiredString(deployment, 'kind', path);
      const supportedKinds = [
        'remote-http',
        'node-stdio',
        'synapse-cloud-node',
      ];
      if (!supportedKinds.includes(kind)) {
        throw new PluginStoreException(
          `Unsupported Marketplace deployment kind "${kind}".`,
          HttpStatus.BAD_REQUEST,
        );
      }

      if (kind === 'remote-http') {
        const url = this.readRequiredString(deployment, 'url', path);
        if (!url.startsWith('https://')) {
          throw new PluginStoreException(
            `${path}.url must use HTTPS.`,
            HttpStatus.BAD_REQUEST,
          );
        }
      } else {
        const artifactId = this.readRequiredString(deployment, 'artifactId', path);
        if (!artifactIds.has(artifactId)) {
          throw new PluginStoreException(
            `${path} references unknown artifact "${artifactId}".`,
            HttpStatus.BAD_REQUEST,
          );
        }
      }
    }
  }

  private readRequiredString(
    value: Record<string, unknown>,
    key: string,
    path: string,
  ): string {
    const result = value[key];
    if (typeof result !== 'string' || result.trim().length === 0) {
      throw new PluginStoreException(
        `${path}.${key} is required.`,
        HttpStatus.BAD_REQUEST,
      );
    }
    return result;
  }

  private buildLegacyDeployments(
    dto: SubmitMcpRegistryServerRequestDto,
  ): Record<string, unknown>[] {
    const deployments: Record<string, unknown>[] = [];
    const sourceType = dto.source?.type;
    const sourceUrl = dto.source?.url;

    if (
      sourceType === 'remote-http' &&
      typeof sourceUrl === 'string' &&
      sourceUrl.startsWith('https://')
    ) {
      deployments.push({
        id: 'provider-remote',
        kind: 'remote-http',
        runtimeTarget: 'provider-remote',
        transport: 'streamable-http',
        url: sourceUrl,
        platforms: [...dto.platforms],
        priority: 10,
      });
    }

    if (dto.desktop) {
      deployments.push({
        id: 'desktop-node',
        kind: 'node-stdio',
        runtimeTarget: 'desktop-node',
        platforms: dto.platforms.filter((platform) =>
          ['macos', 'windows', 'linux'].includes(platform),
        ),
        config: dto.desktop,
        priority: 20,
      });
    }

    if (dto.cloud) {
      deployments.push({
        id: 'legacy-cloud',
        kind: 'legacy-cloud-worker',
        runtimeTarget: 'cloud-worker',
        platforms: [...dto.platforms],
        config: dto.cloud,
        priority: 30,
      });
    }

    return deployments;
  }
}
