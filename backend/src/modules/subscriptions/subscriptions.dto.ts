import { IsEnum, IsOptional, IsString, IsNumber } from 'class-validator';

export enum PaymentMethod {
  MPESA = 'MPESA',
  BANK_TRANSFER = 'BANK_TRANSFER',
  WALLET = 'WALLET',
}

export class CreateSubscriptionDto {
  @IsEnum(['SILVER', 'GOLD', 'PLATINUM'])
  tier: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}

export class UpdateSubscriptionDto {
  @IsOptional()
  @IsEnum(['SILVER', 'GOLD', 'PLATINUM'])
  tier?: string;

  @IsOptional()
  autoRenew?: boolean;
}

export class SubscriptionTierDto {
  tier: string;
  monthlyPrice: number;
  loadsPerDay: number;
  features: string[];
  supportLevel: 'basic' | 'priority' | 'vip';
}

export class SubscriptionResponseDto {
  id: string;
  userId: string;
  tier: string;
  monthlyPrice: number;
  status: string;
  startDate: Date;
  nextBillingDate: Date;
  autoRenew: boolean;
  createdAt: Date;
}
