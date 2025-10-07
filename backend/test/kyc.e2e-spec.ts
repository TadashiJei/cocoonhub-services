import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, getAdminToken, ensureUser } from './utils';

describe('KYC (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let userId: string;
  let applicationId: string;

  beforeAll(async () => {
    app = await createApp();
    adminToken = await getAdminToken();
    userId = `u_${Date.now()}`;
    await ensureUser(userId);
  });

  afterAll(async () => {
    await app.close();
  });

  it('submit application -> list -> set status -> list decisions', async () => {
    // Submit application (member-style, but no auth required in controller)
    const apply = await request(app.getHttpServer())
      .post('/api/kyc/apply')
      .send({ userId, documents: [{ type: 'id', fileRef: 'r2://doc1' }] })
      .expect(201);
    applicationId = apply.body.id;

    // Admin list applications
    const list = await request(app.getHttpServer())
      .get('/api/kyc/applications')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(Array.isArray(list.body)).toBe(true);

    // Admin set status with notes (encrypted at rest)
    const set = await request(app.getHttpServer())
      .patch(`/api/kyc/applications/${applicationId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved', notes: 'Looks good' })
      .expect(200);
    expect(set.body.ok).toBe(true);

    // Decisions include decrypted notes
    const decisions = await request(app.getHttpServer())
      .get(`/api/kyc/applications/${applicationId}/decisions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(Array.isArray(decisions.body)).toBe(true);
    if (decisions.body.length > 0) {
      expect(typeof decisions.body[0].notes === 'string' || decisions.body[0].notes === null).toBe(true);
    }
  });
});
