import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ListEventsParams {
  page?: number;
  limit?: number;
  q?: string;
}

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublic(params: ListEventsParams) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.max(1, Math.min(100, params.limit ?? 10));
    const skip = (page - 1) * limit;
    const where = {
      status: 'published' as const,
      ...(params.q
        ? {
            OR: [
              { title: { contains: params.q, mode: 'insensitive' as const } },
              { description: { contains: params.q, mode: 'insensitive' as const } },
              { location: { contains: params.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.event.findMany({ where, orderBy: [{ startAt: 'asc' }], skip, take: limit }),
      this.prisma.event.count({ where }),
    ]);
    return {
      items,
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async register(eventId: string, userId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    if (event.status !== 'published') throw new BadRequestException('Event is not open for registration');

    let status: 'registered' | 'waitlisted' = 'registered';
    if (typeof event.capacity === 'number' && event.capacity >= 0) {
      const registeredCount = await this.prisma.registration.count({
        where: { eventId, status: 'registered' },
      });
      if (registeredCount >= event.capacity) status = 'waitlisted';
    }

    return this.prisma.registration.upsert({
      where: { eventId_userId: { eventId, userId } },
      update: { status },
      create: { eventId, userId, status },
    });
  }

  async checkIn(eventId: string, userId: string) {
    const reg = await this.prisma.registration.findUnique({ where: { eventId_userId: { eventId, userId } } });
    if (!reg) throw new NotFoundException('Registration not found');
    if (reg.status === 'canceled') throw new BadRequestException('Registration canceled');
    return this.prisma.registration.update({
      where: { eventId_userId: { eventId, userId } },
      data: { status: 'checked_in', checkedInAt: new Date() },
    });
  }
}
