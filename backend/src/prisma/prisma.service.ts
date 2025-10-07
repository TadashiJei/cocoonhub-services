import { INestApplication, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    // Connect lazily by default so the app can boot without a DB (e.g., when Docker is not running).
    // Opt-in to eager connection by setting DB_EAGER_CONNECT=true
    if (process.env.DB_EAGER_CONNECT === 'true') {
      try {
        await this.$connect();
      } catch (err) {
        // Keep the app running; log a warning. Services will attempt connection on first use instead.
        // eslint-disable-next-line no-console
        console.warn('[Prisma] Eager connect failed. Continue without DB until it is available. Error:', err);
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async enableShutdownHooks(app: INestApplication) {
    // Some Prisma versions/types don't expose 'beforeExit' in $on typings.
    // Use a safe optional call with a type cast to preserve behavior without TS error.
    (this as unknown as { $on?: (event: string, cb: () => Promise<void>) => void }).$on?.(
      'beforeExit',
      async () => {
        await app.close();
      },
    );
  }
}
