import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createPayment(createPaymentDto: CreatePaymentDto) {
    const reference = 'PAY-' + Math.floor(Math.random() * 1000000).toString();
    return this.prisma.payment.create({
      data: {
        ...createPaymentDto,
        reference,
        status: 'PENDING',
      },
    });
  }

  async getPayment(id: string) {
    return this.prisma.payment.findUnique({
      where: { id },
    });
  }

  async completePayment(id: string) {
    return this.prisma.payment.update({
      where: { id },
      data: { status: 'SUCCESS' },
    });
  }
}

