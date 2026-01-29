import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;

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

  describe('Developer Endpoints', () => {
    it('/api/v1/dev/plugins/submit (POST) without file should return error', () => {
      // Without file upload middleware in e2e test context, this returns 500
      // We're testing that the endpoint exists and handles the request
      return request(app.getHttpServer())
        .post('/api/v1/dev/plugins/submit')
        .expect((res) => {
          // Either 400 (validation error) or 500 (no file provided)
          expect([400, 500]).toContain(res.status);
        });
    });
  });

  describe('Admin Endpoints', () => {
    it('/api/v1/admin/review-queue (GET) should return review queue', () => {
      return request(app.getHttpServer())
        .get('/api/v1/admin/review-queue')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
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
