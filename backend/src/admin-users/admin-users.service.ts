import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Role } from '../auth/roles.enum';
import { createHmac } from 'node:crypto';

function base64url(input: Buffer | string) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signHS256(data: string, secret: string) {
  return base64url(createHmac('sha256', secret).update(data).digest());
}

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(params: { query?: string; status?: string; skip?: number; take?: number }) {
    const where: any = {};
    if (params.query) where.email = { contains: params.query, mode: 'insensitive' };
    if (params.status) where.status = params.status;
    const take = Math.min(Math.max(params.take ?? 20, 1), 100);
    const skip = Math.max(params.skip ?? 0, 0);
    const [items, total] = await this.prisma.$transaction([
      (this.prisma as any).user.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take, include: { userRoles: true } }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, skip, take };
  }

  async getUser(id: string) {
    const user = await (this.prisma as any).user.findUnique({ where: { id }, include: { userRoles: true } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async setStatus(id: string, status: string) {
    if (!status) throw new BadRequestException('status required');
    const user = await this.prisma.user.update({ where: { id }, data: { status } });
    return { ok: true, user };
  }

  async listRoles(id: string) {
    const roles = await (this.prisma as any).userRole.findMany({ where: { userId: id }, orderBy: { createdAt: 'asc' } });
    return roles.map((r) => r.role);
  }

  async addRole(id: string, role: Role) {
    try {
      await (this.prisma as any).userRole.create({ data: { userId: id, role } });
      return { ok: true };
    } catch (e: any) {
      // unique constraint yields already has role
      return { ok: true };
    }
  }

  async removeRole(id: string, role: Role) {
    await (this.prisma as any).userRole.deleteMany({ where: { userId: id, role } });
    return { ok: true };
  }

  async reissueDevToken(id: string, expSeconds?: number) {
    const user = await (this.prisma as any).user.findUnique({ where: { id }, include: { userRoles: true } });
    if (!user) throw new NotFoundException('User not found');
    const roles = user.userRoles.map((r) => r.role) as Role[];
    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const payload: any = {
      sub: user.id,
      roles,
      iat: now,
      exp: now + (expSeconds ?? 24 * 60 * 60),
    };
    const encHeader = base64url(JSON.stringify(header));
    const encPayload = base64url(JSON.stringify(payload));
    const data = `${encHeader}.${encPayload}`;
    const secret = process.env.JWT_SECRET || 'devsecret';
    const signature = signHS256(data, secret);
    const token = `${data}.${signature}`;
    return { token, payload };
  }
}
