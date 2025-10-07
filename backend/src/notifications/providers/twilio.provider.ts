import { Injectable } from '@nestjs/common';
import Twilio from 'twilio';

@Injectable()
export class TwilioProvider {
  private client: Twilio.Twilio | null = null;
  private fromNumber: string | undefined;

  constructor() {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = process.env.TWILIO_FROM_NUMBER;
    if (sid && token) {
      this.client = Twilio(sid, token);
    }
  }

  isConfigured() {
    return !!this.client && !!this.fromNumber;
  }

  async sendSms(params: { to: string; body: string }) {
    if (!this.client || !this.fromNumber) throw new Error('Twilio not configured');
    await this.client.messages.create({
      body: params.body,
      to: params.to,
      from: this.fromNumber,
    });
  }
}
