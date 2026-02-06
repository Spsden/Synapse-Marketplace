import { Injectable, Logger, Inject } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import {
  OAuthAuditLog,
  CreateOAuthAuditLogDto,
} from '../common/entities/oauth.entity';
import { OAuthAuditAction, OAuthAuditStatus } from '../common/enums/oauth-provider.enum';

/**
 * Repository for OAuthAuditLog entity using Supabase.
 * Manages audit logging for all OAuth operations.
 */
@Injectable()
export class OAuthAuditRepository {
  private readonly logger = new Logger(OAuthAuditRepository.name);
  private readonly supabase: SupabaseClient;

  constructor(@Inject(ConfigService) private configService: ConfigService) {
    const supabaseConfig = this.configService.get('supabase');
    this.supabase = createClient(supabaseConfig.projectUrl, supabaseConfig.serviceRoleKey, {
      auth: { persistSession: false },
    });
  }

  /**
   * Create a new audit log entry.
   */
  async create(dto: CreateOAuthAuditLogDto): Promise<OAuthAuditLog> {
    const newLog = {
      id: crypto.randomUUID(),
      user_id: dto.userId || null,
      plugin_id: dto.pluginId || null,
      provider: dto.provider || null,
      action: dto.action,
      status: dto.status,
      error_message: dto.errorMessage || null,
      ip_address: dto.ipAddress || null,
      user_agent: dto.userAgent || null,
      metadata: dto.metadata || {},
      created_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('oauth_audit_log')
      .insert(newLog)
      .select()
      .single();

    if (error) {
      // Log locally but don't throw - audit failures shouldn't break the flow
      this.logger.warn(`Failed to create audit log: ${error.message}`);
      return null;
    }

    return this.mapToEntity(data);
  }

  /**
   * Log a successful OAuth action.
   */
  async logSuccess(
    action: OAuthAuditAction,
    userId?: string,
    pluginId?: string,
    provider?: string,
    metadata?: Record<string, unknown>,
  ): Promise<OAuthAuditLog | null> {
    return this.create({
      userId,
      pluginId,
      provider,
      action,
      status: OAuthAuditStatus.SUCCESS,
      metadata,
    });
  }

  /**
   * Log a failed OAuth action.
   */
  async logFailure(
    action: OAuthAuditAction,
    errorMessage: string,
    userId?: string,
    pluginId?: string,
    provider?: string,
    metadata?: Record<string, unknown>,
  ): Promise<OAuthAuditLog | null> {
    return this.create({
      userId,
      pluginId,
      provider,
      action,
      status: OAuthAuditStatus.FAILURE,
      errorMessage,
      metadata,
    });
  }

  /**
   * Find all audit logs for a specific user.
   */
  async findByUserId(userId: string, limit = 100): Promise<OAuthAuditLog[]> {
    const { data } = await this.supabase
      .from('oauth_audit_log')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    return (data || []).map((item) => this.mapToEntity(item));
  }

  /**
   * Find all audit logs for a specific plugin.
   */
  async findByPluginId(pluginId: string, limit = 100): Promise<OAuthAuditLog[]> {
    const { data } = await this.supabase
      .from('oauth_audit_log')
      .select('*')
      .eq('plugin_id', pluginId)
      .order('created_at', { ascending: false })
      .limit(limit);

    return (data || []).map((item) => this.mapToEntity(item));
  }

  /**
   * Find all audit logs for a specific provider.
   */
  async findByProvider(provider: string, limit = 100): Promise<OAuthAuditLog[]> {
    const { data } = await this.supabase
      .from('oauth_audit_log')
      .select('*')
      .eq('provider', provider)
      .order('created_at', { ascending: false })
      .limit(limit);

    return (data || []).map((item) => this.mapToEntity(item));
  }

  /**
   * Find audit logs by action type.
   */
  async findByAction(action: string, limit = 100): Promise<OAuthAuditLog[]> {
    const { data } = await this.supabase
      .from('oauth_audit_log')
      .select('*')
      .eq('action', action)
      .order('created_at', { ascending: false })
      .limit(limit);

    return (data || []).map((item) => this.mapToEntity(item));
  }

  /**
   * Find failed audit logs (for security monitoring).
   */
  async findFailures(limit = 100): Promise<OAuthAuditLog[]> {
    const { data } = await this.supabase
      .from('oauth_audit_log')
      .select('*')
      .eq('status', OAuthAuditStatus.FAILURE)
      .order('created_at', { ascending: false })
      .limit(limit);

    return (data || []).map((item) => this.mapToEntity(item));
  }

  /**
   * Find recent audit logs across all users.
   */
  async findRecent(limit = 50): Promise<OAuthAuditLog[]> {
    const { data } = await this.supabase
      .from('oauth_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    return (data || []).map((item) => this.mapToEntity(item));
  }

  /**
   * Delete old audit logs (for cleanup).
   * Returns the number of logs deleted.
   */
  async deleteOlderThan(days: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const { data, error } = await this.supabase
      .from('oauth_audit_log')
      .delete()
      .lt('created_at', cutoffDate.toISOString())
      .select();

    if (error) {
      this.logger.warn(`Failed to delete old audit logs: ${error.message}`);
      return 0;
    }

    return (data || []).length;
  }

  /**
   * Map database row to OAuthAuditLog entity.
   */
  private mapToEntity(data: any): OAuthAuditLog {
    return {
      id: data.id,
      userId: data.user_id,
      pluginId: data.plugin_id,
      provider: data.provider,
      action: data.action,
      status: data.status,
      errorMessage: data.error_message,
      ipAddress: data.ip_address,
      userAgent: data.user_agent,
      metadata: data.metadata,
      createdAt: new Date(data.created_at),
    };
  }
}

import * as crypto from 'crypto';
