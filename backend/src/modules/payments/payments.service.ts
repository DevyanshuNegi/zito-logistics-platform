import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EscrowService } from './escrow/escrow.service';
import { MpesaService } from './mpesa/mpesa.service';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly escrowService: EscrowService,
    private readonly mpesaService: MpesaService,
  ) {}

  async initiatePayment(
    bookingId: string,
    amount: number,
    method: PaymentMethod,
    idempotencyKey: string,
  ) {
    const existing = await this.prisma.payment.findUnique({
      where: { idempotencyKey },
    });
    if (existing) return existing;

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new NotFoundException(`Booking ${bookingId} not found`);

    const customer = await this.prisma.user.findUnique({
      where: { id: booking.customerId },
      select: { phone: true },
    });

    const existingPayment = await this.prisma.payment.findFirst({
      where: { bookingId, status: PaymentStatus.SUCCESS },
    });
    if (existingPayment) {
      throw new ConflictException('Booking already has a successful payment');
    }

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          bookingId,
          amount,
          method,
          status: method === PaymentMethod.MPESA
            ? PaymentStatus.PENDING
            : PaymentStatus.INITIATED,
          idempotencyKey,
          reference: `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
        },
      });

      await tx.escrow.upsert({
        where: { bookingId },
        create: { bookingId, amount, status: 'HELD' },
        update: { amount, status: 'HELD' },
      });

      if (method !== PaymentMethod.MPESA) {
        return payment;
      }

      const providerResponse = await this.mpesaService.initiateStkPush({
        amount,
        phoneNumber: customer?.phone,
        reference: payment.reference,
      });

      return {
        ...payment,
        providerResponse,
      };
    });
  }

  async confirmPayment(paymentId: string, mpesaRef?: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    if (payment.status === PaymentStatus.SUCCESS) {
      return payment;
    }

    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.SUCCESS,
        reference: mpesaRef ?? payment.reference,
      },
    });

    const booking = await this.prisma.booking.findUnique({
      where: { id: payment.bookingId },
      select: { status: true },
    });

    if (booking && ['DELIVERED', 'COMPLETED'].includes(booking.status)) {
      await this.releaseEscrowForBooking(
        payment.bookingId,
        'Released after successful payment confirmation',
      );
    }

    return updated;
  }

  async refundPayment(paymentId: string, reason?: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    if (payment.status !== PaymentStatus.SUCCESS) {
      throw new BadRequestException('Only successful payments can be refunded');
    }

    const refunded = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.REFUNDED,
        reversedAt: new Date(),
        failureReason: reason,
      },
    });

    try {
      await this.escrowService.refund(
        payment.bookingId,
        reason ?? 'Refund processed from payment service',
      );
    } catch {
      // Some bookings may not have escrow yet; payment refund should still succeed.
    }

    return refunded;
  }

  async retryPayment(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    if (payment.retryCount >= 3) {
      throw new BadRequestException('Maximum retry attempts (3) reached');
    }

    if (payment.status === PaymentStatus.SUCCESS) {
      throw new BadRequestException('Payment already successful');
    }

    return this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: payment.method === PaymentMethod.MPESA
          ? PaymentStatus.PENDING
          : PaymentStatus.INITIATED,
        retryCount: { increment: 1 },
        failureReason: null,
      },
    });
  }

  async refundBookingPayment(bookingId: string, reason: string) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        bookingId,
        status: { in: [PaymentStatus.SUCCESS, PaymentStatus.PENDING, PaymentStatus.INITIATED] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!payment) {
      return {
        action: 'NO_PAYMENT_FOUND',
        bookingId,
      };
    }

    if (payment.status === PaymentStatus.SUCCESS) {
      const refundedPayment = await this.refundPayment(payment.id, reason);
      return {
        action: 'PAYMENT_REFUNDED',
        payment: refundedPayment,
      };
    }

    const reversed = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.REVERSED,
        reversedAt: new Date(),
        failureReason: reason,
      },
    });

    try {
      await this.escrowService.refund(bookingId, reason);
    } catch {
      // Escrow may not exist yet for a reversed initiation.
    }

    return {
      action: 'PAYMENT_REVERSED',
      payment: reversed,
    };
  }

  async releaseEscrowForBooking(bookingId: string, note: string) {
    const successfulPayment = await this.prisma.payment.findFirst({
      where: { bookingId, status: PaymentStatus.SUCCESS },
      select: { id: true },
    });

    if (!successfulPayment) {
      return {
        action: 'ESCROW_HELD_NO_SUCCESSFUL_PAYMENT',
        bookingId,
      };
    }

    try {
      const escrow = await this.escrowService.release(bookingId, note);
      return {
        action: 'ESCROW_RELEASED',
        escrow,
      };
    } catch {
      return {
        action: 'ESCROW_RELEASE_SKIPPED',
        bookingId,
      };
    }
  }

  async getPayment(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: { booking: { select: { id: true, reference: true, status: true } } },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  async getBookingPayments(bookingId: string) {
    return this.prisma.payment.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getEscrow(bookingId: string) {
    const escrow = await this.prisma.escrow.findUnique({
      where: { bookingId },
    });
    if (!escrow) throw new NotFoundException('Escrow not found for this booking');
    return escrow;
  }

  async getWallet(userId: string) {
    let wallet = await this.prisma.wallet.findFirst({ where: { userId } });

    if (!wallet) {
      wallet = await this.prisma.wallet.create({
        data: { userId, balance: 0, currency: 'KES' },
      });
    }

    return wallet;
  }

  async creditWallet(
    userId: string,
    amount: number,
    description: string,
    bookingId?: string,
    idempotencyKey?: string,
  ) {
    if (idempotencyKey) {
      const existing = await this.prisma.walletTransaction.findUnique({
        where: { idempotencyKey },
      });
      if (existing) return existing;
    }

    const wallet = await this.getWallet(userId);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: amount } },
      });

      return tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'CREDIT',
          amount,
          balance: updated.balance,
          description,
          bookingId,
          idempotencyKey,
        },
      });
    });
  }

  async debitWallet(
    userId: string,
    amount: number,
    description: string,
    bookingId?: string,
    idempotencyKey?: string,
  ) {
    if (idempotencyKey) {
      const existing = await this.prisma.walletTransaction.findUnique({
        where: { idempotencyKey },
      });
      if (existing) return existing;
    }

    const wallet = await this.getWallet(userId);

    if (wallet.balance < amount) {
      throw new BadRequestException('Insufficient wallet balance');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: amount } },
      });

      return tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'DEBIT',
          amount,
          balance: updated.balance,
          description,
          bookingId,
          idempotencyKey,
        },
      });
    });
  }

  async getWalletTransactions(userId: string, page = 1, limit = 20) {
    const wallet = await this.getWallet(userId);

    const [transactions, total] = await Promise.all([
      this.prisma.walletTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.walletTransaction.count({ where: { walletId: wallet.id } }),
    ]);

    return { wallet, transactions, total, page, limit };
  }

  async getAllPayments(page = 1, limit = 20, status?: PaymentStatus) {
    const where = status ? { status } : {};
    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { booking: { select: { reference: true } } },
      }),
      this.prisma.payment.count({ where }),
    ]);
    return { payments, total, page, limit };
  }
}
