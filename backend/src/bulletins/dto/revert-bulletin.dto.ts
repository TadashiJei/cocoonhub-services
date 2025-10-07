import { IsInt, Min } from 'class-validator';

export class RevertBulletinDto {
  @IsInt()
  @Min(1)
  version!: number;
}
