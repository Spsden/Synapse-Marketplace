import { OAuthProvider } from '../common/enums/oauth-provider.enum';

/**
 * OAuth provider configuration interface.
 *
 * Each provider has specific endpoints and configuration for OAuth 2.0 flows.
 * This configuration is used by the OAuthService to build auth URLs and exchange tokens.
 */
export interface ProviderConfig {
  /** Display name for the provider */
  displayName: string;

  /** OAuth 2.0 authorization endpoint */
  authUrl: string;

  /** OAuth 2.0 token endpoint */
  tokenUrl: string;

  /** Default scopes for this provider */
  defaultScopes: string[];

  /** Whether this provider supports PKCE (Proof Key for Code Exchange) */
  supportsPkce: boolean;

  /** How scopes are formatted in the auth URL */
  scopeSeparator: ' ' | ',' | '%20';

  /** Additional parameters to include in auth URL */
  extraAuthParams?: Record<string, string>;

  /** Additional parameters to include in token request */
  extraTokenParams?: Record<string, string>;

  /** Whether to use HTTP Basic auth for token request (client_id + client_secret) */
  useBasicAuth: boolean;

  /** Custom header requirements for token request */
  tokenHeaders?: Record<string, string>;

  /** How to send the access token in API requests */
  authHeaderFormat: 'Bearer' | 'token' | 'OAuth';
}

/**
 * OAuth provider configurations.
 *
 * This map contains the configuration for all supported OAuth providers.
 * To add a new provider:
 * 1. Add the provider to OAuthProvider enum
 * 2. Add configuration here
 * 3. Update documentation
 */
export const OAUTH_PROVIDER_CONFIGS: Record<OAuthProvider, ProviderConfig> = {
  [OAuthProvider.NOTION]: {
    displayName: 'Notion',
    authUrl: 'https://api.notion.com/v1/oauth/authorize',
    tokenUrl: 'https://api.notion.com/v1/oauth/token',
    defaultScopes: [],
    supportsPkce: true,
    scopeSeparator: ' ',
    useBasicAuth: true,
    authHeaderFormat: 'Bearer',
  },

  [OAuthProvider.GOOGLE]: {
    displayName: 'Google',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    defaultScopes: ['openid', 'profile', 'email'],
    supportsPkce: true,
    scopeSeparator: ' ',
    extraAuthParams: {
      prompt: 'consent',
      access_type: 'offline',
    },
    useBasicAuth: false,
    authHeaderFormat: 'Bearer',
  },

  [OAuthProvider.GITHUB]: {
    displayName: 'GitHub',
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    defaultScopes: ['read:user', 'user:email'],
    supportsPkce: true,
    scopeSeparator: ' ',
    extraAuthParams: {},
    useBasicAuth: true,
    authHeaderFormat: 'Bearer',
  },

  [OAuthProvider.SLACK]: {
    displayName: 'Slack',
    authUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
    defaultScopes: ['chat:write', 'channels:read'],
    supportsPkce: true,
    scopeSeparator: ',',
    extraAuthParams: {},
    useBasicAuth: false,
    authHeaderFormat: 'Bearer',
  },

  [OAuthProvider.MICROSOFT]: {
    displayName: 'Microsoft',
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    defaultScopes: ['openid', 'profile', 'email'],
    supportsPkce: true,
    scopeSeparator: ' ',
    extraAuthParams: {
      response_mode: 'query',
    },
    useBasicAuth: false,
    authHeaderFormat: 'Bearer',
  },

  [OAuthProvider.DISCORD]: {
    displayName: 'Discord',
    authUrl: 'https://discord.com/oauth2/authorize',
    tokenUrl: 'https://discord.com/api/oauth2/token',
    defaultScopes: ['identify', 'guilds'],
    supportsPkce: true,
    scopeSeparator: ' ',
    extraAuthParams: {},
    useBasicAuth: true,
    authHeaderFormat: 'Bearer',
  },

  [OAuthProvider.LINEAR]: {
    displayName: 'Linear',
    authUrl: 'https://linear.app/oauth/authorize',
    tokenUrl: 'https://api.linear.app/oauth/token',
    defaultScopes: ['read', 'write'],
    supportsPkce: true,
    scopeSeparator: ' ',
    extraAuthParams: {},
    useBasicAuth: true,
    authHeaderFormat: 'Bearer',
  },

  [OAuthProvider.FIGMA]: {
    displayName: 'Figma',
    authUrl: 'https://www.figma.com/oauth',
    tokenUrl: 'https://www.figma.com/api/oauth/token',
    defaultScopes: ['file_read'],
    supportsPkce: true,
    scopeSeparator: ',',
    extraAuthParams: {},
    useBasicAuth: true,
    authHeaderFormat: 'Bearer',
  },

  [OAuthProvider.SALESFORCE]: {
    displayName: 'Salesforce',
    authUrl: '/services/oauth2/authorize', // Base URL varies per instance
    tokenUrl: '/services/oauth2/token', // Base URL varies per instance
    defaultScopes: ['api', 'web', 'full'],
    supportsPkce: true,
    scopeSeparator: ' ',
    extraAuthParams: {},
    useBasicAuth: true,
    authHeaderFormat: 'Bearer',
  },

  [OAuthProvider.DROPBOX]: {
    displayName: 'Dropbox',
    authUrl: 'https://www.dropbox.com/oauth2/authorize',
    tokenUrl: 'https://api.dropboxapi.com/oauth2/token',
    defaultScopes: [],
    supportsPkce: true,
    scopeSeparator: ' ',
    extraAuthParams: {
      token_access_type: 'offline',
    },
    useBasicAuth: true,
    authHeaderFormat: 'Bearer',
  },

  [OAuthProvider.STRIPE]: {
    displayName: 'Stripe',
    authUrl: 'https://connect.stripe.com/oauth/authorize',
    tokenUrl: 'https://connect.stripe.com/oauth/token',
    defaultScopes: ['read_only'],
    supportsPkce: true,
    scopeSeparator: ' ',
    extraAuthParams: {},
    useBasicAuth: true,
    authHeaderFormat: 'Bearer',
  },
};

