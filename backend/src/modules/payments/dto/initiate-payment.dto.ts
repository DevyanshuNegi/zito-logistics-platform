import { IsEnum, IsNotEmpty, IsNumber, IsUUID, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';

export class InitiatePaymentDto {
  @ApiProperty({ description: 'Booking ID to pay for (PRD §15)' })
  @IsUUID()
  @IsNotEmpty()
  bookingId: string;

  @ApiProperty({ description: 'Amount in KES' })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({
    enum: PaymentMethod,
    description: 'Payment method — MPESA, WALLET, BANK_TRANSFER (PRD §15)',
  })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;
}