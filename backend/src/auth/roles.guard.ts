import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import type { Role } from './roles.enum';
import { createHmac, timingSafeEqual } from 'node:crypto';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Read required roles from route metadata
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // no restriction
    }

    const request = context.switchToHttp().getRequest();
    let userRoles: Role[] = [];

    // 1) Try to extract roles from Bearer token payload (verified HS256)
    const authHeader = (request.headers['authorization'] || request.headers['Authorization']) as
      | string
      | undefined;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice('Bearer '.length);
      const parts = token.split('.');
      if (parts.length === 3) {
        try {
          const secret = process.env.JWT_SECRET || 'devsecret';
          const [h, p, s] = parts;
          const data = `${h}.${p}`;
          const expected = createHmac('sha256', secret).update(data).digest();
          const given = Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
          if (given.length === expected.length && timingSafeEqual(given, expected)) {
            const payloadJson = Buffer.from(p, 'base64url').toString('utf8');
            const payload = JSON.parse(payloadJson);
            // check exp
            if (typeof payload.exp === 'number') {
              const now = Math.floor(Date.now() / 1000);
              if (now > payload.exp) return false;
            }
            if (Array.isArray(payload?.roles)) {
              userRoles = payload.roles as Role[];
            }
          }
        } catch {
          // ignore parse errors
        }
      }
    }

    // 2) Fallback (dev only if enabled): derive roles from header `x-roles: admin,finance`
    if (userRoles.length === 0 && process.env.ALLOW_DEV_ROLES_HEADER === 'true') {
      const header = (request.headers['x-roles'] || request.headers['X-Roles']) as string | undefined;
      userRoles = (header?.split(',').map((r) => r.trim()) as Role[]) || [];
    }

    // Allow if any required role is present
    return requiredRoles.some((role) => userRoles.includes(role));
  }
}
