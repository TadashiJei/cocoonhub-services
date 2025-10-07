import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertTemplateDto {
  @IsString()
  @MaxLength(64)
  key!: string;

  @IsIn(['email','sms'])
  channel!: 'email'|'sms';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @IsString()
  body!: string;
}
