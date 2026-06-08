import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';
import {
  CreateMcpRegistrySubmissionDto,
  McpRegistrySubmission,
  UpdateMcpRegistrySubmissionDto,
} from '../common/entities/mcp-registry.entity';
import { McpRegistrySubmissionStatus } from '../common/enums/mcp-registry-submission-status.enum';

@Injectable()
export class McpRegistrySubmissionsRepository {
  private readonly supabase: SupabaseClient;

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {
    const supabaseConfig = this.configService.get('supabase');
    this.supabase = createClient(
      supabaseConfig.projectUrl,
      supabaseConfig.serviceRoleKey,
      { auth: { persistSession: false } },
    );
  }

  async findById(id: string): Promise<McpRegistrySubmission | null> {
    const { data, error } = await this.supabase
      .from('mcp_registry_submissions')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapToEntity(data);
  }

  async findOpenByServerId(serverId: string): Promise<McpRegistrySubmission | null> {
    const { data, error } = await this.supabase
      .from('mcp_registry_submissions')
      .select('*')
      .eq('server_id', serverId)
      .in('status', [
        McpRegistrySubmissionStatus.SUBMITTED,
        McpRegistrySubmissionStatus.PENDING_REVIEW,
      ])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return this.mapToEntity(data);
  }

  async findInReviewQueue(): Promise<McpRegistrySubmission[]> {
    const { data } = await this.supabase
      .from('mcp_registry_submissions')
      .select('*')
      .in('status', [
        McpRegistrySubmissionStatus.SUBMITTED,
        McpRegistrySubmissionStatus.PENDING_REVIEW,
      ])
      .order('created_at', { ascending: true });

    return (data || []).map((row) => this.mapToEntity(row));
  }

  async create(dto: CreateMcpRegistrySubmissionDto): Promise<McpRegistrySubmission> {
    const payload = {
      id: crypto.randomUUID(),
      server_id: dto.serverId,
      target_entry_id: dto.targetEntryId ?? null,
      change_type: dto.changeType,
      display_name: dto.displayName,
      description: dto.description ?? null,
      current_version: dto.currentVersion,
      maintainer_name: dto.maintainerName,
      maintainer_kind: dto.maintainerKind,
      trust_level: dto.trustLevel,
      documentation_url: dto.documentationUrl ?? null,
      source: dto.source,
      auth: dto.auth ?? null,
      tools: dto.tools,
      runtime_targets: dto.runtimeTargets,
      platforms: dto.platforms,
      desktop: dto.desktop ?? null,
      cloud: dto.cloud ?? null,
      capabilities: dto.capabilities ?? null,
      submission_notes: dto.submissionNotes ?? null,
      created_by: dto.createdBy,
      status: McpRegistrySubmissionStatus.SUBMITTED,
    };

    const { data, error } = await this.supabase
      .from('mcp_registry_submissions')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create MCP registry submission: ${error.message}`);
    }

    return this.mapToEntity(data);
  }

  async update(
    id: string,
    dto: UpdateMcpRegistrySubmissionDto,
  ): Promise<McpRegistrySubmission> {
    const payload: Record<string, unknown> = {};

    if (dto.targetEntryId !== undefined) payload.target_entry_id = dto.targetEntryId;
    if (dto.status !== undefined) payload.status = dto.status;
    if (dto.reviewedBy !== undefined) payload.reviewed_by = dto.reviewedBy;
    if (dto.reviewNotes !== undefined) payload.review_notes = dto.reviewNotes;
    if (dto.reviewedAt !== undefined) {
      payload.reviewed_at = dto.reviewedAt?.toISOString();
    }

    const { data, error } = await this.supabase
      .from('mcp_registry_submissions')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to update MCP registry submission: ${error.message}`);
    }

    return this.mapToEntity(data);
  }

  private mapToEntity(data: any): McpRegistrySubmission {
    return {
      id: data.id,
      serverId: data.server_id,
      targetEntryId: data.target_entry_id,
      changeType: data.change_type,
      displayName: data.display_name,
      description: data.description,
      currentVersion: data.current_version,
      maintainerName: data.maintainer_name,
      maintainerKind: data.maintainer_kind,
      trustLevel: data.trust_level,
      documentationUrl: data.documentation_url,
      source: (data.source ?? {}) as Record<string, unknown>,
      auth: (data.auth ?? null) as Record<string, unknown> | null,
      tools: Array.isArray(data.tools) ? [...data.tools] : [],
      runtimeTargets: Array.isArray(data.runtime_targets) ? [...data.runtime_targets] : [],
      platforms: Array.isArray(data.platforms) ? [...data.platforms] : [],
      desktop: (data.desktop ?? null) as Record<string, unknown> | null,
      cloud: (data.cloud ?? null) as Record<string, unknown> | null,
      capabilities: (data.capabilities ?? null) as Record<string, unknown> | null,
      submissionNotes: data.submission_notes,
      createdBy: data.created_by,
      status: data.status,
      reviewedBy: data.reviewed_by,
      reviewNotes: data.review_notes,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      reviewedAt: data.reviewed_at ? new Date(data.reviewed_at) : null,
    };
  }
}
