import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  Prisma,
  PrismaClient,
  ServiceType,
  UserRole,
  VehicleStatus,
} from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

type DbClient = PrismaService | PrismaClient | Prisma.TransactionClient;
type SlaStage =
  | 'ASSIGNMENT'
  | 'DRIVER_ACCEPTANCE'
  | 'PICKUP_ARRIVAL'
  | 'DELIVERY_COMPLETION';
type EscalationLevel = 'LEVEL_1' | 'LEVEL_2' | 'MANAGER' | 'SUPER_ADMIN';

type ServiceTypeSlaConfig = {
  assignmentMinutes: number;
  acceptanceMinutes: number;
  pickupMinutes: number;
  deliveryMinutes: number;
  noShowGraceMinutes: number;
};

const ACTIVE_SLA_STATUSES: BookingStatus[] = [
  BookingStatus.CREATED,
  BookingStatus.SEARCHING,
  BookingStatus.APPROVED,
  BookingStatus.ASSIGNED,
  BookingStatus.ACCEPTED,
  BookingStatus.ARRIVED,
  BookingStatus.PICKED,
  BookingStatus.IN_TRANSIT,
  BookingStatus.ARRIVED_AT_DESTINATION,
  BookingStatus.DELIVERY_VERIFICATION,
];

@Injectable()
export class SlaService {
  private readonly config: Record<ServiceType, ServiceTypeSlaConfig> = {
    [ServiceType.COURIER]: {
      assignmentMinutes: Number(process.env.SLA_COURIER_ASSIGNMENT_MINUTES ?? 15),
      acceptanceMinutes: Number(process.env.SLA_COURIER_ACCEPTANCE_MINUTES ?? 8),
      pickupMinutes: Number(process.env.SLA_COURIER_PICKUP_MINUTES ?? 30),
      deliveryMinutes: Number(process.env.SLA_COURIER_DELIVERY_MINUTES ?? 180),
      noShowGraceMinutes: Number(process.env.SLA_COURIER_NO_SHOW_GRACE_MINUTES ?? 15),
    },
    [ServiceType.PTL]: {
      assignmentMinutes: Number(process.env.SLA_PTL_ASSIGNMENT_MINUTES ?? 30),
      acceptanceMinutes: Number(process.env.SLA_PTL_ACCEPTANCE_MINUTES ?? 12),
      pickupMinutes: Number(process.env.SLA_PTL_PICKUP_MINUTES ?? 60),
      deliveryMinutes: Number(process.env.SLA_PTL_DELIVERY_MINUTES ?? 480),
      noShowGraceMinutes: Number(process.env.SLA_PTL_NO_SHOW_GRACE_MINUTES ?? 20),
    },
    [ServiceType.FTL]: {
      assignmentMinutes: Number(process.env.SLA_FTL_ASSIGNMENT_MINUTES ?? 45),
      acceptanceMinutes: Number(process.env.SLA_FTL_ACCEPTANCE_MINUTES ?? 15),
      pickupMinutes: Number(process.env.SLA_FTL_PICKUP_MINUTES ?? 90),
      deliveryMinutes: Number(process.env.SLA_FTL_DELIVERY_MINUTES ?? 720),
      noShowGraceMinutes: Number(process.env.SLA_FTL_NO_SHOW_GRACE_MINUTES ?? 30),
    },
    [ServiceType.WAREHOUSE]: {
      assignmentMinutes: Number(process.env.SLA_WAREHOUSE_ASSIGNMENT_MINUTES ?? 120),
      acceptanceMinutes: Number(process.env.SLA_WAREHOUSE_ACCEPTANCE_MINUTES ?? 30),
      pickupMinutes: Number(process.env.SLA_WAREHOUSE_PICKUP_MINUTES ?? 240),
      deliveryMinutes: Number(process.env.SLA_WAREHOUSE_DELIVERY_MINUTES ?? 1440),
      noShowGraceMinutes: Number(process.env.SLA_WAREHOUSE_NO_SHOW_GRACE_MINUTES ?? 60),
    },
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  getConfig(serviceType?: ServiceType) {
    if (serviceType) {
      return {
        serviceType,
        ...this.config[serviceType],
      };
    }

    return Object.entries(this.config).map(([key, value]) => ({
      serviceType: key as ServiceType,
      ...value,
    }));
  }

  async getDashboard(limit = 25) {
    const bookings = await this.prisma.booking.findMany({
      where: {
        status: { in: ACTIVE_SLA_STATUSES },
      },
      orderBy: { updatedAt: 'asc' },
      take: Math.min(Math.max(limit, 1), 100),
      include: this.bookingInclude,
    });

    const snapshots = await Promise.all(
      bookings.map((booking) => this.buildSlaSnapshot(booking)),
    );
    const breached = snapshots.filter((item) => item.isBreached);

    const activeAlerts = await this.prisma.internalAlert.findMany({
      where: {
        entityType: 'BOOKING',
        type: { startsWith: 'SLA_' },
        status: { not: 'RESOLVED' },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return {
      config: this.getConfig(),
      activeBookings: snapshots.length,
      breachedBookings: breached.length,
      activeAlerts: {
        total: activeAlerts.length,
        byStatus: activeAlerts.reduce<Record<string, number>>((acc, alert) => {
          acc[alert.status] = (acc[alert.status] ?? 0) + 1;
          return acc;
        }, {}),
      },
      bookings: snapshots,
    };
  }

  async getBookingSla(bookingId: string) {
    const booking = await this.getBookingOrThrow(bookingId);
    return this.buildSlaSnapshot(booking);
  }

  async startTimer(bookingId: string, stage?: SlaStage) {
    const booking = await this.getBookingOrThrow(bookingId);
    const resolvedStage = stage ?? this.resolveStage(booking.status);

    if (!resolvedStage) {
      return {
        bookingId: booking.id,
        serviceType: booking.serviceType,
        active: false,
        status: booking.status,
        reason: `No active SLA timer for booking status ${booking.status}`,
      };
    }

    const serviceConfig = this.config[booking.serviceType];
    const startedAt = await this.resolveTimerStart(booking, resolvedStage);
    const thresholdMinutes = this.getThresholdForStage(serviceConfig, resolvedStage);
    const deadline = new Date(startedAt.getTime() + thresholdMinutes * 60 * 1000);

    return {
      bookingId: booking.id,
      serviceType: booking.serviceType,
      status: booking.status,
      stage: resolvedStage,
      thresholdMinutes,
      startedAt,
      deadline,
      active: true,
    };
  }

  async detectBreach(
    bookingId: string,
    options: { autoHandleNoShow?: boolean; actorId?: string } = {},
  ) {
    const booking = await this.getBookingOrThrow(bookingId);
    const snapshot = await this.buildSlaSnapshot(booking);

    if (!snapshot.active || !snapshot.stage) {
      await this.resolveAlerts(booking.id, 'SLA state inactive');
      return snapshot;
    }

    if (!snapshot.isBreached) {
      await this.resolveAlerts(booking.id, 'SLA recovered');
      return snapshot;
    }

    const escalationLevel = this.resolveEscalationLevel(
      snapshot.thresholdMinutes,
      snapshot.overdueMinutes,
    );
    const alert = await this.upsertAlert({
      booking,
      type: 'SLA_BREACH',
      status: escalationLevel,
      severity: this.mapSeverity(escalationLevel),
      message: `${snapshot.stage.replace(/_/g, ' ')} SLA breached for booking ${booking.reference}`,
      metadata: {
        stage: snapshot.stage,
        thresholdMinutes: snapshot.thresholdMinutes,
        overdueMinutes: snapshot.overdueMinutes,
        escalationLevel,
        deadline: snapshot.deadline?.toISOString() ?? null,
        serviceType: booking.serviceType,
        bookingStatus: booking.status,
      },
    });

    await this.sendEscalationNotifications(booking, escalationLevel, snapshot);

    let action: Record<string, any> | null = null;
    if (
      options.autoHandleNoShow &&
      this.isNoShowStage(snapshot.stage) &&
      snapshot.overdueMinutes >= this.config[booking.serviceType].noShowGraceMinutes
    ) {
      action = await this.handleNoShow(booking.id, options.actorId);
    }

    return {
      ...snapshot,
      alert,
      escalationLevel,
      action,
    };
  }

  async scanActiveBreaches(
    options: { autoHandleNoShow?: boolean; actorId?: string; limit?: number } = {},
  ) {
    const bookings = await this.prisma.booking.findMany({
      where: {
        status: { in: ACTIVE_SLA_STATUSES },
      },
      orderBy: { updatedAt: 'asc' },
      take: Math.min(Math.max(options.limit ?? 50, 1), 200),
      include: this.bookingInclude,
    });

    const results = [];
    for (const booking of bookings) {
      const result = await this.detectBreach(booking.id, {
        autoHandleNoShow: options.autoHandleNoShow,
        actorId: options.actorId,
      });
      results.push(result);
    }

    return {
      totalChecked: results.length,
      breached: results.filter((result) => result.isBreached).length,
      handledNoShows: results.filter((result) => result.action?.action === 'NO_SHOW_HANDLED').length,
      results,
    };
  }

  async handleNoShow(bookingId: string, actorId?: string) {
    const booking = await this.getBookingOrThrow(bookingId);
    const activeStage = this.resolveStage(booking.status);

    if (!activeStage || !this.isNoShowStage(activeStage)) {
      throw new BadRequestException('Booking is not in a no-show eligible SLA stage');
    }

    if (!booking.driverId) {
      throw new BadRequestException('Booking has no assigned driver to replace');
    }

    const replacement = await this.findReplacementDriver(booking);
    const nextStatus = BookingStatus.ASSIGNED;
    const deliveryOtp = crypto.randomInt(1000, 9999).toString();

    const updatedBooking = await this.prisma.$transaction(async (tx) => {
      await tx.driver.update({
        where: { id: booking.driverId! },
        data: { isAvailable: true },
      });

      let updated;
      if (replacement) {
        updated = await tx.booking.update({
          where: { id: booking.id },
          data: {
            driverId: replacement.id,
            vehicleId: replacement.vehicle?.id ?? null,
            status: nextStatus,
            deliveryOtp,
          },
          include: this.bookingInclude,
        });

        await tx.driver.update({
          where: { id: replacement.id },
          data: { isAvailable: false },
        });
      } else {
        updated = await tx.booking.update({
          where: { id: booking.id },
          data: {
            driverId: null,
            vehicleId: null,
            status: BookingStatus.SEARCHING,
          },
          include: this.bookingInclude,
        });
      }

      return updated;
    });

    await this.resolveAlerts(booking.id, 'No-show handled');

    await this.upsertAlert({
      booking: updatedBooking,
      type: 'SLA_NO_SHOW',
      status: replacement ? 'REASSIGNED' : 'REQUEUE_REQUIRED',
      severity: replacement ? 'HIGH' : 'CRITICAL',
      message: replacement
        ? `Driver no-show handled by reassigning booking ${booking.reference}`
        : `Driver no-show returned booking ${booking.reference} to dispatch queue`,
      metadata: {
        previousDriverId: booking.driverId,
        replacementDriverId: replacement?.id ?? null,
        previousStatus: booking.status,
        currentStatus: updatedBooking.status,
      },
    });

    if (actorId) {
      await this.writeAudit(actorId, 'SLA_NO_SHOW_HANDLED', 'BOOKING', booking.id, {
        previousDriverId: booking.driverId,
        replacementDriverId: replacement?.id ?? null,
        previousStatus: booking.status,
        nextStatus: updatedBooking.status,
      });
    }

    if (replacement?.user?.id) {
      await this.notificationsService.notifyDriverAssigned(
        updatedBooking.customerId,
        replacement.user.id,
        updatedBooking.reference,
        updatedBooking.id,
      );
    }

    return {
      action: 'NO_SHOW_HANDLED',
      mode: replacement ? 'REASSIGNED' : 'REQUEUED',
      booking: updatedBooking,
      replacementDriverId: replacement?.id ?? null,
    };
  }

  private readonly bookingInclude = {
    driver: {
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            agencyId: true,
          },
        },
      },
    },
    vehicle: {
      select: {
        id: true,
        type: true,
        status: true,
        plateNumber: true,
      },
    },
    stops: {
      orderBy: { sequence: 'asc' as const },
    },
  };

  private async buildSlaSnapshot(booking: any) {
    const timer = await this.startTimer(booking.id);
    if (!timer.active) {
      return {
        ...timer,
        isBreached: false,
        overdueMinutes: 0,
        activeAlert: await this.findActiveAlert(booking.id),
      };
    }

    const overdueMinutes = Math.max(
      0,
      Math.floor((Date.now() - timer.deadline.getTime()) / (60 * 1000)),
    );

    return {
      bookingId: booking.id,
      reference: booking.reference,
      serviceType: booking.serviceType,
      status: booking.status,
      customerId: booking.customerId,
      driverId: booking.driverId ?? null,
      stage: timer.stage,
      thresholdMinutes: timer.thresholdMinutes,
      startedAt: timer.startedAt,
      deadline: timer.deadline,
      active: true,
      isBreached: overdueMinutes > 0,
      overdueMinutes,
      escalationRecommendation:
        overdueMinutes > 0
          ? this.resolveEscalationLevel(timer.thresholdMinutes, overdueMinutes)
          : null,
      activeAlert: await this.findActiveAlert(booking.id),
    };
  }

  private resolveStage(status: BookingStatus): SlaStage | null {
    if (
      status === BookingStatus.CREATED ||
      status === BookingStatus.SEARCHING ||
      status === BookingStatus.APPROVED
    ) {
      return 'ASSIGNMENT';
    }
    if (status === BookingStatus.ASSIGNED) {
      return 'DRIVER_ACCEPTANCE';
    }
    if (status === BookingStatus.ACCEPTED) {
      return 'PICKUP_ARRIVAL';
    }
    if (
      status === BookingStatus.PICKED ||
      status === BookingStatus.IN_TRANSIT ||
      status === BookingStatus.ARRIVED_AT_DESTINATION ||
      status === BookingStatus.DELIVERY_VERIFICATION
    ) {
      return 'DELIVERY_COMPLETION';
    }
    return null;
  }

  private getThresholdForStage(
    config: ServiceTypeSlaConfig,
    stage: SlaStage,
  ) {
    switch (stage) {
      case 'ASSIGNMENT':
        return config.assignmentMinutes;
      case 'DRIVER_ACCEPTANCE':
        return config.acceptanceMinutes;
      case 'PICKUP_ARRIVAL':
        return config.pickupMinutes;
      case 'DELIVERY_COMPLETION':
        return config.deliveryMinutes;
      default:
        return config.deliveryMinutes;
    }
  }

  private async resolveTimerStart(booking: any, stage: SlaStage) {
    const auditLogs = await this.prisma.auditLog.findMany({
      where: {
        entityType: 'BOOKING',
        entityId: booking.id,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const findStatusTransitionAt = (...statuses: string[]) => {
      const hit = auditLogs.find((log) => {
        const details = this.asObject(log.details);
        return statuses.includes(String(details?.to ?? ''));
      });
      return hit?.createdAt ?? null;
    };

    if (stage === 'ASSIGNMENT') {
      if (booking.status === BookingStatus.CREATED) {
        return booking.createdAt;
      }
      return booking.updatedAt;
    }

    if (stage === 'DRIVER_ACCEPTANCE') {
      return findStatusTransitionAt(BookingStatus.ASSIGNED) ?? booking.updatedAt;
    }

    if (stage === 'PICKUP_ARRIVAL') {
      return findStatusTransitionAt(BookingStatus.ACCEPTED) ?? booking.updatedAt;
    }

    return (
      findStatusTransitionAt(
        BookingStatus.PICKED,
        BookingStatus.IN_TRANSIT,
        BookingStatus.ARRIVED_AT_DESTINATION,
        BookingStatus.DELIVERY_VERIFICATION,
      ) ?? booking.updatedAt
    );
  }

  private resolveEscalationLevel(
    thresholdMinutes: number,
    overdueMinutes: number,
  ): EscalationLevel {
    if (overdueMinutes >= Math.max(120, thresholdMinutes * 2)) {
      return 'SUPER_ADMIN';
    }
    if (overdueMinutes >= Math.max(60, thresholdMinutes)) {
      return 'MANAGER';
    }
    if (overdueMinutes >= Math.max(30, Math.floor(thresholdMinutes / 2))) {
      return 'LEVEL_2';
    }
    return 'LEVEL_1';
  }

  private mapSeverity(level: EscalationLevel) {
    switch (level) {
      case 'SUPER_ADMIN':
        return 'CRITICAL';
      case 'MANAGER':
      case 'LEVEL_2':
        return 'HIGH';
      default:
        return 'MEDIUM';
    }
  }

  private isNoShowStage(stage: SlaStage) {
    return stage === 'DRIVER_ACCEPTANCE' || stage === 'PICKUP_ARRIVAL';
  }

  private async sendEscalationNotifications(
    booking: any,
    level: EscalationLevel,
    snapshot: any,
  ) {
    const recipientIds = await this.resolveRecipientIds(booking, level);
    if (recipientIds.length === 0) {
      return;
    }

    await this.notificationsService.sendBulk(recipientIds, {
      title: `SLA escalation: ${level.replace(/_/g, ' ')}`,
      message: `Booking ${booking.reference} breached ${snapshot.stage.replace(/_/g, ' ').toLowerCase()} SLA by ${snapshot.overdueMinutes} minute(s).`,
      channels: ['PUSH', 'EMAIL', 'SMS'],
      entityType: 'BOOKING',
      entityId: booking.id,
      priority: level === 'SUPER_ADMIN' ? 'HIGH' : 'NORMAL',
    });
  }

  private async resolveRecipientIds(booking: any, level: EscalationLevel) {
    if (level === 'LEVEL_1') {
      return booking.driver?.user?.id ? [booking.driver.user.id] : [];
    }

    const roleFilter =
      level === 'SUPER_ADMIN'
        ? [UserRole.SUPER_ADMIN]
        : [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.AGENCY_STAFF];

    const users = await this.prisma.user.findMany({
      where: {
        role: { in: roleFilter },
        ...(level === 'LEVEL_2' && booking.agencyId
          ? {
              OR: [
                { role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] } },
                { role: UserRole.AGENCY_STAFF, agencyId: booking.agencyId },
              ],
            }
          : {}),
      },
      select: { id: true },
      take: 20,
    });

    return users.map((user) => user.id);
  }

  private async findReplacementDriver(booking: any) {
    const pickup = booking.stops[0];
    const requiredVehicleType = booking.requiredVehicleType ?? booking.vehicle?.type ?? undefined;

    const candidates = await this.prisma.driver.findMany({
      where: {
        id: { not: booking.driverId ?? undefined },
        isOnline: true,
        isAvailable: true,
        isBlacklisted: false,
        licenseVerified: true,
        vehicle: {
          is: {
            status: VehicleStatus.ACTIVE,
            ...(requiredVehicleType ? { type: requiredVehicleType } : {}),
          },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            agencyId: true,
          },
        },
        vehicle: {
          select: {
            id: true,
            type: true,
            plateNumber: true,
            status: true,
          },
        },
      },
      take: 25,
    });

    const scopedCandidates = booking.agencyId
      ? candidates.filter(
          (candidate) =>
            !candidate.user?.agencyId || candidate.user.agencyId === booking.agencyId,
        )
      : candidates;

    return scopedCandidates
      .map((candidate) => ({
        ...candidate,
        distanceKm:
          pickup?.latitude != null &&
          pickup?.longitude != null &&
          candidate.currentLatitude != null &&
          candidate.currentLongitude != null
            ? this.haversineKm(
                pickup.latitude,
                pickup.longitude,
                candidate.currentLatitude,
                candidate.currentLongitude,
              )
            : Number.MAX_SAFE_INTEGER,
      }))
      .sort((left, right) => left.distanceKm - right.distanceKm)[0];
  }

  private async upsertAlert(params: {
    booking: any;
    type: string;
    status: string;
    severity: string;
    message: string;
    metadata: Record<string, any>;
  }) {
    const existing = await this.prisma.internalAlert.findFirst({
      where: {
        type: params.type,
        entityType: 'BOOKING',
        entityId: params.booking.id,
        status: { not: 'RESOLVED' },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      return this.prisma.internalAlert.update({
        where: { id: existing.id },
        data: {
          status: params.status,
          severity: params.severity,
          message: params.message,
          metadata: params.metadata,
        },
      });
    }

    return this.prisma.internalAlert.create({
      data: {
        type: params.type,
        severity: params.severity,
        message: params.message,
        status: params.status,
        entityType: 'BOOKING',
        entityId: params.booking.id,
        agencyId: params.booking.agencyId ?? null,
        metadata: params.metadata,
      },
    });
  }

  private async findActiveAlert(bookingId: string) {
    return this.prisma.internalAlert.findFirst({
      where: {
        entityType: 'BOOKING',
        entityId: bookingId,
        type: { startsWith: 'SLA_' },
        status: { not: 'RESOLVED' },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async resolveAlerts(bookingId: string, reason: string) {
    const alerts = await this.prisma.internalAlert.findMany({
      where: {
        entityType: 'BOOKING',
        entityId: bookingId,
        type: { startsWith: 'SLA_' },
        status: { not: 'RESOLVED' },
      },
    });

    for (const alert of alerts) {
      const currentMetadata = this.asObject(alert.metadata);
      await this.prisma.internalAlert.update({
        where: { id: alert.id },
        data: {
          status: 'RESOLVED',
          metadata: {
            ...(currentMetadata ?? {}),
            resolvedAt: new Date().toISOString(),
            resolutionReason: reason,
          },
        },
      });
    }
  }

  private async getBookingOrThrow(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: this.bookingInclude,
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return booking;
  }

  private async writeAudit(
    userId: string,
    action: string,
    entityType: string,
    entityId: string,
    details?: Record<string, any>,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return null;
    }

    return this.prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        details: details ?? {},
      },
    });
  }

  private asObject(value: Prisma.JsonValue | null) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, any>;
  }

  private haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private toRad(value: number) {
    return (value * Math.PI) / 180;
  }
}
