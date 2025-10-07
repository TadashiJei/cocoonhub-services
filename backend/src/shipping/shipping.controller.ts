import { Body, Controller, Get, Param, Post, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { NinjaVanService } from './ninjavan.service';
import { ManualShippingService } from './manual.service';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { CancelShipmentDto } from './dto/cancel-shipment.dto';
import { Roles } from '../auth/roles.decorator';
import { ManualCreateShipmentDto } from './dto/manual-create-shipment.dto';
import { PresignLabelDto } from './dto/presign-label.dto';
import { ManualUpdateStatusDto } from './dto/manual-update-status.dto';
import { ManualAddEventDto } from './dto/manual-add-event.dto';
import type { Request } from 'express';
import { Req } from '@nestjs/common';

@ApiTags('shipping')
@Controller('shipping/ninjavan')
export class ShippingController {
  constructor(
    private readonly nv: NinjaVanService,
    private readonly manual: ManualShippingService,
  ) {}

  @Post('orders')
  @ApiOperation({ summary: 'Create Ninja Van order', description: 'Creates a Ninja Van order (shipment). Payload follows NV spec (e.g., service_type, service_level, parcel_job, etc.).' })
  createOrder(@Body() body: CreateShipmentDto) {
    return this.nv.createOrder(body.payload);
  }

  @Get('orders/:trackingNumber')
  @ApiOperation({ summary: 'Get Ninja Van order', description: 'Fetches Ninja Van order details by tracking number.' })
  getOrder(@Param('trackingNumber') trackingNumber: string) {
    return this.nv.getOrder(trackingNumber);
  }

  @Post('orders/:trackingNumber/cancel')
  @ApiOperation({ summary: 'Cancel Ninja Van order', description: 'Cancels an existing Ninja Van order with an optional reason.' })
  cancel(@Param('trackingNumber') trackingNumber: string, @Body() body: CancelShipmentDto) {
    return this.nv.cancelOrder(trackingNumber, body.reason);
  }

  @Get('track/:trackingNumber')
  @ApiOperation({ summary: 'Track Ninja Van shipment', description: 'Gets tracking status for a Ninja Van shipment by tracking number.' })
  track(@Param('trackingNumber') trackingNumber: string) {
    return this.nv.track(trackingNumber);
  }
}

@ApiTags('shipping')
@Controller('shipping/manual')
export class ManualShippingController {
  constructor(private readonly manual: ManualShippingService) {}

  @Post('shipments')
  @Roles('admin')
  @ApiOperation({ summary: 'Create manual shipment (admin)', description: 'Creates a manual shipment for an order with optional carrier and tracking number.' })
  create(@Body() body: ManualCreateShipmentDto) {
    return this.manual.createShipment(body.orderId, { carrierName: body.carrierName, trackingNumber: body.trackingNumber });
  }

  @Post('shipments/:id/presign-label')
  @Roles('admin')
  @ApiOperation({ summary: 'Presign label upload (admin)', description: 'Returns a presigned URL to upload a shipping label (PDF/PNG/JPG) to R2.' })
  presignLabel(@Param('id') id: string, @Body() body: PresignLabelDto) {
    return this.manual.presignLabel(id, body.fileName, body.contentType);
  }

  @Patch('shipments/:id/status')
  @Roles('admin')
  @ApiOperation({ summary: 'Update shipment status (admin)', description: 'Update a manual shipment status and append an event.' })
  updateStatus(@Param('id') id: string, @Body() body: ManualUpdateStatusDto) {
    return this.manual.updateStatus(id, body.status);
  }

  @Post('shipments/:id/events')
  @Roles('admin')
  @ApiOperation({ summary: 'Add shipment event (admin)', description: 'Append a custom tracking event to a manual shipment.' })
  addEvent(@Param('id') id: string, @Body() body: ManualAddEventDto) {
    return this.manual.addEvent(id, { status: body.status, description: body.description, occurredAt: body.occurredAt ? new Date(body.occurredAt) : undefined });
  }

  @Get('shipments/:id/track')
  @Roles('member','admin')
  @ApiOperation({ summary: 'Track manual shipment', description: 'Returns shipment details and events; members can only view shipments for their orders.' })
  track(@Param('id') id: string, @Req() req: Request) {
    // Infer userId and role from JWT or dev header
    let userId: string | undefined;
    let asAdmin = false;
    const authHeader = (req.headers['authorization'] || req.headers['Authorization']) as string | undefined;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice('Bearer '.length);
      const parts = token.split('.')
      if (parts.length === 3) {
        try {
          const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
          const payload = JSON.parse(payloadJson);
          if (typeof payload?.sub === 'string') userId = payload.sub;
          if (Array.isArray(payload?.roles) && payload.roles.includes('admin')) asAdmin = true;
        } catch {}
      }
    }
    if (!userId && typeof req.headers['x-user-id'] === 'string') userId = req.headers['x-user-id'] as string;
    return this.manual.trackForUser(id, userId!, asAdmin);
  }
}
