import { IsEmail, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateStripeCheckoutDto {
  @IsString()
  orderId!: string;

  @IsUrl()
  successUrl!: string;

  @IsUrl()
  cancelUrl!: string;

  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  // In a full auth setup, this would come from JWT; for now it's provided explicitly.
  @IsString()
  requesterUserId!: string;
}
