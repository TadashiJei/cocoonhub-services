import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, getMemberToken, ensureUser, prisma } from './utils';

describe('Events (e2e)', () => {
  let app: INestApplication;
  let memberToken: string;
  let userId: string;
  let eventId: string;

  beforeAll(async () => {
    app = await createApp();
    userId = `u_${Date.now()}`;
    await ensureUser(userId);
    memberToken = await getMemberToken(userId);

    const start = new Date(Date.now() + 3600_000);
    const end = new Date(start.getTime() + 3600_000);
    const ev = await prisma.event.create({
      data: { title: 'Open House', description: 'Welcome', startAt: start, endAt: end, location: 'HQ', capacity: 1, status: 'published' as any, publishedAt: new Date() },
    });
    eventId = ev.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists published events', async () => {
    const res = await request(app.getHttpServer()).get('/api/events').expect(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('member can register for event', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/events/${eventId}/register`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({})
      .expect(201);
    expect(res.body).toHaveProperty('status');
  });
});
