import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

/**
 * Token the admin/developer guards compare against. The guards read
 * process.env directly, so it must be set before the app is compiled.
 */
const ADMIN_TOKEN = 'e2e-marketplace-token';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(() => {
    process.env.SYNAPSE_MARKETPLACE_TOKEN = ADMIN_TOKEN;
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }));
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Health Endpoints', () => {
    it('/api/v1/health (GET)', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status');
          expect(res.body).toHaveProperty('info');
        });
    });

    it('/api/v1/health/liveness (GET)', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health/liveness')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status', 'ok');
        });
    });
  });

  describe('Store Endpoints', () => {
    it('/api/v1/store/plugins (GET) should return plugins list', () => {
      return request(app.getHttpServer())
        .get('/api/v1/store/plugins')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('total');
          expect(res.body).toHaveProperty('page');
          expect(res.body).toHaveProperty('pageSize');
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    it('/api/v1/store/plugins with pagination (GET)', () => {
      return request(app.getHttpServer())
        .get('/api/v1/store/plugins?page=0&pageSize=10')
        .expect(200)
        .expect((res) => {
          expect(res.body.page).toBe(0);
          expect(res.body.pageSize).toBe(10);
        });
    });

    it('/api/v1/store/plugins with category filter (GET)', () => {
      return request(app.getHttpServer())
        .get('/api/v1/store/plugins?category=productivity')
        .expect(200);
    });

    it('/api/v1/store/plugins with search (GET)', () => {
      return request(app.getHttpServer())
        .get('/api/v1/store/plugins?search=test')
        .expect(200);
    });

    it('/api/v1/store/plugins/:packageId (GET) for non-existent plugin should return 404', () => {
      return request(app.getHttpServer())
        .get('/api/v1/store/plugins/non.existent.plugin')
        .expect(404);
    });

    it('/api/v1/store/plugins/:packageId/versions (GET) for non-existent plugin should return 404', () => {
      return request(app.getHttpServer())
        .get('/api/v1/store/plugins/non.existent.plugin/versions')
        .expect(404);
    });

    it('/api/v1/store/versions/:versionId (GET) for non-existent version should return 404', () => {
      return request(app.getHttpServer())
        .get('/api/v1/store/versions/non-existent-version-id')
        .expect(404);
    });

    it('/api/v1/store/plugins/:packageId/statistics (GET) for non-existent plugin should return 404', () => {
      return request(app.getHttpServer())
        .get('/api/v1/store/plugins/non.existent.plugin/statistics')
        .expect(404);
    });
  });

  describe('Admin Endpoints', () => {
    it('/api/v1/admin/review-queue (GET) should reject an unauthenticated request', () => {
      return request(app.getHttpServer())
        .get('/api/v1/admin/review-queue')
        .expect(401);
    });

    it('/api/v1/admin/review-queue (GET) should return review queue with a valid token', () => {
      return request(app.getHttpServer())
        .get('/api/v1/admin/review-queue')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('/api/v1/admin/plugins/ingest (POST) should require a token', () => {
      return request(app.getHttpServer())
        .post('/api/v1/admin/plugins/ingest')
        .send({ dryRun: true })
        .expect(401);
    });

    it('/api/v1/admin/plugins/ingest (POST) should reject a malformed commitSha', () => {
      return request(app.getHttpServer())
        .post('/api/v1/admin/plugins/ingest')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ commitSha: 'not-a-sha' })
        .expect(400);
    });
  });

  describe('Validation', () => {
    it('should handle negative page parameter gracefully', () => {
      // The service handles invalid pagination values internally
      return request(app.getHttpServer())
        .get('/api/v1/store/plugins?page=-1')
        .expect(200)
        .expect((res) => {
          // Service handles negative page internally
          expect(res.body).toHaveProperty('data');
        });
    });

    it('should handle zero pageSize parameter gracefully', () => {
      return request(app.getHttpServer())
        .get('/api/v1/store/plugins?pageSize=0')
        .expect(200)
        .expect((res) => {
          // Service handles invalid pageSize internally
          expect(res.body).toHaveProperty('data');
        });
    });
  });

  describe('Not Found', () => {
    it('/api/v1/non-existent (GET) should return 404', () => {
      return request(app.getHttpServer())
        .get('/api/v1/non-existent')
        .expect(404);
    });
  });
});
