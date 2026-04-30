import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EscrowService } from './escrow/escrow.service';
import { MpesaService } from './mpesa/mpesa.service';

type PaymentTargetInput = {
  bookingId?: string;
  invoiceId?: string;
};

type PaymentContext = {
  booking: {
    id: string;
    reference: string;
    customerId: string;
    totalPrice: number;
    status: string;
  } | null;
  invoice: {
    id: string;
    number: string;
    totalAmount: number;
    status: InvoiceStatus;
    bookingId: string | null;
    customerId: string;
    issuedAt: Date | null;
    dueDate: Date | null;
  } | null;
};

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly escrowService: EscrowService,
    private readonly mpesaService: MpesaService,
  ) {}

  async initiatePayment(
    target: PaymentTargetInput,
    amount: number,
    method: PaymentMethod,
    idempotencyKey: string,
  ) {
    const existing = await this.prisma.payment.findUnique({
      where: { idempotencyKey },
    });
    if (existing) return existing;

    const context = await this.resolvePaymentContext(target);
    const customerId = context.invoice?.customerId ?? context.booking?.customerId;
    if (!customerId) {
      throw new BadRequestException('Payment target must resolve to a billable account');
    }

    const customer = await this.prisma.user.findUnique({
      where: { id: customerId },
      select: { phone: true },
    });

    await this.assertChargeAmount(context, amount);

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          bookingId: context.booking?.id ?? null,
          invoiceId: context.invoice?.id ?? null,
          amount,
          method,
          status:
            method === PaymentMethod.MPESA
              ? PaymentStatus.PENDING
              : PaymentStatus.INITIATED,
          idempotencyKey,
          reference: `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
        },
      });

      if (context.booking && !context.invoice) {
        await tx.escrow.upsert({
          where: { bookingId: context.booking.id },
          create: { bookingId: context.booking.id, amount, status: 'HELD' },
          update: { amount, status: 'HELD' },
        });
      }

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
      select: {
        id: true,
        bookingId: true,
        invoiceId: true,
        status: true,
        reference: true,
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    if (payment.status === PaymentStatus.SUCCESS) {
      return this.getPayment(payment.id);
    }

    let linkedInvoiceId = payment.invoiceId;
    if (!linkedInvoiceId && payment.bookingId) {
      linkedInvoiceId = await this.linkInvoiceForBookingPayment(payment.id, payment.bookingId);
    }

    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.SUCCESS,
        reference: mpesaRef ?? payment.reference,
        ...(linkedInvoiceId ? { invoiceId: linkedInvoiceId } : {}),
      },
    });

    if (linkedInvoiceId) {
      await this.syncInvoicePaymentState(linkedInvoiceId);
    }

    if (updated.bookingId) {
      const booking = await this.prisma.booking.findUnique({
        where: { id: updated.bookingId },
        select: { status: true },
      });

      if (booking && ['DELIVERED', 'COMPLETED'].includes(booking.status)) {
        await this.releaseEscrowForBooking(
          updated.bookingId,
          'Released after successful payment confirmation',
        );
      }
    }

    return this.getPayment(updated.id);
  }

  async refundPayment(paymentId: string, reason?: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        bookingId: true,
        invoiceId: true,
        status: true,
      },
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

    if (payment.invoiceId) {
      await this.syncInvoicePaymentState(payment.invoiceId);
    }

    if (payment.bookingId) {
      try {
        await this.escrowService.refund(
          payment.bookingId,
          reason ?? 'Refund processed from payment service',
        );
      } catch {
        // Some bookings may not have escrow yet; payment refund should still succeed.
      }
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
        status:
          payment.method === PaymentMethod.MPESA
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
        status: {
          in: [
            PaymentStatus.SUCCESS,
            PaymentStatus.PENDING,
            PaymentStatus.INITIATED,
          ],
        },
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

    if (payment.invoiceId) {
      await this.syncInvoicePaymentState(payment.invoiceId);
    }

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
      include: {
        booking: { select: { id: true, reference: true, status: true } },
        invoice: { select: { id: true, number: true, status: true } },
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  async getBookingPayments(bookingId: string) {
    return this.prisma.payment.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
      include: {
        invoice: { select: { id: true, number: true, status: true } },
      },
    });
  }

  async getInvoicePayments(invoiceId: string) {
    return this.prisma.payment.findMany({
      where: { invoiceId },
      orderBy: { createdAt: 'desc' },
      include: {
        booking: { select: { id: true, reference: true, status: true } },
        invoice: { select: { id: true, number: true, status: true } },
      },
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
        include: {
          booking: { select: { reference: true } },
          invoice: { select: { number: true, status: true } },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);
    return { payments, total, page, limit };
  }

  private async resolvePaymentContext(
    target: PaymentTargetInput,
  ): Promise<PaymentContext> {
    if (!target.bookingId && !target.invoiceId) {
      throw new BadRequestException('Either bookingId or invoiceId is required');
    }

    let booking = target.bookingId
      ? await this.prisma.booking.findUnique({
          where: { id: target.bookingId },
          select: {
            id: true,
            reference: true,
            customerId: true,
            totalPrice: true,
            status: true,
          },
        })
      : null;
    if (target.bookingId && !booking) {
      throw new NotFoundException(`Booking ${target.bookingId} not found`);
    }

    let invoice = target.invoiceId
      ? await this.prisma.invoice.findUnique({
          where: { id: target.invoiceId },
          select: {
            id: true,
            number: true,
            totalAmount: true,
            status: true,
            bookingId: true,
            customerId: true,
            issuedAt: true,
            dueDate: true,
          },
        })
      : null;
    if (target.invoiceId && !invoice) {
      throw new NotFoundException(`Invoice ${target.invoiceId} not found`);
    }

    if (booking && !invoice) {
      invoice = await this.prisma.invoice.findUnique({
        where: { bookingId: booking.id },
        select: {
          id: true,
          number: true,
          totalAmount: true,
          status: true,
          bookingId: true,
          customerId: true,
          issuedAt: true,
          dueDate: true,
        },
      });
    }

    if (invoice?.bookingId && !booking) {
      booking = await this.prisma.booking.findUnique({
        where: { id: invoice.bookingId },
        select: {
          id: true,
          reference: true,
          customerId: true,
          totalPrice: true,
          status: true,
        },
      });
    }

    if (booking && invoice?.bookingId && invoice.bookingId !== booking.id) {
      throw new BadRequestException(
        'bookingId and invoiceId do not belong to the same finance record',
      );
    }

    if (invoice && invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('Cancelled invoices cannot accept payments');
    }

    return { booking, invoice };
  }

  private async assertChargeAmount(context: PaymentContext, amount: number) {
    if (amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than 0');
    }

    if (context.invoice) {
      const paidAmount = await this.sumSuccessfulPaymentsForInvoice(context.invoice);
      const remaining = Number((context.invoice.totalAmount - paidAmount).toFixed(2));

      if (remaining <= 0) {
        throw new ConflictException('Invoice already has enough successful payments');
      }
      if (amount > remaining) {
        throw new BadRequestException(
          `Payment amount exceeds the remaining invoice balance of ${remaining.toFixed(2)}`,
        );
      }
      return;
    }

    if (!context.booking) {
      throw new BadRequestException('Payment target could not be resolved');
    }

    const paidAmount = await this.sumSuccessfulPaymentsForBooking(context.booking.id);
    const remaining = Number((context.booking.totalPrice - paidAmount).toFixed(2));

    if (remaining <= 0) {
      throw new ConflictException('Booking already has enough successful payments');
    }
    if (amount > remaining) {
      throw new BadRequestException(
        `Payment amount exceeds the remaining booking balance of ${remaining.toFixed(2)}`,
      );
    }
  }

  private async sumSuccessfulPaymentsForInvoice(
    invoice: NonNullable<PaymentContext['invoice']>,
  ) {
    const payments = await this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.SUCCESS,
        OR: [
          { invoiceId: invoice.id },
          ...(invoice.bookingId
            ? [{ invoiceId: null, bookingId: invoice.bookingId }]
            : []),
        ],
      },
      select: { amount: true },
    });

    return Number(
      payments.reduce((sum, payment) => sum + payment.amount, 0).toFixed(2),
    );
  }

  private async sumSuccessfulPaymentsForBooking(bookingId: string) {
    const payments = await this.prisma.payment.findMany({
      where: {
        bookingId,
        status: PaymentStatus.SUCCESS,
      },
      select: { amount: true },
    });

    return Number(
      payments.reduce((sum, payment) => sum + payment.amount, 0).toFixed(2),
    );
  }

  private async linkInvoiceForBookingPayment(paymentId: string, bookingId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { bookingId },
      select: { id: true },
    });
    if (!invoice) {
      return null;
    }

    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { invoiceId: invoice.id },
    });

    return invoice.id;
  }

  private async syncInvoicePaymentState(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        totalAmount: true,
        paidAmount: true,
        paidAt: true,
        status: true,
        dueDate: true,
        issuedAt: true,
      },
    });
    if (!invoice || invoice.status === InvoiceStatus.CANCELLED) {
      return;
    }

    const payments = await this.prisma.payment.findMany({
      where: {
        invoiceId,
        status: PaymentStatus.SUCCESS,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        amount: true,
        createdAt: true,
      },
    });

    const paidAmount = Number(
      payments.reduce((sum, payment) => sum + payment.amount, 0).toFixed(2),
    );
    const nextStatus = !invoice.issuedAt
      ? InvoiceStatus.DRAFT
      : paidAmount >= invoice.totalAmount
        ? InvoiceStatus.PAID
        : invoice.dueDate && invoice.dueDate < new Date()
          ? InvoiceStatus.OVERDUE
          : InvoiceStatus.ISSUED;
    const paidAt =
      paidAmount >= invoice.totalAmount ? payments[0]?.createdAt ?? new Date() : null;

    if (
      paidAmount === invoice.paidAmount &&
      nextStatus === invoice.status &&
      String(paidAt ?? '') === String(invoice.paidAt ?? '')
    ) {
      return;
    }

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        paidAmount,
        paidAt,
        status: nextStatus,
      },
    });
  }
}
