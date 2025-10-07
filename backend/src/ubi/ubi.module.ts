import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UbiService } from './ubi.service';
import { UbiController } from './ubi.controller';

@Module({
  imports: [PrismaModule],
  providers: [UbiService],
  controllers: [UbiController],
  exports: [UbiService],
})
export class UbiModule {}
