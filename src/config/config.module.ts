import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { appConfig } from './app.config';
import { supabaseConfig } from './supabase.config';

/**
 * Configuration module that loads all environment-based settings.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, supabaseConfig],
      envFilePath: ['.env.local', '.env'],
    }),
  ],
  exports: [ConfigModule],
})
export class AppConfigModule {}
