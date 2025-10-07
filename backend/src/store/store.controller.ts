import { Body, Controller, Get, Post, Query, Req, Param, Patch } from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { StoreService } from './store.service';
import { ListProductsQueryDto } from './dto/list-products.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { SetProductStatusDto } from './dto/set-product-status.dto';
import { SetProductStockDto } from './dto/set-product-stock.dto';

@ApiTags('store')
@Controller('store')
export class StoreController {
  constructor(private readonly store: StoreService) {}

  @Get('products')
  @ApiOperation({ summary: 'List products', description: 'Public list of published products with pagination/search.' })
  listProducts(@Query() query: ListProductsQueryDto) {
    return this.store.listProducts(query);
  }

  @Post('orders')
  @Roles('member','admin')
  @ApiOperation({ summary: 'Create order', description: 'Creates an order with tax calculation from current product prices and tax rates.' })
  createOrder(@Body() body: CreateOrderDto, @Req() req: Request) {
    let userId = body.userId;
    if (!userId) {
      const authHeader = (req.headers['authorization'] || req.headers['Authorization']) as string | undefined;
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice('Bearer '.length);
        const parts = token.split('.')
        if (parts.length === 3) {
          try {
            const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
            const payload = JSON.parse(payloadJson);
            if (typeof payload?.sub === 'string') userId = payload.sub;
          } catch {}
        }
      }
      if (!userId && typeof req.headers['x-user-id'] === 'string') userId = req.headers['x-user-id'] as string;
    }
    if (!userId) return { ok: false, error: 'userId required' };
    return this.store.createOrder(userId, body.items);
  }

  @Get('orders/me')
  @Roles('member','admin')
  @ApiOperation({ summary: 'My orders', description: 'Lists orders for the current user including items.' })
  listMyOrders(@Req() req: Request) {
    let userId: string | undefined;
    const authHeader = (req.headers['authorization'] || req.headers['Authorization']) as string | undefined;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice('Bearer '.length);
      const parts = token.split('.')
      if (parts.length === 3) {
        try {
          const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
          const payload = JSON.parse(payloadJson);
          if (typeof payload?.sub === 'string') userId = payload.sub;
        } catch {}
      }
    }
    if (!userId && typeof req.headers['x-user-id'] === 'string') userId = req.headers['x-user-id'] as string;
    if (!userId) return [];
    return this.store.listMyOrders(userId);
  }

  @Post('orders/:id/checkout')
  @Roles('member','admin')
  @ApiOperation({ summary: 'Checkout order', description: 'Moves order to awaiting_payment and returns available manual payment options.' })
  checkout(@Param('id') id: string, @Req() req: Request) {
    let userId: string | undefined;
    const authHeader = (req.headers['authorization'] || req.headers['Authorization']) as string | undefined;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice('Bearer '.length);
      const parts = token.split('.')
      if (parts.length === 3) {
        try {
          const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
          const payload = JSON.parse(payloadJson);
          if (typeof payload?.sub === 'string') userId = payload.sub;
        } catch {}
      }
    }
    if (!userId && typeof req.headers['x-user-id'] === 'string') userId = req.headers['x-user-id'] as string;
    if (!userId) return { ok: false, error: 'userId required' };
    return this.store.checkoutOrder(userId, id);
  }

  @Post('orders/:id/settle')
  @Roles('member','admin')
  @ApiOperation({ summary: 'Settle order from ledger', description: 'Debits user ledger credits (from approved manual payments) to mark order as paid.' })
  settle(@Param('id') id: string, @Req() req: Request) {
    let userId: string | undefined;
    const authHeader = (req.headers['authorization'] || req.headers['Authorization']) as string | undefined;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice('Bearer '.length);
      const parts = token.split('.')
      if (parts.length === 3) {
        try {
          const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
          const payload = JSON.parse(payloadJson);
          if (typeof payload?.sub === 'string') userId = payload.sub;
        } catch {}
      }
    }
    if (!userId && typeof req.headers['x-user-id'] === 'string') userId = req.headers['x-user-id'] as string;
    if (!userId) return { ok: false, error: 'userId required' };
    return this.store.settleOrder(userId, id);
  }

  // ---- Admin: Order fulfillment ----
  @Post('orders/:id/fulfill')
  @Roles('admin')
  @ApiOperation({ summary: 'Fulfill order (admin)', description: 'Moves order from paid to fulfilled.' })
  fulfill(@Param('id') id: string) {
    return this.store.fulfillOrder(id);
  }

  // ---- Admin: Product management ----
  @Post('products/admin')
  @Roles('admin')
  @ApiOperation({ summary: 'Create product (admin)', description: 'Creates a new product in draft status.' })
  createProduct(@Body() body: CreateProductDto) {
    return this.store.createProduct(body);
  }

  @Patch('products/admin/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update product (admin)', description: 'Updates product fields.' })
  updateProduct(@Param('id') id: string, @Body() body: UpdateProductDto) {
    return this.store.updateProduct(id, body);
  }

  @Post('products/admin/:id/status')
  @Roles('admin')
  @ApiOperation({ summary: 'Set product status (admin)', description: 'Sets product status to draft/published/archived.' })
  setProductStatus(@Param('id') id: string, @Body() body: SetProductStatusDto) {
    return this.store.setProductStatus(id, body.status);
  }

  @Post('products/admin/:id/stock')
  @Roles('admin')
  @ApiOperation({ summary: 'Set product stock (admin)', description: 'Sets or clears product stock (null for unlimited).' })
  setProductStock(@Param('id') id: string, @Body() body: SetProductStockDto) {
    const stock = typeof body.stock === 'number' ? body.stock : null;
    return this.store.setProductStock(id, stock);
  }
}
