import { IsNumber, IsOptional, IsPositive, IsString, Length, MaxLength, Min } from 'class-validator';

export class CreateManualRequestDto {
  @IsString()
  @MaxLength(64)
  userId!: string;

  @IsString()
  @Length(2, 20)
  bankCode!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsString()
  @Length(3, 10)
  currency!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
