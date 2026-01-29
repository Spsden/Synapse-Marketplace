import { Injectable, Logger, Inject } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import {
  PluginVersion,
  CreatePluginVersionDto,
} from '../common/entities/plugin-version.entity';
import { VersionStatus } from '../common/enums/version-status.enum';
import * as crypto from 'crypto';

/**
 * Repository for PluginVersion entity using Supabase.
 * Provides data access methods for plugin version operations.
 */
@Injectable()
export class PluginVersionsRepository {
  private readonly logger = new Logger(PluginVersionsRepository.name);
  private readonly supabase: SupabaseClient;

  constructor(@Inject(ConfigService) private configService: ConfigService) {
    const supabaseConfig = this.configService.get('supabase');
    this.supabase = createClient(supabaseConfig.projectUrl, supabaseConfig.serviceRoleKey, {
      auth: { persistSession: false },
    });
  }

  /**
   * Find all versions for a specific plugin, ordered by creation date.
   */
  async findByPluginIdOrderByCreatedAtDesc(pluginId: string): Promise<PluginVersion[]> {
    const { data } = await this.supabase
      .from('plugin_versions')
      .select('*')
      .eq('plugin_id', pluginId)
      .order('created_at', { ascending: false });

    return (data || []).map((item) => this.mapToEntity(item));
  }

  /**
   * Find a specific version by plugin ID and version string.
   */
  async findByPluginIdAndVersion(
    pluginId: string,
    version: string,
  ): Promise<PluginVersion | null> {
    const { data, error } = await this.supabase
      .from('plugin_versions')
      .select('*')
      .eq('plugin_id', pluginId)
      .eq('version', version)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapToEntity(data);
  }

  /**
   * Check if a version exists for the given plugin.
   */
  async existsByPluginIdAndVersion(pluginId: string, version: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('plugin_versions')
      .select('id')
      .eq('plugin_id', pluginId)
      .eq('version', version)
      .single();

    return !error && !!data;
  }

