import { IsIn } from 'class-validator';

export class SetProductStatusDto {
  @IsIn(['draft','published','archived'])
  status!: 'draft'|'published'|'archived';
}
