import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VaultModule } from '../vault/vault.module';
import { OAuthController } from './oauth.controller';
import { OAuthService } from './oauth.service';
import { OAuthProxyController } from './oauth-proxy.controller';
import { OAuthProxyService } from './oauth-proxy.service';
import { OAuthClientsRepository } from './oauth-clients.repository';
import { OAuthTokensRepository } from './oauth-tokens.repository';
import { OAuthSessionsRepository } from './oauth-sessions.repository';
import { OAuthAuditRepository } from './oauth-audit.repository';

/**
 * OAuth Module - Provides OAuth 2.0 authentication flows for plugins.
 *
 * This module handles:
 * - OAuth flow initiation with PKCE
 * - OAuth callback handling
 * - Token storage and encryption
 * - Token refresh and revocation
 * - Audit logging for all OAuth operations
 *
 * Configuration:
 * - VAULT_ENCRYPTION_KEY: Required for token encryption
 * - OAUTH_CALLBACK_BASE_URL: Base URL for OAuth callbacks (optional)
 *
 * @example
 * ```typescript
 * // In app.module.ts
 * import { OAuthModule } from './oauth/oauth.module';
 *
 * @Module({
 *   imports: [OAuthModule],
 *   // ...
 * })
 * export class AppModule {}
 * ```
 */
@Module({
  imports: [ConfigModule, VaultModule],
  controllers: [OAuthController, OAuthProxyController],
  providers: [
    OAuthService,
    OAuthProxyService,
    OAuthClientsRepository,
    OAuthTokensRepository,
    OAuthSessionsRepository,
    OAuthAuditRepository,
  ],
  exports: [
    OAuthService,
    OAuthProxyService,
    OAuthClientsRepository,
    OAuthTokensRepository,
    OAuthSessionsRepository,
    OAuthAuditRepository,
  ],
})
export class OAuthModule {}
