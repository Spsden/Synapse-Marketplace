import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
} from '@nestjs/terminus';

import { DatabaseHealthService } from './database-health.service';

/**
 * Health check controller for monitoring application status.
 * Provides endpoints for liveness and readiness probes.
 */
@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private healthCheckService: HealthCheckService,
    private databaseHealthService: DatabaseHealthService,
  ) {}

  /**
   * General health check endpoint.
   * Returns the health status of the application.
   */
  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: 'Health check',
    description: 'Returns the health status of the application',
  })
  async health(): Promise<HealthCheckResult> {
    return this.healthCheckService.check([
      () => this.databaseHealthService.isHealthy(),
    ]);
  }

  /**
   * Readiness probe - checks if the app is ready to serve traffic.
   * Used by orchestrators to route traffic away from pods that are initializing.
   */
  @Get('readiness')
  @HealthCheck()
  @ApiOperation({
    summary: 'Readiness check',
    description: 'Returns whether the application is ready to accept traffic',
  })
  async readiness(): Promise<HealthCheckResult> {
    return this.healthCheckService.check([
      () => this.databaseHealthService.isHealthy(),
    ]);
  }

  /**
   * Liveness probe - checks if the app is running.
   * Used by orchestrators to restart the container if needed.
   */
  @Get('liveness')
  @ApiOperation({
    summary: 'Liveness check',
    description: 'Returns whether the application is alive (for container orchestration)',
  })
  liveness() {
    return { status: 'ok', message: 'Application is alive' };
  }
}
