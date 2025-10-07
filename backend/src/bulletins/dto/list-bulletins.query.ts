import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class ListBulletinsQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}
