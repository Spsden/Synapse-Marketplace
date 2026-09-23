import { Module, Global } from '@nestjs/common';
import { SupabaseStorageService } from './supabase-storage.service';
import { SynxBuilderService } from './synx-builder.service';
import { StorageService } from './storage.service';

/**
 * Storage module - handles all Supabase Storage operations.
 * Marked as Global to make it available throughout the application.
 */
@Global()
@Module({
  providers: [
    SupabaseStorageService,
    SynxBuilderService,
    {
      provide: StorageService,
      useClass: SupabaseStorageService,
    },
  ],
  exports: [
    SupabaseStorageService,
    SynxBuilderService,
    StorageService,
  ],
})
export class StorageModule {}
