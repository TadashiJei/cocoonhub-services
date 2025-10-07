import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from './password.service';
import { createHmac, randomBytes, createHash } from 'node:crypto';
import type { Role } from './roles.enum';

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
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly password: PasswordService) {}

  private async signAccessToken(userId: string, roles: Role[], expSeconds?: number) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const payload: any = {
      sub: userId,
      roles,
      iat: now,
      exp: now + (expSeconds ?? Number(process.env.ACCESS_TOKEN_TTL_SECONDS || 900)),
    };
    const encHeader = base64url(JSON.stringify(header));
    const encPayload = base64url(JSON.stringify(payload));
    const data = `${encHeader}.${encPayload}`;
    const secret = process.env.JWT_SECRET || 'devsecret';
    const signature = signHS256(data, secret);
    const token = `${data}.${signature}`;
    return { token, payload };
  }

  private generateRefreshTokenString() {
    return base64url(randomBytes(32));
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  async login(params: { email: string; password: string; ip?: string }) {
    const user = await (this.prisma as any).user.findUnique({ where: { email: params.email }, include: { userRoles: true } });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const valid = await this.password.verify(user.passwordHash, params.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const roles = user.userRoles.map((r) => r.role) as Role[];
    const access = await this.signAccessToken(user.id, roles);

    const refreshToken = this.generateRefreshTokenString();
    const tokenHash = this.hashToken(refreshToken);
    const days = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30);
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    await (this.prisma as any).refreshToken.create({
      data: { userId: user.id, tokenHash, expiresAt, createdByIp: params.ip ?? null },
    });

    return { accessToken: access.token, accessPayload: access.payload, refreshToken, user: { id: user.id, email: user.email, roles } };
  }

  async refresh(params: { refreshToken: string; ip?: string }) {
    const tokenHash = this.hashToken(params.refreshToken);
    const current = await (this.prisma as any).refreshToken.findUnique({ where: { tokenHash } });
    if (!current) throw new UnauthorizedException('Invalid refresh token');
    if (current.revokedAt) throw new UnauthorizedException('Token revoked');
    if (current.expiresAt.getTime() < Date.now()) throw new UnauthorizedException('Token expired');

    const user = await (this.prisma as any).user.findUnique({ where: { id: current.userId }, include: { userRoles: true } });
    if (!user) throw new UnauthorizedException('User not found');
    const roles = user.userRoles.map((r) => r.role) as Role[];

    // rotate
    const newToken = this.generateRefreshTokenString();
    const newHash = this.hashToken(newToken);
    const days = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30);
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const [_, created] = await this.prisma.$transaction([
      (this.prisma as any).refreshToken.update({ where: { tokenHash }, data: { revokedAt: new Date() } }),
      (this.prisma as any).refreshToken.create({ data: { userId: user.id, tokenHash: newHash, expiresAt, createdByIp: params.ip ?? null, replacedByTokenId: current.id } }),
    ]);

    const access = await this.signAccessToken(user.id, roles);
    return { accessToken: access.token, accessPayload: access.payload, refreshToken: newToken };
  }

  async logout(params: { refreshToken: string }) {
    const tokenHash = this.hashToken(params.refreshToken);
    await (this.prisma as any).refreshToken.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } });
    return { ok: true };
  }
}
