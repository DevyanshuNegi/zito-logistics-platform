export class CreatePaymentDto {
  amount: number;
  bookingId: string;
  method: 'MPESA' | 'CARD' | 'BANK_TRANSFER' | 'CASH';
}
