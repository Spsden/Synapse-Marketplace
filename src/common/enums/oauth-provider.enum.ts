/**
 * Supported OAuth 2.0 providers for plugin authentication.
 *
 * Each provider has specific configuration for:
 * - Authorization endpoints
 * - Token endpoints
 * - Scope format
 * - PKCE support
 *
 * To add a new provider:
 * 1. Add the provider to this enum
 * 2. Update OAuthConfigService with provider configuration
 * 3. Add any provider-specific logic in OAuthService
 */
export enum OAuthProvider {
  /** Notion - for workspace and database access */
  NOTION = 'notion',

  /** Google - for Drive, Gmail, Calendar, etc. */
  GOOGLE = 'google',

  /** GitHub - for repository and Gist access */
  GITHUB = 'github',

  /** Slack - for workspace messaging and integrations */
  SLACK = 'slack',

  /** Microsoft - for Azure AD, Graph API, etc. */
  MICROSOFT = 'microsoft',

  /** Discord - for bot and server integrations */
  DISCORD = 'discord',

  /** Linear - for issue tracking and project management */
  LINEAR = 'linear',

  /** Figma - for design file access */
  FIGMA = 'figma',

  /** Salesforce - for CRM data access */
  SALESFORCE = 'salesforce',

  /** Dropbox - for file storage access */
  DROPBOX = 'dropbox',

  /** Stripe - for payment and subscription data */
  STRIPE = 'stripe',
}

/**
 * OAuth token types supported by the system.
 */
export enum OAuthTokenType {
  /** Bearer token (most common for OAuth 2.0) */
  BEARER = 'Bearer',

  /** MAC token (less common, legacy) */
  MAC = 'MAC',
}

/**
 * OAuth session states.
 */
export enum OAuthSessionState {
  /** Session is pending user authorization */
  PENDING = 'pending',

  /** Session is completed and tokens have been issued */
  COMPLETED = 'completed',

  /** Session expired or was cancelled */
  EXPIRED = 'expired',

  /** Session failed due to an error */
  FAILED = 'failed',
}

/**
 * OAuth audit actions for logging.
 */
export enum OAuthAuditAction {
  /** OAuth flow initiated */
  FLOW_STARTED = 'flow_started',

  /** Authorization code received */
  AUTH_CODE_RECEIVED = 'auth_code_received',

  /** Tokens exchanged successfully */
  TOKEN_EXCHANGED = 'token_exchanged',

  /** Token refreshed */
  TOKEN_REFRESHED = 'token_refreshed',

  /** Token revoked by user */
  TOKEN_REVOKED = 'token_revoked',

  /** Token used for API call */
  TOKEN_USED = 'token_used',

  /** Session expired */
  SESSION_EXPIRED = 'session_expired',

  /** Flow failed with error */
  FLOW_FAILED = 'flow_failed',
}

/**
 * OAuth audit status codes.
 */
export enum OAuthAuditStatus {
  SUCCESS = 'success',
  FAILURE = 'failure',
  PENDING = 'pending',
}
