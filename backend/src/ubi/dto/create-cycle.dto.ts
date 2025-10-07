import { IsDateString, IsString } from 'class-validator';

export class CreateCycleDto {
  @IsString()
  programId!: string;

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;
}
