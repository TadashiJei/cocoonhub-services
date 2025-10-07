import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class SetKycStatusDto {
  @IsIn(['approved', 'rejected', 'needs_more_info'])
  status!: 'approved' | 'rejected' | 'needs_more_info';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
