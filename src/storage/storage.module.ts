import { Module, Global } from '@nestjs/common';
import { SupabaseStorageService } from './supabase-storage.service';
import { SynxPackageService } from './synx-package.service';
import { StorageService } from './storage.service';

/**
 * Storage module - handles all Supabase Storage operations.
 * Marked as Global to make it available throughout the application.
 */
@Global()
@Module({
  providers: [
    SupabaseStorageService,
    SynxPackageService,
    {
      provide: StorageService,
      useClass: SupabaseStorageService,
    },
  ],
  exports: [
    SupabaseStorageService,
    SynxPackageService,
    StorageService,
  ],
})
export class StorageModule {}
