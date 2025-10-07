import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UnpublishBulletinDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
