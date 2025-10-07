import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { SendgridProvider } from './providers/sendgrid.provider';
import { SmtpProvider } from './providers/smtp.provider';
import { TwilioProvider } from './providers/twilio.provider';
import { NotificationsMaintenanceService } from './notifications.maintenance';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, SendgridProvider, SmtpProvider, TwilioProvider, NotificationsMaintenanceService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
