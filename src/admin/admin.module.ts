import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { PluginsModule } from '../plugins/plugins.module';
import { IngestModule } from '../ingest/ingest.module';

/**
 * Admin module - handles admin review and management operations.
 */
@Module({
  imports: [PluginsModule, IngestModule],
  controllers: [AdminController],
})
export class AdminModule {}
