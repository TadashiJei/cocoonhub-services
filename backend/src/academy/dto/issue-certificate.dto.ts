import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class IssueCertificateDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Matches(/^[\w .()\-]+$/)
  fileName?: string; // optional override, sanitized
}
