import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class ManualShippingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async createShipment(orderId: string, params: { carrierName?: string; trackingNumber?: string }) {
    // Ensure order exists
    const order = await (this.prisma as any).order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    return (this.prisma as any).shipment.create({
      data: {
        orderId,
        provider: 'manual',
        status: 'pending',
        carrierName: params.carrierName,
        trackingNumber: params.trackingNumber,
      },
    });
  }

  async presignLabel(shipmentId: string, fileName?: string, contentType?: string) {
    const s = await (this.prisma as any).shipment.findUnique({ where: { id: shipmentId } });
    if (!s) throw new NotFoundException('Shipment not found');
    const safeFile = (fileName || 'label.pdf').replace(/[^a-zA-Z0-9_.-]+/g, '_');
    const key = `shipments/${shipmentId}/${Date.now()}-${safeFile}`;
    const ct = contentType || (safeFile.toLowerCase().endsWith('.png') ? 'image/png' : safeFile.toLowerCase().endsWith('.jpg') || safeFile.toLowerCase().endsWith('.jpeg') ? 'image/jpeg' : 'application/pdf');
    const presign = this.storage.presignUpload({ key, contentType: ct });
    // Store labelKey now; can be overwritten on re-presign
    await (this.prisma as any).shipment.update({ where: { id: shipmentId }, data: { labelKey: presign.key } });
    return presign;
  }

  async updateStatus(shipmentId: string, status: 'pending'|'labeled'|'in_transit'|'delivered'|'canceled') {
    const s = await (this.prisma as any).shipment.findUnique({ where: { id: shipmentId } });
    if (!s) throw new NotFoundException('Shipment not found');
    const updated = await (this.prisma as any).shipment.update({ where: { id: shipmentId }, data: { status } });
    await (this.prisma as any).shipmentEvent.create({ data: { shipmentId, status, description: `Status set to ${status}` } });
    return updated;
  }

  async addEvent(shipmentId: string, params: { status?: 'pending'|'labeled'|'in_transit'|'delivered'|'canceled'; description?: string; occurredAt?: Date }) {
    const s = await (this.prisma as any).shipment.findUnique({ where: { id: shipmentId } });
    if (!s) throw new NotFoundException('Shipment not found');
    return (this.prisma as any).shipmentEvent.create({
      data: {
        shipmentId,
        status: params.status ?? s.status,
        description: params.description,
        occurredAt: params.occurredAt ?? new Date(),
      },
    });
  }

  async trackForUser(shipmentId: string, userId: string, asAdmin: boolean) {
    const shipment = await (this.prisma as any).shipment.findUnique({
      where: { id: shipmentId },
      include: { order: true },
    });
    if (!shipment) throw new NotFoundException('Shipment not found');
    if (!asAdmin && shipment.order.userId !== userId) throw new ForbiddenException('Not allowed');
    const events = await (this.prisma as any).shipmentEvent.findMany({ where: { shipmentId }, orderBy: { occurredAt: 'asc' } });
    return { shipment: { ...shipment, order: undefined }, events };
  }
}
