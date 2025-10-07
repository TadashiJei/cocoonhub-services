import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectManualRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
