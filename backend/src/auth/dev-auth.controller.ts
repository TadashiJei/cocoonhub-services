import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { createHmac } from 'node:crypto';
import type { Role } from './roles.enum';
import { Throttle } from '@nestjs/throttler';

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

@ApiTags('auth')
@Controller('auth')
export class DevAuthController {
  @Post('dev-token')
  @Throttle(5, 60)
  createDevToken(
    @Body()
    body: {
      sub?: string;
      roles: Role[];
      expSeconds?: number; // default 1 day
    },
  ) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const payload: any = {
      sub: body.sub || 'dev-user',
      roles: body.roles || [],
      iat: now,
      exp: now + (body.expSeconds ?? 24 * 60 * 60),
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
