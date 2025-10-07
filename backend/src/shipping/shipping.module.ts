import { Module } from '@nestjs/common';
import { ShippingController, ManualShippingController } from './shipping.controller';
import { NinjaVanService } from './ninjavan.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ManualShippingService } from './manual.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [ShippingController, ManualShippingController],
  providers: [NinjaVanService, ManualShippingService],
  exports: [NinjaVanService, ManualShippingService],
})
export class ShippingModule {}
