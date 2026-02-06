import { Injectable, Logger, Inject } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import {
  OAuthToken,
  CreateOAuthTokenDto,
} from '../common/entities/oauth.entity';
import { OAuthProvider } from '../common/enums/oauth-provider.enum';
import { VaultService } from '../vault/vault.service';
import { ResourceNotFoundException } from '../common/exceptions/resource-not-found.exception';

/**
 * Repository for OAuthToken entity using Supabase.
 * Manages OAuth access and refresh tokens for users.
 */
@Injectable()
export class OAuthTokensRepository {
  private readonly logger = new Logger(OAuthTokensRepository.name);
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
   * Find OAuth tokens by user ID, plugin ID, and provider.
   */
  async findByUserPluginProvider(
    userId: string,
    pluginId: string,
    provider: OAuthProvider,
  ): Promise<OAuthToken | null> {
    const { data, error } = await this.supabase
      .from('plugin_oauth_tokens')
      .select('*')
      .eq('user_id', userId)
      .eq('plugin_id', pluginId)
      .eq('provider', provider)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapToEntity(data);
  }

  /**
   * Find all tokens for a specific user across all plugins.
   */
  async findByUserId(userId: string): Promise<OAuthToken[]> {
    const { data } = await this.supabase
      .from('plugin_oauth_tokens')
      .select('*')
      .eq('user_id', userId)
      .eq('is_revoked', false)
      .order('created_at', { ascending: false });

    return (data || []).map((item) => this.mapToEntity(item));
  }

  /**
   * Find all tokens for a specific plugin across all users.
   */
  async findByPluginId(pluginId: string): Promise<OAuthToken[]> {
    const { data } = await this.supabase
      .from('plugin_oauth_tokens')
      .select('*')
      .eq('plugin_id', pluginId)
      .eq('is_revoked', false)
      .order('created_at', { ascending: false });

    return (data || []).map((item) => this.mapToEntity(item));
  }

  /**
   * Find all tokens for a specific provider.
   */
  async findByProvider(provider: OAuthProvider): Promise<OAuthToken[]> {
    const { data } = await this.supabase
      .from('plugin_oauth_tokens')
      .select('*')
      .eq('provider', provider)
      .eq('is_revoked', false)
      .order('created_at', { ascending: false });

    return (data || []).map((item) => this.mapToEntity(item));
  }

  /**
   * Find all expired tokens that should be refreshed.
   */
  async findExpiredTokens(): Promise<OAuthToken[]> {
    const { data } = await this.supabase
      .from('plugin_oauth_tokens')
      .select('*')
      .lt('expires_at', new Date().toISOString())
      .eq('is_revoked', false)
      .is('refresh_token_encrypted', null, { inverted: true });

    return (data || []).map((item) => this.mapToEntity(item));
  }

  /**
   * Find token by ID.
   */
  async findById(id: string): Promise<OAuthToken | null> {
    const { data, error } = await this.supabase
      .from('plugin_oauth_tokens')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapToEntity(data);
  }

