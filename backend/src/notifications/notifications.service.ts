import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SendgridProvider } from './providers/sendgrid.provider';
import { SmtpProvider } from './providers/smtp.provider';
import { TwilioProvider } from './providers/twilio.provider';

export type NotificationChannel = 'email' | 'sms';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sendgrid: SendgridProvider,
    private readonly smtp: SmtpProvider,
    private readonly twilio: TwilioProvider,
  ) {}

  private render(body: string, variables?: Record<string, any>): string {
    if (!variables) return body;
    return body.replace(/{{\s*([\w.]+)\s*}}/g, (_, key: string) => {
      const parts = key.split('.');
      let v: any = variables;
      for (const p of parts) v = v?.[p];
      return v == null ? '' : String(v);
    });
  }

  async upsertTemplate(input: { key: string; channel: NotificationChannel; subject?: string; body: string }) {
    if (input.channel === 'email' && !input.subject) throw new BadRequestException('subject required for email templates');
    return (this.prisma as any).notificationTemplate.upsert({
      where: { key_channel: { key: input.key, channel: input.channel } },
      create: { key: input.key, channel: input.channel, subject: input.subject ?? null, body: input.body },
      update: { subject: input.subject ?? null, body: input.body },
    });
  }

  async listTemplates(channel?: NotificationChannel) {
    return (this.prisma as any).notificationTemplate.findMany({ where: channel ? { channel } : undefined, orderBy: { key: 'asc' } });
  }

  async getTemplate(key: string, channel: NotificationChannel) {
    const tpl = await (this.prisma as any).notificationTemplate.findUnique({ where: { key_channel: { key, channel } } });
    if (!tpl) throw new BadRequestException('Template not found');
    return tpl;
  }

  private async sendEmailViaProvider(to: string, subject: string, body: string): Promise<{ provider: string }> {
    if (this.sendgrid.isConfigured()) {
      await this.sendgrid.sendEmail({ to, subject, html: body });
      return { provider: 'sendgrid' };
    }
    if (this.smtp.isConfigured()) {
      await this.smtp.sendEmail({ to, subject, html: body });
      return { provider: 'smtp' };
    }
    throw new InternalServerErrorException('No email provider configured');
  }

  private async sendSmsViaProvider(to: string, body: string): Promise<{ provider: string }> {
    if (this.twilio.isConfigured()) {
      await this.twilio.sendSms({ to, body });
      return { provider: 'twilio' };
    }
    throw new InternalServerErrorException('No SMS provider configured');
  }

  async send(input: {
    channel: NotificationChannel;
    to: string;
    subject?: string;
    body?: string;
    templateKey?: string;
    variables?: Record<string, any>;
    userId?: string;
  }) {
    // Resolve subject/body
    let subject = input.subject ?? null;
    let body = input.body ?? '';

    if (input.templateKey) {
      const tpl = await this.getTemplate(input.templateKey, input.channel);
      subject = tpl.subject ?? null;
      body = tpl.body;
    }
    body = this.render(body, input.variables);

    // Persist message (pending)
    const msg = await (this.prisma as any).notificationMessage.create({
      data: {
        userId: input.userId ?? null,
        channel: input.channel,
        to: input.to,
        subject,
        body,
        templateKey: input.templateKey ?? null,
        variables: input.variables ?? null,
        status: 'pending',
        attempts: 0,
      },
    });

    // Attempt send
    try {
      const now = new Date();
      let provider = '';
      if (input.channel === 'email') {
        if (!subject) throw new BadRequestException('subject required for email');
        const res = await this.sendEmailViaProvider(input.to, subject, body);
        provider = res.provider;
      } else if (input.channel === 'sms') {
        const res = await this.sendSmsViaProvider(input.to, body);
        provider = res.provider;
      } else {
        throw new BadRequestException('Unknown channel');
      }
      const updated = await (this.prisma as any).notificationMessage.update({
        where: { id: msg.id },
        data: { status: 'sent', provider, attempts: { increment: 1 }, lastAttemptAt: now, sentAt: now },
      });
      return updated;
    } catch (err: any) {
      const now = new Date();
      const updated = await (this.prisma as any).notificationMessage.update({
        where: { id: msg.id },
        data: { status: 'failed', attempts: { increment: 1 }, lastAttemptAt: now, lastError: String(err?.message || err) },
      });
      return updated;
    }
  }

  async retryMessage(id: string) {
    const msg = await (this.prisma as any).notificationMessage.findUnique({ where: { id } });
    if (!msg) throw new BadRequestException('Message not found');
    if (msg.status === 'sent') return msg;

    if (msg.channel === 'email') {
      if (!msg.subject) throw new BadRequestException('subject required for email');
      return this.send({ channel: 'email', to: msg.to, subject: msg.subject, body: msg.body, userId: msg.userId ?? undefined, templateKey: msg.templateKey ?? undefined, variables: msg.variables ?? undefined });
    } else if (msg.channel === 'sms') {
      return this.send({ channel: 'sms', to: msg.to, body: msg.body, userId: msg.userId ?? undefined, templateKey: msg.templateKey ?? undefined, variables: msg.variables ?? undefined });
    }
    throw new BadRequestException('Unknown channel');
  }

  async listMessages(filter?: { status?: 'pending'|'sent'|'failed'; channel?: NotificationChannel; to?: string }) {
    const where: any = {};
    if (filter?.status) where.status = filter.status;
    if (filter?.channel) where.channel = filter.channel;
    if (filter?.to) where.to = filter.to;
    return (this.prisma as any).notificationMessage.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 });
  }
}
