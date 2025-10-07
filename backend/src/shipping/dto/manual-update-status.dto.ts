import { IsIn } from 'class-validator';

export class ManualUpdateStatusDto {
  @IsIn(['pending','labeled','in_transit','delivered','canceled'])
  status!: 'pending'|'labeled'|'in_transit'|'delivered'|'canceled';
}
