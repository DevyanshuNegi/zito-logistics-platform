import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async initiateMpesaPayment(initiatePaymentDto: InitiatePaymentDto, customerId: string) {
    // Scaffold M-PESA STK Push logic here
    const transactionRef = 'MPESA-' + Date.now().toString();

    return this.prisma.payment.create({
      data: {
        bookingId: initiatePaymentDto.bookingId,
        amount: initiatePaymentDto.amount,
        method: 'MPESA',
        status: 'PENDING',
        reference: transactionRef,
      },
    });
  }

  async verifyPayment(transactionRef: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { reference: transactionRef },
    });

    if (!payment) throw new BadRequestException('Transaction not found');

    return this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'COMPLETED' },
    });
  }
}
