import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export class SendNotificationDto {
  @IsIn(['email','sms'])
  channel!: 'email'|'sms';

  // Single recipient field (email address or E.164 phone depending on channel)
  @IsString()
  to!: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  templateKey?: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, any>;

  @IsOptional()
  @IsString()
  userId?: string;
}
