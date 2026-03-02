import { Injectable, Logger, Inject } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { OAuthProvider } from './oauth-provider.enum';
import { VaultService } from '../vault/vault.service';
import { ResourceNotFoundException } from '../common/exceptions/resource-not-found.exception';

/**
 * OAuth client entity.
 */
interface OAuthClient {
  id: string;
  pluginId: string;
  provider: OAuthProvider;
  clientId: string;
  clientSecretEncrypted: string;
  redirectUrl: string;
  scopes: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

/**
 * DTO for creating OAuth client credentials.
 */
interface CreateOAuthClientDto {
  pluginId: string;
  provider: OAuthProvider;
  clientId: string;
  clientSecret: string;
  redirectUrl: string;
  scopes: string[];
  createdBy: string;
}

/**
 * DTO for updating OAuth client credentials.
 */
interface UpdateOAuthClientDto {
  clientId?: string;
  clientSecret?: string;
  redirectUrl?: string;
  scopes?: string[];
  isActive?: boolean;
}

/**
 * Repository for OAuthClient entity using Supabase.
 * Manages OAuth client credentials for plugins.
 */
@Injectable()
export class OAuthClientsRepository {
  private readonly logger = new Logger(OAuthClientsRepository.name);
  private readonly supabase: SupabaseClient;

  constructor(
    @Inject(ConfigService) private configService: ConfigService,
    private vaultService: VaultService,
  ) {
    const supabaseConfig = this.configService.get('supabase');
    this.supabase = createClient(supabaseConfig.projectUrl, supabaseConfig.serviceRoleKey, {
      auth: { persistSession: false },
    });
  }

  /**
   * Find OAuth client credentials by plugin ID and provider.
   */
  async findByPluginAndProvider(pluginId: string, provider: OAuthProvider): Promise<OAuthClient | null> {
    const { data, error } = await this.supabase
      .from('plugin_oauth_clients')
      .select('*')
      .eq('plugin_id', pluginId)
      .eq('provider', provider)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapToEntity(data);
  }

  /**
   * Find all OAuth clients for a specific plugin.
   */
  async findByPluginId(pluginId: string): Promise<OAuthClient[]> {
    const { data } = await this.supabase
      .from('plugin_oauth_clients')
      .select('*')
      .eq('plugin_id', pluginId)
      .order('created_at', { ascending: false });

    return (data || []).map((item) => this.mapToEntity(item));
  }

  /**
   * Find OAuth clients by package_id.
   */
  async findByPackageId(packageId: string): Promise<OAuthClient[]> {
    // First get the plugin_id from package_id
    const { data: plugin } = await this.supabase
      .from('plugins')
      .select('id')
      .eq('package_id', packageId)
      .single();

    if (!plugin) {
      return [];
    }

    return this.findByPluginId(plugin.id);
  }

  /**
   * Find all OAuth clients created by a specific developer.
   */
  async findByCreatedBy(createdBy: string): Promise<OAuthClient[]> {
    const { data } = await this.supabase
      .from('plugin_oauth_clients')
      .select('*')
      .eq('created_by', createdBy)
      .order('created_at', { ascending: false });

    return (data || []).map((item) => this.mapToEntity(item));
  }

  /**
   * Find all active OAuth clients for a specific provider.
   */
  async findByProvider(provider: OAuthProvider): Promise<OAuthClient[]> {
    const { data } = await this.supabase
      .from('plugin_oauth_clients')
      .select('*')
      .eq('provider', provider)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    return (data || []).map((item) => this.mapToEntity(item));
  }

  /**
   * Find OAuth client by ID.
   */
  async findById(id: string): Promise<OAuthClient | null> {
    const { data, error } = await this.supabase
      .from('plugin_oauth_clients')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapToEntity(data);
  }

  /**
   * Create new OAuth client credentials (encrypts the client secret).
   */
  async create(dto: CreateOAuthClientDto): Promise<OAuthClient> {
    // Encrypt the client secret before storing
    const clientSecretEncrypted = await this.vaultService.encrypt(dto.clientSecret);

    const newClient = {
      id: crypto.randomUUID(),
      plugin_id: dto.pluginId,
      provider: dto.provider,
      client_id: dto.clientId,
      client_secret_encrypted: clientSecretEncrypted,
      redirect_url: dto.redirectUrl,
      scopes: dto.scopes,
      owner_developer_id: dto.createdBy,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_active: true,
    };

    const { data, error } = await this.supabase
      .from('plugin_oauth_clients')
      .insert(newClient)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create OAuth client: ${error.message}`);
    }

    return this.mapToEntity(data);
  }

  /**
   * Update existing OAuth client credentials.
   */
  async update(id: string, dto: UpdateOAuthClientDto): Promise<OAuthClient> {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (dto.clientId !== undefined) updateData.client_id = dto.clientId;
    if (dto.redirectUrl !== undefined) updateData.redirect_url = dto.redirectUrl;
    if (dto.scopes !== undefined) updateData.scopes = dto.scopes;
    if (dto.isActive !== undefined) updateData.is_active = dto.isActive;

    // Encrypt new client secret if provided
    if (dto.clientSecret !== undefined) {
      updateData.client_secret_encrypted = await this.vaultService.encrypt(dto.clientSecret);
    }

    const { data, error } = await this.supabase
      .from('plugin_oauth_clients')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update OAuth client: ${error.message}`);
    }

    if (!data) {
      throw new ResourceNotFoundException('OAuth client not found');
    }

    return this.mapToEntity(data);
  }

  /**
   * Deactivate OAuth client credentials (soft delete).
   */
  async deactivate(id: string): Promise<OAuthClient> {
    return this.update(id, { isActive: false });
  }

  /**
   * Delete OAuth client credentials permanently.
   */
  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('plugin_oauth_clients')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete OAuth client: ${error.message}`);
    }
  }

  /**
   * Decrypt and return the client secret for a given OAuth client.
   * Use this carefully and only when needed for token exchange.
   */
  async getClientSecret(clientId: string, provider: OAuthProvider): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('plugin_oauth_clients')
      .select('client_secret_encrypted')
      .eq('client_id', clientId)
      .eq('provider', provider)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return null;
    }

    return this.vaultService.decrypt(data.client_secret_encrypted);
  }

  /**
   * Get both client ID and decrypted secret for a plugin/provider combination.
   * Returns null if credentials don't exist or are inactive.
   */
  async getCredentials(
    pluginId: string,
    provider: OAuthProvider,
  ): Promise<{ clientId: string; clientSecret: string; redirectUrl: string; scopes: string[] } | null> {
    const client = await this.findByPluginAndProvider(pluginId, provider);

    if (!client) {
      return null;
    }

    const clientSecret = await this.vaultService.decrypt(client.clientSecretEncrypted);

    return {
      clientId: client.clientId,
      clientSecret,
      redirectUrl: client.redirectUrl,
      scopes: client.scopes,
    };
  }

  /**
   * Map database row to OAuthClient entity.
   */
  private mapToEntity(data: any): OAuthClient {
    return {
      id: data.id,
      pluginId: data.plugin_id,
      provider: data.provider as OAuthProvider,
      clientId: data.client_id,
      clientSecretEncrypted: data.client_secret_encrypted,
      redirectUrl: data.redirect_url,
      scopes: data.scopes,
      createdBy: data.owner_developer_id,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      isActive: data.is_active,
    };
  }
}

import * as crypto from 'crypto';
