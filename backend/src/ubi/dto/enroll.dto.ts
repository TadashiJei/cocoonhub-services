import { IsString } from 'class-validator';

export class EnrollDto {
  @IsString()
  userId!: string;
}
