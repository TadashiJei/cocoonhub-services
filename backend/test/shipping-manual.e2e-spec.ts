import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, getAdminToken, getMemberToken, ensureUser } from './utils';

describe('Shipping Manual (e2e)', () => {
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
  });

  afterAll(async () => {
    await app.close();
  });

  it('create order -> admin creates shipment -> presign -> update status -> add event -> member can track', async () => {
    // Create product and publish (admin)
    const prod = await request(app.getHttpServer())
      .post('/api/store/products/admin')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sku: `SKU-${Date.now()}`, name: 'Ship Item', price: 50, currency: 'PHP', taxRatePct: 12 })
      .expect(201);
    const productId = prod.body.id as string;

    await request(app.getHttpServer())
      .post(`/api/store/products/admin/${productId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'published' })
      .expect(201);

    // Member creates order
    const order = await request(app.getHttpServer())
      .post('/api/store/orders')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ items: [{ productId, quantity: 1 }] })
      .expect(201);
    const orderId = order.body.id as string;

    // Admin creates manual shipment for the order
    const shipment = await request(app.getHttpServer())
      .post('/api/shipping/manual/shipments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ orderId, carrierName: 'ManualCarrier', trackingNumber: `TRK-${Date.now()}` })
      .expect(201);
    const shipmentId = shipment.body.id as string;

    // Presign label
    const presign = await request(app.getHttpServer())
      .post(`/api/shipping/manual/shipments/${shipmentId}/presign-label`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fileName: 'label.pdf' })
      .expect(201);
    expect(presign.body).toHaveProperty('url');

    // Update status
    await request(app.getHttpServer())
      .patch(`/api/shipping/manual/shipments/${shipmentId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'in_transit' })
      .expect(200);

    // Add event
    await request(app.getHttpServer())
      .post(`/api/shipping/manual/shipments/${shipmentId}/events`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'delivered', description: 'Delivered successfully' })
      .expect(201);

    // Member can track
    const track = await request(app.getHttpServer())
      .get(`/api/shipping/manual/shipments/${shipmentId}/track`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);
    expect(track.body).toHaveProperty('shipment');
    expect(Array.isArray(track.body.events)).toBe(true);
  });
});
