import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { AcademyService } from './academy.service';
import { AcademyController } from './academy.controller';

@Module({
  imports: [PrismaModule, StorageModule],
  providers: [AcademyService],
  controllers: [AcademyController],
  exports: [AcademyService],
})
export class AcademyModule {}
