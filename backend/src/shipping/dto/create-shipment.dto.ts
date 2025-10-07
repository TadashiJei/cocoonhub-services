import { IsObject } from 'class-validator';

export class CreateShipmentDto {
  // We accept a raw payload that conforms to Ninja Van order schema
  @IsObject()
  payload!: Record<string, any>;
}
