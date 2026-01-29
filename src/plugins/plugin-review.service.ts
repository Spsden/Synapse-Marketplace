import { Injectable, Logger } from '@nestjs/common';
import { PluginsRepository } from './plugins.repository';
import { PluginVersionsRepository } from './plugin-versions.repository';
import { StorageService } from '../storage/storage.service';
import { PluginStatus } from '../common/enums/plugin-status.enum';
import { VersionStatus, ReviewDecision } from '../common/enums/version-status.enum';
import { PluginReviewItem } from '../common/dto';
import { ReviewDecisionRequestDto } from '../common/dto';
import { ResourceNotFoundException, InvalidTransitionException } from '../common/exceptions';
import { Plugin } from '../common/entities/plugin.entity';
import { PluginVersion } from '../common/entities/plugin-version.entity';

/**
 * Service for plugin review and security vetting operations.
 * Handles the workflow for approving or rejecting plugin versions.
 */
@Injectable()
export class PluginReviewService {
  private readonly logger = new Logger(PluginReviewService.name);

  constructor(
    private readonly pluginsRepository: PluginsRepository,
    private readonly versionsRepository: PluginVersionsRepository,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Retrieves all plugin versions currently in the review queue.
   */
  async getReviewQueue(): Promise<PluginReviewItem[]> {
    this.logger.debug('Fetching review queue');

    const versions = await this.versionsRepository.findVersionsInReviewQueue();

    // Map to review items, fetching parent plugin info
    const result: PluginReviewItem[] = [];

    for (const version of versions) {
      const plugin = await this.pluginsRepository.findById(version.pluginId);
      result.push(
        new PluginReviewItem(
          version.id,
          version.pluginId,
          plugin?.packageId || 'unknown',
          plugin?.name || 'Unknown',
          plugin?.description || '',
          version.version,
          plugin?.author || 'Unknown',
          version.createdAt,
          version.status,
          version.isFlagged,
          version.flagReason || null,
        ),
      );
    }

    return result;
  }

  /**
   * Submits a review decision for a plugin version.
   */
  async submitReviewDecision(versionId: string, decision: ReviewDecisionRequestDto): Promise<void> {
    this.logger.log(
      `Processing review decision for version ${versionId}: ${decision.decision} by ${decision.reviewedBy}`,
    );

    const version = await this.getVersionForReview(versionId);
    const plugin = await this.pluginsRepository.findById(version.pluginId);

    if (!plugin) {
      throw new ResourceNotFoundException('Plugin', 'id', version.pluginId);
    }

    // Validate state transition
    if (!this.isValidTransition(version.status, decision.decision)) {
      throw new InvalidTransitionException(
        `Version status is ${version.status}, cannot transition to ${decision.decision}`,
      );
    }

    // Perform automated safety check before allowing publication
    if (decision.decision === ReviewDecision.PUBLISH) {
      if (!this.performAutomatedSafetyCheck(version)) {
        throw new InvalidTransitionException(
          'Automated safety check failed. Please review the code for security issues.',
        );
      }
    }

    // Update version status based on decision
    switch (decision.decision) {
      case ReviewDecision.PUBLISH:
        await this.handlePublishDecision(version, plugin, decision.reviewedBy);
        break;

      case ReviewDecision.REJECT:
        await this.handleRejectDecision(version, plugin, decision);
        break;
    }
  }

  /**
   * Flags a plugin version for security violations.
   */
  async flagVersion(versionId: string, reason: string, flaggedBy: string): Promise<void> {
    this.logger.warn(`Flagging version ${versionId} for security: ${reason} by ${flaggedBy}`);

    const version = await this.getVersionForReview(versionId);
    const plugin = await this.pluginsRepository.findById(version.pluginId);

    if (!plugin) {
      throw new ResourceNotFoundException('Plugin', 'id', version.pluginId);
    }

    await this.versionsRepository.update(versionId, {
      isFlagged: true,
      flagReason: reason,
      status: VersionStatus.FLAGGED,
    });

    // Clear the latest version reference if this was the published version
    if (versionId === plugin.latestVersionId) {
      await this.pluginsRepository.update(plugin.id, {
        latestVersionId: null,
        status: PluginStatus.REJECTED,
      });
    }
  }

  /**
   * Unflags a previously flagged version.
   */
  async unflagVersion(versionId: string): Promise<void> {
    this.logger.log(`Unflagging version ${versionId}`);

    const version = await this.getVersionForReview(versionId);
    await this.versionsRepository.update(versionId, {
      isFlagged: false,
      flagReason: null,
    });
  }

  /**
   * Performs automated safety checks on a plugin version.
   * Currently a placeholder that always passes.
   */
  performAutomatedSafetyCheck(version: PluginVersion): boolean {
    this.logger.debug(`Performing automated safety check on version ${version.id}`);

    // ============================================================
    // CURRENT: Placeholder implementation - always passes
    // ============================================================

    // ============================================================
    // FUTURE: Extensible security checks (architected for addition)
    // ============================================================

    // 1. Regex-based dangerous code pattern detection
    // 2. Domain blacklist validation
    // 3. Code size validation
    // 4. Obfuscation detection

    return true;
  }

  /**
   * Validates that a review decision is valid for the current version status.
   */
  isValidTransition(currentStatus: VersionStatus, decision: ReviewDecision): boolean {
    switch (currentStatus) {
      case VersionStatus.SUBMITTED:
      case VersionStatus.PENDING_REVIEW:
        return true; // Can publish or reject
      case VersionStatus.PUBLISHED:
      case VersionStatus.REJECTED:
      case VersionStatus.FLAGGED:
        return false; // Cannot re-review
      default:
        return false;
    }
  }

  /**
   * Retrieves detailed information about a version for review.
   */
  async getVersionForReview(versionId: string): Promise<PluginVersion> {
    const version = await this.versionsRepository.findById(versionId);
    if (!version) {
      throw new ResourceNotFoundException('PluginVersion', 'id', versionId);
    }
    return version;
  }

  // ===== Private helper methods =====

  private async handlePublishDecision(
    version: PluginVersion,
    plugin: Plugin,
    reviewedBy: string,
  ): Promise<void> {
    // Move artifact from temp to permanent storage
    if (version.tempStoragePath) {
      try {
        const moveResult = await this.storageService.moveArtifact(
          version.tempStoragePath,
          plugin.packageId,
          version.version,
        );

        await this.versionsRepository.update(version.id, {
          storagePath: moveResult.storagePath,
          storageBucket: 'plugins', // Will be set from config in production
          tempStoragePath: null,
        });

        this.logger.log(
          `Moved artifact from temp to permanent: ${version.tempStoragePath} -> ${moveResult.storagePath}`,
        );
      } catch (error) {
        this.logger.error(`Failed to move artifact for version ${version.id}: ${error.message}`);
        throw new Error('Failed to move artifact to permanent storage');
      }
    }

    // Update version status
    await this.versionsRepository.update(version.id, {
      status: VersionStatus.PUBLISHED,
      reviewedAt: new Date(),
      reviewedBy,
      rejectionReason: null,
      publishedAt: new Date(),
    });

    // Update parent plugin to point to this version as latest
    await this.pluginsRepository.update(plugin.id, {
      latestVersionId: version.id,
      status: PluginStatus.PUBLISHED,
    });

    this.logger.log(`Published version ${version.version} of plugin ${plugin.packageId}`);
  }

  private async handleRejectDecision(
    version: PluginVersion,
    plugin: Plugin,
    decision: ReviewDecisionRequestDto,
  ): Promise<void> {
    // Delete artifact from temp storage
    if (version.tempStoragePath) {
      try {
        await this.storageService.deleteArtifact(version.tempStoragePath, 'temp_uploads');
        this.logger.log(`Deleted rejected artifact from temp storage: ${version.tempStoragePath}`);
      } catch (error) {
        this.logger.error(`Failed to delete temp artifact for version ${version.id}: ${error.message}`);
        // Don't fail the rejection if cleanup fails - log and continue
      }
    }

    // Update version status
    await this.versionsRepository.update(version.id, {
      status: VersionStatus.REJECTED,
      reviewedAt: new Date(),
      reviewedBy: decision.reviewedBy,
      rejectionReason: decision.rejectionReason,
      tempStoragePath: null,
    });

    // If this was the latest version, clear the reference
    if (version.id === plugin.latestVersionId) {
      // Try to find another published version
      const publishedVersions = await this.versionsRepository.findPublishedVersions(plugin.id);
      if (publishedVersions.length === 0) {
        await this.pluginsRepository.update(plugin.id, {
          latestVersionId: null,
          status: PluginStatus.REJECTED,
        });
      } else {
        await this.pluginsRepository.update(plugin.id, {
          latestVersionId: publishedVersions[0].id,
        });
      }
    }

    this.logger.log(
      `Rejected version ${version.version} of plugin ${plugin.packageId}. Reason: ${decision.rejectionReason}`,
    );
  }
}
