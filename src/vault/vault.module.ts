import { Module, Global } from '@nestjs/common';
import { VaultService } from './vault.service';

/**
 * Vault Module - Provides encryption/decryption services for sensitive data.
 *
 * This module is marked as @Global() so it can be used anywhere without
 * importing it into each module that needs it.
 *
 * Configuration:
 * - VAULT_ENCRYPTION_KEY: Required environment variable for encryption
 *
 * @example
 * ```typescript
 * // In app.module.ts
 * import { VaultModule } from './vault/vault.module';
 *
 * @Module({
 *   imports: [VaultModule],
 *   // ...
 * })
 * export class AppModule {}
 *
 * // In any service:
 * constructor(private vaultService: VaultService) {}
 * ```
 */
@Global()
@Module({
  providers: [VaultService],
  exports: [VaultService],
})
export class VaultModule {}
