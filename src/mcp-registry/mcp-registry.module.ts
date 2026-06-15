import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { McpRegistryAdminController } from './mcp-registry-admin.controller';
import { McpRegistryController } from './mcp-registry.controller';
import { McpRegistryDeveloperController } from './mcp-registry-developer.controller';
import { McpRegistryEntriesRepository } from './mcp-registry-entries.repository';
import { McpRegistryService } from './mcp-registry.service';
import { McpRegistrySubmissionsRepository } from './mcp-registry-submissions.repository';

@Module({
  imports: [ConfigModule],
  controllers: [
    McpRegistryController,
    McpRegistryDeveloperController,
    McpRegistryAdminController,
  ],
  providers: [
    McpRegistryService,
    McpRegistryEntriesRepository,
    McpRegistrySubmissionsRepository,
  ],
  exports: [McpRegistryService],
})
export class McpRegistryModule {}
