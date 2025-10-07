import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelShipmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
