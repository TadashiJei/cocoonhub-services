import { IsOptional, IsString, MaxLength } from 'class-validator';

export class PublishBulletinDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
