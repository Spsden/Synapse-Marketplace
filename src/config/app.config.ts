import { registerAs } from '@nestjs/config';

/**
 * General application configuration.
 */
export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiPrefix: process.env.API_PREFIX || 'api/v1',

  // Timeout configuration
  timeout: {
    submission: {
      seconds: parseInt(process.env.TIMEOUT_SUBMISSION_SECONDS || '5', 10),
      enabled: process.env.TIMEOUT_SUBMISSION_ENABLED === 'true',
    },
  },

  // Pagination defaults
  pagination: {
    defaultPageSize: 20,
    maxPageSize: 100,
  },
}));
