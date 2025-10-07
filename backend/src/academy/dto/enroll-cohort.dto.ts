import { IsOptional, IsString } from 'class-validator';

export class EnrollCohortDto {
  @IsOptional()
  @IsString()
  userId?: string;
}
