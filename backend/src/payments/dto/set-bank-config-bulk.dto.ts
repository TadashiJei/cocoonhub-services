import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Length, Min, ValidateNested } from 'class-validator';

class SetBankConfigBulkItemDto {
  @IsString()
  @Length(2, 20)
  code!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  dailyLimit?: number;
}

export class SetBankConfigBulkDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SetBankConfigBulkItemDto)
  items!: SetBankConfigBulkItemDto[];
}
