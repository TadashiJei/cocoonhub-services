import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Roles } from '../auth/roles.decorator';
import { EventsService } from './events.service';
import { ListEventsQueryDto } from './dto/list-events.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  @ApiOperation({ summary: 'List published events', description: 'Public list of published events with pagination and search.' })
  list(@Query() query: ListEventsQueryDto) {
    return this.events.listPublic(query);
  }

  @Post(':id/register')
  @Roles('member','admin','reviewer','finance')
  @ApiOperation({ summary: 'Register for event', description: 'Registers the user for an event; if capacity reached, the user is waitlisted.' })
  register(@Param('id') id: string, @Body() body: RegisterDto, @Req() req: Request) {
    // If userId not provided, infer from JWT dev header fallback
    let userId = body.userId;
    if (!userId) {
      const authHeader = (req.headers['authorization'] || req.headers['Authorization']) as string | undefined;
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice('Bearer '.length);
        const parts = token.split('.')
        if (parts.length === 3) {
          try {
            const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
            const payload = JSON.parse(payloadJson);
            if (typeof payload?.sub === 'string') userId = payload.sub;
          } catch {}
        }
      }
      if (!userId && typeof req.headers['x-user-id'] === 'string') userId = req.headers['x-user-id'] as string;
    }
    if (!userId) return { ok: false, error: 'userId required' };
    return this.events.register(id, userId);
  }

  @Post(':id/check-in/:userId')
  @Roles('admin')
  @ApiOperation({ summary: 'Check-in attendee (admin)', description: 'Marks a registered/waitlisted user as checked in for the event.' })
  checkIn(@Param('id') id: string, @Param('userId') userId: string) {
    return this.events.checkIn(id, userId);
  }
}
