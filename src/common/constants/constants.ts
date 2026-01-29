/**
 * Application constants.
 * Centralized location for magic strings and configuration values.
 */
export class Constants {
  // API Paths
  static readonly API_PREFIX = 'api/v1';
  static readonly API_VERSION = '1.0';

  // Status
  static readonly PLUGIN_STATUS = {
    SUBMITTED: 'SUBMITTED',
    PENDING_REVIEW: 'PENDING_REVIEW',
    PLUBLISHED: 'PUBLISHED',
    REJECTED: 'REJECTED',
  } as const;

  static readonly VERSION_STATUS = {
    SUBMITTED: 'SUBMITTED',
    PENDING_REVIEW: 'PENDING_REVIEW',
    PLUBLISHED: 'PUBLISHED',
    REJECTED: 'REJECTED',
    FLAGGED: 'FLAGGED',
  } as const;

  // Storage
  static readonly BUCKETS = {
    PLUGINS: 'plugins',
    ICONS: 'icons',
    TEMP_UPLOADS: 'temp_uploads',
  } as const;

  // File Extensions
  static readonly FILE_EXTENSIONS = {
    SYNX: '.synx',
    PNG: '.png',
    JPG: '.jpg',
    JPEG: '.jpeg',
    SVG: '.svg',
  } as const;

  // Content Types
  static readonly CONTENT_TYPES = {
    SYNX: 'application/zip',
    JSON: 'application/json',
    PNG: 'image/png',
    JPEG: 'image/jpeg',
    SVG: 'image/svg+xml',
    FORM_DATA: 'multipart/form-data',
  } as const;

  // Validation Messages
  static readonly ERRORS = {
    PLUGIN_NOT_FOUND: 'Plugin not found',
    VERSION_NOT_FOUND: 'Version not found',
    VERSION_EXISTS: 'Version already exists for this plugin',
    INVALID_VERSION: 'No compatible version found',
    INVALID_TRANSITION: 'Invalid status transition',
  } as const;

  // Pagination
  static readonly PAGINATION = {
    DEFAULT_PAGE: 0,
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,
  } as const;

  // Cache
  static readonly CACHE = {
    TTL_SHORT: 60, // 1 minute
    TTL_MEDIUM: 300, // 5 minutes
    TTL_LONG: 3600, // 1 hour
  } as const;
}
