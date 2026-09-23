import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PluginsModule } from '../plugins/plugins.module';
import { SynxBuilderService } from '../storage/synx-builder.service';
import { GitHubSourceClient } from './github-source.client';
import { PluginIngestService } from './plugin-ingest.service';

/**
 * Ingest module - builds plugin versions from reviewed source in a git
 * repository instead of accepting developer archive uploads.
 */
@Module({
  imports: [ConfigModule, PluginsModule],
  providers: [GitHubSourceClient, SynxBuilderService, PluginIngestService],
  exports: [PluginIngestService],
})
export class IngestModule {}
