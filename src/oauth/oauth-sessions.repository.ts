import { Injectable, Logger, Inject } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import {
  OAuthSession,
  CreateOAuthSessionDto,
} from '../common/entities/oauth.entity';
import { OAuthProvider } from '../common/enums/oauth-provider.enum';

/**
 * Repository for OAuthSession entity using Supabase.
 * Manages temporary OAuth flow sessions with PKCE data.
 */
@Injectable()
export class OAuthSessionsRepository {
  private readonly logger = new Logger(OAuthSessionsRepository.name);
  private readonly supabase: SupabaseClient;
  private readonly DEFAULT_SESSION_TTL = 10 * 60 * 1000; // 10 minutes in milliseconds

  constructor(@Inject(ConfigService) private configService: ConfigService) {
    const supabaseConfig = this.configService.get('supabase');
    this.supabase = createClient(supabaseConfig.projectUrl, supabaseConfig.serviceRoleKey, {
      auth: { persistSession: false },
    });
  }

  /**
   * Find OAuth session by state parameter.
   */
  async findByState(state: string): Promise<OAuthSession | null> {
    const { data, error } = await this.supabase
      .from('oauth_sessions')
      .select('*')
      .eq('state', state)
      .single();

    if (error || !data) {
      return null;
    }

    const session = this.mapToEntity(data);

    // Check if session has expired
    if (new Date() > session.expiresAt) {
      await this.delete(session.id);
      return null;
    }

    return session;
  }

  /**
   * Find all active sessions for a user.
   */
  async findByUserId(userId: string): Promise<OAuthSession[]> {
    const { data } = await this.supabase
      .from('oauth_sessions')
      .select('*')
      .eq('user_id', userId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    return (data || []).map((item) => this.mapToEntity(item));
  }

  /**
   * Find session by ID.
   */
  async findById(id: string): Promise<OAuthSession | null> {
    const { data, error } = await this.supabase
      .from('oauth_sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapToEntity(data);
  }

  /**
   * Create a new OAuth session.
   */
  async create(dto: CreateOAuthSessionDto): Promise<OAuthSession> {
    const newSession = {
      id: crypto.randomUUID(),
      user_id: dto.userId,
      plugin_id: dto.pluginId,
      provider: dto.provider,
      state: dto.state,
      code_verifier: dto.codeVerifier,
      code_challenge: dto.codeChallenge || null,
      redirect_uri: dto.redirectUri || null,
      scopes: dto.scopes,
      metadata: dto.metadata || {},
      created_at: new Date().toISOString(),
      expires_at: dto.expiresAt.toISOString(),
    };

    const { data, error } = await this.supabase
      .from('oauth_sessions')
      .insert(newSession)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create OAuth session: ${error.message}`);
    }

    return this.mapToEntity(data);
  }

  /**
   * Delete a session by ID.
   */
  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('oauth_sessions')
      .delete()
      .eq('id', id);

    if (error) {
      this.logger.warn(`Failed to delete session ${id}: ${error.message}`);
    }
  }

  /**
   * Delete a session by state (after token exchange).
   */
  async deleteByState(state: string): Promise<void> {
    const { error } = await this.supabase
      .from('oauth_sessions')
      .delete()
      .eq('state', state);

    if (error) {
      this.logger.warn(`Failed to delete session with state ${state}: ${error.message}`);
    }
  }

  /**
   * Delete all expired sessions.
   * Returns the number of sessions deleted.
   */
  async deleteExpired(): Promise<number> {
    const { data, error } = await this.supabase.rpc('cleanup_expired_sessions');

    if (error) {
      this.logger.warn(`Failed to cleanup expired sessions: ${error.message}`);
      return 0;
    }

    return data || 0;
  }

  /**
   * Create a new OAuth session with automatic expiration calculation.
   */
  async createWithDefaults(
    userId: string,
    pluginId: string,
    provider: OAuthProvider,
    state: string,
    codeVerifier: string,
    codeChallenge: string,
    scopes: string[],
    metadata?: Record<string, unknown>,
  ): Promise<OAuthSession> {
    const expiresAt = new Date(Date.now() + this.DEFAULT_SESSION_TTL);

    return this.create({
      userId,
      pluginId,
      provider,
      state,
      codeVerifier,
      codeChallenge,
      scopes,
      metadata,
      expiresAt,
    });
  }

  /**
   * Map database row to OAuthSession entity.
   */
  private mapToEntity(data: any): OAuthSession {
    return {
      id: data.id,
      userId: data.user_id,
      pluginId: data.plugin_id,
      provider: data.provider as OAuthProvider,
      state: data.state,
      codeVerifier: data.code_verifier,
      codeChallenge: data.code_challenge,
      redirectUri: data.redirect_uri,
      scopes: data.scopes,
      metadata: data.metadata,
      createdAt: new Date(data.created_at),
      expiresAt: new Date(data.expires_at),
    };
  }
}

import * as crypto from 'crypto';
