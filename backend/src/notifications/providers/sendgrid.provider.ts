import { Injectable } from '@nestjs/common';
import sgMail from '@sendgrid/mail';

@Injectable()
export class SendgridProvider {
  private configured = false;
  private fromEmail: string | undefined;

  constructor() {
    const key = process.env.SENDGRID_API_KEY;
    this.fromEmail = process.env.SENDGRID_FROM_EMAIL;
    if (key) {
      sgMail.setApiKey(key);
      this.configured = true;
    }
  }

  isConfigured() {
    return this.configured && !!this.fromEmail;
  }

  async sendEmail(params: { to: string; subject: string; html: string }) {
    if (!this.isConfigured()) throw new Error('SendGrid not configured');
    await sgMail.send({
      to: params.to,
      from: this.fromEmail!,
      subject: params.subject,
      html: params.html,
    });
  }
}
