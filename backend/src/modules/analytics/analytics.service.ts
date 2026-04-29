import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AccountStatus,
  BookingStatus,
  InvoiceStatus,
  InvoiceType,
  InventoryStatus,
  Prisma,
  UserRole,
  VehicleStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RetentionService } from '../retention/retention.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

type AnalyticsPeriod = 'daily' | 'monthly';

type ResolvedDateRange = {
  period: AnalyticsPeriod;
  start: Date;
  endExclusive: Date;
  label: string;
};

type RevenueBucket = {
  bucket: string;
  label: string;
  invoiceCount: number;
  billedRevenue: number;
  collectedRevenue: number;
  outstandingRevenue: number;
};

type DriverKpiRow = {
  driverId: string;
  userId: string;
  driverName: string;
  phone: string | null;
  rating: number;
  completionRate: number;
  onTimeRate: number;
  acceptanceRate: number;
  assignedTrips: number;
  completedTrips: number;
  cancelledTrips: number;
  noShowEvents: number;
  isOnline: boolean;
  isAvailable: boolean;
  currentShiftStatus: string;
  attendanceStatus: string | null;
  lastShiftStartedAt: string | null;
  lastLocationAt: string | null;
};

type WarehouseKpiRow = {
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  agencyId: string;
  agencyName: string;
  configuredCapacity: number;
  totalBins: number;
  occupiedBins: number;
  availableBins: number;
  occupancyPercentage: number;
  activeStorageItems: number;
  averageDwellDays: number;
  turnoverCount: number;
  turnoverRate: number;
};

