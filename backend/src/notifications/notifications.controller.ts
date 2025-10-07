import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { NotificationsService } from './notifications.service';
import { UpsertTemplateDto } from './dto/upsert-template.dto';
import { SendNotificationDto } from './dto/send-notification.dto';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  // Templates
  @Post('templates')
  @Roles('admin')
  @ApiOperation({ summary: 'Upsert template (admin)' })
  upsertTemplate(@Body() body: UpsertTemplateDto) {
    return this.notifications.upsertTemplate(body);
  }

  @Get('templates')
  @Roles('admin')
  @ApiOperation({ summary: 'List templates (admin)' })
  listTemplates(@Query('channel') channel?: 'email'|'sms') {
    return this.notifications.listTemplates(channel as any);
  }

  @Get('templates/:channel/:key')
  @Roles('admin')
  @ApiOperation({ summary: 'Get template (admin)' })
  getTemplate(@Param('key') key: string, @Param('channel') channel: 'email'|'sms') {
    return this.notifications.getTemplate(key, channel);
  }

  // Messages
  @Post('send')
  @Roles('admin')
  @ApiOperation({ summary: 'Send notification (admin)' })
  send(@Body() body: SendNotificationDto) {
    return this.notifications.send(body as any);
  }

  @Get('messages')
  @Roles('admin')
  @ApiOperation({ summary: 'List messages (admin)' })
  listMessages(@Query('status') status?: 'pending'|'sent'|'failed', @Query('channel') channel?: 'email'|'sms', @Query('to') to?: string) {
    return this.notifications.listMessages({ status, channel, to });
  }

  @Post('messages/:id/retry')
  @Roles('admin')
  @ApiOperation({ summary: 'Retry a failed/pending message (admin)' })
  retry(@Param('id') id: string) {
    return this.notifications.retryMessage(id);
  }
}
