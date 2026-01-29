import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { DatabaseHealthService } from './database-health.service';

/**
 * Health check module.
 * Provides endpoints for monitoring application health.
 */
@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [DatabaseHealthService, ConfigService],
  exports: [DatabaseHealthService],
})
export class HealthModule {}
