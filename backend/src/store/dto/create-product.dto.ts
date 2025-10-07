import { IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @MaxLength(64)
  sku!: string;

  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsNumber()
  @Min(0)
  price!: number; // e.g., 123.45

  @IsString()
  @MaxLength(10)
  currency!: string; // USD, EUR, PHP, MYR

  @IsNumber()
  @Min(0)
  taxRatePct!: number; // e.g., 12.00
}
