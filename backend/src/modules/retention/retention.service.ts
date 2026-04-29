import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { IncentivesService } from '../drivers/incentives/incentives.service';
import { RegisterDriverReferralDto } from './dto/driver-referral.dto';

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

type DriverReferralStatus = 'REGISTERED' | 'CONVERTED';

type DriverReferralRecord = {
  referralId: string;
  referrerDriverId: string;
  referrerUserId: string;
  referredUserId: string;
  convertedDriverId: string | null;
  status: DriverReferralStatus;
  referrerBonusAmount: number;
  joiningBonusAmount: number;
  note: string | null;
  createdAt: string;
  convertedAt: string | null;
  convertedBy: string | null;
};

@Injectable()
export class RetentionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly incentivesService: IncentivesService,
  ) {}

  private readonly referralBonusAmount = Number(
    process.env.DRIVER_REFERRAL_BONUS_AMOUNT ?? 1000,
  );
  private readonly joiningBonusAmount = Number(
    process.env.DRIVER_JOINING_BONUS_AMOUNT ?? 500,
  );

  async listDriverReferrals() {
    const referrals = await this.readDriverReferralRecords();
    const driverIds = [
      ...new Set(
        referrals.flatMap((referral) =>
          [
            referral.referrerDriverId,
            ...(referral.convertedDriverId ? [referral.convertedDriverId] : []),
          ].filter(Boolean),
        ),
      ),
    ];
    const userIds = [...new Set(referrals.map((referral) => referral.referredUserId))];

    const [drivers, users] = await Promise.all([
      driverIds.length > 0
        ? this.prisma.driver.findMany({
            where: { id: { in: driverIds } },
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  phone: true,
                  email: true,
                },
              },
            },
          })
        : Promise.resolve([]),
      userIds.length > 0
        ? this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: {
              id: true,
              fullName: true,
              phone: true,
              email: true,
              status: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const driverMap = new Map(drivers.map((driver) => [driver.id, driver]));
    const userMap = new Map(users.map((user) => [user.id, user]));

    return {
      generatedAt: new Date().toISOString(),
      summary: {
        totalReferrals: referrals.length,
        registered: referrals.filter((referral) => referral.status === 'REGISTERED').length,
        converted: referrals.filter((referral) => referral.status === 'CONVERTED').length,
        totalReferralBonusAmount: this.round(
          referrals.reduce((sum, referral) => sum + referral.referrerBonusAmount, 0),
        ),
        totalJoiningBonusAmount: this.round(
          referrals.reduce((sum, referral) => sum + referral.joiningBonusAmount, 0),
        ),
      },
      referrals: referrals.map((referral) => ({
        ...referral,
        referrer: driverMap.get(referral.referrerDriverId) ?? null,
        referredUser: userMap.get(referral.referredUserId) ?? null,
        convertedDriver: referral.convertedDriverId
          ? driverMap.get(referral.convertedDriverId) ?? null
          : null,
      })),
      notes: [
        'Driver referral state is stored through IdempotencyRecord entries so activation payouts can be tracked without adding new Phase 0 tables.',
        'Referral conversion requires the invited account to be ACTIVE and to have a driver profile before payout is released.',
      ],
    };
  }

  async registerDriverReferral(
    dto: RegisterDriverReferralDto,
    actorId: string,
    actorDriverId: string | null,
  ) {
    const referrerDriverId = dto.referrerDriverId ?? actorDriverId;
    if (!referrerDriverId) {
      throw new BadRequestException('referrerDriverId is required for driver referrals.');
    }

    const [referrerDriver, referredUser] = await Promise.all([
      this.prisma.driver.findUnique({
        where: { id: referrerDriverId },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.user.findUnique({
        where: { id: dto.referredUserId },
        select: {
          id: true,
          role: true,
          status: true,
          fullName: true,
          email: true,
        },
      }),
    ]);

    if (!referrerDriver) {
      throw new NotFoundException('Referrer driver not found');
    }
    if (!referredUser || referredUser.role !== UserRole.DRIVER) {
      throw new BadRequestException('Referred account must be a DRIVER user.');
    }
    if (referrerDriver.userId === referredUser.id) {
      throw new BadRequestException('A driver cannot refer their own account.');
    }

    const existing = (await this.readDriverReferralRecords()).find(
      (referral) =>
        referral.referredUserId === referredUser.id &&
        referral.status === 'REGISTERED',
    );
    if (existing) {
      return {
        referral: existing,
        idempotent: true,
      };
    }

    const record: DriverReferralRecord = {
      referralId: crypto.randomUUID(),
      referrerDriverId,
      referrerUserId: referrerDriver.userId,
      referredUserId: referredUser.id,
      convertedDriverId: null,
      status: 'REGISTERED',
      referrerBonusAmount: this.round(
        dto.referrerBonusAmount ?? this.referralBonusAmount,
      ),
      joiningBonusAmount: this.round(
        dto.joiningBonusAmount ?? this.joiningBonusAmount,
      ),
      note: dto.note?.trim() || null,
      createdAt: new Date().toISOString(),
      convertedAt: null,
      convertedBy: null,
    };

    await this.persistDriverReferralRecord(record);
    await this.writeAudit(actorId, 'REFERRAL_REGISTERED', record.referralId, {
      referrerDriverId,
      referredUserId: referredUser.id,
      referrerBonusAmount: record.referrerBonusAmount,
      joiningBonusAmount: record.joiningBonusAmount,
    });

    return {
      referral: record,
      idempotent: false,
    };
  }

  async convertDriverReferral(referralId: string, actorId: string, note?: string) {
    const referral = await this.getDriverReferralRecordOrThrow(referralId);
    if (referral.status === 'CONVERTED') {
      return {
        referral,
        idempotent: true,
      };
    }

    const referredDriver = await this.prisma.driver.findUnique({
      where: { userId: referral.referredUserId },
      include: {
        user: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });
    if (!referredDriver || referredDriver.user.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Referred driver must have an ACTIVE account and a driver profile before referral conversion.',
      );
    }

    const referrerBonus = await this.incentivesService.grantReferralBonus(
      {
        driverId: referral.referrerDriverId,
        amount: referral.referrerBonusAmount,
        reason: `Driver referral bonus for ${referral.referredUserId}`,
        reference: referral.referralId,
      },
      actorId,
    );
    const joiningBonus = await this.incentivesService.grantJoiningBonus(
      {
        driverId: referredDriver.id,
        amount: referral.joiningBonusAmount,
        reason: `Driver joining bonus after referral ${referral.referralId}`,
        reference: referral.referralId,
      },
      actorId,
    );

    const updated: DriverReferralRecord = {
      ...referral,
      convertedDriverId: referredDriver.id,
      status: 'CONVERTED',
      note: note?.trim() || referral.note,
      convertedAt: new Date().toISOString(),
      convertedBy: actorId,
    };

    await this.persistDriverReferralRecord(updated);
    await this.writeAudit(actorId, 'REFERRAL_CONVERTED', referral.referralId, {
      referredUserId: referral.referredUserId,
      convertedDriverId: referredDriver.id,
      referrerBonusAmount: referral.referrerBonusAmount,
      joiningBonusAmount: referral.joiningBonusAmount,
    });

    return {
      referral: updated,
      referrerBonus,
      joiningBonus,
      idempotent: false,
    };
  }

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
    const [
      walletAccounts,
      walletTransactions,
      programTransactions,
      referralLogs,
    ] = await Promise.all([
      this.prisma.wallet.count(),
      this.prisma.walletTransaction.count(),
      this.prisma.walletTransaction.findMany({
        where: {
          type: {
            in: [
              'PROMO_CREDIT',
              'PROMO_DEBIT',
              'LOYALTY_CREDIT',
              'LOYALTY_DEBIT',
              'REFERRAL_BONUS',
            ],
          },
        },
        select: {
          walletId: true,
          type: true,
          amount: true,
          reference: true,
          description: true,
        },
      }),
      this.prisma.auditLog.findMany({
        where: {
          action: {
            in: ['REFERRAL_REGISTERED', 'REFERRAL_CONVERTED'],
          },
        },
        select: {
          action: true,
          entityId: true,
          details: true,
        },
      }),
    ]);

    const promoTransactions = programTransactions.filter((transaction) =>
      transaction.type.startsWith('PROMO_'),
    );
    const loyaltyTransactions = programTransactions.filter((transaction) =>
      transaction.type.startsWith('LOYALTY_'),
    );
    const referralTransactions = programTransactions.filter(
      (transaction) => transaction.type === 'REFERRAL_BONUS',
    );

    const promoCodes = new Set(
      promoTransactions
        .map(
          (transaction) =>
            transaction.reference ??
            this.extractProgramCode(transaction.description, 'PROMO'),
        )
        .filter((value): value is string => Boolean(value)),
    );

    const loyaltyWallets = new Set(loyaltyTransactions.map((transaction) => transaction.walletId));
    const loyaltyBalance = loyaltyTransactions.reduce((sum, transaction) => {
      if (transaction.type === 'LOYALTY_DEBIT') {
        return sum - transaction.amount;
      }
      return sum + transaction.amount;
    }, 0);

    const referralKeys = new Set<string>();
    for (const log of referralLogs) {
      referralKeys.add(log.entityId);
    }
    for (const transaction of referralTransactions) {
      if (transaction.reference) {
        referralKeys.add(transaction.reference);
      }
    }

    return {
      generatedAt: new Date().toISOString(),
      readiness: 'ACTIVE',
      promoCodes: {
        enabled: true,
        totalCodes: promoCodes.size,
        redemptions: promoTransactions.filter(
          (transaction) => transaction.type === 'PROMO_CREDIT',
        ).length,
        note: 'Promo activity is derived from wallet transactions tagged PROMO_CREDIT or PROMO_DEBIT, with the code stored in reference or description.',
      },
      loyaltyPoints: {
        enabled: true,
        totalAccounts: loyaltyWallets.size,
        totalPoints: this.round(loyaltyBalance),
        note: 'Loyalty balances use wallet transactions tagged LOYALTY_CREDIT and LOYALTY_DEBIT within the current schema.',
      },
      referrals: {
        enabled: true,
        totalReferrals: referralKeys.size,
        convertedReferrals:
          referralLogs.filter((log) => log.action === 'REFERRAL_CONVERTED').length +
          referralTransactions.length,
        note: 'Referral conversion is tracked through REFERRAL_REGISTERED or REFERRAL_CONVERTED audit logs and REFERRAL_BONUS wallet transactions.',
      },
      supportingSignals: {
        walletAccounts,
        walletTransactions,
      },
      notes: [
        'Promo, loyalty, and referral analytics are backed by wallet-transaction type conventions and referral audit-log actions inside the existing schema.',
        'The current schema does not use dedicated promo or referral tables, so references and descriptions act as the lightweight program ledger.',
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

  private referralKey(referralId: string) {
    return `driver-referral:${referralId}`;
  }

  private async readDriverReferralRecords() {
    const rows = await this.prisma.idempotencyRecord.findMany({
      where: {
        key: { startsWith: 'driver-referral:' },
      },
      select: {
        response: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return rows
      .map((row) => this.asDriverReferralRecord(row.response))
      .filter((record): record is DriverReferralRecord => Boolean(record));
  }

  private async getDriverReferralRecordOrThrow(referralId: string) {
    const row = await this.prisma.idempotencyRecord.findUnique({
      where: { key: this.referralKey(referralId) },
      select: { response: true },
    });
    const record = this.asDriverReferralRecord(row?.response);
    if (!record) {
      throw new NotFoundException('Driver referral record not found');
    }
    return record;
  }

  private async persistDriverReferralRecord(record: DriverReferralRecord) {
    await this.prisma.idempotencyRecord.upsert({
      where: { key: this.referralKey(record.referralId) },
      create: {
        key: this.referralKey(record.referralId),
        status: record.status,
        requestHash: record.referredUserId,
        response: record as Prisma.InputJsonValue,
      },
      update: {
        status: record.status,
        requestHash: record.referredUserId,
        response: record as Prisma.InputJsonValue,
      },
    });
  }

  private asDriverReferralRecord(value: Prisma.JsonValue | null | undefined) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const record = value as Record<string, Prisma.JsonValue>;
    if (
      typeof record.referralId !== 'string' ||
      typeof record.referrerDriverId !== 'string' ||
      typeof record.referredUserId !== 'string'
    ) {
      return null;
    }

    return {
      referralId: record.referralId,
      referrerDriverId: record.referrerDriverId,
      referrerUserId:
        typeof record.referrerUserId === 'string' ? record.referrerUserId : '',
      referredUserId: record.referredUserId,
      convertedDriverId:
        typeof record.convertedDriverId === 'string'
          ? record.convertedDriverId
          : null,
      status:
        typeof record.status === 'string'
          ? (record.status as DriverReferralStatus)
          : 'REGISTERED',
      referrerBonusAmount:
        typeof record.referrerBonusAmount === 'number'
          ? record.referrerBonusAmount
          : this.referralBonusAmount,
      joiningBonusAmount:
        typeof record.joiningBonusAmount === 'number'
          ? record.joiningBonusAmount
          : this.joiningBonusAmount,
      note: typeof record.note === 'string' ? record.note : null,
      createdAt:
        typeof record.createdAt === 'string'
          ? record.createdAt
          : new Date().toISOString(),
      convertedAt:
        typeof record.convertedAt === 'string' ? record.convertedAt : null,
      convertedBy:
        typeof record.convertedBy === 'string' ? record.convertedBy : null,
    } satisfies DriverReferralRecord;
  }

  private extractProgramCode(value: string | null | undefined, prefix: string) {
    if (!value) {
      return null;
    }

    const match = value.match(new RegExp(`${prefix}:([A-Z0-9_-]+)`, 'i'));
    return match?.[1] ?? null;
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

  private async writeAudit(
    userId: string,
    action: string,
    entityId: string,
    details: Record<string, unknown>,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      return;
    }

    await this.prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType: 'DRIVER_REFERRAL',
        entityId,
        details: details as Prisma.InputJsonValue,
      },
    });
  }
}
