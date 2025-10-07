import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface ListParams {
  page?: number;
  limit?: number;
  q?: string;
}

interface CreateOrderItemInput {
  productId: string;
  quantity: number;
}

@Injectable()
export class StoreService {
  constructor(private readonly prisma: PrismaService) {}

  async listProducts(params: ListParams) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.max(1, Math.min(100, params.limit ?? 12));
    const skip = (page - 1) * limit;
    const where = {
      status: 'published' as const,
      ...(params.q
        ? {
            OR: [
              { name: { contains: params.q, mode: 'insensitive' as const } },
              { description: { contains: params.q, mode: 'insensitive' as const } },
              { sku: { contains: params.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({ where, orderBy: [{ createdAt: 'desc' }], skip, take: limit }),
      this.prisma.product.count({ where }),
    ]);
    return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async createOrder(userId: string, items: CreateOrderItemInput[]) {
    if (!Array.isArray(items) || items.length === 0) throw new BadRequestException('items required');

    // Gather products
    const productIds = [...new Set(items.map(i => i.productId))];
    const products = await this.prisma.product.findMany({ where: { id: { in: productIds }, status: 'published' } });
    if (products.length !== productIds.length) throw new NotFoundException('One or more products not found');

    // Ensure same currency across items
    const currency = products[0].currency;
    if (!products.every(p => p.currency === currency)) {
      throw new BadRequestException('Products must share the same currency');
    }

    // Build line computations
    const productMap = new Map<string, (typeof products)[number]>(products.map(p => [p.id, p]));
    const lineCalcs = items.map(i => {
      if (i.quantity <= 0 || !Number.isFinite(i.quantity)) throw new BadRequestException('Invalid quantity');
      const p = productMap.get(i.productId)!;
      const unitPrice = new Prisma.Decimal(p.price);
      const qty = new Prisma.Decimal(i.quantity);
      const lineSubtotal = unitPrice.mul(qty);
      const taxRate = new Prisma.Decimal(p.taxRatePct).div(new Prisma.Decimal(100));
      const lineTax = lineSubtotal.mul(taxRate);
      const lineTotal = lineSubtotal.add(lineTax);
      return { product: p, quantity: i.quantity, unitPrice, taxRatePct: new Prisma.Decimal(p.taxRatePct), lineSubtotal, lineTax, lineTotal };
    });

    const subtotal = lineCalcs.reduce((acc, l) => acc.add(l.lineSubtotal), new Prisma.Decimal(0));
    const tax = lineCalcs.reduce((acc, l) => acc.add(l.lineTax), new Prisma.Decimal(0));
    const total = subtotal.add(tax);

    return this.prisma.$transaction(async (tx) => {
      const order = await (tx as any).order.create({
        data: {
          userId,
          status: 'awaiting_payment',
          subtotal,
          tax,
          total,
          currency,
        },
      });
      for (const lc of lineCalcs) {
        await (tx as any).orderItem.create({
          data: {
            orderId: order.id,
            productId: lc.product.id,
            quantity: lc.quantity,
            unitPrice: lc.unitPrice,
            currency,
            taxRatePct: lc.taxRatePct,
            lineSubtotal: lc.lineSubtotal,
            lineTax: lc.lineTax,
            lineTotal: lc.lineTotal,
          },
        });
      }
      return order;
    });
  }

  listMyOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });
  }

  // Move an order to awaiting_payment and return payment options (enabled banks)
  async checkoutOrder(userId: string, orderId: string) {
    const order = await (this.prisma as any).order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) throw new NotFoundException('Order not found');

    if (order.status === 'pending') {
      await (this.prisma as any).order.update({ where: { id: orderId }, data: { status: 'awaiting_payment' } });
      order.status = 'awaiting_payment';
    }

    // Build payment options from Bank + BankConfig
    const banks = await (this.prisma as any).bank.findMany({ include: { configs: true }, orderBy: { code: 'asc' } });
    const paymentOptions = banks.map((b: any) => {
      const cfg = b.configs?.[0];
      return {
        code: b.code,
        name: b.name,
        enabled: cfg?.enabled ?? true,
        dailyLimit: cfg?.dailyLimit ?? 0,
      };
    });

    const currency = String(order.currency).toUpperCase();
    const stripeConfigured = !!process.env.STRIPE_API_KEY;
    const recommendedMethods: string[] = [];
    const recommendedBanks: string[] = [];
    if (['USD', 'EUR', 'MYR'].includes(currency) && stripeConfigured) recommendedMethods.push('stripe');
    if (currency === 'PHP') {
      for (const o of paymentOptions) if (o.enabled) recommendedBanks.push(o.code);
    }

    return {
      order: {
        id: order.id,
        status: order.status,
        total: order.total,
        currency: order.currency,
        items: order.items,
      },
      paymentOptions,
      recommended: { methods: recommendedMethods, banks: recommendedBanks },
      instructions: `Submit a manual payment for the total amount and currency, then provide reference to finance. Banks: ${paymentOptions
        .filter((o: any) => o.enabled)
        .map((o: any) => o.code)
        .join(', ')}`,
    };
  }

