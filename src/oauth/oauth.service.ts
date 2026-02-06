import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuthProvider, OAuthAuditAction, OAuthAuditStatus } from '../common/enums/oauth-provider.enum';
import {
  OAuthClient,
  OAuthSession,
  OAuthToken,
  OAuthTokenInfo,
} from '../common/entities/oauth.entity';
import { OAuthClientsRepository } from './oauth-clients.repository';
import { OAuthSessionsRepository } from './oauth-sessions.repository';
import { OAuthTokensRepository } from './oauth-tokens.repository';
import { OAuthAuditRepository } from './oauth-audit.repository';
import { VaultService } from '../vault/vault.service';
import {
  buildAuthorizationUrl,
  getProviderConfig,
} from './oauth-provider.config';
import axios, { AxiosError } from 'axios';

/**
 * DTO for starting an OAuth flow.
 */
export interface StartOAuthParams {
  userId: string;
  pluginId: string;
  provider: OAuthProvider;
  redirectUri?: string;
  scopes?: string[];
}

/**
 * Result of starting an OAuth flow.
 */
export interface StartOAuthResult {
  authorizationUrl: string;
  state: string;
  codeVerifier: string;
}

/**
 * DTO for handling OAuth callback.
 */
export interface HandleCallbackParams {
  state: string;
  code: string;
  error?: string;
  errorDescription?: string;
}

/**
 * Result of handling OAuth callback.
 */
export interface HandleCallbackResult {
  success: boolean;
  error?: string;
  redirectUrl?: string;
  tokenInfo?: OAuthTokenInfo;
}

/**
 * Token response from OAuth provider.
 */
interface ProviderTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
}

/**
 * OAuth Service - Handles OAuth 2.0 flows with PKCE.
 *
 * This service manages the complete OAuth lifecycle:
 * 1. Start flow - Generate authorization URL with PKCE
 * 2. Callback - Exchange authorization code for tokens
 * 3. Token storage - Encrypt and store tokens securely
 * 4. Token refresh - Refresh expired tokens
 */
