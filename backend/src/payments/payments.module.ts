import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, StripeService],
})
export class PaymentsModule {}
