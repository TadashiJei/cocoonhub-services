import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, getAdminToken, ensureUser, prisma } from './utils';

describe('Payments Manual (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  const userId = `u_${Date.now()}`;

  beforeAll(async () => {
    app = await createApp();
    adminToken = await getAdminToken();
    await ensureUser(userId);
    // Ensure bank exists and enabled
    await prisma.bank.upsert({ where: { code: 'BDO' }, create: { code: 'BDO', name: 'Banco de Oro' }, update: { name: 'Banco de Oro' } });
    await prisma.bankConfig.upsert({ where: { bankCode: 'BDO' }, create: { bankCode: 'BDO', enabled: true, dailyLimit: 0 }, update: { enabled: true } });
  });

  afterAll(async () => {
    await app.close();
  });

  it('submit manual request -> admin list -> review -> approve -> verify ledger credit', async () => {
    // Submit
    const submit = await request(app.getHttpServer())
      .post('/api/payments/manual-requests')
      .send({ userId, bankCode: 'BDO', amount: 1000, currency: 'PHP', notes: 'Deposit slip 123' })
      .expect(201);

    const reqId = submit.body.id as string;

    // Admin list
    const list = await request(app.getHttpServer())
      .get('/api/payments/manual-requests')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(Array.isArray(list.body)).toBe(true);

    // Under review
    await request(app.getHttpServer())
      .post(`/api/payments/manual-requests/${reqId}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: 'Reviewing' })
      .expect(201);

    // Approve
    const approve = await request(app.getHttpServer())
      .post(`/api/payments/manual-requests/${reqId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ref: 'bankref-001', notes: 'OK' })
      .expect(201);
    expect(approve.body.ok).toBe(true);

    // Ledger has credit
    const ledger = await prisma.ledgerEntry.findMany({ where: { userId, currency: 'PHP', type: 'credit', manualRequestId: reqId } });
    expect(ledger.length).toBeGreaterThanOrEqual(1);
  });
});
