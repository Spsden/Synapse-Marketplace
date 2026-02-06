import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  Redirect,
  ParseUUIDPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { OAuthService, StartOAuthParams, HandleCallbackResult } from './oauth.service';
import { OAuthProvider } from '../common/enums/oauth-provider.enum';
import { isProviderSupported } from './oauth-provider.config';

/**
 * DTO for starting OAuth flow.
 */
class StartOAuthDto {
  user_id: string;
  plugin_id: string;
  redirect_uri?: string;
  scopes?: string[];
}

/**
 * Response for starting OAuth flow.
 */
class StartOAuthResponse {
  authorization_url: string;
  state: string;
}

/**
 * OAuth Controller - Handles OAuth 2.0 flows.
 *
 * Routes:
 * - GET /api/v1/oauth/:provider/start - Start OAuth flow
 * - GET /api/v1/oauth/:provider/callback - Handle OAuth callback
 * - POST /api/v1/oauth/:provider/refresh - Refresh access token
 * - POST /api/v1/oauth/:provider/revoke - Revoke access token
 * - GET /api/v1/oauth/:provider/check - Check if user has valid token
 */
@ApiTags('OAuth')
@Controller('api/v1/oauth')
export class OAuthController {
  constructor(private readonly oauthService: OAuthService) {}

