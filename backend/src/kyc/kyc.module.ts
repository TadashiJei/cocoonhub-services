import { Module } from '@nestjs/common';
import { KycController } from './kyc.controller';
import { StorageModule } from '../storage/storage.module';
import { KycService } from './kyc.service';
import { CryptoService } from '../security/crypto.service';

@Module({
  imports: [StorageModule],
  controllers: [KycController],
  providers: [KycService, CryptoService],
})
export class KycModule {}
