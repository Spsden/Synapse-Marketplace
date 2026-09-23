import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PluginsService } from './plugins.service';
import { PluginReviewService } from './plugin-review.service';
import { PluginsRepository } from './plugins.repository';
import { PluginVersionsRepository } from './plugin-versions.repository';
import { StoreController } from './store.controller';
import { StorageModule } from '../storage/storage.module';

/**
 * Plugins module - handles core plugin functionality.
 */
@Module({
  imports: [ConfigModule, StorageModule],
  controllers: [StoreController],
  providers: [
    PluginsService,
    PluginReviewService,
    PluginsRepository,
    PluginVersionsRepository,
  ],
  exports: [PluginsService, PluginReviewService],
})
export class PluginsModule {}