  /**
   * Create new OAuth tokens (encrypts both access and refresh tokens).
   */
  async create(dto: CreateOAuthTokenDto): Promise<OAuthToken> {
    const accessTokenEncrypted = await this.vaultService.encrypt(dto.accessToken);
    const refreshTokenEncrypted = dto.refreshToken
      ? await this.vaultService.encrypt(dto.refreshToken)
      : null;

    const newToken = {
      id: crypto.randomUUID(),
      user_id: dto.userId,
      plugin_id: dto.pluginId,
      provider: dto.provider,
      access_token_encrypted: accessTokenEncrypted,
      refresh_token_encrypted: refreshTokenEncrypted,
      token_type: dto.tokenType || 'Bearer',
      expires_at: dto.expiresAt?.toISOString() || null,
      scopes: dto.scopes,
      metadata: dto.metadata || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_used_at: null,
      is_revoked: false,
    };

    const { data, error } = await this.supabase
      .from('plugin_oauth_tokens')
      .insert(newToken)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create OAuth token: ${error.message}`);
    }

    return this.mapToEntity(data);
  }

  /**
   * Update existing OAuth tokens (for token refresh).
   */
  async updateTokens(
    id: string,
    accessToken: string,
    refreshToken?: string,
    expiresAt?: Date,
    scopes?: string[],
  ): Promise<OAuthToken> {
    const updateData: any = {
      access_token_encrypted: await this.vaultService.encrypt(accessToken),
      updated_at: new Date().toISOString(),
    };

    if (refreshToken !== undefined) {
      updateData.refresh_token_encrypted = refreshToken
        ? await this.vaultService.encrypt(refreshToken)
        : null;
    }

    if (expiresAt !== undefined) {
      updateData.expires_at = expiresAt?.toISOString() || null;
    }

    if (scopes !== undefined) {
      updateData.scopes = scopes;
    }

    const { data, error } = await this.supabase
      .from('plugin_oauth_tokens')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update OAuth token: ${error.message}`);
    }

    if (!data) {
      throw new ResourceNotFoundException('OAuth token not found');
    }

    return this.mapToEntity(data);
  }

  /**
   * Update the last_used_at timestamp for a token.
   */
  async updateLastUsed(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('plugin_oauth_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      this.logger.warn(`Failed to update last_used_at for token ${id}: ${error.message}`);
    }
  }

  /**
   * Revoke OAuth tokens (soft delete - keeps record but marks as revoked).
   */
  async revoke(id: string): Promise<OAuthToken> {
    const { data, error } = await this.supabase
      .from('plugin_oauth_tokens')
      .update({ is_revoked: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to revoke OAuth token: ${error.message}`);
    }

    if (!data) {
      throw new ResourceNotFoundException('OAuth token not found');
    }

    return this.mapToEntity(data);
  }

  /**
   * Revoke all tokens for a specific user and plugin.
   */
  async revokeByUserPlugin(userId: string, pluginId: string): Promise<void> {
    const { error } = await this.supabase
      .from('plugin_oauth_tokens')
      .update({ is_revoked: true, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('plugin_id', pluginId);

    if (error) {
      throw new Error(`Failed to revoke tokens: ${error.message}`);
    }
  }

  /**
   * Delete OAuth tokens permanently.
   */
  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('plugin_oauth_tokens')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete OAuth token: ${error.message}`);
    }
  }

  /**
   * Get decrypted access token for making API calls.
   * Also updates last_used_at timestamp.
   */
  async getAccessToken(
    userId: string,
    pluginId: string,
    provider: OAuthProvider,
  ): Promise<string | null> {
    const token = await this.findByUserPluginProvider(userId, pluginId, provider);

    if (!token || token.isRevoked) {
      return null;
    }

    // Check if token has expired
    if (token.expiresAt && new Date() > token.expiresAt) {
      return null;
    }

    // Update last used timestamp
    await this.updateLastUsed(token.id);

    return this.vaultService.decrypt(token.accessTokenEncrypted);
  }

  /**
   * Get both access and refresh tokens (decrypted) for a user/plugin/provider.
   * Returns null if tokens don't exist or are revoked.
   */
  async getTokens(
    userId: string,
    pluginId: string,
    provider: OAuthProvider,
  ): Promise<{ accessToken: string; refreshToken: string | null; token: OAuthToken } | null> {
    const token = await this.findByUserPluginProvider(userId, pluginId, provider);

    if (!token || token.isRevoked) {
      return null;
    }

    const accessToken = await this.vaultService.decrypt(token.accessTokenEncrypted);
    const refreshToken = token.refreshTokenEncrypted
      ? await this.vaultService.decrypt(token.refreshTokenEncrypted)
      : null;

    return {
      accessToken,
      refreshToken,
      token,
    };
  }

  /**
   * Check if a token exists and is valid (not revoked, not expired).
   */
  async isValid(userId: string, pluginId: string, provider: OAuthProvider): Promise<boolean> {
    const token = await this.findByUserPluginProvider(userId, pluginId, provider);

    if (!token || token.isRevoked) {
      return false;
    }

    // Check expiration
    if (token.expiresAt && new Date() > token.expiresAt) {
      return false;
    }

    return true;
  }

  /**
   * Map database row to OAuthToken entity.
   */
  private mapToEntity(data: any): OAuthToken {
    return {
      id: data.id,
      userId: data.user_id,
      pluginId: data.plugin_id,
      provider: data.provider as OAuthProvider,
      accessTokenEncrypted: data.access_token_encrypted,
      refreshTokenEncrypted: data.refresh_token_encrypted,
      tokenType: data.token_type,
      expiresAt: data.expires_at ? new Date(data.expires_at) : null,
      scopes: data.scopes,
      metadata: data.metadata,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      lastUsedAt: data.last_used_at ? new Date(data.last_used_at) : null,
      isRevoked: data.is_revoked,
    };
  }
}

import * as crypto from 'crypto';
