import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaClient } from '@prisma/client';
import { createHmac } from 'node:crypto';

export async function createApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  await app.init();
  return app;
}

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

export function makeToken(roles: string[], sub?: string, expSeconds = 3600) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload: any = { sub: sub || `u_${Date.now()}`, roles, iat: now, exp: now + expSeconds };
  const encHeader = base64url(JSON.stringify(header));
  const encPayload = base64url(JSON.stringify(payload));
  const data = `${encHeader}.${encPayload}`;
  const secret = process.env.JWT_SECRET || 'devsecret';
  const signature = signHS256(data, secret);
  return `${data}.${signature}`;
}

export async function getAdminToken(): Promise<string> {
  return makeToken(['admin']);
}

export async function getMemberToken(sub?: string): Promise<string> {
  return makeToken(['member'], sub);
}

export const prisma = new PrismaClient();

export async function ensureUser(id: string, email?: string) {
  const em = email || `${id}@example.com`;
  await prisma.user.upsert({
    where: { id },
    update: {},
    create: { id, email: em, passwordHash: 'test' },
  });
}