@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);
  private readonly callbackBaseUrl: string;
  private readonly defaultSessionTtl: number = 10 * 60 * 1000; // 10 minutes

  constructor(
    private configService: ConfigService,
    private vaultService: VaultService,
    private oauthClientsRepository: OAuthClientsRepository,
    private oauthSessionsRepository: OAuthSessionsRepository,
    private oauthTokensRepository: OAuthTokensRepository,
    private oauthAuditRepository: OAuthAuditRepository,
  ) {
    // Get the base URL for OAuth callbacks
    this.callbackBaseUrl = this.configService.get<string>('OAUTH_CALLBACK_BASE_URL') ||
                          this.configService.get<string>('APP_BASE_URL') ||
                          'http://localhost:3000';
  }

  /**
   * Start an OAuth flow for a user and plugin.
   *
   * This generates a secure authorization URL with:
   * - PKCE code challenge
   * - State parameter for CSRF protection
   * - Proper scopes
   *
   * @param params OAuth flow parameters
   * @returns Authorization URL and session data
   */
  async startFlow(params: StartOAuthParams): Promise<StartOAuthResult> {
    const { userId, pluginId, provider, redirectUri, scopes } = params;

    this.logger.log(`Starting OAuth flow for user ${userId}, plugin ${pluginId}, provider ${provider}`);

    try {
      // Get OAuth client credentials for this plugin/provider
      const credentials = await this.oauthClientsRepository.getCredentials(
        pluginId,
        provider,
      );

      if (!credentials) {
        throw new HttpException(
          `No OAuth credentials found for plugin ${pluginId} and provider ${provider}`,
          HttpStatus.NOT_FOUND,
        );
      }

      const config = getProviderConfig(provider);

      // Generate PKCE verifier and challenge
      const codeVerifier = this.vaultService.generateRandom(32, 'base64url');
      const codeChallenge = this.generateCodeChallenge(codeVerifier);

      // Generate state for CSRF protection
      const state = this.vaultService.generateRandom(32, 'base64url');

      // Build the redirect URI
      const finalRedirectUri = redirectUri || `${this.callbackBaseUrl}/api/v1/oauth/${provider}/callback`;

      // Build the authorization URL
      const authorizationUrl = buildAuthorizationUrl({
        provider,
        clientId: credentials.clientId,
        redirectUri: finalRedirectUri,
        state,
        scopes: scopes || credentials.scopes,
        codeChallenge: config.supportsPkce ? codeChallenge : undefined,
      });

      // Store session with PKCE data
      const expiresAt = new Date(Date.now() + this.defaultSessionTtl);
      await this.oauthSessionsRepository.createWithDefaults(
        userId,
        pluginId,
        provider,
        state,
        codeVerifier,
        codeChallenge,
        scopes || credentials.scopes,
        { redirectUri: finalRedirectUri },
      );

      // Log the flow start
      await this.oauthAuditRepository.logSuccess(
        OAuthAuditAction.FLOW_STARTED,
        userId,
        pluginId,
        provider,
        { scopes: scopes || credentials.scopes },
      );

      return {
        authorizationUrl,
        state,
        codeVerifier,
      };
    } catch (error) {
      this.logger.error(`Failed to start OAuth flow: ${error.message}`, error.stack);

      await this.oauthAuditRepository.logFailure(
        OAuthAuditAction.FLOW_FAILED,
        error.message,
        userId,
        pluginId,
        provider,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Failed to start OAuth flow: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Handle OAuth callback from provider.
   *
   * This validates the state, exchanges the authorization code for tokens,
   * and stores the tokens securely.
   *
   * @param params Callback parameters
   * @returns Result with redirect URL or error
   */
  async handleCallback(params: HandleCallbackParams): Promise<HandleCallbackResult> {
    const { state, code, error, errorDescription } = params;

    this.logger.log(`Handling OAuth callback with state ${state}`);

    try {
      // Check for OAuth error from provider
      if (error) {
        this.logger.warn(`OAuth error from provider: ${error} - ${errorDescription}`);
        await this.failSession(state, error, errorDescription);
        return {
          success: false,
          error: errorDescription || error,
        };
      }

      // Validate and retrieve session
      const session = await this.oauthSessionsRepository.findByState(state);

      if (!session) {
        throw new HttpException('Invalid or expired OAuth session', HttpStatus.BAD_REQUEST);
      }

      // Get OAuth client credentials
      const credentials = await this.oauthClientsRepository.getCredentials(
        session.pluginId,
        session.provider,
      );

      if (!credentials) {
        throw new HttpException('OAuth credentials not found', HttpStatus.NOT_FOUND);
      }

      // Log authorization code received
      await this.oauthAuditRepository.logSuccess(
        OAuthAuditAction.AUTH_CODE_RECEIVED,
        session.userId,
        session.pluginId,
        session.provider,
      );

      // Exchange authorization code for tokens
      const tokenResponse = await this.exchangeCodeForTokens(
        code,
        session.codeVerifier,
        credentials.clientId,
        credentials.clientSecret,
        session.provider,
        session.redirectUri || `${this.callbackBaseUrl}/api/v1/oauth/${session.provider}/callback`,
      );

      // Calculate expiration time
      const expiresAt = tokenResponse.expires_in
        ? new Date(Date.now() + tokenResponse.expires_in * 1000)
        : null;

      // Store tokens securely
      const token = await this.oauthTokensRepository.create({
        userId: session.userId,
        pluginId: session.pluginId,
        provider: session.provider,
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        tokenType: tokenResponse.token_type || 'Bearer',
        expiresAt,
        scopes: tokenResponse.scope?.split(' ') || session.scopes,
        metadata: {
          grantedScopes: tokenResponse.scope,
        },
      });

      // Delete the session
      await this.oauthSessionsRepository.deleteByState(state);

      // Log successful token exchange
      await this.oauthAuditRepository.logSuccess(
        OAuthAuditAction.TOKEN_EXCHANGED,
        session.userId,
        session.pluginId,
        session.provider,
        { tokenId: token.id, expiresIn: tokenResponse.expires_in },
      );

      // Build deep link redirect URL for the host app
      const deepLinkUrl = `synapse://oauth/success?plugin_id=${session.pluginId}&provider=${session.provider}`;

      return {
        success: true,
        redirectUrl: deepLinkUrl,
        tokenInfo: {
          expiresAt,
          expiresIn: tokenResponse.expires_in || null,
          scopes: token.scopes,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to handle OAuth callback: ${error.message}`, error.stack);

      await this.failSession(state, 'callback_error', error.message);

      return {
        success: false,
        error: errorDescription || error.message,
      };
    }
  }

  /**
   * Refresh an expired OAuth token.
   *
   * @param userId User ID
   * @param pluginId Plugin ID
   * @param provider OAuth provider
   * @returns Refreshed token info
   */
  async refreshToken(
    userId: string,
    pluginId: string,
    provider: OAuthProvider,
  ): Promise<OAuthTokenInfo> {
    this.logger.log(`Refreshing token for user ${userId}, plugin ${pluginId}, provider ${provider}`);

    const tokens = await this.oauthTokensRepository.getTokens(userId, pluginId, provider);

    if (!tokens) {
      throw new HttpException('No tokens found', HttpStatus.NOT_FOUND);
    }

    if (!tokens.refreshToken) {
      throw new HttpException('No refresh token available', HttpStatus.BAD_REQUEST);
    }

    const credentials = await this.oauthClientsRepository.getCredentials(pluginId, provider);

    if (!credentials) {
      throw new HttpException('OAuth credentials not found', HttpStatus.NOT_FOUND);
    }

    try {
      // Exchange refresh token for new access token
      const tokenResponse = await this.exchangeRefreshTokenForTokens(
        tokens.refreshToken,
        credentials.clientId,
        credentials.clientSecret,
        provider,
      );

      // Calculate expiration time
      const expiresAt = tokenResponse.expires_in
        ? new Date(Date.now() + tokenResponse.expires_in * 1000)
        : null;

      // Update stored tokens
      await this.oauthTokensRepository.updateTokens(
        tokens.token.id,
        tokenResponse.access_token,
        tokenResponse.refresh_token, // Some providers rotate refresh tokens
        expiresAt,
        tokenResponse.scope?.split(' ') || tokens.token.scopes,
      );

      // Log successful token refresh
      await this.oauthAuditRepository.logSuccess(
        OAuthAuditAction.TOKEN_REFRESHED,
        userId,
        pluginId,
        provider,
        { expiresIn: tokenResponse.expires_in },
      );

      return {
        expiresAt,
        expiresIn: tokenResponse.expires_in || null,
        scopes: tokenResponse.scope?.split(' ') || tokens.token.scopes,
      };
    } catch (error) {
      this.logger.error(`Failed to refresh token: ${error.message}`, error.stack);

      await this.oauthAuditRepository.logFailure(
        OAuthAuditAction.TOKEN_REFRESHED,
        error.message,
        userId,
        pluginId,
        provider,
      );

      throw new HttpException(
        `Failed to refresh token: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Revoke OAuth tokens for a user and plugin.
   */
  async revokeToken(userId: string, pluginId: string, provider: OAuthProvider): Promise<void> {
    this.logger.log(`Revoking token for user ${userId}, plugin ${pluginId}, provider ${provider}`);

    const token = await this.oauthTokensRepository.findByUserPluginProvider(userId, pluginId, provider);

    if (!token) {
      throw new HttpException('No tokens found', HttpStatus.NOT_FOUND);
    }

    await this.oauthTokensRepository.revoke(token.id);

    await this.oauthAuditRepository.logSuccess(
      OAuthAuditAction.TOKEN_REVOKED,
      userId,
      pluginId,
      provider,
    );
  }

  /**
   * Check if a user has valid OAuth tokens for a plugin/provider.
   */
  async hasValidToken(userId: string, pluginId: string, provider: OAuthProvider): Promise<boolean> {
    return this.oauthTokensRepository.isValid(userId, pluginId, provider);
  }

  /**
   * Get OAuth token info for a user and plugin.
   */
  async getTokenInfo(
    userId: string,
    pluginId: string,
    provider: OAuthProvider,
  ): Promise<OAuthToken | null> {
    return this.oauthTokensRepository.findByUserPluginProvider(userId, pluginId, provider);
  }

  /**
   * Exchange authorization code for access tokens.
   */
  private async exchangeCodeForTokens(
    code: string,
    codeVerifier: string,
    clientId: string,
    clientSecret: string,
    provider: OAuthProvider,
    redirectUri: string,
  ): Promise<ProviderTokenResponse> {
    const config = getProviderConfig(provider);

    const params: Record<string, string> = {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      ...config.extraTokenParams,
    };

    // Add PKCE verifier if supported
    if (config.supportsPkce) {
      params.code_verifier = codeVerifier;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...config.tokenHeaders,
    };

    // Add basic auth if required
    if (config.useBasicAuth) {
      headers['Authorization'] = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
    } else {
      params.client_secret = clientSecret;
    }

    try {
      const response = await axios.post<ProviderTokenResponse>(
        config.tokenUrl,
        new URLSearchParams(params).toString(),
        { headers },
      );

      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError<any>;
      this.logger.error(
        `Token exchange failed: ${axiosError.response?.data || axiosError.message}`,
      );
      throw new Error(
        `Token exchange failed: ${JSON.stringify(axiosError.response?.data || axiosError.message)}`,
      );
    }
  }

  /**
   * Exchange refresh token for new access token.
   */
  private async exchangeRefreshTokenForTokens(
    refreshToken: string,
    clientId: string,
    clientSecret: string,
    provider: OAuthProvider,
  ): Promise<ProviderTokenResponse> {
    const config = getProviderConfig(provider);

    const params: Record<string, string> = {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      ...config.extraTokenParams,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...config.tokenHeaders,
    };

    if (config.useBasicAuth) {
      headers['Authorization'] = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
    } else {
      params.client_secret = clientSecret;
    }

    try {
      const response = await axios.post<ProviderTokenResponse>(
        config.tokenUrl,
        new URLSearchParams(params).toString(),
        { headers },
      );

      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError<any>;
      this.logger.error(
        `Token refresh failed: ${axiosError.response?.data || axiosError.message}`,
      );
      throw new Error(
        `Token refresh failed: ${JSON.stringify(axiosError.response?.data || axiosError.message)}`,
      );
    }
  }

  /**
   * Generate PKCE code challenge from verifier.
   * Uses SHA-256 and base64url encoding.
   */
  private generateCodeChallenge(codeVerifier: string): string {
    const { createHash } = require('crypto');
    const hash = createHash('sha256').update(codeVerifier).digest();
    return hash.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  /**
   * Mark a session as failed and clean it up.
   */
  private async failSession(state: string, error: string, description?: string): Promise<void> {
    const session = await this.oauthSessionsRepository.findByState(state);

    if (session) {
      await this.oauthAuditRepository.logFailure(
        OAuthAuditAction.FLOW_FAILED,
        description || error,
        session.userId,
        session.pluginId,
        session.provider,
        { errorCode: error },
      );

      await this.oauthSessionsRepository.deleteByState(state);
    }
  }
}
