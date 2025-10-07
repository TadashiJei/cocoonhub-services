import { IsBoolean, IsInt, IsOptional, IsPositive, IsString, Length, Min } from 'class-validator';

export class SetBankConfigDto {
  @IsString()
  @Length(2, 20)
  code!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  dailyLimit?: number;
}
