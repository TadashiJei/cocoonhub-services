import { IsInt, IsOptional, Min } from 'class-validator';

export class SetProductStockDto {
  // If omitted, service can set stock to null via a different route; send null explicitly to clear.
  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;
}
