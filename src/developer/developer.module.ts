import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { DeveloperService } from './developer.service';
import { DeveloperController } from './developer.controller';
import { PluginsModule } from '../plugins/plugins.module';

/**
 * Developer module - handles developer plugin submission operations.
 */
@Module({
  imports: [
    ConfigModule,
    PluginsModule,
    MulterModule.register({
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
      },
    }),
  ],
  controllers: [DeveloperController],
  providers: [DeveloperService],
})
export class DeveloperModule {}