  /**
   * Find all versions with a specific status.
   */
  async findByStatus(status: VersionStatus): Promise<PluginVersion[]> {
    const { data } = await this.supabase
      .from('plugin_versions')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: true });

    return (data || []).map((item) => this.mapToEntity(item));
  }

  /**
   * Find versions in the review queue (SUBMITTED or PENDING_REVIEW).
   */
  async findVersionsInReviewQueue(): Promise<PluginVersion[]> {
    const { data } = await this.supabase
      .from('plugin_versions')
      .select('*')
      .in('status', [VersionStatus.SUBMITTED, VersionStatus.PENDING_REVIEW])
      .order('created_at', { ascending: true });

    return (data || []).map((item) => this.mapToEntity(item));
  }

  /**
   * Find the latest published version for a plugin.
   */
  async findPublishedVersions(pluginId: string): Promise<PluginVersion[]> {
    const { data } = await this.supabase
      .from('plugin_versions')
      .select('*')
      .eq('plugin_id', pluginId)
      .eq('status', VersionStatus.PUBLISHED)
      .order('created_at', { ascending: false });

    return (data || []).map((item) => this.mapToEntity(item));
  }

  /**
   * Find the latest compatible version for a given plugin and app version.
   * Returns the newest published version where min_app_version <= requested_app_version.
   */
  async findLatestCompatibleVersion(
    pluginId: string,
    appVersion: string,
  ): Promise<PluginVersion | null> {
    // Using a raw query with proper version comparison
    const { data } = await this.supabase.rpc('find_latest_compatible_version', {
      p_plugin_id: pluginId,
      p_app_version: appVersion,
    });

    if (!data) {
      return null;
    }

    // Handle both single object and array responses
    const result = Array.isArray(data) ? data[0] : data;
    return result ? this.mapToEntity(result) : null;
  }

  /**
   * Find flagged versions for security review.
   */
  async findFlaggedVersions(): Promise<PluginVersion[]> {
    const { data } = await this.supabase
      .from('plugin_versions')
      .select('*')
      .eq('is_flagged', true)
      .order('created_at', { ascending: false });

    return (data || []).map((item) => this.mapToEntity(item));
  }

  /**
   * Count versions by status for a plugin.
   */
  async countByPluginIdAndStatus(
    pluginId: string,
    status: VersionStatus,
  ): Promise<number> {
    const { count, error } = await this.supabase
      .from('plugin_versions')
      .select('*', { count: 'exact', head: true })
      .eq('plugin_id', pluginId)
      .eq('status', status);

    if (error) {
      return 0;
    }

    return count || 0;
  }

  /**
   * Create a new plugin version.
   */
  async create(dto: CreatePluginVersionDto): Promise<PluginVersion> {
    const newVersion = {
      id: crypto.randomUUID(),
      plugin_id: dto.pluginId,
      version: dto.version,
      storage_path: dto.storagePath || null,
      storage_bucket: dto.storageBucket || null,
      temp_storage_path: dto.tempStoragePath || null,
      file_size_bytes: dto.fileSizeBytes || null,
      checksum_sha256: dto.checksumSha256 || null,
      manifest: dto.manifest,
      min_app_version: dto.minAppVersion,
      release_notes: dto.releaseNotes || null,
      status: VersionStatus.SUBMITTED,
      download_count: 0,
      is_flagged: false,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('plugin_versions')
      .insert(newVersion)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create plugin version: ${error.message}`);
    }

    return this.mapToEntity(data);
  }

  /**
   * Update an existing plugin version.
   */
  async update(id: string, updates: Partial<PluginVersion>): Promise<PluginVersion> {
    const updateData: any = {};

    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.storagePath !== undefined) updateData.storage_path = updates.storagePath;
    if (updates.storageBucket !== undefined) updateData.storage_bucket = updates.storageBucket;
    if (updates.tempStoragePath !== undefined) updateData.temp_storage_path = updates.tempStoragePath;
    if (updates.rejectionReason !== undefined) updateData.rejection_reason = updates.rejectionReason;
    if (updates.reviewedBy !== undefined) updateData.reviewed_by = updates.reviewedBy;
    if (updates.reviewedAt !== undefined) updateData.reviewed_at = updates.reviewedAt?.toISOString();
    if (updates.publishedAt !== undefined) updateData.published_at = updates.publishedAt?.toISOString();
    if (updates.downloadCount !== undefined) updateData.download_count = updates.downloadCount;
    if (updates.isFlagged !== undefined) updateData.is_flagged = updates.isFlagged;
    if (updates.flagReason !== undefined) updateData.flag_reason = updates.flagReason;

    const { data, error } = await this.supabase
      .from('plugin_versions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update plugin version: ${error.message}`);
    }

    return this.mapToEntity(data);
  }

  /**
   * Find a version by ID.
   */
  async findById(id: string): Promise<PluginVersion | null> {
    const { data, error } = await this.supabase
      .from('plugin_versions')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapToEntity(data);
  }

  /**
   * Increment download count for a version.
   */
  async incrementDownloadCount(id: string): Promise<void> {
    await this.supabase.rpc('increment_download_count', { p_version_id: id });
  }

  /**
   * Map database row to PluginVersion entity.
   */
  private mapToEntity(data: any): PluginVersion {
    return {
      id: data.id,
      pluginId: data.plugin_id,
      version: data.version,
      storagePath: data.storage_path,
      storageBucket: data.storage_bucket,
      tempStoragePath: data.temp_storage_path,
      fileSizeBytes: data.file_size_bytes,
      checksumSha256: data.checksum_sha256,
      manifest: data.manifest || {},
      minAppVersion: data.min_app_version,
      releaseNotes: data.release_notes,
      status: data.status as VersionStatus,
      rejectionReason: data.rejection_reason,
      reviewedBy: data.reviewed_by,
      createdAt: new Date(data.created_at),
      reviewedAt: data.reviewed_at ? new Date(data.reviewed_at) : undefined,
      publishedAt: data.published_at ? new Date(data.published_at) : undefined,
      downloadCount: data.download_count || 0,
      isFlagged: data.is_flagged || false,
      flagReason: data.flag_reason,
    };
  }
}
