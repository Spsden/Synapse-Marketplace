import { Injectable, Logger, Inject } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { Plugin, CreatePluginDto, UpdatePluginDto } from '../common/entities/plugin.entity';
import { PluginStatus } from '../common/enums/plugin-status.enum';
import { ResourceNotFoundException } from '../common/exceptions/resource-not-found.exception';

/**
 * Repository for Plugin entity using Supabase.
 * Provides data access methods for plugin operations.
 */
@Injectable()
export class PluginsRepository {
  private readonly logger = new Logger(PluginsRepository.name);
  private readonly supabase: SupabaseClient;

  constructor(@Inject(ConfigService) private configService: ConfigService) {
    const supabaseConfig = this.configService.get('supabase');
    this.supabase = createClient(supabaseConfig.projectUrl, supabaseConfig.serviceRoleKey, {
      auth: { persistSession: false },
    });
  }

  /**
   * Find a plugin by its unique package ID.
   */
  async findByPackageId(packageId: string): Promise<Plugin | null> {
    const { data, error } = await this.supabase
      .from('plugins')
      .select('*')
      .eq('package_id', packageId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapToEntity(data);
  }

  /**
   * Check if a plugin exists with the given package ID.
   */
  async existsByPackageId(packageId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('plugins')
      .select('id')
      .eq('package_id', packageId)
      .single();

    return !error && !!data;
  }

  /**
   * Find all plugins with a specific status.
   */
  async findByStatus(status: PluginStatus): Promise<Plugin[]> {
    const { data } = await this.supabase
      .from('plugins')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });

    return (data || []).map((item) => this.mapToEntity(item));
  }

  /**
   * Find all plugins in a specific category with PUBLISHED status.
   */
  async findByCategoryAndStatus(category: string, status: PluginStatus): Promise<Plugin[]> {
    const { data } = await this.supabase
      .from('plugins')
      .select('*')
      .eq('category', category)
      .eq('status', status)
      .order('created_at', { ascending: false });

    return (data || []).map((item) => this.mapToEntity(item));
  }

  /**
   * Search for published plugins by name or description containing the search term.
   */
  async searchPublishedPlugins(searchTerm: string, status: PluginStatus): Promise<Plugin[]> {
    const { data } = await this.supabase
      .from('plugins')
      .select('*')
      .eq('status', status)
      .or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
      .order('created_at', { ascending: false });

    return (data || []).map((item) => this.mapToEntity(item));
  }

  /**
   * Find all plugins by author.
   */
  async findByAuthor(author: string): Promise<Plugin[]> {
    const { data } = await this.supabase
      .from('plugins')
      .select('*')
      .eq('author', author)
      .order('created_at', { ascending: false });

    return (data || []).map((item) => this.mapToEntity(item));
  }

  /**
   * Find plugins with latest version matching a given version ID.
   */
  async findByLatestVersionId(latestVersionId: string): Promise<Plugin[]> {
    const { data } = await this.supabase
      .from('plugins')
      .select('*')
      .eq('latest_version_id', latestVersionId);

    return (data || []).map((item) => this.mapToEntity(item));
  }

  /**
   * Find parent plugin by version ID.
   */
  async findParentByVersionId(versionId: string): Promise<Plugin | null> {
    const { data, error } = await this.supabase
      .from('plugins')
      .select('*')
      .eq('latest_version_id', versionId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapToEntity(data);
  }

  /**
   * Create a new plugin.
   */
  async create(dto: CreatePluginDto): Promise<Plugin> {
    const newPlugin = {
      id: crypto.randomUUID(),
      package_id: dto.packageId,
      name: dto.name,
      description: dto.description || null,
      author: dto.author,
      icon_key: dto.iconKey || null,
      status: PluginStatus.SUBMITTED,
      category: dto.category || null,
      tags: dto.tags || null,
      source_url: dto.sourceUrl || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('plugins')
      .insert(newPlugin)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create plugin: ${error.message}`);
    }

    return this.mapToEntity(data);
  }

  /**
   * Update an existing plugin.
   */
  async update(id: string, dto: UpdatePluginDto): Promise<Plugin> {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.iconKey !== undefined) updateData.icon_key = dto.iconKey;
    if (dto.category !== undefined) updateData.category = dto.category;
    if (dto.tags !== undefined) updateData.tags = dto.tags;
    if (dto.sourceUrl !== undefined) updateData.source_url = dto.sourceUrl;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.latestVersionId !== undefined) updateData.latest_version_id = dto.latestVersionId;

    const { data, error } = await this.supabase
      .from('plugins')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update plugin: ${error.message}`);
    }

    return this.mapToEntity(data);
  }

  /**
   * Find a plugin by ID.
   */
  async findById(id: string): Promise<Plugin | null> {
    const { data, error } = await this.supabase
      .from('plugins')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapToEntity(data);
  }

  /**
   * Map database row to Plugin entity.
   */
  private mapToEntity(data: any): Plugin {
    return {
      id: data.id,
      packageId: data.package_id,
      name: data.name,
      description: data.description,
      author: data.author,
      iconKey: data.icon_key,
      status: data.status as PluginStatus,
      latestVersionId: data.latest_version_id,
      category: data.category,
      tags: data.tags,
      sourceUrl: data.source_url,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      version: data.version,
    };
  }
}

import * as crypto from 'crypto';
import { PostgrestError } from '@supabase/supabase-js';
