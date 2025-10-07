import { IsMimeType, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class PresignLabelDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Matches(/^[\w .()\-]+\.(pdf|png|jpg|jpeg)$/i)
  fileName?: string;

  @IsOptional()
  @IsString()
  // Not all class-validator versions ship IsMimeType; keep it as string validation fallback
  // @IsMimeType()
  contentType?: string;
}
