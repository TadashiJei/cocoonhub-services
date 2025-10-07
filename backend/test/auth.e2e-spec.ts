import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('dev-token issues a JWT', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/dev-token')
      .send({ roles: ['admin'], expSeconds: 3600 });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
  });
});
