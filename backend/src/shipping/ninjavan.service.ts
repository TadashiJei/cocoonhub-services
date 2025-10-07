import { Injectable, InternalServerErrorException } from '@nestjs/common';

interface RequestOptions {
  method: 'GET' | 'POST' | 'DELETE' | 'PUT' | 'PATCH';
  path: string;
  body?: any;
  query?: Record<string, string | number | boolean | undefined>;
}

@Injectable()
export class NinjaVanService {
  private baseUrl = (process.env.NINJAVAN_BASE_URL || '').replace(/\/$/, '');
  private token = process.env.NINJAVAN_API_TOKEN || '';

  private buildUrl(path: string, query?: RequestOptions['query']) {
    const url = new URL(`${this.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }
    return url.toString();
  }

  private async request<T = any>({ method, path, body, query }: RequestOptions): Promise<T> {
    if (!this.baseUrl || !this.token) {
      throw new InternalServerErrorException('NINJAVAN_BASE_URL or NINJAVAN_API_TOKEN is not configured');
    }
    const res = await fetch(this.buildUrl(path, query), {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json: any;
    try { json = text ? JSON.parse(text) : undefined; } catch { json = text; }
    if (!res.ok) {
      throw new InternalServerErrorException({ status: res.status, statusText: res.statusText, body: json });
    }
    return json as T;
  }

  // Create order (shipment)
  createOrder(payload: any) {
    // Ninja Van typically 
    // POST /2.2/orders with payload similar to the YAML examples
    return this.request({ method: 'POST', path: '/2.2/orders', body: payload });
  }

  // Get order by tracking number
  getOrder(trackingNumber: string) {
    return this.request({ method: 'GET', path: `/2.2/orders/${encodeURIComponent(trackingNumber)}` });
  }

  // Cancel order
  cancelOrder(trackingNumber: string, reason?: string) {
    return this.request({ method: 'POST', path: `/2.2/orders/${encodeURIComponent(trackingNumber)}/cancel`, body: { reason } });
  }

  // Track shipment
  track(trackingNumber: string) {
    return this.request({ method: 'GET', path: `/2.2/track/${encodeURIComponent(trackingNumber)}` });
  }
}
