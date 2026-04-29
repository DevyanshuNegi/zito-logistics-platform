import { BadRequestException, Injectable } from '@nestjs/common';
import { InvoiceStatus, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type ReconciliationRecord = {
  key: string;
  bookingId: string | null;
  bookingReference: string | null;
  customerId: string | null;
  customerLabel: string | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
  invoiceType: string | null;
  invoiceStatus: string | null;
  invoiceTotal: number;
  paymentIds: string[];
  paymentReferenceIds: string[];
  paymentStatuses: string[];
  paymentMethods: string[];
  paymentTotal: number;
  outstandingAmount: number;
  matchStatus:
    | 'MATCHED'
    | 'PARTIAL'
    | 'OVERPAID'
    | 'UNPAID'
    | 'NO_INVOICE'
    | 'MANUAL_REVIEW';
  matchedBy: 'BOOKING_REFERENCE' | 'INVOICE_REFERENCE' | 'NONE';
  mismatchReasons: string[];
  lastActivityAt: string;
};

@Injectable()
export class ReconciliationService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(date?: string, limit = 200) {
    const dataset = await this.loadDataset({ date, limit });
    const records = this.buildRecords(dataset);
    const summary = this.buildSummary(records);

    return {
      date: dataset.scopeDate,
      generatedAt: new Date().toISOString(),
      summary,
      mismatches: records.filter((record) => record.mismatchReasons.length > 0),
      matched: records.filter((record) => record.matchStatus === 'MATCHED').slice(0, 25),
      records,
      notes: [
        'Standalone warehouse and combined invoices currently fall back to invoice-number matching when there is no booking-linked payment reference.',
        'Payment auto-match is strongest for booking-linked invoices because the current schema links payments to bookings, not directly to invoices.',
      ],
    };
  }

  async autoMatch(date?: string, limit = 200) {
    const dataset = await this.loadDataset({ date, limit });
    const records = this.buildRecords(dataset);
    const matched = records.filter((record) => record.matchStatus === 'MATCHED');

    return {
      date: dataset.scopeDate,
      generatedAt: new Date().toISOString(),
      totalRecords: records.length,
      matchedCount: matched.length,
      partialCount: records.filter((record) => record.matchStatus === 'PARTIAL').length,
      overpaidCount: records.filter((record) => record.matchStatus === 'OVERPAID').length,
      unmatchedCount: records.filter((record) => record.matchStatus !== 'MATCHED').length,
      matched,
      records,
    };
  }

  async detectMismatch(date?: string, limit = 200) {
    const dataset = await this.loadDataset({ date, limit });
    const records = this.buildRecords(dataset);
    const mismatches = records.filter((record) => record.mismatchReasons.length > 0);

    return {
      date: dataset.scopeDate,
      generatedAt: new Date().toISOString(),
      totalMismatches: mismatches.length,
      byReason: mismatches.reduce<Record<string, number>>((acc, record) => {
        record.mismatchReasons.forEach((reason) => {
          acc[reason] = (acc[reason] ?? 0) + 1;
        });
        return acc;
      }, {}),
      mismatches,
    };
  }

  async dailyReport(date?: string, limit = 200) {
    const dashboard = await this.getDashboard(date, limit);
    return {
      date: dashboard.date,
      generatedAt: dashboard.generatedAt,
      summary: dashboard.summary,
      mismatchCount: dashboard.mismatches.length,
      topMismatches: dashboard.mismatches.slice(0, 20),
      notes: dashboard.notes,
    };
  }

  private async loadDataset(options: { date?: string; limit?: number }) {
    const scope = this.resolveScope(options.date);
    const take = Math.min(Math.max(options.limit ?? 200, 1), 500);

    const [invoices, payments] = await Promise.all([
      this.prisma.invoice.findMany({
        where: {
          status: { not: InvoiceStatus.CANCELLED },
          ...(scope.where
            ? {
                OR: [
                  { createdAt: scope.where },
                  { issuedAt: scope.where },
                ],
              }
            : {}),
        },
        include: {
          booking: {
            select: {
              id: true,
              reference: true,
              customerId: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take,
      }),
      this.prisma.payment.findMany({
        where: {
          status: {
            in: [
              PaymentStatus.SUCCESS,
              PaymentStatus.PENDING,
              PaymentStatus.REFUNDED,
              PaymentStatus.REVERSED,
            ],
          },
          ...(scope.where ? { createdAt: scope.where } : {}),
        },
        include: {
          booking: {
            select: {
              id: true,
              reference: true,
              customerId: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take,
      }),
    ]);

    const customerIds = [
      ...new Set(
        [
          ...invoices.map((invoice) => invoice.customerId),
          ...payments.map((payment) => payment.booking?.customerId).filter(Boolean),
        ] as string[],
      ),
    ];

    const customers =
      customerIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: customerIds } },
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          })
        : [];

    return {
      invoices,
      payments,
      customersById: new Map(
        customers.map((customer) => [
          customer.id,
          customer.fullName ?? customer.email ?? customer.id,
        ]),
      ),
      scopeDate: scope.label,
    };
  }

  private buildRecords(dataset: Awaited<ReturnType<typeof this.loadDataset>>) {
    const paymentsByBookingId = new Map<string, typeof dataset.payments>();
    const paymentsByReference = new Map<string, typeof dataset.payments>();

    for (const payment of dataset.payments) {
      if (payment.bookingId) {
        paymentsByBookingId.set(payment.bookingId, [
          ...(paymentsByBookingId.get(payment.bookingId) ?? []),
          payment,
        ]);
      }
      if (payment.reference) {
        paymentsByReference.set(payment.reference, [
          ...(paymentsByReference.get(payment.reference) ?? []),
          payment,
        ]);
      }
    }

    const records: ReconciliationRecord[] = [];
    const consumedPaymentIds = new Set<string>();

    for (const invoice of dataset.invoices) {
      const bookingPayments = invoice.bookingId
        ? paymentsByBookingId.get(invoice.bookingId) ?? []
        : [];
      const referencePayments = paymentsByReference.get(invoice.number) ?? [];
      const relatedPayments =
        bookingPayments.length > 0 ? bookingPayments : referencePayments;

      relatedPayments.forEach((payment) => consumedPaymentIds.add(payment.id));

      const successfulPayments = relatedPayments.filter(
        (payment) => payment.status === PaymentStatus.SUCCESS,
      );
      const pendingPayments = relatedPayments.filter(
        (payment) => payment.status === PaymentStatus.PENDING,
      );
      const refundedOrReversed = relatedPayments.filter(
        (payment) =>
          payment.status === PaymentStatus.REFUNDED ||
          payment.status === PaymentStatus.REVERSED,
      );
      const paymentTotal = Number(
        successfulPayments.reduce((sum, payment) => sum + payment.amount, 0).toFixed(2),
      );
      const outstandingAmount = Number(
        Math.max(0, invoice.totalAmount - paymentTotal).toFixed(2),
      );
      const duplicateReferences = this.findDuplicates(
        successfulPayments.map((payment) => payment.reference).filter(Boolean) as string[],
      );

      const mismatchReasons: string[] = [];
      if (!invoice.bookingId && referencePayments.length === 0) {
        mismatchReasons.push('MANUAL_REFERENCE_REQUIRED');
      }
      if (paymentTotal === 0 && invoice.status !== InvoiceStatus.DRAFT) {
        mismatchReasons.push('MISSING_PAYMENT');
      }
      if (paymentTotal > 0 && paymentTotal !== invoice.totalAmount) {
        mismatchReasons.push('AMOUNT_MISMATCH');
      }
      if (
        successfulPayments.length > 1 &&
        (paymentTotal > invoice.totalAmount || duplicateReferences.length > 0)
      ) {
        mismatchReasons.push('DUPLICATE_PAYMENT');
      }
      if (pendingPayments.length > 0) {
        mismatchReasons.push('PENDING_SETTLEMENT');
      }
      if (refundedOrReversed.length > 0 && paymentTotal < invoice.totalAmount) {
        mismatchReasons.push('PAYMENT_REVERSED');
      }

      records.push({
        key: `invoice:${invoice.id}`,
        bookingId: invoice.bookingId ?? null,
        bookingReference: invoice.booking?.reference ?? null,
        customerId: invoice.customerId,
        customerLabel: dataset.customersById.get(invoice.customerId) ?? invoice.customerId,
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        invoiceType: invoice.type,
        invoiceStatus: invoice.status,
        invoiceTotal: invoice.totalAmount,
        paymentIds: relatedPayments.map((payment) => payment.id),
        paymentReferenceIds: relatedPayments
          .map((payment) => payment.reference)
          .filter(Boolean) as string[],
        paymentStatuses: relatedPayments.map((payment) => payment.status),
        paymentMethods: [
          ...new Set(relatedPayments.map((payment) => payment.method as PaymentMethod)),
        ],
        paymentTotal,
        outstandingAmount,
        matchStatus: this.resolveMatchStatus({
          invoiceTotal: invoice.totalAmount,
          paymentTotal,
          hasManualReferenceGap: !invoice.bookingId && referencePayments.length === 0,
        }),
        matchedBy: bookingPayments.length > 0
          ? 'BOOKING_REFERENCE'
          : referencePayments.length > 0
            ? 'INVOICE_REFERENCE'
            : 'NONE',
        mismatchReasons: [...new Set(mismatchReasons)],
        lastActivityAt: new Date(
          Math.max(
            invoice.updatedAt.getTime(),
            ...relatedPayments.map((payment) => payment.updatedAt.getTime()),
          ),
        ).toISOString(),
      });
    }

    const invoiceIdsByReference = new Map(
      dataset.invoices.map((invoice) => [invoice.number, invoice.id]),
    );
    const invoiceIdsByBookingId = new Map(
      dataset.invoices
        .filter((invoice) => invoice.bookingId)
        .map((invoice) => [invoice.bookingId as string, invoice.id]),
    );

    for (const payment of dataset.payments) {
      if (consumedPaymentIds.has(payment.id)) {
        continue;
      }

      const linkedInvoiceId =
        (payment.bookingId && invoiceIdsByBookingId.get(payment.bookingId)) ||
        (payment.reference ? invoiceIdsByReference.get(payment.reference) : null);

      if (linkedInvoiceId) {
        continue;
      }

      records.push({
        key: `payment:${payment.id}`,
        bookingId: payment.bookingId ?? null,
        bookingReference: payment.booking?.reference ?? null,
        customerId: payment.booking?.customerId ?? null,
        customerLabel: payment.booking?.customerId
          ? dataset.customersById.get(payment.booking.customerId) ?? payment.booking.customerId
          : null,
        invoiceId: null,
        invoiceNumber: null,
        invoiceType: null,
        invoiceStatus: null,
        invoiceTotal: 0,
        paymentIds: [payment.id],
        paymentReferenceIds: payment.reference ? [payment.reference] : [],
        paymentStatuses: [payment.status],
        paymentMethods: [payment.method],
        paymentTotal: payment.status === PaymentStatus.SUCCESS ? payment.amount : 0,
        outstandingAmount: 0,
        matchStatus: 'NO_INVOICE',
        matchedBy: 'NONE',
        mismatchReasons: ['MISSING_INVOICE'],
        lastActivityAt: payment.updatedAt.toISOString(),
      });
    }

    return records.sort((left, right) => {
      return new Date(right.lastActivityAt).getTime() - new Date(left.lastActivityAt).getTime();
    });
  }

  private buildSummary(records: ReconciliationRecord[]) {
    const totalInvoiceValue = Number(
      records.reduce((sum, record) => sum + record.invoiceTotal, 0).toFixed(2),
    );
    const totalPaymentValue = Number(
      records.reduce((sum, record) => sum + record.paymentTotal, 0).toFixed(2),
    );
    const totalOutstanding = Number(
      records.reduce((sum, record) => sum + record.outstandingAmount, 0).toFixed(2),
    );

    return {
      totalRecords: records.length,
      totalInvoiceValue,
      totalPaymentValue,
      totalOutstanding,
      matchedCount: records.filter((record) => record.matchStatus === 'MATCHED').length,
      mismatchCount: records.filter((record) => record.mismatchReasons.length > 0).length,
      duplicateCount: records.filter((record) =>
        record.mismatchReasons.includes('DUPLICATE_PAYMENT'),
      ).length,
      missingInvoiceCount: records.filter((record) =>
        record.mismatchReasons.includes('MISSING_INVOICE'),
      ).length,
      missingPaymentCount: records.filter((record) =>
        record.mismatchReasons.includes('MISSING_PAYMENT'),
      ).length,
    };
  }

  private resolveMatchStatus(input: {
    invoiceTotal: number;
    paymentTotal: number;
    hasManualReferenceGap: boolean;
  }): ReconciliationRecord['matchStatus'] {
    if (input.hasManualReferenceGap) {
      return 'MANUAL_REVIEW';
    }
    if (input.paymentTotal === 0) {
      return 'UNPAID';
    }
    if (input.paymentTotal === input.invoiceTotal) {
      return 'MATCHED';
    }
    if (input.paymentTotal > input.invoiceTotal) {
      return 'OVERPAID';
    }
    return 'PARTIAL';
  }

  private findDuplicates(values: string[]) {
    const counts = new Map<string, number>();
    values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
    return [...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value);
  }

  private resolveScope(date?: string) {
    if (!date) {
      return {
        label: 'All recent finance records',
        where: null as Prisma.DateTimeFilter | null,
      };
    }

    const start = new Date(date);
    if (Number.isNaN(start.getTime())) {
      throw new BadRequestException('Invalid reconciliation date');
    }
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    return {
      label: start.toISOString().slice(0, 10),
      where: {
        gte: start,
        lt: end,
      } satisfies Prisma.DateTimeFilter,
    };
  }
}
