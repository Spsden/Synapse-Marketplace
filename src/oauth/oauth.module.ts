import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VaultModule } from '../vault/vault.module';
import { OAuthCredentialsController } from './oauth.controller';
import { OAuthClientsRepository } from './oauth-clients.repository';

/**
 * OAuth Credentials Vault Module
 *
 * Provides secure storage for OAuth client credentials.
 * The Synapse host app fetches these credentials to run its own OAuth flow.
 */
@Module({
  imports: [ConfigModule, VaultModule],
  controllers: [OAuthCredentialsController],
  providers: [OAuthClientsRepository],
  exports: [OAuthClientsRepository],
})
export class OAuthModule {}
