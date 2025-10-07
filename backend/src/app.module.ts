import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { BulletinsModule } from './bulletins/bulletins.module';
import { PaymentsModule } from './payments/payments.module';
import { KycModule } from './kyc/kyc.module';
import { PrismaModule } from './prisma/prisma.module';
import { RolesGuard } from './auth/roles.guard';
import { AuthModule } from './auth/auth.module';
import { StorageModule } from './storage/storage.module';
import { UbiModule } from './ubi/ubi.module';
import { EventsModule } from './events/events.module';
import { AcademyModule } from './academy/academy.module';
import { StoreModule } from './store/store.module';
import { ShippingModule } from './shipping/shipping.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AdminUsersModule } from './admin-users/admin-users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: Number(process.env.THROTTLE_TTL_SECONDS || 60),
          limit: Number(process.env.THROTTLE_LIMIT || 100),
        },
      ],
    }),
    AuthModule,
    HealthModule,
    BulletinsModule,
    PaymentsModule,
    KycModule,
    UbiModule,
    EventsModule,
    AcademyModule,
    StoreModule,
    ShippingModule,
    NotificationsModule,
    AdminUsersModule,
    PrismaModule,
    StorageModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    ...(process.env.NODE_ENV === 'test' ? [] : [{ provide: APP_GUARD, useClass: ThrottlerGuard } as any]),
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
