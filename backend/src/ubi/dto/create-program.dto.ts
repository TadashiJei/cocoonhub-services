import { IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateProgramDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  @MaxLength(10)
  currency!: string;
}
