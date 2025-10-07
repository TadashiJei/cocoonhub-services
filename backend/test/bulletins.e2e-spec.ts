import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

async function getAdminToken(app: INestApplication) {
  const res = await request(app.getHttpServer()).post('/api/auth/dev-token').send({ roles: ['admin'], expSeconds: 3600 });
  return res.body.token as string;
}

describe('Bulletins (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  const title = `Test Bulletin ${Date.now()}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    adminToken = await getAdminToken(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('admin can create, publish, list versions, and list published', async () => {
    // Create draft
    const created = await request(app.getHttpServer())
      .post('/api/bulletins')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title, body: 'Body', status: 'draft' })
      .expect(201);

    // Publish
    await request(app.getHttpServer())
      .post(`/api/bulletins/${created.body.id}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(201);

    // Versions
    const versions = await request(app.getHttpServer())
      .get(`/api/bulletins/${created.body.id}/versions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(Array.isArray(versions.body)).toBe(true);

    // Public list
    const list = await request(app.getHttpServer()).get('/api/bulletins').expect(200);
    expect(Array.isArray(list.body.items)).toBe(true);
  });
});
