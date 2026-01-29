import { registerAs } from '@nestjs/config';

/**
 * Configuration for Supabase integration.
 *
 * This configuration connects to:
 * 1. Supabase Postgres (via supabase-js) - for metadata storage
 * 2. Supabase Storage (via REST API) - for artifact distribution
 */
export const supabaseConfig = registerAs('supabase', () => ({
  projectUrl: process.env.SUPABASE_URL,
  anonKey: process.env.SUPABASE_ANON_KEY,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  databaseUrl: process.env.DATABASE_URL,

  // Time-to-live for signed URLs in seconds (default: 1 hour)
  signedUrlTtlSeconds: parseInt(process.env.SIGNED_URL_TTL_SECONDS || '3600', 10),

  // Maximum upload size in megabytes
  maxUploadSizeMb: parseInt(process.env.MAX_UPLOAD_SIZE_MB || '50', 10),

  // Storage bucket names
  pluginsBucket: process.env.STORAGE_PLUGINS_BUCKET || 'plugins',
  iconsBucket: process.env.STORAGE_ICONS_BUCKET || 'icons',
  tempUploadsBucket: process.env.STORAGE_TEMP_UPLOADS_BUCKET || 'temp_uploads',
}));

/**
 * Computed URLs for Supabase Storage operations.
 */
export class SupabaseUrls {
  static getStorageUrl(projectUrl: string): string {
    return `${projectUrl}/storage/v1`;
  }

  static getObjectUrl(projectUrl: string): string {
    return `${this.getStorageUrl(projectUrl)}/object`;
  }

  static getSignUrl(projectUrl: string): string {
    return `${this.getObjectUrl(projectUrl)}/sign`;
  }

  static getPublicUrl(projectUrl: string): string {
    return `${this.getObjectUrl(projectUrl)}/public`;
  }

  static getUploadUrl(projectUrl: string, bucket: string): string {
    return `${this.getObjectUrl(projectUrl)}/${bucket}`;
  }

  static getAuthUrl(projectUrl: string): string {
    return `${projectUrl}/auth/v1`;
  }
}
