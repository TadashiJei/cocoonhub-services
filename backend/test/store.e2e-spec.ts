import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, getAdminToken, getMemberToken, prisma, ensureUser } from './utils';

describe('Store (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let memberToken: string;
  let userId: string;

  beforeAll(async () => {
    app = await createApp();
    adminToken = await getAdminToken();
    userId = `u_${Date.now()}`;
    await ensureUser(userId);
    memberToken = await getMemberToken(userId);
    // Ensure bank baseline (checkout payment options use banks list)
    await prisma.bank.upsert({
      where: { code: 'BPI' },
      create: { code: 'BPI', name: 'Bank of the Philippine Islands' },
      update: { name: 'Bank of the Philippine Islands' },
    });
    await prisma.bankConfig.upsert({ where: { bankCode: 'BPI' }, create: { bankCode: 'BPI', enabled: true, dailyLimit: 0 }, update: {} });
  });

  afterAll(async () => {
    await app.close();
  });

  it('admin creates product -> publish -> list public -> member creates order -> checkout -> settle with credits', async () => {
    // Create product (draft)
    const createRes = await request(app.getHttpServer())
      .post('/api/store/products/admin')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sku: `SKU-${Date.now()}`, name: 'Test Product', description: 'Desc', price: 100, currency: 'PHP', taxRatePct: 12, stock: 10 })
      .expect(201);
    const productId = createRes.body.id;

    // Publish product
    await request(app.getHttpServer())
      .post(`/api/store/products/admin/${productId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'published' })
      .expect(201);

    // Public list includes product
    const listRes = await request(app.getHttpServer()).get('/api/store/products').expect(200);
    expect(Array.isArray(listRes.body.items)).toBe(true);

    // Member creates order
    const orderRes = await request(app.getHttpServer())
      .post('/api/store/orders')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ items: [{ productId, quantity: 1 }] })
      .expect(201);

    const orderId = orderRes.body.id as string;

    // Checkout options
    const checkout = await request(app.getHttpServer())
      .post(`/api/store/orders/${orderId}/checkout`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({})
      .expect(201);
    expect(checkout.body).toHaveProperty('paymentOptions');

    // Seed ledger credits to settle
    await prisma.ledgerEntry.create({
      data: { userId, amount: orderRes.body.total, currency: 'PHP', type: 'credit', ref: `seed:${orderId}` },
    });

    // Settle
    const settle = await request(app.getHttpServer())
      .post(`/api/store/orders/${orderId}/settle`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({})
      .expect(201);
    expect(settle.body.ok).toBe(true);
    expect(settle.body.order.status).toBe('paid');
  });
});
