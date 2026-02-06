import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AppConfigModule } from './config/config.module';
import { StorageModule } from './storage/storage.module';
import { PluginsModule } from './plugins/plugins.module';
import { DeveloperModule } from './developer/developer.module';
import { AdminModule } from './admin/admin.module';
import { HealthModule } from './health';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { OAuthModule } from './oauth/oauth.module';
import { VaultModule } from './vault/vault.module';

/**
 * Root application module.
 */
@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    AppConfigModule,

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 seconds
        limit: 100, // 100 requests per minute
      },
    ]),

    // Feature modules
    HealthModule,
    VaultModule,
    StorageModule,
    PluginsModule,
    DeveloperModule,
    AdminModule,
    OAuthModule,
  ],
  controllers: [],
  providers: [
    // Apply rate limiting globally
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  /**
   * Configure middleware.
   * Applies correlation ID middleware to all routes.
   */
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
  /**
   * Setup Swagger documentation.
   */
  static setupSwagger(app: any): void {
    const config = new DocumentBuilder()
      .setTitle('Synapse Plugin Store API')
      .setDescription(
        'Enterprise marketplace API for Synapse Second Mind app plugins. ' +
          'Built with NestJS and Supabase.',
      )
      .setVersion('1.0.0')
      .addTag('Store', 'Public API for browsing and downloading published plugins')
      .addTag('Developer', 'API for developers to submit and manage plugins')
      .addTag('Admin', 'API for administrators to review and manage plugins')
      .addTag('Health', 'Health check endpoints for monitoring')
      .addTag('OAuth', 'OAuth 2.0 authentication flows for plugins')
      .addTag('OAuth Proxy', 'Proxy endpoints for authenticated provider API calls')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api-docs', app, document);
  }
}
