import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, getAdminToken } from './utils';

describe('Notifications (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    app = await createApp();
    adminToken = await getAdminToken();
  });

  afterAll(async () => {
    await app.close();
  });

  it('upserts template, lists, gets, sends (will fail without provider but return record), lists messages, retries', async () => {
    // Upsert template
    await request(app.getHttpServer())
      .post('/api/notifications/templates')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ key: 'welcome', channel: 'email', subject: 'Hi {{name}}', body: 'Hello {{name}}' })
      .expect(201);

    // List templates
    const listTpl = await request(app.getHttpServer())
      .get('/api/notifications/templates?channel=email')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(Array.isArray(listTpl.body)).toBe(true);

    // Get template
    await request(app.getHttpServer())
      .get('/api/notifications/templates/email/welcome')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // Send via template (no provider configured -> status failed, but 201)
    const send = await request(app.getHttpServer())
      .post('/api/notifications/send')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ channel: 'email', to: 'test@example.com', templateKey: 'welcome', variables: { name: 'Jay' } })
      .expect(201);
    expect(['pending', 'sent', 'failed']).toContain(send.body.status);

    // List messages
    const msgs = await request(app.getHttpServer())
      .get('/api/notifications/messages')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(Array.isArray(msgs.body)).toBe(true);

    // Retry
    await request(app.getHttpServer())
      .post(`/api/notifications/messages/${send.body.id}/retry`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
  });
});
