import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export enum PublishStatusDto {
  draft = 'draft',
  published = 'published',
  archived = 'archived',
}

export class CreateBulletinDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title!: string;

  @IsString()
  @MinLength(1)
  body!: string;

  @IsOptional()
  @IsEnum(PublishStatusDto)
  status?: PublishStatusDto;
}
