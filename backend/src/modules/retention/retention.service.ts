import { Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type CustomerSummary = {
  customerId: string;
  label: string;
  role: string;
  bookingCount: number;
  completedBookings: number;
  lifetimeValue: number;
  paidValue: number;
  lastBookingAt: string | null;
  repeatCustomer: boolean;
};

@Injectable()
export class RetentionService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const customers = await this.prisma.user.findMany({
      where: {
        role: {
          in: [UserRole.CUSTOMER, UserRole.CORPORATE],
        },
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const customerIds = customers.map((customer) => customer.id);
    const [bookings, invoices, contracts, ratingLogs] = await Promise.all([
      customerIds.length > 0
        ? this.prisma.booking.findMany({
            where: { customerId: { in: customerIds } },
            select: {
              id: true,
              customerId: true,
              status: true,
              createdAt: true,
            },
          })
        : Promise.resolve([]),
      customerIds.length > 0
        ? this.prisma.invoice.findMany({
            where: { customerId: { in: customerIds } },
            select: {
              customerId: true,
              totalAmount: true,
              paidAmount: true,
              status: true,
            },
          })
        : Promise.resolve([]),
      customerIds.length > 0
        ? this.prisma.contract.findMany({
            where: { customerId: { in: customerIds } },
            select: {
              customerId: true,
              businessName: true,
              status: true,
              updatedAt: true,
            },
            orderBy: { updatedAt: 'desc' },
          })
        : Promise.resolve([]),
      this.prisma.auditLog.findMany({
        where: {
          entityType: 'BOOKING',
          action: 'BOOKING_STATUS_CHANGED',
        },
        select: {
          details: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const contractNames = new Map<string, string>();
    for (const contract of contracts) {
      if (!contractNames.has(contract.customerId)) {
        contractNames.set(contract.customerId, contract.businessName);
      }
    }

    const customerMap = new Map<string, CustomerSummary>();
    for (const customer of customers) {
      customerMap.set(customer.id, {
        customerId: customer.id,
        label:
          contractNames.get(customer.id) ??
          customer.fullName ??
          customer.email ??
          customer.phone ??
          customer.id,
        role: customer.role,
        bookingCount: 0,
        completedBookings: 0,
        lifetimeValue: 0,
        paidValue: 0,
        lastBookingAt: null,
        repeatCustomer: false,
      });
    }

    for (const booking of bookings) {
      const current = customerMap.get(booking.customerId);
      if (!current) {
        continue;
      }

      current.bookingCount += 1;
      if (booking.status === 'COMPLETED' || booking.status === 'DELIVERED') {
        current.completedBookings += 1;
      }
      if (!current.lastBookingAt || new Date(current.lastBookingAt) < booking.createdAt) {
        current.lastBookingAt = booking.createdAt.toISOString();
      }
    }

    for (const invoice of invoices) {
      const current = customerMap.get(invoice.customerId);
      if (!current) {
        continue;
      }

      current.lifetimeValue = this.round(current.lifetimeValue + invoice.totalAmount);
      current.paidValue = this.round(current.paidValue + invoice.paidAmount);
    }

    const summaries = [...customerMap.values()].map((summary) => ({
      ...summary,
      repeatCustomer: summary.bookingCount >= 2,
    }));

    const activeCustomers = summaries.filter(
      (summary) => summary.bookingCount > 0 || summary.lifetimeValue > 0,
    );
    const repeatCustomers = activeCustomers.filter((summary) => summary.repeatCustomer);
    const totalLifetimeValue = this.round(
      activeCustomers.reduce((sum, customer) => sum + customer.lifetimeValue, 0),
    );
    const ratings = ratingLogs
      .map((log) => this.extractRating(log.details))
      .filter((value): value is number => value != null);

    const promoters = ratings.filter((rating) => rating >= 5).length;
    const passives = ratings.filter((rating) => rating === 4).length;
    const detractors = ratings.filter((rating) => rating <= 3).length;
    const npsScore = ratings.length
      ? this.round(((promoters - detractors) / ratings.length) * 100)
      : 0;

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    return {
      generatedAt: new Date().toISOString(),
      summary: {
        registeredCustomers: summaries.length,
        activeCustomers: activeCustomers.length,
        repeatCustomers: repeatCustomers.length,
        repeatRate: this.percent(repeatCustomers.length, activeCustomers.length),
        averageClv: this.average(activeCustomers.map((customer) => customer.lifetimeValue)),
        totalLifetimeValue,
        npsScore,
        ratingResponses: ratings.length,
        promoters,
        passives,
        detractors,
        atRiskCustomers: activeCustomers.filter(
          (customer) =>
            customer.lastBookingAt != null &&
            new Date(customer.lastBookingAt) < sixtyDaysAgo,
        ).length,
      },
      segments: [
        {
          segment: 'NEW',
          label: 'New',
          count: activeCustomers.filter((customer) => customer.bookingCount === 1).length,
          description: 'Customers with exactly one booking on record.',
        },
        {
          segment: 'REPEAT',
          label: 'Repeat',
          count: activeCustomers.filter(
            (customer) => customer.bookingCount >= 2 && customer.bookingCount <= 4,
          ).length,
          description: 'Customers with 2 to 4 bookings on record.',
        },
        {
          segment: 'LOYAL',
          label: 'Loyal',
          count: activeCustomers.filter((customer) => customer.bookingCount >= 5).length,
          description: 'Customers with 5 or more bookings on record.',
        },
        {
          segment: 'AT_RISK',
          label: 'At risk',
          count: activeCustomers.filter(
            (customer) =>
              customer.lastBookingAt != null &&
              new Date(customer.lastBookingAt) < sixtyDaysAgo,
          ).length,
          description: 'Customers whose last booking is older than 60 days.',
        },
      ],
      topCustomers: activeCustomers
        .sort((left, right) => {
          if (right.lifetimeValue !== left.lifetimeValue) {
            return right.lifetimeValue - left.lifetimeValue;
          }
          return right.bookingCount - left.bookingCount;
        })
        .slice(0, 12),
      notes: [
        'Customer lifetime value is derived from invoice totals in the current schema, so open uninvoiced work is not counted until it is billed.',
        'NPS is exposed as a proxy score derived from 1-to-5 booking ratings captured in audit logs because the current schema does not persist a dedicated 0-to-10 survey response.',
      ],
    };
  }

  async promos() {
    const [walletAccounts, walletTransactions] = await Promise.all([
      this.prisma.wallet.count(),
      this.prisma.walletTransaction.count(),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      readiness: 'SCHEMA_GAP',
      promoCodes: {
        enabled: false,
        totalCodes: 0,
        redemptions: 0,
        note: 'No promo-code or redemption model exists in the current schema.',
      },
      loyaltyPoints: {
        enabled: false,
        totalAccounts: 0,
        totalPoints: 0,
        note: 'Wallets exist, but they store currency balances rather than loyalty-point ledgers.',
      },
      referrals: {
        enabled: false,
        totalReferrals: 0,
        convertedReferrals: 0,
        note: 'No referral relationship or referral reward ledger exists in the current schema.',
      },
      supportingSignals: {
        walletAccounts,
        walletTransactions,
      },
      notes: [
        'Promo codes, loyalty points, and referral rewards are not yet schema-backed in this repo, so the retention backend exposes an explicit readiness state instead of fabricating activity data.',
        'Existing wallet records are surfaced only as implementation signals; they are monetary balances, not a loyalty-points system.',
      ],
    };
  }

  private extractRating(value: Prisma.JsonValue | null) {
    const details = this.asRecord(value);
    if (!details || details.action !== 'RATED') {
      return null;
    }

    const rating = details.rating;
    if (typeof rating === 'number') {
      return rating;
    }
    if (typeof rating === 'string' && rating.trim() !== '') {
      const parsed = Number(rating);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private asRecord(value: Prisma.JsonValue | null | undefined) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, Prisma.JsonValue>;
  }

  private round(value: number) {
    return Number(value.toFixed(2));
  }

  private average(values: number[]) {
    if (values.length === 0) {
      return 0;
    }
    return this.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }

  private percent(part: number, whole: number) {
    if (whole <= 0) {
      return 0;
    }
    return this.round((part / whole) * 100);
  }
}
