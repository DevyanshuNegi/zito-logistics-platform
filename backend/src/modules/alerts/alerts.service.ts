import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AccountStatus,
  BookingStatus,
  LossReportStatus,
  PaymentStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CapacityPlanningService } from '../capacity-planning/capacity-planning.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SlaService } from '../sla/sla.service';

type SupportedTriggerType =
  | 'ALL'
  | 'MISSING_PARCEL'
  | 'PAYMENT_FAILURE'
  | 'DELAY'
  | 'FRAUD_ALERT';

type AlertDashboardFilters = {
  status?: string;
  type?: string;
};

type AlertSubjectContext = {
  subjectLabel: string;
  agencyId?: string | null;
  warehouseManagerId?: string | null;
};

type RoutedRecipient = {
  userId: string;
  label: string;
  route: string;
};

const ACTIVE_TRIP_STATUSES: BookingStatus[] = [
  BookingStatus.ASSIGNED,
  BookingStatus.ACCEPTED,
  BookingStatus.ARRIVED,
  BookingStatus.PICKED,
  BookingStatus.IN_TRANSIT,
  BookingStatus.ARRIVED_AT_DESTINATION,
  BookingStatus.DELIVERY_VERIFICATION,
];

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly slaService: SlaService,
    private readonly capacityPlanningService: CapacityPlanningService,
  ) {}

  async getDashboard(filters: AlertDashboardFilters = {}) {
    const alerts = await this.prisma.internalAlert.findMany({
      where: {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.type ? { type: filters.type } : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
    });

    const contexts = await this.hydrateAlertContexts(alerts);
    const items = alerts.map((alert) => {
      const metadata = this.asObject(alert.metadata);
      const context = contexts.get(`${alert.entityType}:${alert.entityId}`);
      const routedRecipients = Array.isArray(metadata?.routedRecipients)
        ? metadata?.routedRecipients
        : [];

      return {
        ...alert,
        createdAt: alert.createdAt.toISOString(),
        subjectLabel: context?.subjectLabel ?? `${alert.entityType} ${alert.entityId}`,
        routeTargets: Array.isArray(metadata?.routeTargets) ? metadata.routeTargets : [],
        routedRecipients,
        routedAt: typeof metadata?.routedAt === 'string' ? metadata.routedAt : null,
        resolvedAt: typeof metadata?.resolvedAt === 'string' ? metadata.resolvedAt : null,
        resolutionNote: typeof metadata?.resolutionNote === 'string' ? metadata.resolutionNote : null,
      };
    });

    return {
      generatedAt: new Date().toISOString(),
      summary: {
        totalAlerts: items.length,
        pendingAlerts: items.filter((alert) => alert.status === 'PENDING').length,
        routedAlerts: items.filter((alert) => alert.status === 'ROUTED').length,
        resolvedAlerts: items.filter((alert) => alert.status === 'RESOLVED').length,
        criticalAlerts: items.filter((alert) => alert.severity === 'CRITICAL').length,
        highAlerts: items.filter((alert) => alert.severity === 'HIGH').length,
        unroutedAlerts: items.filter((alert) => !alert.routedAt && alert.status !== 'RESOLVED').length,
      },
      alerts: items,
      supportedTriggers: ['MISSING_PARCEL', 'PAYMENT_FAILURE', 'DELAY', 'FRAUD_ALERT'],
      notes: [
        'Dispatch and accounts routing uses Staff.role string matching because the current schema has no dedicated department enum.',
        'Warehouse manager routing uses Warehouse.managerId when available and falls back to admin or super-admin recipients otherwise.',
        'The dashboard also surfaces previously generated internal alerts such as SLA, stale-item, and route-deviation signals in the same queue.',
      ],
    };
  }

  async trigger(type?: string) {
    const normalized = (type?.trim().toUpperCase() || 'ALL') as SupportedTriggerType;
    switch (normalized) {
      case 'ALL': {
        const [missingParcel, paymentFailure, delay, fraud] = await Promise.all([
          this.triggerMissingParcelAlerts(),
          this.triggerPaymentFailureAlerts(),
          this.triggerDelayAlerts(),
          this.triggerFraudAlerts(),
        ]);

        return {
          trigger: 'ALL',
          results: {
            missingParcel,
            paymentFailure,
            delay,
            fraud,
          },
        };
      }
      case 'MISSING_PARCEL':
        return this.triggerMissingParcelAlerts();
      case 'PAYMENT_FAILURE':
        return this.triggerPaymentFailureAlerts();
      case 'DELAY':
        return this.triggerDelayAlerts();
      case 'FRAUD_ALERT':
        return this.triggerFraudAlerts();
      default:
        throw new BadRequestException(`Unsupported alert trigger type: ${type}`);
    }
  }

  async capacityAlert() {
    const snapshot = await this.capacityPlanningService.warehouse();
    const impacted = snapshot.warehouses.filter(
      (warehouse) => warehouse.occupancyPercentage >= 90,
    );

    const alerts = [];
    for (const warehouse of impacted) {
      const alert = await this.upsertAlert({
        type: 'LOW_WAREHOUSE_CAPACITY',
        severity: warehouse.isFull ? 'CRITICAL' : 'HIGH',
        message: `${warehouse.name} is at ${warehouse.occupancyPercentage}% occupancy with ${warehouse.availableBins} bin(s) available.`,
        entityType: 'WAREHOUSE',
        entityId: warehouse.id,
        agencyId: warehouse.agencyId,
        metadata: {
          warehouseName: warehouse.name,
          occupancyPercentage: warehouse.occupancyPercentage,
          availableBins: warehouse.availableBins,
          totalBins: warehouse.totalBins,
        },
      });
      alerts.push(await this.route(alert.id));
    }

    return {
      trigger: 'LOW_WAREHOUSE_CAPACITY',
      checked: snapshot.warehouses.length,
      raised: alerts.length,
      alerts,
    };
  }

  async driverOfflineAlert() {
    const offlineMinutes = Number(process.env.ALERT_DRIVER_OFFLINE_MINUTES ?? 10);
    const cutoff = new Date(Date.now() - offlineMinutes * 60 * 1000);

    const bookings = await this.prisma.booking.findMany({
      where: {
        status: { in: ACTIVE_TRIP_STATUSES },
        driverId: { not: null },
      },
      select: {
        id: true,
        reference: true,
        agencyId: true,
        status: true,
        driver: {
          select: {
            id: true,
            isOnline: true,
            lastLocationAt: true,
            user: {
              select: {
                fullName: true,
              },
            },
          },
        },
      },
    });

    const impacted = bookings.filter((booking) => {
      if (!booking.driver) {
        return false;
      }

      if (!booking.driver.isOnline) {
        return true;
      }

      return !booking.driver.lastLocationAt || booking.driver.lastLocationAt < cutoff;
    });

    const alerts = [];
    for (const booking of impacted) {
      const lastSeenAt = booking.driver?.lastLocationAt?.toISOString() ?? null;
      const alert = await this.upsertAlert({
        type: 'DRIVER_OFFLINE',
        severity: booking.driver?.isOnline === false ? 'CRITICAL' : 'HIGH',
        message: `Driver ${booking.driver?.user.fullName ?? booking.driver?.id ?? 'assigned to booking'} appears offline during active trip ${booking.reference}.`,
        entityType: 'BOOKING',
        entityId: booking.id,
        agencyId: booking.agencyId,
        metadata: {
          bookingReference: booking.reference,
          bookingStatus: booking.status,
          driverId: booking.driver?.id ?? null,
          driverLabel: booking.driver?.user.fullName ?? booking.driver?.id ?? null,
          lastSeenAt,
          offlineThresholdMinutes: offlineMinutes,
        },
      });
      alerts.push(await this.route(alert.id));
    }

    return {
      trigger: 'DRIVER_OFFLINE',
      checked: bookings.length,
      raised: alerts.length,
      alerts,
    };
  }

  async routePending() {
    const alerts = await this.prisma.internalAlert.findMany({
      where: {
        status: { not: 'RESOLVED' },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const pending = alerts.filter((alert) => !this.asObject(alert.metadata)?.routedAt);
    const results = [];
    for (const alert of pending) {
      results.push(await this.route(alert.id));
    }

    return {
      checked: alerts.length,
      routed: results.length,
      results,
    };
  }

  async route(alertId: string) {
    const alert = await this.prisma.internalAlert.findUnique({
      where: { id: alertId },
    });
    if (!alert) {
      throw new NotFoundException('Internal alert not found');
    }

    const context = await this.resolveAlertContext(alert);
    const recipients = await this.resolveRecipients(alert, context);
    const uniqueRecipients = this.dedupeRecipients(recipients);

    if (uniqueRecipients.length > 0) {
      await this.notificationsService.sendBulk(
        uniqueRecipients.map((recipient) => recipient.userId),
        {
          title: `Internal alert: ${this.formatStatus(alert.type)}`,
          message: alert.message,
          channels: ['PUSH', 'EMAIL', 'SMS'],
          entityType: alert.entityType,
          entityId: alert.entityId,
          priority:
            alert.severity === 'CRITICAL' || alert.severity === 'HIGH'
              ? 'HIGH'
              : 'NORMAL',
        },
      );
    }

    const currentMetadata = this.asObject(alert.metadata) ?? {};
    const routeTargets = [...new Set(uniqueRecipients.map((recipient) => recipient.route))];
    const routedRecipients = uniqueRecipients.map((recipient) => ({
      userId: recipient.userId,
      label: recipient.label,
      route: recipient.route,
    }));

    const updated = await this.prisma.internalAlert.update({
      where: { id: alert.id },
      data: {
        status: alert.status === 'PENDING' ? 'ROUTED' : alert.status,
        metadata: {
          ...currentMetadata,
          routedAt: new Date().toISOString(),
          routeTargets,
          routedRecipients,
        } as Prisma.InputJsonValue,
      },
    });

    return {
      alertId: updated.id,
      type: updated.type,
      status: updated.status,
      routedRecipients,
      routeTargets,
    };
  }

  async resolve(alertId: string, actorId: string, note?: string) {
    const alert = await this.prisma.internalAlert.findUnique({
      where: { id: alertId },
    });
    if (!alert) {
      throw new NotFoundException('Internal alert not found');
    }

    const currentMetadata = this.asObject(alert.metadata) ?? {};
    const updated = await this.prisma.internalAlert.update({
      where: { id: alert.id },
      data: {
        status: 'RESOLVED',
        metadata: {
          ...currentMetadata,
          resolvedAt: new Date().toISOString(),
          resolvedBy: actorId,
          resolutionNote: note ?? null,
        } as Prisma.InputJsonValue,
      },
    });

    return {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  private async triggerMissingParcelAlerts() {
    const unresolvedReports = await this.prisma.lossReport.findMany({
      where: {
        status: {
          in: [
            LossReportStatus.PENDING,
            LossReportStatus.INVESTIGATING,
            LossReportStatus.ESCALATED,
          ],
        },
      },
      include: {
        booking: {
          select: {
            id: true,
            reference: true,
            agencyId: true,
          },
        },
        item: {
          select: {
            id: true,
            parcelId: true,
            warehouseId: true,
          },
        },
      },
    });

    const alerts = [];
    for (const report of unresolvedReports) {
      const alert = await this.upsertAlert({
        type: 'MISSING_PARCEL',
        severity: report.isHighValue ? 'CRITICAL' : 'HIGH',
        message: `Loss report ${report.id} for booking ${report.booking.reference} is still unresolved.`,
        entityType: 'LOSS_REPORT',
        entityId: report.id,
        agencyId: report.booking.agencyId,
        metadata: {
          bookingId: report.bookingId,
          bookingReference: report.booking.reference,
          itemId: report.itemId ?? null,
          parcelId: report.item?.parcelId ?? null,
          estimatedValue: report.estimatedValue,
          reportStatus: report.status,
        },
      });
      alerts.push(await this.route(alert.id));
    }

    const itemsWithoutReports = await this.prisma.inventoryItem.findMany({
      where: {
        status: 'MISSING',
        lossReports: {
          none: {
            status: {
              in: [
                LossReportStatus.PENDING,
                LossReportStatus.INVESTIGATING,
                LossReportStatus.ESCALATED,
              ],
            },
          },
        },
      },
      select: {
        id: true,
        parcelId: true,
        bookingId: true,
        booking: {
          select: {
            reference: true,
            agencyId: true,
          },
        },
      },
    });

    for (const item of itemsWithoutReports) {
      const alert = await this.upsertAlert({
        type: 'MISSING_PARCEL',
        severity: 'HIGH',
        message: `Parcel ${item.parcelId} is marked missing without an open loss report.`,
        entityType: 'INVENTORY_ITEM',
        entityId: item.id,
        agencyId: item.booking.agencyId,
        metadata: {
          bookingId: item.bookingId,
          bookingReference: item.booking.reference,
          parcelId: item.parcelId,
        },
      });
      alerts.push(await this.route(alert.id));
    }

    return {
      trigger: 'MISSING_PARCEL',
      checked: unresolvedReports.length + itemsWithoutReports.length,
      raised: alerts.length,
      alerts,
    };
  }

  private async triggerPaymentFailureAlerts() {
    const failedPayments = await this.prisma.payment.findMany({
      where: {
        status: { in: [PaymentStatus.FAILED, PaymentStatus.REVERSED] },
      },
      include: {
        booking: {
          select: {
            id: true,
            reference: true,
            agencyId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const alerts = [];
    for (const payment of failedPayments) {
      const alert = await this.upsertAlert({
        type: 'PAYMENT_FAILURE',
        severity: payment.retryCount >= 3 ? 'CRITICAL' : 'HIGH',
        message: `Payment ${payment.reference} for booking ${payment.booking.reference} is in ${payment.status} state.`,
        entityType: 'PAYMENT',
        entityId: payment.id,
        agencyId: payment.booking.agencyId,
        metadata: {
          bookingId: payment.bookingId,
          bookingReference: payment.booking.reference,
          paymentReference: payment.reference,
          paymentStatus: payment.status,
          retryCount: payment.retryCount,
          failureReason: payment.failureReason ?? null,
        },
      });
      alerts.push(await this.route(alert.id));
    }

    return {
      trigger: 'PAYMENT_FAILURE',
      checked: failedPayments.length,
      raised: alerts.length,
      alerts,
    };
  }

  private async triggerDelayAlerts() {
    const dashboard = await this.slaService.getDashboard(100);
    const breached = dashboard.bookings.filter((booking: any) => booking.isBreached);
    const alerts = [];

    for (const booking of breached) {
      const alert = await this.upsertAlert({
        type: 'DELAY',
        severity:
          booking.escalationRecommendation === 'SUPER_ADMIN'
            ? 'CRITICAL'
            : booking.escalationRecommendation === 'MANAGER' ||
                booking.escalationRecommendation === 'LEVEL_2'
              ? 'HIGH'
              : 'MEDIUM',
        message: `Booking ${booking.reference} is delayed at ${this.formatStatus(booking.stage)} by ${booking.overdueMinutes} minute(s).`,
        entityType: 'BOOKING',
        entityId: booking.bookingId,
        agencyId: null,
        metadata: {
          bookingReference: booking.reference,
          stage: booking.stage,
          overdueMinutes: booking.overdueMinutes,
          thresholdMinutes: booking.thresholdMinutes,
          escalationRecommendation: booking.escalationRecommendation,
        },
      });
      alerts.push(await this.route(alert.id));
    }

    return {
      trigger: 'DELAY',
      checked: dashboard.bookings.length,
      raised: alerts.length,
      alerts,
    };
  }

  private async triggerFraudAlerts() {
    const flags = await this.prisma.fraudFlag.findMany({
      where: {
        status: { in: ['OPEN', 'CONFIRMED'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const alerts = [];
    for (const flag of flags) {
      const alert = await this.upsertAlert({
        type: 'FRAUD_ALERT',
        severity: flag.severity,
        message: flag.description,
        entityType: 'FRAUD_FLAG',
        entityId: flag.id,
        agencyId: null,
        metadata: {
          fraudFlagType: flag.type,
          fraudEntityType: flag.entityType,
          fraudEntityId: flag.entityId,
          fraudStatus: flag.status,
        },
      });
      alerts.push(await this.route(alert.id));
    }

    return {
      trigger: 'FRAUD_ALERT',
      checked: flags.length,
      raised: alerts.length,
      alerts,
    };
  }

  private async upsertAlert(input: {
    type: string;
    severity: string;
    message: string;
    entityType: string;
    entityId: string;
    agencyId?: string | null;
    metadata: Record<string, unknown>;
  }) {
    const existing = await this.prisma.internalAlert.findFirst({
      where: {
        type: input.type,
        entityType: input.entityType,
        entityId: input.entityId,
        status: { not: 'RESOLVED' },
      },
      orderBy: { createdAt: 'desc' },
    });

    const mergedMetadata = {
      ...input.metadata,
      detectedAt: new Date().toISOString(),
      detector: 'alerts-service',
    } as Prisma.InputJsonValue;

    if (existing) {
      return this.prisma.internalAlert.update({
        where: { id: existing.id },
        data: {
          severity: input.severity,
          message: input.message,
          agencyId: input.agencyId ?? existing.agencyId,
          metadata: {
            ...(this.asObject(existing.metadata) ?? {}),
            ...(input.metadata as Record<string, unknown>),
            detectedAt: new Date().toISOString(),
            detector: 'alerts-service',
          } as Prisma.InputJsonValue,
        },
      });
    }

    return this.prisma.internalAlert.create({
      data: {
        type: input.type,
        severity: input.severity,
        message: input.message,
        status: 'PENDING',
        agencyId: input.agencyId ?? null,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: mergedMetadata,
      },
    });
  }

  private async hydrateAlertContexts(
    alerts: Array<{ entityType: string; entityId: string }>,
  ) {
    const bookingIds = [...new Set(alerts.filter((alert) => alert.entityType === 'BOOKING').map((alert) => alert.entityId))];
    const paymentIds = [...new Set(alerts.filter((alert) => alert.entityType === 'PAYMENT').map((alert) => alert.entityId))];
    const warehouseIds = [...new Set(alerts.filter((alert) => alert.entityType === 'WAREHOUSE').map((alert) => alert.entityId))];
    const itemIds = [...new Set(alerts.filter((alert) => alert.entityType === 'INVENTORY_ITEM').map((alert) => alert.entityId))];
    const lossReportIds = [...new Set(alerts.filter((alert) => alert.entityType === 'LOSS_REPORT').map((alert) => alert.entityId))];
    const fraudFlagIds = [...new Set(alerts.filter((alert) => alert.entityType === 'FRAUD_FLAG').map((alert) => alert.entityId))];

    const [bookings, payments, warehouses, items, lossReports, fraudFlags] = await Promise.all([
      bookingIds.length > 0
        ? this.prisma.booking.findMany({
            where: { id: { in: bookingIds } },
            select: { id: true, reference: true, agencyId: true },
          })
        : Promise.resolve([]),
      paymentIds.length > 0
        ? this.prisma.payment.findMany({
            where: { id: { in: paymentIds } },
            select: {
              id: true,
              reference: true,
              booking: { select: { agencyId: true, reference: true } },
            },
          })
        : Promise.resolve([]),
      warehouseIds.length > 0
        ? this.prisma.warehouse.findMany({
            where: { id: { in: warehouseIds } },
            select: { id: true, name: true, agencyId: true, managerId: true },
          })
        : Promise.resolve([]),
      itemIds.length > 0
        ? this.prisma.inventoryItem.findMany({
            where: { id: { in: itemIds } },
            select: {
              id: true,
              parcelId: true,
              booking: { select: { agencyId: true, reference: true } },
              warehouse: { select: { managerId: true } },
            },
          })
        : Promise.resolve([]),
      lossReportIds.length > 0
        ? this.prisma.lossReport.findMany({
            where: { id: { in: lossReportIds } },
            select: {
              id: true,
              booking: { select: { agencyId: true, reference: true } },
              item: {
                select: {
                  parcelId: true,
                  warehouse: { select: { managerId: true } },
                },
              },
            },
          })
        : Promise.resolve([]),
      fraudFlagIds.length > 0
        ? this.prisma.fraudFlag.findMany({
            where: { id: { in: fraudFlagIds } },
            select: { id: true, type: true, entityType: true, entityId: true },
          })
        : Promise.resolve([]),
    ]);

    const map = new Map<string, AlertSubjectContext>();
    for (const booking of bookings) {
      map.set(`BOOKING:${booking.id}`, {
        subjectLabel: `Booking ${booking.reference}`,
        agencyId: booking.agencyId,
      });
    }
    for (const payment of payments) {
      map.set(`PAYMENT:${payment.id}`, {
        subjectLabel: `Payment ${payment.reference}`,
        agencyId: payment.booking.agencyId,
      });
    }
    for (const warehouse of warehouses) {
      map.set(`WAREHOUSE:${warehouse.id}`, {
        subjectLabel: warehouse.name,
        agencyId: warehouse.agencyId,
        warehouseManagerId: warehouse.managerId,
      });
    }
    for (const item of items) {
      map.set(`INVENTORY_ITEM:${item.id}`, {
        subjectLabel: `Parcel ${item.parcelId}`,
        agencyId: item.booking.agencyId,
        warehouseManagerId: item.warehouse?.managerId ?? null,
      });
    }
    for (const report of lossReports) {
      map.set(`LOSS_REPORT:${report.id}`, {
        subjectLabel: report.item?.parcelId
          ? `Loss report for ${report.item.parcelId}`
          : `Loss report for booking ${report.booking.reference}`,
        agencyId: report.booking.agencyId,
        warehouseManagerId: report.item?.warehouse?.managerId ?? null,
      });
    }
    for (const flag of fraudFlags) {
      map.set(`FRAUD_FLAG:${flag.id}`, {
        subjectLabel: `Fraud flag ${flag.type}`,
      });
    }

    return map;
  }

  private async resolveAlertContext(alert: {
    id: string;
    type: string;
    entityType: string;
    entityId: string;
    agencyId: string | null;
    metadata: Prisma.JsonValue | null;
  }) {
    const contexts = await this.hydrateAlertContexts([
      { entityType: alert.entityType, entityId: alert.entityId },
    ]);
    const hydrated = contexts.get(`${alert.entityType}:${alert.entityId}`);
    const metadata = this.asObject(alert.metadata);

    return {
      subjectLabel: hydrated?.subjectLabel ?? `${alert.entityType} ${alert.entityId}`,
      agencyId: alert.agencyId ?? hydrated?.agencyId ?? (typeof metadata?.agencyId === 'string' ? metadata.agencyId : null),
      warehouseManagerId:
        hydrated?.warehouseManagerId ??
        (typeof metadata?.warehouseManagerId === 'string' ? metadata.warehouseManagerId : null),
    };
  }

  private async resolveRecipients(
    alert: {
      type: string;
      entityType: string;
      entityId: string;
      agencyId: string | null;
      severity: string;
      metadata: Prisma.JsonValue | null;
    },
    context: AlertSubjectContext,
  ): Promise<RoutedRecipient[]> {
    const agencyId = context.agencyId ?? alert.agencyId ?? null;
    const superAdmins = await this.resolveUsersBySystemRoles([UserRole.SUPER_ADMIN], 'Super Admin');
    const admins = await this.resolveUsersBySystemRoles([UserRole.ADMIN], 'Admin');

    if (
      ['MISSING_PARCEL', 'LOW_WAREHOUSE_CAPACITY', 'STALE_ITEM'].includes(alert.type) ||
      ['WAREHOUSE', 'INVENTORY_ITEM', 'LOSS_REPORT'].includes(alert.entityType)
    ) {
      return [
        ...(await this.resolveWarehouseManagerRecipients(context.warehouseManagerId)),
        ...(await this.resolveAgencyStaffByPatterns(
          agencyId,
          [/dispatch/i, /operations/i, /ops/i],
          'Dispatch',
        )),
        ...superAdmins,
      ];
    }

    if (['PAYMENT_FAILURE'].includes(alert.type) || alert.entityType === 'PAYMENT') {
      return [
        ...(await this.resolveAgencyStaffByPatterns(
          agencyId,
          [/account/i, /finance/i, /billing/i],
          'Accounts',
        )),
        ...superAdmins,
      ];
    }

    if (
      ['DELAY', 'DRIVER_OFFLINE', 'ROUTE_DEVIATION', 'SLA_BREACH', 'SLA_NO_SHOW'].includes(
        alert.type,
      )
    ) {
      return [
        ...(await this.resolveAgencyStaffByPatterns(
          agencyId,
          [/dispatch/i, /operations/i, /ops/i],
          'Dispatch',
        )),
        ...superAdmins,
      ];
    }

    if (['FRAUD_ALERT'].includes(alert.type) || alert.entityType === 'FRAUD_FLAG') {
      return [...admins, ...superAdmins];
    }

    return [...admins, ...superAdmins];
  }

  private async resolveWarehouseManagerRecipients(managerId?: string | null) {
    if (!managerId) {
      return [];
    }

    const user = await this.prisma.user.findUnique({
      where: { id: managerId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        status: true,
      },
    });

    if (!user || user.status !== AccountStatus.ACTIVE) {
      return [];
    }

    return [
      {
        userId: user.id,
        label: user.fullName ?? user.email ?? user.phone ?? user.id,
        route: 'Warehouse Manager',
      },
    ];
  }

  private async resolveUsersBySystemRoles(roles: UserRole[], route: string) {
    const users = await this.prisma.user.findMany({
      where: {
        role: { in: roles },
        status: AccountStatus.ACTIVE,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
      },
      take: 20,
    });

    return users.map((user) => ({
      userId: user.id,
      label: user.fullName ?? user.email ?? user.phone ?? user.id,
      route,
    }));
  }

  private async resolveAgencyStaffByPatterns(
    agencyId: string | null,
    patterns: RegExp[],
    route: string,
  ) {
    const staff = await this.prisma.staff.findMany({
      where: {
        ...(agencyId ? { agencyId } : {}),
        isActive: true,
      },
      select: {
        userId: true,
        role: true,
      },
    });

    const matchedUserIds = staff
      .filter((member) => patterns.some((pattern) => pattern.test(member.role)))
      .map((member) => member.userId);

    if (matchedUserIds.length === 0) {
      return this.resolveUsersBySystemRoles(
        [UserRole.ADMIN, UserRole.SUPER_ADMIN],
        route,
      );
    }

    const users = await this.prisma.user.findMany({
      where: {
        id: { in: matchedUserIds },
        status: AccountStatus.ACTIVE,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
      },
    });

    return users.map((user) => ({
      userId: user.id,
      label: user.fullName ?? user.email ?? user.phone ?? user.id,
      route,
    }));
  }

  private dedupeRecipients(recipients: RoutedRecipient[]) {
    const map = new Map<string, RoutedRecipient>();
    for (const recipient of recipients) {
      if (!map.has(recipient.userId)) {
        map.set(recipient.userId, recipient);
      }
    }
    return [...map.values()];
  }

  private asObject(value: Prisma.JsonValue | null) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, any>;
  }

  private formatStatus(value?: string | null) {
    if (!value) {
      return 'Unknown';
    }
    return value
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
}
