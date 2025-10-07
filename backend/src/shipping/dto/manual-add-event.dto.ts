import { IsIn, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

export class ManualAddEventDto {
  @IsOptional()
  @IsIn(['pending','labeled','in_transit','delivered','canceled'])
  status?: 'pending'|'labeled'|'in_transit'|'delivered'|'canceled';

  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string;

  @IsOptional()
  @IsISO8601()
  occurredAt?: string;
}
