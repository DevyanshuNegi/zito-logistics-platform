import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class InitiatePaymentDto {
  @ApiPropertyOptional({ description: 'Booking ID to pay for when charging a live trip flow (PRD §15)' })
  @IsOptional()
  @IsUUID()
  bookingId?: string;

  @ApiPropertyOptional({ description: 'Invoice ID to pay for when charging an issued finance document (PRD §16, §18)' })
  @IsOptional()
  @IsUUID()
  invoiceId?: string;

  @ApiProperty({ description: 'Amount in KES' })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({
    enum: PaymentMethod,
    description: 'Payment method - MPESA, WALLET, BANK_TRANSFER, CARD, or CASH (PRD §15)',
  })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;
}
