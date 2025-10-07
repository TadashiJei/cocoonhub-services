import { IsString, Matches, MaxLength } from 'class-validator';

export class PresignUploadDto {
  @IsString()
  @MaxLength(200)
  // example: kyc/user-123/passport.jpg
  @Matches(/^[a-zA-Z0-9_\-/.]+$/)
  key!: string;

  @IsString()
  @Matches(/^[\w!#$&^_.+-]+\/[\w!#$&^_.+-]+$/)
  contentType!: string;
}