/**
 * Get provider configuration by provider enum.
 */
export function getProviderConfig(provider: OAuthProvider): ProviderConfig {
  const config = OAUTH_PROVIDER_CONFIGS[provider];
  if (!config) {
    throw new Error(`Unsupported OAuth provider: ${provider}`);
  }
  return config;
}

/**
 * Get all supported OAuth providers.
 */
export function getSupportedProviders(): OAuthProvider[] {
  return Object.keys(OAUTH_PROVIDER_CONFIGS) as OAuthProvider[];
}

/**
 * Check if a provider is supported.
 */
export function isProviderSupported(provider: string): boolean {
  return Object.values(OAuthProvider).includes(provider as OAuthProvider);
}

/**
 * Format scopes for a provider's authorization URL.
 */
export function formatScopes(scopes: string[], provider: OAuthProvider): string {
  const config = getProviderConfig(provider);

  if (scopes.length === 0) {
    return config.defaultScopes.join(config.scopeSeparator);
  }

  return scopes.join(config.scopeSeparator);
}

/**
 * Build authorization URL for a provider.
 */
export interface BuildAuthUrlParams {
  provider: OAuthProvider;
  clientId: string;
  redirectUri: string;
  state: string;
  scopes?: string[];
  codeChallenge?: string;
}

export function buildAuthorizationUrl(params: BuildAuthUrlParams): string {
  const config = getProviderConfig(params.provider);
  const scopes = params.scopes || config.defaultScopes;
  const formattedScopes = formatScopes(scopes, params.provider);

  const authParams = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: 'code',
    state: params.state,
    scope: formattedScopes,
    ...config.extraAuthParams,
  });

  // Add PKCE parameters if supported
  if (params.codeChallenge && config.supportsPkce) {
    authParams.set('code_challenge', params.codeChallenge);
    authParams.set('code_challenge_method', 'S256');
  }

  return `${config.authUrl}?${authParams.toString()}`;
}
