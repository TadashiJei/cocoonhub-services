import { Injectable } from '@nestjs/common';
import nodemailer from 'nodemailer';

@Injectable()
export class SmtpProvider {
  private transporter: nodemailer.Transporter | null = null;
  private fromEmail: string | undefined;

  constructor() {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    this.fromEmail = process.env.SMTP_FROM_EMAIL;

    if (host && port && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
    }
  }

  isConfigured() {
    return !!this.transporter && !!this.fromEmail;
  }

  async sendEmail(params: { to: string; subject: string; html: string }) {
    if (!this.transporter || !this.fromEmail) throw new Error('SMTP not configured');
    await this.transporter.sendMail({
      from: this.fromEmail,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
  }
}
