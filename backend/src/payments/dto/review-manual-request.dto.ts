import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewManualRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
