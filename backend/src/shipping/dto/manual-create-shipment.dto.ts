import { IsOptional, IsString } from 'class-validator';

export class ManualCreateShipmentDto {
  @IsString()
  orderId!: string;

  @IsOptional()
  @IsString()
  carrierName?: string;

  @IsOptional()
  @IsString()
  trackingNumber?: string;
}
