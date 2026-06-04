import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  DisbursementRail,
  DisbursementStatus,
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
} from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EscrowService } from './escrow/escrow.service';
import { MpesaLifecycleResult, MpesaService } from './mpesa/mpesa.service';
import { CreateDisbursementDto } from './dto/create-disbursement.dto';

type PaymentTargetInput = {
  bookingId?: string;
  invoiceId?: string;
};

type PaymentContext = {
  booking: {
    id: string;
    reference: string;
    customerId: string;
    agencyId: string | null;
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
    agencyId: string | null;
    issuedAt: Date | null;
    dueDate: Date | null;
  } | null;
};

type FinanceActor = {
  id: string;
  role?: string | null;
  agencyId?: string | null;
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
    actor?: FinanceActor,
  ) {
    const existing = await this.prisma.payment.findUnique({
      where: { idempotencyKey },
    });
    if (existing) return existing;

    const context = await this.resolvePaymentContext(target);
    this.assertPaymentTargetAccess(context, actor);
    const customerId = context.invoice?.customerId ?? context.booking?.customerId;
    if (!customerId) {
      throw new BadRequestException('Payment target must resolve to a billable account');
    }

    const customer = await this.prisma.user.findUnique({
      where: { id: customerId },
      select: { phone: true },
    });

    await this.assertChargeAmount(context, amount);

    const payment = await this.prisma.$transaction(async (tx) => {
      const createdPayment = await tx.payment.create({
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

      return createdPayment;
    });

    if (method !== PaymentMethod.MPESA) {
      return payment;
    }

    try {
      const providerResponse = await this.mpesaService.initiateStkPush({
        amount,
        phoneNumber: customer?.phone,
        reference: payment.reference ?? payment.id,
      });

      const updated = await this.persistMpesaProviderState(
        payment.id,
        providerResponse,
        'initiation',
        {
          status: providerResponse.success
            ? PaymentStatus.PENDING
            : PaymentStatus.FAILED,
          failureReason: providerResponse.success
            ? null
            : providerResponse.resultDesc ?? 'M-Pesa initiation failed',
        },
      );

      return {
        ...updated,
        providerResponse,
      };
    } catch (error) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          provider: 'MPESA',
          providerStatus: 'INITIATION_FAILED',
          status: PaymentStatus.FAILED,
          failureReason: this.extractErrorMessage(error),
        },
      });
      throw error;
    }
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

    if (payment.status === PaymentStatus.COMPLETED) {
      return this.getPayment(payment.id);
    }

    let linkedInvoiceId = payment.invoiceId;
    if (!linkedInvoiceId && payment.bookingId) {
      linkedInvoiceId = await this.linkInvoiceForBookingPayment(payment.id, payment.bookingId);
    }

    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.COMPLETED,
        providerStatus: 'SUCCESS',
        providerReceiptNumber: mpesaRef ?? undefined,
        confirmedAt: new Date(),
        failureReason: null,
        ...(linkedInvoiceId
          ? { invoice: { connect: { id: linkedInvoiceId } } }
          : {}),
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

    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new BadRequestException('Only completed payments can be refunded');
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

  async retryPayment(paymentId: string, actor?: FinanceActor) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    await this.assertPaymentRecordAccess(paymentId, actor);

    if (payment.retryCount >= 3) {
      throw new BadRequestException('Maximum retry attempts (3) reached');
    }

    if (payment.status === PaymentStatus.COMPLETED) {
      throw new BadRequestException('Payment already completed');
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

  async syncMpesaPaymentStatus(paymentId: string) {
    const payment = await this.loadMpesaPaymentState(paymentId);

    if (payment.checkoutRequestId) {
      const providerResponse = await this.mpesaService.queryStkPushStatus({
        checkoutRequestId: payment.checkoutRequestId,
        reference: payment.reference ?? payment.id,
      });

      if (providerResponse.providerStatus === 'SUCCESS') {
        return this.markPaymentSuccessful(payment.id, providerResponse, 'statusQuery');
      }

      if (providerResponse.providerStatus === 'FAILED') {
        return this.markPaymentFailed(payment.id, providerResponse, 'statusQuery');
      }

      await this.persistMpesaProviderState(payment.id, providerResponse, 'statusQuery', {
        status: PaymentStatus.PENDING,
      });
      return this.getPayment(payment.id);
    }

    if (!payment.providerReceiptNumber) {
      throw new BadRequestException(
        'No M-Pesa checkout request or provider receipt is available for status sync',
      );
    }

    const providerResponse = await this.mpesaService.queryTransactionStatus({
      transactionId: payment.providerReceiptNumber,
      reference: payment.reference ?? payment.id,
    });

    await this.persistMpesaProviderState(
      payment.id,
      providerResponse,
      'transactionStatusRequest',
      {
        status: payment.status,
      },
    );

    return this.getPayment(payment.id);
  }

  async requestMpesaReversal(paymentId: string, reason: string) {
    const payment = await this.loadMpesaPaymentState(paymentId);

    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new BadRequestException('Only completed M-Pesa payments can be reversed');
    }

    if (!payment.providerReceiptNumber) {
      throw new BadRequestException(
        'Provider receipt number is required before an M-Pesa reversal can be requested',
      );
    }

    const providerResponse = await this.mpesaService.requestReversal({
      amount: payment.amount,
      transactionId: payment.providerReceiptNumber,
      reference: payment.reference ?? payment.id,
      remarks: reason,
    });

    if (providerResponse.mode === 'SIMULATED' && providerResponse.providerStatus === 'REVERSED') {
      return this.markPaymentReversed(payment.id, providerResponse, 'reversal', reason);
    }

    await this.persistMpesaProviderState(payment.id, providerResponse, 'reversalRequest', {
      status: payment.status,
    });

    return this.getPayment(payment.id);
  }

  async handleMpesaCallback(payload: Record<string, unknown>) {
    const providerResponse = this.mpesaService.parseCallbackPayload(payload);
    const payment = await this.findPaymentByMpesaIdentifiers(providerResponse);

    if (!payment) {
      return {
        accepted: true,
        matched: false,
        providerStatus: providerResponse.providerStatus,
      };
    }

    if (providerResponse.providerStatus === 'SUCCESS') {
      await this.markPaymentSuccessful(payment.id, providerResponse, 'callback', {
        callbackReceivedAt: new Date(),
      });
    } else {
      await this.markPaymentFailed(payment.id, providerResponse, 'callback', {
        callbackReceivedAt: new Date(),
      });
    }

    return {
      accepted: true,
      matched: true,
      paymentId: payment.id,
      providerStatus: providerResponse.providerStatus,
    };
  }

  async handleMpesaProviderResult(payload: Record<string, unknown>) {
    const providerResponse = this.mpesaService.parseResultPayload(payload, 'RESULT');
    const payment = await this.findPaymentByMpesaIdentifiers(providerResponse);

    if (payment) {
      if (payment.providerStatus === 'REVERSAL_REQUESTED') {
        if (providerResponse.success) {
          await this.markPaymentReversed(
            payment.id,
            {
              ...providerResponse,
              providerStatus: 'REVERSED',
            },
            'reversalResult',
          );
        } else {
          await this.persistMpesaProviderState(
            payment.id,
            {
              ...providerResponse,
              providerStatus: 'REVERSAL_FAILED',
            },
            'reversalResult',
            {
              status: payment.status,
              failureReason:
                providerResponse.resultDesc ?? 'M-Pesa reversal request failed',
            },
          );
        }

        return {
          accepted: true,
          matched: true,
          paymentId: payment.id,
        };
      }

      if (providerResponse.success) {
        await this.markPaymentSuccessful(payment.id, providerResponse, 'transactionStatusResult');
      } else {
        await this.persistMpesaProviderState(
          payment.id,
          {
            ...providerResponse,
            providerStatus: 'STATUS_QUERY_FAILED',
          },
          'transactionStatusResult',
          {
            status:
              payment.status === PaymentStatus.COMPLETED
                ? PaymentStatus.COMPLETED
                : PaymentStatus.FAILED,
            failureReason:
              providerResponse.resultDesc ?? 'M-Pesa transaction status query failed',
          },
        );
      }

      return {
        accepted: true,
        matched: true,
        paymentId: payment.id,
      };
    }

    const disbursement = await this.findDisbursementByMpesaIdentifiers(providerResponse);

    if (disbursement) {
      if (disbursement.providerStatus === 'REVERSAL_REQUESTED') {
        if (providerResponse.success) {
          await this.markDisbursementReversed(
            disbursement.id,
            {
              ...providerResponse,
              providerStatus: 'REVERSED',
            },
            'reversalResult',
          );
        } else {
          await this.persistMpesaDisbursementState(
            disbursement.id,
            {
              ...providerResponse,
              providerStatus: 'REVERSAL_FAILED',
            },
            'reversalResult',
            {
              status: DisbursementStatus.SUCCESS,
              failureReason:
                providerResponse.resultDesc ?? 'M-Pesa disbursement reversal failed',
            },
          );
        }
      } else if (providerResponse.success) {
        await this.markDisbursementSuccessful(
          disbursement.id,
          providerResponse,
          'transactionStatusResult',
        );
      } else {
        await this.markDisbursementFailed(
          disbursement.id,
          {
            ...providerResponse,
            providerStatus: 'STATUS_QUERY_FAILED',
          },
          'transactionStatusResult',
        );
      }

      return {
        accepted: true,
        matched: true,
        disbursementId: disbursement.id,
      };
    }

    return {
      accepted: true,
      matched: false,
      providerStatus: providerResponse.providerStatus,
    };
  }

  async handleMpesaProviderTimeout(payload: Record<string, unknown>) {
    const providerResponse = this.mpesaService.parseResultPayload(payload, 'TIMEOUT');
    const payment = await this.findPaymentByMpesaIdentifiers(providerResponse);

    if (payment) {
      const timeoutStatus =
        payment.providerStatus === 'REVERSAL_REQUESTED'
          ? 'REVERSAL_TIMEOUT'
          : 'STATUS_QUERY_TIMEOUT';

      await this.persistMpesaProviderState(
        payment.id,
        {
          ...providerResponse,
          providerStatus: timeoutStatus,
        },
        'timeout',
        {
          status: payment.status,
          failureReason:
            providerResponse.resultDesc ?? 'M-Pesa provider request timed out',
        },
      );

      return {
        accepted: true,
        matched: true,
        paymentId: payment.id,
      };
    }

    const disbursement = await this.findDisbursementByMpesaIdentifiers(providerResponse);

    if (disbursement) {
      const timeoutStatus =
        disbursement.providerStatus === 'REVERSAL_REQUESTED'
          ? 'REVERSAL_TIMEOUT'
          : 'STATUS_QUERY_TIMEOUT';

      await this.persistMpesaDisbursementState(
        disbursement.id,
        {
          ...providerResponse,
          providerStatus: timeoutStatus,
        },
        'timeout',
        {
          status: disbursement.status,
          failureReason:
            providerResponse.resultDesc ?? 'M-Pesa provider request timed out',
        },
      );

      return {
        accepted: true,
        matched: true,
        disbursementId: disbursement.id,
      };
    }

    return {
      accepted: true,
      matched: false,
      providerStatus: providerResponse.providerStatus,
    };
  }

  async refundBookingPayment(bookingId: string, reason: string) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        bookingId,
        status: {
          in: [
            PaymentStatus.COMPLETED,
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

    if (payment.status === PaymentStatus.COMPLETED) {
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
      where: { bookingId, status: PaymentStatus.COMPLETED },
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

  async getPayment(id: string, actor?: FinanceActor) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        booking: { select: { id: true, reference: true, status: true, customerId: true, agencyId: true } },
        invoice: { select: { id: true, number: true, status: true, customerId: true, agencyId: true } },
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    this.assertPaymentAccessFromRecord(payment, actor);
    return payment;
  }

  async getBookingPayments(bookingId: string, actor?: FinanceActor) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, customerId: true, agencyId: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    this.assertScopedAccess(actor, booking.customerId, booking.agencyId);

    return this.prisma.payment.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
      include: {
        invoice: { select: { id: true, number: true, status: true } },
      },
    });
  }

  async getInvoicePayments(invoiceId: string, actor?: FinanceActor) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { id: true, customerId: true, agencyId: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    this.assertScopedAccess(actor, invoice.customerId, invoice.agencyId);

    return this.prisma.payment.findMany({
      where: { invoiceId },
      orderBy: { createdAt: 'desc' },
      include: {
        booking: { select: { id: true, reference: true, status: true } },
        invoice: { select: { id: true, number: true, status: true } },
      },
    });
  }

  async getEscrow(bookingId: string, actor?: FinanceActor) {
    const escrow = await this.prisma.escrow.findUnique({
      where: { bookingId },
      include: {
        booking: { select: { customerId: true, agencyId: true } },
      },
    });
    if (!escrow) throw new NotFoundException('Escrow not found for this booking');
    this.assertScopedAccess(actor, escrow.booking.customerId, escrow.booking.agencyId);
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

  async deductFromWallet(
    userId: string,
    input: { amount: number; description?: string; reference?: string; type?: string },
  ) {
    return this.debitWallet(
      userId,
      input.amount,
      input.description ?? input.type ?? 'Wallet debit',
      undefined,
      input.reference,
    );
  }

  async refundToWallet(
    userId: string,
    input: { amount: number; description?: string; reference?: string; type?: string },
  ) {
    return this.creditWallet(
      userId,
      input.amount,
      input.description ?? input.type ?? 'Wallet refund',
      undefined,
      input.reference,
    );
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

  async createDisbursement(dto: CreateDisbursementDto, actorId: string) {
    const beneficiary =
      dto.beneficiaryUserId
        ? await this.prisma.user.findUnique({
            where: { id: dto.beneficiaryUserId },
            select: {
              id: true,
              fullName: true,
              companyName: true,
              phone: true,
            },
          })
        : null;

    if (dto.beneficiaryUserId && !beneficiary) {
      throw new NotFoundException('Beneficiary user not found');
    }

    if (dto.sourcePaymentId) {
      const sourcePayment = await this.prisma.payment.findUnique({
        where: { id: dto.sourcePaymentId },
        select: { id: true },
      });
      if (!sourcePayment) {
        throw new NotFoundException('Source payment not found');
      }
    }

    if (dto.sourceInvoiceId) {
      const sourceInvoice = await this.prisma.invoice.findUnique({
        where: { id: dto.sourceInvoiceId },
        select: { id: true },
      });
      if (!sourceInvoice) {
        throw new NotFoundException('Source invoice not found');
      }
    }

    const beneficiaryPhone = dto.beneficiaryPhone ?? beneficiary?.phone ?? null;
    const beneficiaryName =
      dto.beneficiaryName?.trim() ||
      beneficiary?.fullName ||
      beneficiary?.companyName ||
      'Unnamed beneficiary';

    if (dto.rail === DisbursementRail.MPESA_B2C && !beneficiaryPhone) {
      throw new BadRequestException('M-Pesa B2C disbursement requires a beneficiary phone number');
    }

    if (
      dto.rail === DisbursementRail.MPESA_B2B &&
      !dto.beneficiaryPartyNumber?.trim()
    ) {
      throw new BadRequestException(
        'M-Pesa B2B disbursement requires a receiving paybill, till, or shortcode',
      );
    }

    const reference = await this.generateDisbursementReference();

    const disbursement = await this.prisma.disbursement.create({
      data: {
        rail: dto.rail,
        status:
          dto.rail === DisbursementRail.BANK_TRANSFER
            ? DisbursementStatus.INITIATED
            : DisbursementStatus.CREATED,
        amount: dto.amount,
        currency: 'KES',
        reference,
        purpose: dto.purpose,
        beneficiaryName,
        beneficiaryPhone,
        beneficiaryPartyNumber: dto.beneficiaryPartyNumber?.trim() || null,
        accountReference: dto.accountReference?.trim() || null,
        beneficiaryUserId: dto.beneficiaryUserId ?? null,
        createdByUserId: actorId,
        approvedByUserId: actorId,
        sourcePaymentId: dto.sourcePaymentId ?? null,
        sourceInvoiceId: dto.sourceInvoiceId ?? null,
        provider:
          dto.rail === DisbursementRail.BANK_TRANSFER ? 'BANK_TRANSFER' : 'MPESA',
        providerMode:
          dto.rail === DisbursementRail.BANK_TRANSFER ? 'MANUAL' : undefined,
        providerStatus:
          dto.rail === DisbursementRail.BANK_TRANSFER
            ? 'MANUAL_SETTLEMENT_PENDING'
            : undefined,
        initiatedAt:
          dto.rail === DisbursementRail.BANK_TRANSFER ? new Date() : undefined,
      },
    });

    if (dto.rail === DisbursementRail.BANK_TRANSFER) {
      return this.getDisbursement(disbursement.id);
    }

    const providerResponse =
      dto.rail === DisbursementRail.MPESA_B2C
        ? await this.mpesaService.initiateB2CDisbursement({
            amount: dto.amount,
            phoneNumber: beneficiaryPhone,
            reference,
            remarks: dto.purpose,
          })
        : await this.mpesaService.initiateB2BDisbursement({
            amount: dto.amount,
            partyNumber: dto.beneficiaryPartyNumber,
            reference,
            remarks: dto.purpose,
            accountReference: dto.accountReference ?? reference,
          });

    if (providerResponse.mode === 'SIMULATED' && providerResponse.providerStatus === 'SUCCESS') {
      return this.markDisbursementSuccessful(disbursement.id, providerResponse, 'initiation');
    }

    if (!providerResponse.success) {
      await this.markDisbursementFailed(disbursement.id, providerResponse, 'initiation');
      return this.getDisbursement(disbursement.id);
    }

    await this.persistMpesaDisbursementState(disbursement.id, providerResponse, 'initiation', {
      status: DisbursementStatus.INITIATED,
      initiatedAt: new Date(),
      failureReason: null,
    });

    return this.getDisbursement(disbursement.id);
  }

  async getDisbursement(id: string) {
    const disbursement = await this.prisma.disbursement.findUnique({
      where: { id },
      include: {
        beneficiaryUser: {
          select: { id: true, fullName: true, companyName: true, phone: true },
        },
        sourcePayment: {
          select: { id: true, reference: true, status: true, amount: true },
        },
        sourceInvoice: {
          select: { id: true, number: true, status: true, totalAmount: true },
        },
      },
    });

    if (!disbursement) {
      throw new NotFoundException('Disbursement not found');
    }

    return disbursement;
  }

  async getAllDisbursements(
    page = 1,
    limit = 20,
    status?: DisbursementStatus,
    rail?: DisbursementRail,
  ) {
    const where = {
      ...(status ? { status } : {}),
      ...(rail ? { rail } : {}),
    };

    const [disbursements, total] = await Promise.all([
      this.prisma.disbursement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          beneficiaryUser: {
            select: { id: true, fullName: true, companyName: true, phone: true },
          },
          sourcePayment: {
            select: { id: true, reference: true, status: true, amount: true },
          },
          sourceInvoice: {
            select: { id: true, number: true, status: true, totalAmount: true },
          },
        },
      }),
      this.prisma.disbursement.count({ where }),
    ]);

    return { disbursements, total, page, limit };
  }

  async syncMpesaDisbursementStatus(disbursementId: string) {
    const disbursement = await this.loadMpesaDisbursementState(disbursementId);

    if (!disbursement.providerReceiptNumber) {
      if (disbursement.providerStatus === 'INITIATED') {
        await this.persistMpesaDisbursementState(
          disbursement.id,
          {
            provider: 'MPESA',
            action: 'TRANSACTION_STATUS',
            mode: (disbursement.providerMode as 'SIMULATED' | 'LIVE') ?? 'LIVE',
            success: false,
            providerStatus: 'AWAITING_ASYNC_RESULT',
            conversationId: disbursement.providerConversationId,
            originatorConversationId: disbursement.providerOriginatorConversationId,
            resultDesc:
              'Awaiting provider result callback before a transaction receipt is available.',
            payload: {
              reference: disbursement.reference,
            },
          },
          'statusQuery',
          {
            status: DisbursementStatus.PROCESSING,
          },
        );
        return this.getDisbursement(disbursement.id);
      }

      throw new BadRequestException(
        'No provider receipt is available yet for a transaction-status query',
      );
    }

    const providerResponse = await this.mpesaService.queryTransactionStatus({
      transactionId: disbursement.providerReceiptNumber,
      reference: disbursement.reference,
      remarks: `Disbursement status query for ${disbursement.reference}`,
    });

    if (providerResponse.providerStatus === 'SUCCESS') {
      return this.markDisbursementSuccessful(disbursement.id, providerResponse, 'statusQuery');
    }

    if (providerResponse.providerStatus === 'FAILED') {
      return this.markDisbursementFailed(disbursement.id, providerResponse, 'statusQuery');
    }

    await this.persistMpesaDisbursementState(
      disbursement.id,
      providerResponse,
      'statusQuery',
      {
        status: DisbursementStatus.PROCESSING,
      },
    );

    return this.getDisbursement(disbursement.id);
  }

  async requestMpesaDisbursementReversal(disbursementId: string, reason: string) {
    const disbursement = await this.loadMpesaDisbursementState(disbursementId);

    if (disbursement.status !== DisbursementStatus.SUCCESS) {
      throw new BadRequestException('Only successful M-Pesa disbursements can be reversed');
    }

    if (!disbursement.providerReceiptNumber) {
      throw new BadRequestException(
        'Provider receipt number is required before an M-Pesa disbursement reversal can be requested',
      );
    }

    const providerResponse = await this.mpesaService.requestReversal({
      amount: disbursement.amount,
      transactionId: disbursement.providerReceiptNumber,
      reference: disbursement.reference,
      remarks: reason,
    });

    if (providerResponse.mode === 'SIMULATED' && providerResponse.providerStatus === 'REVERSED') {
      return this.markDisbursementReversed(disbursement.id, providerResponse, 'reversal', reason);
    }

    await this.persistMpesaDisbursementState(
      disbursement.id,
      providerResponse,
      'reversalRequest',
      {
        status: DisbursementStatus.SUCCESS,
        providerStatus: 'REVERSAL_REQUESTED',
        failureReason: null,
      },
    );

    return this.getDisbursement(disbursement.id);
  }

  private async loadMpesaDisbursementState(disbursementId: string) {
    const disbursement = await this.prisma.disbursement.findUnique({
      where: { id: disbursementId },
      select: {
        id: true,
        rail: true,
        status: true,
        amount: true,
        reference: true,
        providerMode: true,
        providerStatus: true,
        providerReceiptNumber: true,
        providerConversationId: true,
        providerOriginatorConversationId: true,
        providerPayload: true,
        initiatedAt: true,
        processedAt: true,
      },
    });

    if (!disbursement) {
      throw new NotFoundException('Disbursement not found');
    }

    if (
      disbursement.rail !== DisbursementRail.MPESA_B2C &&
      disbursement.rail !== DisbursementRail.MPESA_B2B
    ) {
      throw new BadRequestException('Only M-Pesa disbursements support this operation');
    }

    return disbursement;
  }

  private async persistMpesaDisbursementState(
    disbursementId: string,
    providerResponse: MpesaLifecycleResult,
    payloadKey: string,
    extras: Prisma.DisbursementUpdateInput = {},
  ) {
    const disbursement = await this.loadMpesaDisbursementState(disbursementId);

    return this.prisma.disbursement.update({
      where: { id: disbursementId },
      data: {
        provider: providerResponse.provider,
        providerMode: providerResponse.mode,
        providerStatus: providerResponse.providerStatus,
        providerReceiptNumber:
          providerResponse.providerReceiptNumber ??
          disbursement.providerReceiptNumber ??
          null,
        providerConversationId:
          providerResponse.conversationId ?? disbursement.providerConversationId ?? null,
        providerOriginatorConversationId:
          providerResponse.originatorConversationId ??
          disbursement.providerOriginatorConversationId ??
          null,
        providerPayload: this.mergeProviderPayload(
          disbursement.providerPayload,
          payloadKey,
          providerResponse.payload,
        ),
        ...extras,
      },
    });
  }

  private async markDisbursementSuccessful(
    disbursementId: string,
    providerResponse: MpesaLifecycleResult,
    payloadKey: string,
  ) {
    const disbursement = await this.loadMpesaDisbursementState(disbursementId);

    await this.prisma.disbursement.update({
      where: { id: disbursementId },
      data: {
        provider: providerResponse.provider,
        providerMode: providerResponse.mode,
        providerStatus: providerResponse.providerStatus,
        status: DisbursementStatus.SUCCESS,
        providerReceiptNumber:
          providerResponse.providerReceiptNumber ??
          disbursement.providerReceiptNumber ??
          providerResponse.transactionId ??
          null,
        providerConversationId:
          providerResponse.conversationId ?? disbursement.providerConversationId ?? null,
        providerOriginatorConversationId:
          providerResponse.originatorConversationId ??
          disbursement.providerOriginatorConversationId ??
          null,
        providerPayload: this.mergeProviderPayload(
          disbursement.providerPayload,
          payloadKey,
          providerResponse.payload,
        ),
        initiatedAt: disbursement.initiatedAt ?? new Date(),
        processedAt: new Date(),
        failureReason: null,
      },
    });

    return this.getDisbursement(disbursementId);
  }

  private async markDisbursementFailed(
    disbursementId: string,
    providerResponse: MpesaLifecycleResult,
    payloadKey: string,
  ) {
    const disbursement = await this.loadMpesaDisbursementState(disbursementId);

    await this.prisma.disbursement.update({
      where: { id: disbursementId },
      data: {
        provider: providerResponse.provider,
        providerMode: providerResponse.mode,
        providerStatus: providerResponse.providerStatus,
        status:
          disbursement.status === DisbursementStatus.SUCCESS
            ? DisbursementStatus.SUCCESS
            : DisbursementStatus.FAILED,
        providerReceiptNumber:
          providerResponse.providerReceiptNumber ??
          disbursement.providerReceiptNumber ??
          null,
        providerConversationId:
          providerResponse.conversationId ?? disbursement.providerConversationId ?? null,
        providerOriginatorConversationId:
          providerResponse.originatorConversationId ??
          disbursement.providerOriginatorConversationId ??
          null,
        providerPayload: this.mergeProviderPayload(
          disbursement.providerPayload,
          payloadKey,
          providerResponse.payload,
        ),
        failureReason:
          providerResponse.resultDesc ?? 'M-Pesa disbursement failed',
      },
    });

    return this.getDisbursement(disbursementId);
  }

  private async markDisbursementReversed(
    disbursementId: string,
    providerResponse: MpesaLifecycleResult,
    payloadKey: string,
    reason?: string,
  ) {
    const disbursement = await this.loadMpesaDisbursementState(disbursementId);

    await this.prisma.disbursement.update({
      where: { id: disbursementId },
      data: {
        provider: providerResponse.provider,
        providerMode: providerResponse.mode,
        providerStatus: providerResponse.providerStatus,
        status: DisbursementStatus.REVERSED,
        providerReceiptNumber:
          providerResponse.providerReceiptNumber ??
          disbursement.providerReceiptNumber ??
          null,
        providerConversationId:
          providerResponse.conversationId ?? disbursement.providerConversationId ?? null,
        providerOriginatorConversationId:
          providerResponse.originatorConversationId ??
          disbursement.providerOriginatorConversationId ??
          null,
        providerPayload: this.mergeProviderPayload(
          disbursement.providerPayload,
          payloadKey,
          providerResponse.payload,
        ),
        reversedAt: new Date(),
        failureReason: reason ?? providerResponse.resultDesc ?? null,
      },
    });

    return this.getDisbursement(disbursementId);
  }

  private async loadMpesaPaymentState(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        bookingId: true,
        invoiceId: true,
        amount: true,
        method: true,
        status: true,
        reference: true,
        providerStatus: true,
        merchantRequestId: true,
        checkoutRequestId: true,
        providerReceiptNumber: true,
        providerConversationId: true,
        providerOriginatorConversationId: true,
        providerPayload: true,
        confirmedAt: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.method !== PaymentMethod.MPESA) {
      throw new BadRequestException('Only M-Pesa payments support this operation');
    }

    return payment;
  }

  private async persistMpesaProviderState(
    paymentId: string,
    providerResponse: MpesaLifecycleResult,
    payloadKey: string,
    extras: Prisma.PaymentUpdateInput = {},
  ) {
    const payment = await this.loadMpesaPaymentState(paymentId);

    return this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        provider: providerResponse.provider,
        providerMode: providerResponse.mode,
        providerStatus: providerResponse.providerStatus,
        merchantRequestId:
          providerResponse.merchantRequestId ?? payment.merchantRequestId ?? null,
        checkoutRequestId:
          providerResponse.checkoutRequestId ?? payment.checkoutRequestId ?? null,
        providerReceiptNumber:
          providerResponse.providerReceiptNumber ??
          payment.providerReceiptNumber ??
          null,
        providerConversationId:
          providerResponse.conversationId ?? payment.providerConversationId ?? null,
        providerOriginatorConversationId:
          providerResponse.originatorConversationId ??
          payment.providerOriginatorConversationId ??
          null,
        providerPayload: this.mergeProviderPayload(
          payment.providerPayload,
          payloadKey,
          providerResponse.payload,
        ),
        ...extras,
      },
    });
  }

  private async markPaymentSuccessful(
    paymentId: string,
    providerResponse: MpesaLifecycleResult,
    payloadKey: string,
    extras: Prisma.PaymentUpdateInput = {},
  ) {
    const payment = await this.loadMpesaPaymentState(paymentId);
    let linkedInvoiceId = payment.invoiceId;

    if (!linkedInvoiceId && payment.bookingId) {
      linkedInvoiceId = await this.linkInvoiceForBookingPayment(payment.id, payment.bookingId);
    }

    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        provider: providerResponse.provider,
        providerMode: providerResponse.mode,
        providerStatus: providerResponse.providerStatus,
        status: PaymentStatus.COMPLETED,
        merchantRequestId:
          providerResponse.merchantRequestId ?? payment.merchantRequestId ?? null,
        checkoutRequestId:
          providerResponse.checkoutRequestId ?? payment.checkoutRequestId ?? null,
        providerReceiptNumber:
          providerResponse.providerReceiptNumber ??
          payment.providerReceiptNumber ??
          null,
        providerConversationId:
          providerResponse.conversationId ?? payment.providerConversationId ?? null,
        providerOriginatorConversationId:
          providerResponse.originatorConversationId ??
          payment.providerOriginatorConversationId ??
          null,
        providerPayload: this.mergeProviderPayload(
          payment.providerPayload,
          payloadKey,
          providerResponse.payload,
        ),
        confirmedAt: payment.confirmedAt ?? new Date(),
        failureReason: null,
        ...(linkedInvoiceId
          ? { invoice: { connect: { id: linkedInvoiceId } } }
          : {}),
        ...extras,
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
          'Released after successful M-Pesa payment confirmation',
        );
      }
    }

    return this.getPayment(paymentId);
  }

  private async markPaymentFailed(
    paymentId: string,
    providerResponse: MpesaLifecycleResult,
    payloadKey: string,
    extras: Prisma.PaymentUpdateInput = {},
  ) {
    const payment = await this.loadMpesaPaymentState(paymentId);

    await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        provider: providerResponse.provider,
        providerMode: providerResponse.mode,
        providerStatus: providerResponse.providerStatus,
        status:
          payment.status === PaymentStatus.COMPLETED
            ? PaymentStatus.COMPLETED
            : PaymentStatus.FAILED,
        merchantRequestId:
          providerResponse.merchantRequestId ?? payment.merchantRequestId ?? null,
        checkoutRequestId:
          providerResponse.checkoutRequestId ?? payment.checkoutRequestId ?? null,
        providerReceiptNumber:
          providerResponse.providerReceiptNumber ??
          payment.providerReceiptNumber ??
          null,
        providerConversationId:
          providerResponse.conversationId ?? payment.providerConversationId ?? null,
        providerOriginatorConversationId:
          providerResponse.originatorConversationId ??
          payment.providerOriginatorConversationId ??
          null,
        providerPayload: this.mergeProviderPayload(
          payment.providerPayload,
          payloadKey,
          providerResponse.payload,
        ),
        failureReason: providerResponse.resultDesc ?? 'M-Pesa payment failed',
        ...extras,
      },
    });

    return this.getPayment(paymentId);
  }

  private async markPaymentReversed(
    paymentId: string,
    providerResponse: MpesaLifecycleResult,
    payloadKey: string,
    reason?: string,
  ) {
    const payment = await this.loadMpesaPaymentState(paymentId);

    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        provider: providerResponse.provider,
        providerMode: providerResponse.mode,
        providerStatus: providerResponse.providerStatus,
        status: PaymentStatus.REVERSED,
        merchantRequestId:
          providerResponse.merchantRequestId ?? payment.merchantRequestId ?? null,
        checkoutRequestId:
          providerResponse.checkoutRequestId ?? payment.checkoutRequestId ?? null,
        providerReceiptNumber:
          providerResponse.providerReceiptNumber ??
          payment.providerReceiptNumber ??
          null,
        providerConversationId:
          providerResponse.conversationId ?? payment.providerConversationId ?? null,
        providerOriginatorConversationId:
          providerResponse.originatorConversationId ??
          payment.providerOriginatorConversationId ??
          null,
        providerPayload: this.mergeProviderPayload(
          payment.providerPayload,
          payloadKey,
          providerResponse.payload,
        ),
        reversedAt: new Date(),
        failureReason: reason ?? providerResponse.resultDesc ?? null,
      },
    });

    if (updated.invoiceId) {
      await this.syncInvoicePaymentState(updated.invoiceId);
    }

    if (updated.bookingId) {
      try {
        await this.escrowService.refund(
          updated.bookingId,
          reason ?? 'Escrow refunded after M-Pesa reversal',
        );
      } catch {
        // Some bookings may not have an escrow ledger yet.
      }
    }

    return this.getPayment(paymentId);
  }

  private async findPaymentByMpesaIdentifiers(providerResponse: MpesaLifecycleResult) {
    if (providerResponse.checkoutRequestId) {
      const byCheckout = await this.prisma.payment.findFirst({
        where: { checkoutRequestId: providerResponse.checkoutRequestId },
        select: { id: true, providerStatus: true, status: true },
      });
      if (byCheckout) {
        return byCheckout;
      }
    }

    if (providerResponse.merchantRequestId) {
      const byMerchant = await this.prisma.payment.findFirst({
        where: { merchantRequestId: providerResponse.merchantRequestId },
        select: { id: true, providerStatus: true, status: true },
      });
      if (byMerchant) {
        return byMerchant;
      }
    }

    if (providerResponse.originatorConversationId) {
      const byOriginator = await this.prisma.payment.findFirst({
        where: {
          providerOriginatorConversationId: providerResponse.originatorConversationId,
        },
        select: { id: true, providerStatus: true, status: true },
      });
      if (byOriginator) {
        return byOriginator;
      }
    }

    if (providerResponse.conversationId) {
      const byConversation = await this.prisma.payment.findFirst({
        where: { providerConversationId: providerResponse.conversationId },
        select: { id: true, providerStatus: true, status: true },
      });
      if (byConversation) {
        return byConversation;
      }
    }

    if (providerResponse.transactionId) {
      return this.prisma.payment.findFirst({
        where: { providerReceiptNumber: providerResponse.transactionId },
        select: { id: true, providerStatus: true, status: true },
      });
    }

    return null;
  }

  private async findDisbursementByMpesaIdentifiers(
    providerResponse: MpesaLifecycleResult,
  ) {
    if (providerResponse.originatorConversationId) {
      const byOriginator = await this.prisma.disbursement.findFirst({
        where: {
          providerOriginatorConversationId: providerResponse.originatorConversationId,
        },
        select: { id: true, providerStatus: true, status: true },
      });
      if (byOriginator) {
        return byOriginator;
      }
    }

    if (providerResponse.conversationId) {
      const byConversation = await this.prisma.disbursement.findFirst({
        where: { providerConversationId: providerResponse.conversationId },
        select: { id: true, providerStatus: true, status: true },
      });
      if (byConversation) {
        return byConversation;
      }
    }

    if (providerResponse.transactionId) {
      const byReceipt = await this.prisma.disbursement.findFirst({
        where: { providerReceiptNumber: providerResponse.transactionId },
        select: { id: true, providerStatus: true, status: true },
      });
      if (byReceipt) {
        return byReceipt;
      }
    }

    return null;
  }

  private mergeProviderPayload(
    existingPayload: Prisma.JsonValue | null,
    payloadKey: string,
    payload: unknown,
  ): Prisma.InputJsonValue {
    const base =
      existingPayload &&
      typeof existingPayload === 'object' &&
      !Array.isArray(existingPayload)
        ? { ...(existingPayload as Record<string, unknown>) }
        : {};

    return {
      ...base,
      [payloadKey]: payload ?? null,
    } as Prisma.InputJsonValue;
  }

  private extractErrorMessage(error: unknown) {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return 'M-Pesa request failed';
  }

  private async assertPaymentRecordAccess(paymentId: string, actor?: FinanceActor) {
    if (!actor) {
      return;
    }

    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        booking: { select: { customerId: true, agencyId: true } },
        invoice: { select: { customerId: true, agencyId: true } },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    this.assertPaymentAccessFromRecord(payment, actor);
  }

  private assertPaymentTargetAccess(context: PaymentContext, actor?: FinanceActor) {
    if (!actor) {
      return;
    }

    const customerId = context.invoice?.customerId ?? context.booking?.customerId ?? null;
    const agencyId = context.invoice?.agencyId ?? context.booking?.agencyId ?? null;
    this.assertScopedAccess(actor, customerId, agencyId);
  }

  private assertPaymentAccessFromRecord(
    payment: {
      booking?: { customerId: string; agencyId?: string | null } | null;
      invoice?: { customerId: string; agencyId?: string | null } | null;
    },
    actor?: FinanceActor,
  ) {
    if (!actor) {
      return;
    }

    const customerId = payment.invoice?.customerId ?? payment.booking?.customerId ?? null;
    const agencyId = payment.invoice?.agencyId ?? payment.booking?.agencyId ?? null;
    this.assertScopedAccess(actor, customerId, agencyId);
  }

  private assertScopedAccess(
    actor: FinanceActor | undefined,
    ownerUserId?: string | null,
    agencyId?: string | null,
  ) {
    if (!actor) {
      return;
    }

    const role = String(actor.role ?? '').toUpperCase();
    if (['SUPER_ADMIN', 'ADMIN'].includes(role)) {
      return;
    }

    if (role === 'AGENCY_STAFF' && actor.agencyId && agencyId === actor.agencyId) {
      return;
    }

    if (ownerUserId && actor.id === ownerUserId) {
      return;
    }

    throw new ForbiddenException('You are not allowed to access this finance record.');
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
            agencyId: true,
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
            agencyId: true,
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
          agencyId: true,
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
            agencyId: true,
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
        status: PaymentStatus.COMPLETED,
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
        status: PaymentStatus.COMPLETED,
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
        status: PaymentStatus.COMPLETED,
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

  private async generateDisbursementReference(): Promise<string> {
    const reference = `DISB-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const exists = await this.prisma.disbursement.findUnique({
      where: { reference },
      select: { id: true },
    });

    return exists ? this.generateDisbursementReference() : reference;
  }
}