  // Settle an order using user's ledger balance (credits from approved manual payments)
  async settleOrder(userId: string, orderId: string) {
    const order = await (this.prisma as any).order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) throw new NotFoundException('Order not found');
    if (order.status !== 'awaiting_payment' && order.status !== 'pending') {
      throw new BadRequestException('Order not awaiting payment');
    }

    const currency = order.currency as string;

    // Idempotency: if a debit ledger with this order ref already exists, return current state
    const existingDebit = await (this.prisma as any).ledgerEntry.findFirst({ where: { userId, currency, type: 'debit', ref: `order:${order.id}` } });
    if (existingDebit) {
      const current = await (this.prisma as any).order.findUnique({ where: { id: order.id } });
      return { ok: true, order: current };
    }

    // Compute balance from ledger (credits - debits) in same currency
    const entries = await (this.prisma as any).ledgerEntry.findMany({ where: { userId, currency } });
    const balance = entries.reduce((acc: Prisma.Decimal, e: any) => {
      return e.type === 'credit' ? acc.add(e.amount) : acc.sub(e.amount);
    }, new Prisma.Decimal(0));

    if (balance.lt(order.total)) {
      throw new BadRequestException('Insufficient balance');
    }

    return this.prisma.$transaction(async (tx: any) => {
      await tx.ledgerEntry.create({
        data: {
          userId,
          amount: order.total,
          currency,
          type: 'debit',
          ref: `order:${order.id}`,
        },
      });
      // Attempt to mark paid; if already updated by a concurrent tx, fetch current
      const upd = await tx.order.update({ where: { id: order.id }, data: { status: 'paid' } });
      const updated = upd;
      return { ok: true, order: updated };
    });
  }

  // Admin: fulfill an order (paid -> fulfilled)
  async fulfillOrder(orderId: string) {
    const order = await (this.prisma as any).order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== 'paid') throw new BadRequestException('Order is not paid');
    return (this.prisma as any).order.update({ where: { id: orderId }, data: { status: 'fulfilled' } });
  }

  // Admin: product management
  async createProduct(input: { sku: string; name: string; description?: string; price: number; currency: string; taxRatePct: number; stock?: number }) {
    return (this.prisma as any).product.create({
      data: {
        sku: input.sku,
        name: input.name,
        description: input.description ?? null,
        price: new Prisma.Decimal(input.price),
        currency: input.currency,
        taxRatePct: new Prisma.Decimal(input.taxRatePct),
        status: 'draft',
        stock: typeof input.stock === 'number' ? input.stock : null,
      },
    });
  }

  async updateProduct(id: string, input: { sku?: string; name?: string; description?: string; price?: number; currency?: string; taxRatePct?: number; stock?: number | null }) {
    const data: any = {};
    if (typeof input.sku === 'string') data.sku = input.sku;
    if (typeof input.name === 'string') data.name = input.name;
    if (typeof input.description === 'string') data.description = input.description;
    if (typeof input.price === 'number') data.price = new Prisma.Decimal(input.price);
    if (typeof input.currency === 'string') data.currency = input.currency;
    if (typeof input.taxRatePct === 'number') data.taxRatePct = new Prisma.Decimal(input.taxRatePct);
    if (typeof input.stock === 'number') data.stock = input.stock;
    if (input.stock === null) data.stock = null;
    return (this.prisma as any).product.update({ where: { id }, data });
  }

  async setProductStatus(id: string, status: 'draft' | 'published' | 'archived') {
    return (this.prisma as any).product.update({ where: { id }, data: { status } });
  }

  async setProductStock(id: string, stock: number | null) {
    return (this.prisma as any).product.update({ where: { id }, data: { stock } });
  }
}