  /**
   * Start OAuth flow for a provider.
   *
   * Returns an authorization URL that the user should be redirected to.
   * The URL includes PKCE parameters and state for CSRF protection.
   *
   * @param provider The OAuth provider
   * @param dto OAuth flow parameters
   * @returns Authorization URL and state
   */
  @ApiOperation({
    summary: 'Start OAuth flow',
    description: `Generate an OAuth authorization URL with PKCE.
                 The user should be redirected to the returned URL.
                 After authorization, they will be redirected back to the callback endpoint.`,
  })
  @ApiParam({
    name: 'provider',
    description: 'OAuth provider name (e.g., notion, google, github)',
    enum: Object.values(OAuthProvider),
    example: OAuthProvider.NOTION,
  })
  @ApiQuery({
    name: 'user_id',
    description: 'User ID initiating the OAuth flow',
    type: String,
    required: true,
    example: 'user_abc123',
  })
  @ApiQuery({
    name: 'plugin_id',
    description: 'Plugin ID requesting OAuth access',
    type: String,
    required: true,
    example: 'plugin_xyz789',
  })
  @ApiQuery({
    name: 'redirect_uri',
    description: 'Custom redirect URI (optional, uses default callback URL)',
    type: String,
    required: false,
  })
  @ApiQuery({
    name: 'scopes',
    description: 'OAuth scopes to request (comma-separated)',
    type: String,
    required: false,
    example: 'read,write',
  })
  @ApiResponse({
    status: 200,
    description: 'Authorization URL generated successfully',
    schema: {
      type: 'object',
      properties: {
        authorization_url: {
          type: 'string',
          description: 'URL to redirect user to for authorization',
        },
        state: {
          type: 'string',
          description: 'State parameter for CSRF protection',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 404, description: 'OAuth credentials not found for this plugin/provider' })
  @Get(':provider/start')
  async startOAuthFlow(
    @Param('provider') provider: string,
    @Query('user_id') userId: string,
    @Query('plugin_id') pluginId: string,
    @Query('redirect_uri') redirectUri?: string,
    @Query('scopes') scopes?: string,
  ): Promise<StartOAuthResponse> {
    // Validate provider
    if (!isProviderSupported(provider)) {
      return {
        authorization_url: '',
        state: '',
      };
    }

    const params: StartOAuthParams = {
      userId,
      pluginId,
      provider: provider as OAuthProvider,
      redirectUri,
      scopes: scopes ? scopes.split(',') : undefined,
    };

    const result = await this.oauthService.startFlow(params);

    return {
      authorization_url: result.authorizationUrl,
      state: result.state,
    };
  }

  /**
   * Handle OAuth callback from provider.
   *
   * This endpoint receives the authorization code from the provider,
   * exchanges it for tokens, and redirects the user back to the app.
   *
   * @param provider The OAuth provider
   * @param query Callback query parameters
   * @returns Redirect to deep link or error page
   */
  @ApiOperation({
    summary: 'Handle OAuth callback',
    description: `Receive OAuth callback from provider, exchange code for tokens,
                 and redirect user to the Synapse app with success/error status.`,
  })
  @ApiParam({
    name: 'provider',
    description: 'OAuth provider name',
    enum: Object.values(OAuthProvider),
  })
  @ApiQuery({
    name: 'code',
    description: 'Authorization code from provider',
    type: String,
    required: true,
  })
  @ApiQuery({
    name: 'state',
    description: 'State parameter for CSRF validation',
    type: String,
    required: true,
  })
  @ApiQuery({
    name: 'error',
    description: 'Error code if authorization failed',
    type: String,
    required: false,
  })
  @ApiQuery({
    name: 'error_description',
    description: 'Error description if authorization failed',
    type: String,
    required: false,
  })
  @ApiResponse({
    status: 302,
    description: 'Redirect to deep link (synapse://oauth/success or synapse://oauth/error)',
  })
  @ApiResponse({ status: 400, description: 'Invalid callback parameters' })
  @Get(':provider/callback')
  @Redirect(undefined, 302)
  async handleOAuthCallback(
    @Param('provider') provider: string,
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error?: string,
    @Query('error_description') errorDescription?: string,
  ): Promise<{ url: string; statusCode: number }> {
    const result: HandleCallbackResult = await this.oauthService.handleCallback({
      state,
      code,
      error,
      errorDescription,
    });

    if (result.success) {
      return {
        url: result.redirectUrl || 'synapse://oauth/success',
        statusCode: 302,
      };
    }

    // Redirect to error page with error details
    const errorUrl = `synapse://oauth/error?error=${encodeURIComponent(result.error || 'Unknown error')}`;
    return {
      url: errorUrl,
      statusCode: 302,
    };
  }

  /**
   * Refresh an expired OAuth token.
   *
   * @param provider The OAuth provider
   * @param userId User ID
   * @param pluginId Plugin ID
   * @returns Refreshed token info
   */
  @ApiOperation({
    summary: 'Refresh OAuth token',
    description: 'Refresh an expired access token using the refresh token.',
  })
  @ApiParam({
    name: 'provider',
    description: 'OAuth provider name',
    enum: Object.values(OAuthProvider),
  })
  @ApiQuery({
    name: 'user_id',
    description: 'User ID',
    type: String,
    required: true,
  })
  @ApiQuery({
    name: 'plugin_id',
    description: 'Plugin ID',
    type: String,
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
    schema: {
      type: 'object',
      properties: {
        expiresAt: { type: 'string', format: 'date-time' },
        expiresIn: { type: 'number', description: 'Seconds until expiration' },
        scopes: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'No tokens found or no refresh token available' })
  @Post(':provider/refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @Param('provider') provider: string,
    @Query('user_id') userId: string,
    @Query('plugin_id') pluginId: string,
  ) {
    return this.oauthService.refreshToken(userId, pluginId, provider as OAuthProvider);
  }

  /**
   * Revoke OAuth tokens.
   *
   * @param provider The OAuth provider
   * @param userId User ID
   * @param pluginId Plugin ID
   */
  @ApiOperation({
    summary: 'Revoke OAuth token',
    description: 'Revoke OAuth tokens for a user and plugin.',
  })
  @ApiParam({
    name: 'provider',
    description: 'OAuth provider name',
    enum: Object.values(OAuthProvider),
  })
  @ApiQuery({
    name: 'user_id',
    description: 'User ID',
    type: String,
    required: true,
  })
  @ApiQuery({
    name: 'plugin_id',
    description: 'Plugin ID',
    type: String,
    required: true,
  })
  @ApiResponse({ status: 204, description: 'Token revoked successfully' })
  @ApiResponse({ status: 404, description: 'No tokens found' })
  @Post(':provider/revoke')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeToken(
    @Param('provider') provider: string,
    @Query('user_id') userId: string,
    @Query('plugin_id') pluginId: string,
  ): Promise<void> {
    await this.oauthService.revokeToken(userId, pluginId, provider as OAuthProvider);
  }

  /**
   * Check if user has valid OAuth token.
   *
   * @param provider The OAuth provider
   * @param userId User ID
   * @param pluginId Plugin ID
   * @returns Token validation status
   */
  @ApiOperation({
    summary: 'Check OAuth token validity',
    description: 'Check if a user has a valid (non-expired, non-revoked) OAuth token.',
  })
  @ApiParam({
    name: 'provider',
    description: 'OAuth provider name',
    enum: Object.values(OAuthProvider),
  })
  @ApiQuery({
    name: 'user_id',
    description: 'User ID',
    type: String,
    required: true,
  })
  @ApiQuery({
    name: 'plugin_id',
    description: 'Plugin ID',
    type: String,
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Token validity status',
    schema: {
      type: 'object',
      properties: {
        valid: { type: 'boolean' },
      },
    },
  })
  @Get(':provider/check')
  async checkToken(
    @Param('provider') provider: string,
    @Query('user_id') userId: string,
    @Query('plugin_id') pluginId: string,
  ): Promise<{ valid: boolean }> {
    const valid = await this.oauthService.hasValidToken(userId, pluginId, provider as OAuthProvider);
    return { valid };
  }
}
