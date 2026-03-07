import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VaultModule } from '../vault/vault.module';
import { OAuthCredentialsController } from './oauth.controller';
import { OAuthCallbackController } from './oauth-callback.controller';
import { OAuthClientsRepository } from './oauth-clients.repository';
import { OAuthRedirectService } from './oauth-redirect.service';

/**
 * OAuth Credentials Vault Module
 *
 * Provides secure storage for OAuth client credentials.
 * The Synapse host app fetches these credentials to run its own OAuth flow.
 */
@Module({
  imports: [ConfigModule, VaultModule],
  controllers: [OAuthCredentialsController, OAuthCallbackController],
  providers: [OAuthClientsRepository, OAuthRedirectService],
  exports: [OAuthClientsRepository, OAuthRedirectService],
})
export class OAuthModule {}
