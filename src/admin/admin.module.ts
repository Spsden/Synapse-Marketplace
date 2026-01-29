import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { PluginsModule } from '../plugins/plugins.module';

/**
 * Admin module - handles admin review and management operations.
 */
@Module({
  imports: [PluginsModule],
  controllers: [AdminController],
})
export class AdminModule {}
