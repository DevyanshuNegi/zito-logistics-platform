import { IsString, IsNumber } from 'class-validator';

export class InitiatePaymentDto {
  @IsString()
  bookingId: string;

  @IsNumber()
  amount: number;

  @IsString()
  phoneNumber: string;
}