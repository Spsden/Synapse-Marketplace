import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';
import {
  CreateMcpRegistryEntryDto,
  McpRegistryEntry,
  UpdateMcpRegistryEntryDto,
} from '../common/entities/mcp-registry.entity';

@Injectable()
export class McpRegistryEntriesRepository {
  private readonly logger = new Logger(McpRegistryEntriesRepository.name);
  private readonly supabase: SupabaseClient;

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {
    const supabaseConfig = this.configService.get('supabase');
    this.supabase = createClient(
      supabaseConfig.projectUrl,
      supabaseConfig.serviceRoleKey,
      { auth: { persistSession: false } },
    );
  }

  async findById(id: string): Promise<McpRegistryEntry | null> {
    const { data, error } = await this.supabase
      .from('mcp_registry_entries')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapToEntity(data);
  }

  async findByServerId(serverId: string): Promise<McpRegistryEntry | null> {
    const { data, error } = await this.supabase
      .from('mcp_registry_entries')
      .select('*')
      .eq('server_id', serverId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapToEntity(data);
  }

  async listPublished(): Promise<McpRegistryEntry[]> {
    const { data } = await this.supabase
      .from('mcp_registry_entries')
      .select('*')
      .order('server_id', { ascending: true });

    return (data || []).map((row) => this.mapToEntity(row));
  }

  async create(dto: CreateMcpRegistryEntryDto): Promise<McpRegistryEntry> {
    const payload = {
      id: crypto.randomUUID(),
      server_id: dto.serverId,
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
      created_by: dto.createdBy ?? null,
      updated_by: dto.updatedBy ?? dto.createdBy ?? null,
      published_at: (dto.publishedAt ?? new Date()).toISOString(),
    };

    const { data, error } = await this.supabase
      .from('mcp_registry_entries')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create MCP registry entry: ${error.message}`);
    }

    return this.mapToEntity(data);
  }

  async update(id: string, dto: UpdateMcpRegistryEntryDto): Promise<McpRegistryEntry> {
    const payload: Record<string, unknown> = {};

    if (dto.serverId !== undefined) payload.server_id = dto.serverId;
    if (dto.displayName !== undefined) payload.display_name = dto.displayName;
    if (dto.description !== undefined) payload.description = dto.description;
    if (dto.currentVersion !== undefined) payload.current_version = dto.currentVersion;
    if (dto.maintainerName !== undefined) payload.maintainer_name = dto.maintainerName;
    if (dto.maintainerKind !== undefined) payload.maintainer_kind = dto.maintainerKind;
    if (dto.trustLevel !== undefined) payload.trust_level = dto.trustLevel;
    if (dto.documentationUrl !== undefined) payload.documentation_url = dto.documentationUrl;
    if (dto.source !== undefined) payload.source = dto.source;
    if (dto.auth !== undefined) payload.auth = dto.auth;
    if (dto.tools !== undefined) payload.tools = dto.tools;
    if (dto.runtimeTargets !== undefined) payload.runtime_targets = dto.runtimeTargets;
    if (dto.platforms !== undefined) payload.platforms = dto.platforms;
    if (dto.desktop !== undefined) payload.desktop = dto.desktop;
    if (dto.cloud !== undefined) payload.cloud = dto.cloud;
    if (dto.capabilities !== undefined) payload.capabilities = dto.capabilities;
    if (dto.createdBy !== undefined) payload.created_by = dto.createdBy;
    if (dto.updatedBy !== undefined) payload.updated_by = dto.updatedBy;
    if (dto.publishedAt !== undefined) {
      payload.published_at = dto.publishedAt?.toISOString();
    }

    const { data, error } = await this.supabase
      .from('mcp_registry_entries')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to update MCP registry entry: ${error.message}`);
    }

    return this.mapToEntity(data);
  }

  private mapToEntity(data: any): McpRegistryEntry {
    return {
      id: data.id,
      serverId: data.server_id,
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
      createdBy: data.created_by,
      updatedBy: data.updated_by,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      publishedAt: new Date(data.published_at),
    };
  }
}
