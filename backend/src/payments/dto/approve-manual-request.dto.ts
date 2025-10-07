import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ApproveManualRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  ref?: string; // external reference
}
