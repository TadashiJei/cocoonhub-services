import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, getAdminToken, prisma } from './utils';

describe('Payments (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    app = await createApp();
    adminToken = await getAdminToken();
    // Ensure at least one bank exists
    await prisma.bank.upsert({
      where: { code: 'BPI' },
      create: { code: 'BPI', name: 'Bank of the Philippine Islands' },
      update: { name: 'Bank of the Philippine Islands' },
    });
    await prisma.bankConfig.upsert({
      where: { bankCode: 'BPI' },
      create: { bankCode: 'BPI', enabled: true, dailyLimit: 0 },
      update: { enabled: true },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists banks', async () => {
    const res = await request(app.getHttpServer()).get('/api/payments/banks').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    const bpi = res.body.find((b: any) => b.code === 'BPI');
    expect(bpi).toBeTruthy();
  });

  it('admin can set and get bank config', async () => {
    await request(app.getHttpServer())
      .post('/api/payments/banks/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'BPI', enabled: false, dailyLimit: 5000 })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/api/payments/banks/BPI')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.enabled).toBe(false);
    expect(Number(res.body.dailyLimit)).toBe(5000);
  });
});
