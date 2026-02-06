import { OAuthProvider } from '../enums/oauth-provider.enum';

/**
 * Represents OAuth client credentials stored for a plugin.
 *
 * Plugin developers submit these credentials through the Developer Portal.
 * Each plugin can have OAuth credentials for multiple providers.
 *
 * Table: plugin_oauth_clients
 */
export interface OAuthClient {
  /** Primary key - UUID identifier */
  id: string;

  /** Foreign key to the plugin that owns these credentials */
  pluginId: string;

  /** The OAuth provider (e.g., 'notion', 'google', 'github') */
  provider: OAuthProvider;

  /** OAuth client ID from the provider's developer console */
  clientId: string;

  /** Encrypted OAuth client secret from the provider */
  clientSecretEncrypted: string;

  /** OAuth redirect URL registered with the provider */
  redirectUrl: string;

  /** OAuth scopes requested by this plugin */
  scopes: string[];

  /** User ID of the developer who submitted these credentials */
  createdBy: string;

  /** Timestamp when credentials were submitted */
  createdAt: Date;

  /** Timestamp when credentials were last updated */
  updatedAt: Date;

  /** Whether these credentials are currently active */
  isActive: boolean;
}

/**
 * Input type for creating OAuth client credentials.
 */
export interface CreateOAuthClientDto {
  pluginId: string;
  provider: OAuthProvider;
  clientId: string;
  clientSecret: string; // Plain text - will be encrypted
  redirectUrl: string;
  scopes: string[];
  createdBy: string;
}

/**
 * Input type for updating OAuth client credentials.
 */
export interface UpdateOAuthClientDto {
  clientId?: string;
  clientSecret?: string; // Plain text - will be encrypted
  redirectUrl?: string;
  scopes?: string[];
  isActive?: boolean;
}

/**
 * Represents stored OAuth tokens for a user-plugin-provider combination.
 *
 * These tokens are obtained after the user completes the OAuth flow.
 * They are used to make authenticated requests to the provider on behalf of the user.
 *
 * Table: plugin_oauth_tokens
 */
export interface OAuthToken {
  /** Primary key - UUID identifier */
  id: string;

  /** User ID who authorized this access */
  userId: string;

  /** Foreign key to the plugin that requested access */
  pluginId: string;

  /** The OAuth provider that issued the tokens */
  provider: OAuthProvider;

  /** Encrypted access token for API calls */
  accessTokenEncrypted: string;

  /** Encrypted refresh token (nullable - some providers don't provide this) */
  refreshTokenEncrypted: string | null;

  /** Token type (typically 'Bearer') */
  tokenType: string;

  /** When the access token expires (nullable - some tokens don't expire) */
  expiresAt: Date | null;

  /** Scopes granted for these tokens */
  scopes: string[];

  /** Additional metadata from the token response */
  metadata?: Record<string, unknown>;

  /** Timestamp when tokens were first stored */
  createdAt: Date;

  /** Timestamp when tokens were last updated or refreshed */
  updatedAt: Date;

  /** Timestamp when tokens were last used */
  lastUsedAt: Date | null;

  /** Whether the user has revoked these tokens */
  isRevoked: boolean;
}

/**
 * Input type for storing OAuth tokens.
 */
export interface CreateOAuthTokenDto {
  userId: string;
  pluginId: string;
  provider: OAuthProvider;
  accessToken: string; // Plain text - will be encrypted
  refreshToken?: string; // Plain text - will be encrypted
  tokenType?: string;
  expiresAt?: Date;
  scopes: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Result of token storage operation with token info.
 */
export interface OAuthTokenInfo {
  /** Whether the token will expire */
  expiresAt: Date | null;

  /** Seconds until expiration (or null if no expiration) */
  expiresIn: number | null;

  /** Granted scopes */
  scopes: string[];
}

/**
 * Represents a temporary OAuth flow session.
 *
 * These sessions store PKCE verifiers and state parameters during
 * the OAuth authorization flow. They have a short TTL and are
 * cleaned up after completion or expiration.
 *
 * Table: oauth_sessions
 */
export interface OAuthSession {
  /** Primary key - UUID identifier */
  id: string;

  /** User ID who initiated the OAuth flow */
  userId: string;

  /** Foreign key to the plugin requesting OAuth access */
  pluginId: string;

  /** The OAuth provider being used */
  provider: OAuthProvider;

  /** OAuth state parameter for CSRF protection */
  state: string;

  /** PKCE code verifier for authorization code exchange */
  codeVerifier: string;

  /** PKCE code challenge (optional - can be derived) */
  codeChallenge: string | null;

  /** Redirect URI for this flow */
  redirectUri: string | null;

  /** Scopes requested for this flow */
  scopes: string[];

  /** Additional metadata for the flow */
  metadata?: Record<string, unknown>;

  /** Timestamp when session was created */
  createdAt: Date;

  /** Timestamp when session expires (typically 10-15 minutes) */
  expiresAt: Date;
}

/**
 * Input type for creating an OAuth session.
 */
export interface CreateOAuthSessionDto {
  userId: string;
  pluginId: string;
  provider: OAuthProvider;
  state: string;
  codeVerifier: string;
  codeChallenge?: string;
  redirectUri?: string;
  scopes: string[];
  metadata?: Record<string, unknown>;
  expiresAt: Date;
}

/**
 * Represents an entry in the OAuth audit log.
 *
 * All OAuth operations are logged for security and compliance.
 *
 * Table: oauth_audit_log
 */
export interface OAuthAuditLog {
  /** Primary key - UUID identifier */
  id: string;

  /** User ID associated with this action */
  userId: string | null;

  /** Plugin ID associated with this action */
  pluginId: string | null;

  /** OAuth provider associated with this action */
  provider: string | null;

  /** The action performed (e.g., 'token_exchanged', 'token_refreshed') */
  action: string;

  /** Status of the action ('success', 'failure', 'pending') */
  status: string;

  /** Error message if the action failed */
  errorMessage: string | null;

  /** IP address of the client making the request */
  ipAddress: string | null;

  /** User agent string from the client */
  userAgent: string | null;

  /** Additional metadata about the action */
  metadata?: Record<string, unknown>;

  /** Timestamp when the action occurred */
  createdAt: Date;
}

/**
 * Input type for creating an audit log entry.
 */
export interface CreateOAuthAuditLogDto {
  userId?: string;
  pluginId?: string;
  provider?: string;
  action: string;
  status: string;
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}