type MarketplacePartnerSnapshot = {
  partnerType: string;
  verificationStatus: string;
};

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly retentionService: RetentionService,
  ) {}

  async revenue(query: AnalyticsQueryDto = {}) {
    const range = this.resolveDateRange(query);
    const dateWhere = this.toDateFilter(range);

    const invoices = await this.prisma.invoice.findMany({
      where: {
        status: { not: InvoiceStatus.CANCELLED },
        OR: [{ createdAt: dateWhere }, { issuedAt: dateWhere }],
      },
      include: {
        booking: {
          select: {
            id: true,
            reference: true,
            serviceType: true,
            agencyId: true,
          },
        },
      },
      orderBy: [{ issuedAt: 'asc' }, { createdAt: 'asc' }],
    });

    const agencyIds = [
      ...new Set(
        invoices
          .map((invoice) => invoice.agencyId ?? invoice.booking?.agencyId)
          .filter((value): value is string => Boolean(value)),
      ),
    ];

    const agencies =
      agencyIds.length > 0
        ? await this.prisma.agency.findMany({
            where: { id: { in: agencyIds } },
            select: { id: true, name: true },
          })
        : [];

    const agencyNames = new Map(agencies.map((agency) => [agency.id, agency.name]));
    const buckets = new Map<string, RevenueBucket>();
    const byService = new Map<string, RevenueBucket>();
    const byAgency = new Map<string, RevenueBucket>();

    for (const invoice of invoices) {
      const occurredAt = invoice.issuedAt ?? invoice.createdAt;
      const bucketKey = this.formatBucketKey(occurredAt, range.period);
      const billedRevenue = this.round(invoice.totalAmount);
      const collectedRevenue = this.round(invoice.paidAmount);
      const outstandingRevenue = this.round(
        Math.max(0, invoice.totalAmount - invoice.paidAmount),
      );

      this.accumulateBucket(buckets, bucketKey, this.formatBucketLabel(occurredAt, range.period), {
        billedRevenue,
        collectedRevenue,
        outstandingRevenue,
      });

      const serviceKey =
        invoice.booking?.serviceType ?? this.mapInvoiceTypeToService(invoice.type);
      this.accumulateBucket(byService, serviceKey, serviceKey, {
        billedRevenue,
        collectedRevenue,
        outstandingRevenue,
      });

      const agencyId = invoice.agencyId ?? invoice.booking?.agencyId ?? 'UNASSIGNED';
      const agencyLabel = agencyNames.get(agencyId) ?? 'Unassigned';
      this.accumulateBucket(byAgency, agencyId, agencyLabel, {
        billedRevenue,
        collectedRevenue,
        outstandingRevenue,
      });
    }

    const summary = {
      invoiceCount: invoices.length,
      billedRevenue: this.round(
        invoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0),
      ),
      collectedRevenue: this.round(
        invoices.reduce((sum, invoice) => sum + invoice.paidAmount, 0),
      ),
      outstandingRevenue: this.round(
        invoices.reduce(
          (sum, invoice) => sum + Math.max(0, invoice.totalAmount - invoice.paidAmount),
          0,
        ),
      ),
      paidInvoices: invoices.filter((invoice) => invoice.status === InvoiceStatus.PAID).length,
      overdueInvoices: invoices.filter((invoice) => invoice.status === InvoiceStatus.OVERDUE)
        .length,
    };

    return {
      period: range.period,
      dateRange: {
        start: range.start.toISOString(),
        endExclusive: range.endExclusive.toISOString(),
        label: range.label,
      },
      summary,
      buckets: this.sortBuckets([...buckets.values()], range.period),
      byService: this.sortBreakdowns([...byService.values()]),
      byAgency: this.sortBreakdowns([...byAgency.values()]),
      notes: [
        'Revenue analytics use invoice totals as billed revenue and invoice paid amounts as collected revenue within the selected reporting window.',
        'Invoices without a linked booking fall back to invoice-type segmentation because the current schema does not store a separate service field on standalone invoices.',
      ],
    };
  }

  async driverKpis(query: AnalyticsQueryDto = {}) {
    const range = this.resolveDateRange(query);
    const dateWhere = this.toDateFilter(range);
    const completedStatuses = new Set<BookingStatus>([
      BookingStatus.DELIVERED,
      BookingStatus.COMPLETED,
    ]);
    const cancelledStatuses = new Set<BookingStatus>([
      BookingStatus.CANCELLED,
      BookingStatus.REJECTED,
    ]);

    const drivers = await this.prisma.driver.findMany({
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
        shifts: {
          orderBy: { shiftStartTime: 'desc' },
          take: 1,
          select: {
            status: true,
            attendanceStatus: true,
            shiftStartTime: true,
          },
        },
        bookings: {
          where: { createdAt: dateWhere },
          select: {
            id: true,
            reference: true,
            status: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const bookingIds = drivers.flatMap((driver) => driver.bookings.map((booking) => booking.id));
    const alerts =
      bookingIds.length > 0
        ? await this.prisma.internalAlert.findMany({
            where: {
              entityType: 'BOOKING',
              entityId: { in: bookingIds },
              type: { in: ['SLA_BREACH', 'SLA_NO_SHOW'] },
            },
            select: {
              entityId: true,
              type: true,
            },
          })
        : [];

    const breachIds = new Set(
      alerts.filter((alert) => alert.type === 'SLA_BREACH').map((alert) => alert.entityId),
    );
    const noShowIds = new Set(
      alerts.filter((alert) => alert.type === 'SLA_NO_SHOW').map((alert) => alert.entityId),
    );

    const rows: DriverKpiRow[] = drivers.map((driver) => {
      const assignedTrips = driver.bookings.length;
      const completedTrips = driver.bookings.filter((booking) =>
        completedStatuses.has(booking.status),
      ).length;
      const cancelledTrips = driver.bookings.filter((booking) =>
        cancelledStatuses.has(booking.status),
      ).length;
      const onTimeTrips = driver.bookings.filter(
        (booking) => completedStatuses.has(booking.status) && !breachIds.has(booking.id),
      ).length;
      const noShowEvents = driver.bookings.filter((booking) => noShowIds.has(booking.id)).length;
      const latestShift = driver.shifts[0];

      const completionRate =
        assignedTrips > 0
          ? this.percent(completedTrips, assignedTrips)
          : this.normalizePercent(driver.completionRate);

      return {
        driverId: driver.id,
        userId: driver.userId,
        driverName:
          driver.user.fullName ?? driver.user.email ?? driver.user.phone ?? driver.user.id,
        phone: driver.user.phone ?? null,
        rating: this.round(driver.rating),
        completionRate,
        onTimeRate: this.percent(onTimeTrips, completedTrips),
        acceptanceRate: this.normalizePercent(driver.acceptanceRate),
        assignedTrips,
        completedTrips,
        cancelledTrips,
        noShowEvents,
        isOnline: driver.isOnline,
        isAvailable: driver.isAvailable,
        currentShiftStatus: latestShift?.status ?? 'OFF_SHIFT',
        attendanceStatus: latestShift?.attendanceStatus ?? null,
        lastShiftStartedAt: latestShift?.shiftStartTime.toISOString() ?? null,
        lastLocationAt: driver.lastLocationAt?.toISOString() ?? null,
      };
    });

    const summary = {
      totalDrivers: rows.length,
      onlineDrivers: rows.filter((driver) => driver.isOnline).length,
      availableDrivers: rows.filter((driver) => driver.isAvailable).length,
      assignedTrips: rows.reduce((sum, driver) => sum + driver.assignedTrips, 0),
      completedTrips: rows.reduce((sum, driver) => sum + driver.completedTrips, 0),
      averageRating: this.average(rows.map((driver) => driver.rating)),
      averageCompletionRate: this.average(
        rows.map((driver) => driver.completionRate).filter((value) => value > 0),
      ),
      averageOnTimeRate: this.average(
        rows.map((driver) => driver.onTimeRate).filter((value) => value > 0),
      ),
      atRiskDrivers: rows.filter(
        (driver) =>
          driver.rating < 4.5 ||
          driver.completionRate < 85 ||
          (driver.completedTrips > 0 && driver.onTimeRate < 85),
      ).length,
    };

    return {
      period: range.period,
      dateRange: {
        start: range.start.toISOString(),
        endExclusive: range.endExclusive.toISOString(),
        label: range.label,
      },
      summary,
      drivers: rows.sort((left, right) => {
        if (right.onTimeRate !== left.onTimeRate) {
          return right.onTimeRate - left.onTimeRate;
        }
        if (right.completionRate !== left.completionRate) {
          return right.completionRate - left.completionRate;
        }
        return right.rating - left.rating;
      }),
      notes: [
        'Driver completion rate is computed from bookings created in the selected reporting window because the stored completion-rate field is not consistently maintained across the current repo.',
        'On-time percentage uses SLA breach alerts as the lateness signal, which keeps this dashboard aligned with the implemented SLA escalation flow.',
      ],
    };
  }

  async warehouseKpis(query: AnalyticsQueryDto = {}) {
    const range = this.resolveDateRange(query);
    const activeStorageStatuses = new Set<InventoryStatus>([
      InventoryStatus.RECEIVED,
      InventoryStatus.STORED,
      InventoryStatus.SORTED,
    ]);
    const turnoverStatuses = new Set<InventoryStatus>([
      InventoryStatus.DISPATCHED,
      InventoryStatus.DELIVERED,
    ]);

    const warehouses = await this.prisma.warehouse.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        agencyId: true,
        agency: {
          select: {
            name: true,
          },
        },
        zones: {
          select: {
            id: true,
            name: true,
            code: true,
            capacity: true,
            racks: {
              select: {
                bins: {
                  select: {
                    id: true,
                    isOccupied: true,
                    _count: {
                      select: {
                        items: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        items: {
          select: {
            id: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const rows: WarehouseKpiRow[] = warehouses.map((warehouse) => {
      let configuredCapacity = 0;
      let totalBins = 0;
      let occupiedBins = 0;

      warehouse.zones.forEach((zone) => {
        configuredCapacity += zone.capacity ?? 0;
        zone.racks.forEach((rack) => {
          totalBins += rack.bins.length;
          occupiedBins += rack.bins.filter(
            (bin) => bin.isOccupied || bin._count.items > 0,
          ).length;
        });
      });

      const activeStorageItems = warehouse.items.filter((item) =>
        activeStorageStatuses.has(item.status),
      );
      const turnoverCount = warehouse.items.filter(
        (item) =>
          turnoverStatuses.has(item.status) &&
          item.updatedAt >= range.start &&
          item.updatedAt < range.endExclusive,
      ).length;

      return {
        warehouseId: warehouse.id,
        warehouseName: warehouse.name,
        warehouseCode: warehouse.code,
        agencyId: warehouse.agencyId,
        agencyName: warehouse.agency.name,
        configuredCapacity: this.round(configuredCapacity),
        totalBins,
        occupiedBins,
        availableBins: Math.max(totalBins - occupiedBins, 0),
        occupancyPercentage: this.percent(occupiedBins, totalBins),
        activeStorageItems: activeStorageItems.length,
        averageDwellDays: this.average(
          activeStorageItems.map((item) => this.diffDays(item.createdAt, new Date())),
        ),
        turnoverCount,
        turnoverRate: this.percent(turnoverCount, activeStorageItems.length + turnoverCount),
      };
    });

    const summary = {
      totalWarehouses: rows.length,
      averageUtilization: this.average(rows.map((warehouse) => warehouse.occupancyPercentage)),
      averageDwellDays: this.average(rows.map((warehouse) => warehouse.averageDwellDays)),
      totalActiveStorageItems: rows.reduce(
        (sum, warehouse) => sum + warehouse.activeStorageItems,
        0,
      ),
      totalTurnoverCount: rows.reduce((sum, warehouse) => sum + warehouse.turnoverCount, 0),
      highOccupancyWarehouses: rows.filter(
        (warehouse) => warehouse.occupancyPercentage >= 90,
      ).length,
    };

    return {
      period: range.period,
      dateRange: {
        start: range.start.toISOString(),
        endExclusive: range.endExclusive.toISOString(),
        label: range.label,
      },
      summary,
      warehouses: rows.sort((left, right) => right.occupancyPercentage - left.occupancyPercentage),
      notes: [
        'Warehouse utilization follows the existing warehouse-capacity implementation in this repo and uses occupied-bin percentage rather than volumetric cubic-space calculations.',
        'Dwell time is measured from each active item creation timestamp because the current schema does not persist a dedicated storage-start clock separate from item intake.',
      ],
    };
  }

  async dashboard(query: AnalyticsQueryDto = {}) {
    const [revenue, drivers, warehouses, retention, promos] = await Promise.all([
      this.revenue(query),
      this.driverKpis(query),
      this.warehouseKpis(query),
      this.retentionService.overview(),
      this.retentionService.promos(),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      period: revenue.period,
      dateRange: revenue.dateRange,
      board: {
        billedRevenue: revenue.summary.billedRevenue,
        collectedRevenue: revenue.summary.collectedRevenue,
        outstandingRevenue: revenue.summary.outstandingRevenue,
        averageDriverCompletionRate: drivers.summary.averageCompletionRate,
        averageDriverOnTimeRate: drivers.summary.averageOnTimeRate,
        averageWarehouseUtilization: warehouses.summary.averageUtilization,
        repeatRate: retention.summary.repeatRate,
        averageClv: retention.summary.averageClv,
        npsScore: retention.summary.npsScore,
      },
      revenue,
      drivers,
      warehouses,
      retention,
      promos,
      notes: [
        ...new Set([
          ...revenue.notes,
          ...drivers.notes,
          ...warehouses.notes,
          ...retention.notes,
          ...promos.notes,
        ]),
      ],
    };
  }

  async funnelReport() {
    const supplyRoles = [
      UserRole.DRIVER,
      UserRole.TRANSPORTER,
      UserRole.WAREHOUSE_PARTNER,
    ];
    const [users, vehicles, referrals, marketplaceRows] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          role: {
            in: supplyRoles,
          },
        },
        select: {
          id: true,
          role: true,
          status: true,
          createdAt: true,
        },
      }),
      this.prisma.vehicle.findMany({
        select: {
          id: true,
          status: true,
          createdAt: true,
        },
      }),
      this.retentionService.listDriverReferrals(),
      this.prisma.idempotencyRecord.findMany({
        where: {
          key: { startsWith: 'marketplace:partner:' },
        },
        select: {
          response: true,
        },
      }),
    ]);

    const partnerSnapshots = marketplaceRows
      .map((row) => this.asMarketplacePartnerSnapshot(row.response))
      .filter((value): value is MarketplacePartnerSnapshot => Boolean(value));
    const registeredStatuses = new Set<AccountStatus>([
      AccountStatus.VERIFIED,
      AccountStatus.ACTIVE,
      AccountStatus.SUSPENDED,
    ]);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const funnelByRole = supplyRoles.map((role) => {
      const roleUsers = users.filter((user) => user.role === role);
      return {
        role,
        registered: roleUsers.length,
        verified: roleUsers.filter((user) => registeredStatuses.has(user.status)).length,
        active: roleUsers.filter((user) => user.status === AccountStatus.ACTIVE).length,
      };
    });

    return {
      generatedAt: new Date().toISOString(),
      summary: {
        registered: users.length,
        verified: users.filter((user) => registeredStatuses.has(user.status)).length,
        active: users.filter((user) => user.status === AccountStatus.ACTIVE).length,
        convertedDriverReferrals: referrals.summary.converted,
        pendingDriverReferrals: referrals.summary.registered,
        approvedMarketplacePartners: partnerSnapshots.filter(
          (partner) => partner.verificationStatus === 'APPROVED',
        ).length,
        pendingMarketplacePartners: partnerSnapshots.filter(
          (partner) => partner.verificationStatus === 'PENDING_REVIEW',
        ).length,
        totalFleetUnits: vehicles.length,
        recentlyOnboardedFleetUnits: vehicles.filter(
          (vehicle) => vehicle.createdAt >= thirtyDaysAgo,
        ).length,
      },
      byRole: funnelByRole,
      partnerApproval: {
        transportersApproved: partnerSnapshots.filter(
          (partner) =>
            partner.partnerType === 'TRANSPORTER' &&
            partner.verificationStatus === 'APPROVED',
        ).length,
        warehousesApproved: partnerSnapshots.filter(
          (partner) =>
            partner.partnerType === 'WAREHOUSE' &&
            partner.verificationStatus === 'APPROVED',
        ).length,
        transportersPending: partnerSnapshots.filter(
          (partner) =>
            partner.partnerType === 'TRANSPORTER' &&
            partner.verificationStatus === 'PENDING_REVIEW',
        ).length,
        warehousesPending: partnerSnapshots.filter(
          (partner) =>
            partner.partnerType === 'WAREHOUSE' &&
            partner.verificationStatus === 'PENDING_REVIEW',
        ).length,
      },
      referralPipeline: referrals.summary,
      fleetSupply: {
        totalVehicles: vehicles.length,
        activeVehicles: vehicles.filter((vehicle) => vehicle.status === VehicleStatus.ACTIVE)
          .length,
        inactiveVehicles: vehicles.filter((vehicle) => vehicle.status !== VehicleStatus.ACTIVE)
          .length,
      },
      notes: [
        'The onboarding funnel tracks registered, verified, and active supply-side accounts across drivers, transporters, and warehouse partners.',
        'Marketplace-partner approval stages are derived from schema-backed marketplace onboarding records, while fleet onboarding depth uses live vehicle creation totals from the current fleet module.',
      ],
    };
  }

  private resolveDateRange(query: AnalyticsQueryDto): ResolvedDateRange {
    const period = query.period ?? 'monthly';
    const now = new Date();

    if (!query.startDate && !query.endDate) {
      if (period === 'daily') {
        const endExclusive = this.startOfDay(new Date(now.getTime() + 24 * 60 * 60 * 1000));
        const start = this.startOfDay(
          new Date(endExclusive.getTime() - 30 * 24 * 60 * 60 * 1000),
        );
        return {
          period,
          start,
          endExclusive,
          label: 'Last 30 days',
        };
      }

      const endExclusive = this.firstDayOfNextMonth(now);
      const start = new Date(endExclusive);
      start.setMonth(start.getMonth() - 12);
      return {
        period,
        start,
        endExclusive,
        label: 'Last 12 months',
      };
    }

    const rawEnd = query.endDate ? this.parseDate(query.endDate, 'endDate') : now;
    const endExclusive = this.startOfDay(rawEnd);
    endExclusive.setDate(endExclusive.getDate() + 1);

    const fallbackStart = period === 'daily'
      ? new Date(endExclusive.getTime() - 30 * 24 * 60 * 60 * 1000)
      : (() => {
          const value = new Date(endExclusive);
          value.setMonth(value.getMonth() - 12);
          return value;
        })();

    const start = this.startOfDay(
      query.startDate ? this.parseDate(query.startDate, 'startDate') : fallbackStart,
    );

    if (start >= endExclusive) {
      throw new BadRequestException('startDate must be earlier than endDate');
    }

    return {
      period,
      start,
      endExclusive,
      label: `${start.toISOString().slice(0, 10)} to ${new Date(
        endExclusive.getTime() - 1,
      )
        .toISOString()
        .slice(0, 10)}`,
    };
  }

  private toDateFilter(range: ResolvedDateRange) {
    return {
      gte: range.start,
      lt: range.endExclusive,
    } satisfies Prisma.DateTimeFilter;
  }

  private startOfDay(value: Date) {
    const next = new Date(value);
    next.setHours(0, 0, 0, 0);
    return next;
  }

  private firstDayOfNextMonth(value: Date) {
    return new Date(value.getFullYear(), value.getMonth() + 1, 1);
  }

  private parseDate(value: string, fieldName: string) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`Invalid ${fieldName}`);
    }
    return parsed;
  }

  private formatBucketKey(value: Date, period: AnalyticsPeriod) {
    if (period === 'monthly') {
      return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}`;
    }
    return value.toISOString().slice(0, 10);
  }

  private formatBucketLabel(value: Date, period: AnalyticsPeriod) {
    return period === 'monthly'
      ? value.toLocaleDateString('en-KE', { month: 'short', year: 'numeric' })
      : value.toLocaleDateString('en-KE', { day: '2-digit', month: 'short' });
  }

  private mapInvoiceTypeToService(type: InvoiceType) {
    switch (type) {
      case InvoiceType.COURIER:
        return 'COURIER';
      case InvoiceType.WAREHOUSE:
        return 'WAREHOUSE';
      case InvoiceType.COMBINED:
        return 'COMBINED';
      case InvoiceType.TRANSPORT:
      default:
        return 'TRANSPORT';
    }
  }

  private accumulateBucket(
    target: Map<string, RevenueBucket>,
    key: string,
    label: string,
    values: { billedRevenue: number; collectedRevenue: number; outstandingRevenue: number },
  ) {
    const current = target.get(key) ?? {
      bucket: key,
      label,
      invoiceCount: 0,
      billedRevenue: 0,
      collectedRevenue: 0,
      outstandingRevenue: 0,
    };

    current.invoiceCount += 1;
    current.billedRevenue = this.round(current.billedRevenue + values.billedRevenue);
    current.collectedRevenue = this.round(current.collectedRevenue + values.collectedRevenue);
    current.outstandingRevenue = this.round(
      current.outstandingRevenue + values.outstandingRevenue,
    );

    target.set(key, current);
  }

  private sortBuckets(values: RevenueBucket[], period: AnalyticsPeriod) {
    return values.sort((left, right) => {
      if (period === 'monthly') {
        return left.bucket.localeCompare(right.bucket);
      }
      return left.bucket.localeCompare(right.bucket);
    });
  }

  private sortBreakdowns(values: RevenueBucket[]) {
    return values.sort((left, right) => {
      if (right.billedRevenue !== left.billedRevenue) {
        return right.billedRevenue - left.billedRevenue;
      }
      return left.label.localeCompare(right.label);
    });
  }

  private round(value: number) {
    return Number(value.toFixed(2));
  }

  private percent(part: number, whole: number) {
    if (whole <= 0) {
      return 0;
    }
    return this.round((part / whole) * 100);
  }

  private average(values: number[]) {
    if (values.length === 0) {
      return 0;
    }
    return this.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }

  private normalizePercent(value: number) {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return value <= 1 ? this.round(value * 100) : this.round(value);
  }

  private diffDays(start: Date, end: Date) {
    return this.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }

  private asMarketplacePartnerSnapshot(value: Prisma.JsonValue | null | undefined) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const record = value as Record<string, Prisma.JsonValue>;
    if (
      typeof record.partnerType !== 'string' ||
      typeof record.verificationStatus !== 'string'
    ) {
      return null;
    }

    return {
      partnerType: record.partnerType,
      verificationStatus: record.verificationStatus,
    } satisfies MarketplacePartnerSnapshot;
  }
}
