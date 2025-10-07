import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor(private readonly prisma: PrismaService) {
    const apiKey = process.env.STRIPE_API_KEY;
    const version: Stripe.LatestApiVersion = '2024-06-20';
    this.stripe = new Stripe(apiKey || 'sk_test_dummy', { apiVersion: version });
  }

  // Build Stripe Checkout Session from an existing order
  async createCheckoutSession(params: { orderId: string; successUrl: string; cancelUrl: string; customerEmail?: string; requesterUserId: string }) {
    if (!process.env.STRIPE_API_KEY) {
      throw new InternalServerErrorException('Stripe not configured');
    }
    const { orderId, successUrl, cancelUrl, customerEmail, requesterUserId } = params;
    const order = await (this.prisma as any).order.findUnique({ where: { id: orderId }, include: { items: { include: { product: true } } } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== requesterUserId) throw new NotFoundException('Order not found');
    if (order.status !== 'awaiting_payment' && order.status !== 'pending') {
      throw new BadRequestException('Order is not awaiting payment');
    }

    const currency = (order.currency as string).toLowerCase();
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = order.items.map((it: any) => {
      const name = it.product?.name || 'Item';
      const unitAmount = Math.round(Number(it.unitPrice) * 100);
      return {
        quantity: it.quantity,
        price_data: {
          currency,
          product_data: { name },
          unit_amount: unitAmount,
        },
        // tax is included in unit_price here; if you want Stripe tax, enable Tax Rates
      };
    });

    // Validate redirect URLs against allowlist in production to prevent open redirects
    const isProd = process.env.NODE_ENV === 'production';
    const redirectAllowlist = (process.env.STRIPE_REDIRECT_ALLOWLIST || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const urlAllowed = (u: string) => !isProd || redirectAllowlist.length === 0 || redirectAllowlist.some((p) => u.startsWith(p));
    if (!urlAllowed(successUrl) || !urlAllowed(cancelUrl)) {
      throw new BadRequestException('Redirect URL not allowed');
    }

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: customerEmail,
      metadata: { orderId },
    });
    return { id: session.id, url: session.url };
  }

  // Confirm session status by querying Stripe (alternative to webhooks)
  async confirmCheckoutSession(sessionId: string) {
    if (!process.env.STRIPE_API_KEY) {
      throw new InternalServerErrorException('Stripe not configured');
    }
    const session = await this.stripe.checkout.sessions.retrieve(sessionId);
    let updatedOrder: any = null;
    try {
      const orderId = (session.metadata as any)?.orderId as string | undefined;
      if (orderId && session.payment_status === 'paid') {
        // Idempotent: only update if not already paid/fulfilled
        const order = await (this.prisma as any).order.findUnique({ where: { id: orderId } });
        if (order && order.status !== 'paid' && order.status !== 'fulfilled') {
          updatedOrder = await (this.prisma as any).order.update({ where: { id: orderId }, data: { status: 'paid' } });
        } else {
          updatedOrder = order;
        }
      }
    } catch {
      // ignore, return session even if DB update fails
    }
    return { session, order: updatedOrder };
  }
}
