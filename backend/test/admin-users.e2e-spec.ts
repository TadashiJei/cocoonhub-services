import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, getAdminToken, ensureUser, prisma } from './utils';

describe('Admin Users (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let targetUserId: string;

  beforeAll(async () => {
    app = await createApp();
    adminToken = await getAdminToken();
    targetUserId = `u_${Date.now()}`;
    await ensureUser(targetUserId);
  });

  afterAll(async () => {
    await app.close();
  });

  it('list users', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('get user, set status, manage roles, reissue token', async () => {
    // details
    await request(app.getHttpServer())
      .get(`/api/admin/users/${targetUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // set status
    await request(app.getHttpServer())
      .patch(`/api/admin/users/${targetUserId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'active' })
      .expect(200);

    // add role
    await request(app.getHttpServer())
      .post(`/api/admin/users/${targetUserId}/roles`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'member' })
      .expect(201);

    // list roles
    const roles = await request(app.getHttpServer())
      .get(`/api/admin/users/${targetUserId}/roles`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(Array.isArray(roles.body)).toBe(true);

    // remove role
    await request(app.getHttpServer())
      .delete(`/api/admin/users/${targetUserId}/roles/member`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // reissue token
    const tok = await request(app.getHttpServer())
      .post(`/api/admin/users/${targetUserId}/dev-token`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(201);
    expect(tok.body).toHaveProperty('token');
  });
});
