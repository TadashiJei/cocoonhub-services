import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBulletinDto } from './dto/create-bulletin.dto';

@Injectable()
export class BulletinsService {
  constructor(private readonly prisma: PrismaService) {}

  listPublished() {
    return this.prisma.bulletin.findMany({
      where: { status: 'published' },
      orderBy: [{ publishedAt: 'desc' }],
    });
  }

  async listPublishedPaginated(params: { page?: number; limit?: number; q?: string }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.max(1, Math.min(100, params.limit ?? 10));
    const skip = (page - 1) * limit;
    const where = {
      status: 'published' as const,
      ...(params.q
        ? {
            OR: [
              { title: { contains: params.q, mode: 'insensitive' as const } },
              { body: { contains: params.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.bulletin.findMany({ where, orderBy: [{ publishedAt: 'desc' }], skip, take: limit }),
      this.prisma.bulletin.count({ where }),
    ]);
    return {
      items,
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  create(dto: CreateBulletinDto) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.bulletin.create({
        data: {
          title: dto.title,
          body: dto.body,
          status: dto.status ?? 'draft',
          publishedAt: dto.status === 'published' ? new Date() : null,
        },
      });
      await tx.bulletinVersion.create({
        data: {
          bulletinId: created.id,
          version: 1,
          title: created.title,
          body: created.body,
          status: created.status as any,
          createdByUserId: null,
        },
      });
      return created;
    });
  }

  async publish(id: string) {
    const exists = await this.prisma.bulletin.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Not found');
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.bulletin.update({
        where: { id },
        data: { status: 'published', publishedAt: new Date() },
      });
      const last = await tx.bulletinVersion.findFirst({
        where: { bulletinId: id },
        orderBy: { version: 'desc' },
      });
      const nextVersion = (last?.version ?? 0) + 1;
      await tx.bulletinVersion.create({
        data: {
          bulletinId: id,
          version: nextVersion,
          title: updated.title,
          body: updated.body,
          status: updated.status as any,
          createdByUserId: null,
        },
      });
      return updated;
    });
  }

  async unpublish(id: string) {
    const exists = await this.prisma.bulletin.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Not found');
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.bulletin.update({
        where: { id },
        data: { status: 'draft', publishedAt: null },
      });
      const last = await tx.bulletinVersion.findFirst({
        where: { bulletinId: id },
        orderBy: { version: 'desc' },
      });
      const nextVersion = (last?.version ?? 0) + 1;
      await tx.bulletinVersion.create({
        data: {
          bulletinId: id,
          version: nextVersion,
          title: updated.title,
          body: updated.body,
          status: updated.status as any,
          createdByUserId: null,
        },
      });
      return updated;
    });
  }

  listVersions(bulletinId: string) {
    return this.prisma.bulletinVersion.findMany({
      where: { bulletinId },
      orderBy: { version: 'desc' },
    });
  }

  async revertToVersion(bulletinId: string, version: number) {
    const ver = await this.prisma.bulletinVersion.findUnique({
      where: { bulletinId_version: { bulletinId, version } },
    });
    if (!ver) throw new NotFoundException('Version not found');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.bulletin.update({
        where: { id: bulletinId },
        data: {
          title: ver.title,
          body: ver.body,
          status: ver.status as any,
          publishedAt: ver.status === 'published' ? new Date() : null,
        },
      });
      const last = await tx.bulletinVersion.findFirst({
        where: { bulletinId },
        orderBy: { version: 'desc' },
      });
      const nextVersion = (last?.version ?? 0) + 1;
      await tx.bulletinVersion.create({
        data: {
          bulletinId,
          version: nextVersion,
          title: updated.title,
          body: updated.body,
          status: updated.status as any,
          createdByUserId: null,
        },
      });
      return updated;
    });
  }
}
