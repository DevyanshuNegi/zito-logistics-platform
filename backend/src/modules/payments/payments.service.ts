import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentMethod, PaymentStatus } from '@prisma/client';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Initiate Payment (PRD §15) ───────────────────────────────────────────
  /**
   * Creates a payment record and holds escrow.
   * Idempotency key prevents duplicate charges on retry.
   */
  async initiatePayment(
    bookingId: string,
    amount: number,
    method: PaymentMethod,
    idempotencyKey: string,
  ) {
    // PRD §28: Idempotency — return existing payment if key already used
    const existing = await this.prisma.payment.findUnique({
      where: { idempotencyKey },
    });
    if (existing) return existing;

    // Verify booking exists
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new NotFoundException(`Booking ${bookingId} not found`);

    // PRD §15: Cannot initiate payment on already-paid booking
    const existingPayment = await this.prisma.payment.findFirst({
      where: { bookingId, status: PaymentStatus.SUCCESS },
    });
    if (existingPayment) {
      throw new ConflictException('Booking already has a successful payment');
    }

    // Create payment + escrow in a transaction
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          bookingId,
          amount,
          method,
          status: PaymentStatus.INITIATED,
          idempotencyKey,
          reference: `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
        },
      });

      // PRD §15: Hold escrow on booking creation
      await tx.escrow.upsert({
        where: { bookingId },
        create: { bookingId, amount, status: 'HELD' },
        update: { amount, status: 'HELD' },
      });

      return payment;
    });
  }

  // ─── Verify / Confirm Payment (PRD §15) ───────────────────────────────────
  /**
   * Called after M-Pesa STK push callback confirms payment.
   * Releases escrow and marks booking payment_status as paid.
   */
  async confirmPayment(paymentId: string, mpesaRef?: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    if (payment.status === PaymentStatus.SUCCESS) {
      return payment; // Already confirmed — idempotent
    }

    return this.prisma.$transaction(async (tx) => {
      // Mark payment success
      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.SUCCESS,
          reference: mpesaRef ?? payment.reference,
        },
      });

      // PRD §15: Release escrow on payment confirmation
      await tx.escrow.update({
        where: { bookingId: payment.bookingId },
        data: { status: 'RELEASED', releasedAt: new Date() },
      });

      // PRD §6: Move booking to PAYMENT_PENDING → COMPLETED handled by booking service
      // Here we just log the payment success
      return updated;
    });
  }

  // ─── Refund Payment (PRD §15) ─────────────────────────────────────────────
  /**
   * Admin-initiated refund. Reverses escrow and marks payment refunded.
   * PRD §15: Automated refund on cancellation.
   */
  async refundPayment(paymentId: string, reason?: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    if (payment.status !== PaymentStatus.SUCCESS) {
      throw new BadRequestException('Only successful payments can be refunded');
    }

    return this.prisma.$transaction(async (tx) => {
      const refunded = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.REFUNDED,
          reversedAt: new Date(),
          failureReason: reason,
        },
      });

      // Reverse escrow
      await tx.escrow.update({
        where: { bookingId: payment.bookingId },
        data: { status: 'REFUNDED', refundedAt: new Date() },
      });

      return refunded;
    });
  }

  // ─── Retry Failed Payment (PRD §15) ───────────────────────────────────────
  /**
   * Increments retry count and resets status to INITIATED.
   * Max 3 retries enforced per PRD §15.
   */
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
        status: PaymentStatus.INITIATED,
        retryCount: { increment: 1 },
        failureReason: null,
      },
    });
  }

  // ─── Get Payment by ID ────────────────────────────────────────────────────
  async getPayment(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: { booking: { select: { id: true, reference: true, status: true } } },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  // ─── Get Payments for Booking ─────────────────────────────────────────────
  async getBookingPayments(bookingId: string) {
    return this.prisma.payment.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Get Escrow Status (PRD §15) ─────────────────────────────────────────
  async getEscrow(bookingId: string) {
    const escrow = await this.prisma.escrow.findUnique({
      where: { bookingId },
    });
    if (!escrow) throw new NotFoundException('Escrow not found for this booking');
    return escrow;
  }

  // ─── Wallet: Get Balance (PRD §15) ───────────────────────────────────────
  async getWallet(userId: string) {
    let wallet = await this.prisma.wallet.findFirst({ where: { userId } });

    // Auto-create wallet if not exists
    if (!wallet) {
      wallet = await this.prisma.wallet.create({
        data: { userId, balance: 0, currency: 'KES' },
      });
    }

    return wallet;
  }

  // ─── Wallet: Credit (PRD §15) ─────────────────────────────────────────────
  async creditWallet(
    userId: string,
    amount: number,
    description: string,
    bookingId?: string,
    idempotencyKey?: string,
  ) {
    // Idempotency check
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

  // ─── Wallet: Debit (PRD §15) ──────────────────────────────────────────────
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

  // ─── Wallet: Transaction History (PRD §15) ────────────────────────────────
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

  // ─── Admin: All Payments (PRD §42) ────────────────────────────────────────
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