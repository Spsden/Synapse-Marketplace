import { Injectable, Logger } from '@nestjs/common';
import { HealthIndicator, HealthCheckError, HealthIndicatorResult } from '@nestjs/terminus';
import { createClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';

/**
 * Database health check service.
 * Checks if the database connection is working properly.
 */
@Injectable()
export class DatabaseHealthService extends HealthIndicator {
  private readonly logger = new Logger(DatabaseHealthService.name);
  private readonly supabase: ReturnType<typeof createClient>;

  constructor(private configService: ConfigService) {
    super();
    const supabaseConfig = this.configService.get('supabase');
    this.supabase = createClient(
      supabaseConfig.projectUrl,
      supabaseConfig.serviceRoleKey,
      { auth: { persistSession: false } },
    );
  }

  /**
   * Check if the database is accessible.
   * Returns a health indicator result.
   */
  async isHealthy(): Promise<HealthIndicatorResult> {
    try {
      const { error } = await this.supabase
        .from('plugins')
        .select('id')
        .limit(1)
        .single();

      if (error) {
        this.logger.error(`Database health check failed: ${error.message}`);
        throw new HealthCheckError('Database connection failed', this.getStatus('database', false, { error: error.message }));
      }

      this.logger.debug('Database health check passed');
      return this.getStatus('database', true);
    } catch (error) {
      this.logger.error(`Database health check error: ${error.message}`);
      throw new HealthCheckError('Database health check failed', this.getStatus('database', false, { error: error.message }));
    }
  }
}
