import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsMaintenanceService {
  private readonly logger = new Logger(NotificationsMaintenanceService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeOldMessages() {
    const days = Number(process.env.NOTIFICATIONS_RETENTION_DAYS || 90);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    try {
      const result = await this.prisma.notificationMessage.deleteMany({
        where: {
          createdAt: { lt: cutoff },
          status: { in: ['sent', 'failed'] as any },
        },
      });
      this.logger.log(`Purged ${result.count} notification messages older than ${days} days`);
    } catch (e) {
      this.logger.error('Failed to purge old notification messages', e as any);
    }
  }
}
