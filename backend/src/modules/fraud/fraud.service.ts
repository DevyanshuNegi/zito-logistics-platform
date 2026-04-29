import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountStatus, BookingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReviewFraudFlagDto } from './dto/review-fraud-flag.dto';

type FraudSummary = {
  totalFlags: number;
  openFlags: number;
  confirmedFlags: number;
  suspendedFlags: number;
  criticalFlags: number;
  gpsSpoofCount: number;
  ghostTripCount: number;
  duplicateBookingCount: number;
  routeAnomalyCount: number;
};

@Injectable()
export class FraudService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(status?: string) {
    const flags = await this.prisma.fraudFlag.findMany({
      where: status ? { status } : undefined,
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
    });

    const hydratedFlags = await this.hydrateFlags(flags);

    return {
      generatedAt: new Date().toISOString(),
      summary: this.buildSummary(flags),
      flags: hydratedFlags,
      notes: [
        'GPS spoof detection compares the driver-app location against the assigned vehicle-device GPS when both signals are fresh.',
        'Duplicate booking detection uses idempotency-aware fingerprint clustering because the current booking schema enforces unique idempotency keys rather than storing raw duplicate attempts directly.',
        'Route anomaly detection uses a straight-line corridor across ordered booking stops until the dedicated route-optimization layer arrives in Phase 4.3.',
      ],
    };
  }

  async runAll() {
    const [gpsSpoof, ghostTrips, duplicates, routeAnomalies] = await Promise.all([
      this.detectGpsSpoof(),
      this.detectGhostTrip(),
      this.detectDuplicate(),
      this.detectRouteAnomaly(),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      detectors: {
        gpsSpoof,
        ghostTrips,
        duplicates,
        routeAnomalies,
      },
      flaggedCount:
        gpsSpoof.flaggedCount +
        ghostTrips.flaggedCount +
        duplicates.flaggedCount +
        routeAnomalies.flaggedCount,
    };
  }

  async detectGpsSpoof() {
    const thresholdKm = Number(process.env.FRAUD_GPS_SPOOF_THRESHOLD_KM ?? 2);
    const freshnessMinutes = Number(process.env.FRAUD_GPS_FRESHNESS_MINUTES ?? 20);
    const freshnessCutoff = new Date(Date.now() - freshnessMinutes * 60 * 1000);

    const drivers = await this.prisma.driver.findMany({
      where: {
        isOnline: true,
        currentLatitude: { not: null },
        currentLongitude: { not: null },
        lastLocationAt: { gte: freshnessCutoff },
        vehicle: {
          is: {
            deviceGpsLat: { not: null },
            deviceGpsLng: { not: null },
            lastGpsAt: { gte: freshnessCutoff },
          },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            phone: true,
          },
        },
        vehicle: {
          select: {
            id: true,
            plateNumber: true,
            deviceGpsLat: true,
            deviceGpsLng: true,
          },
        },
      },
    });

    const flagged = [];
    for (const driver of drivers) {
      const divergenceKm = this.distanceKm(
        driver.currentLatitude!,
        driver.currentLongitude!,
        driver.vehicle!.deviceGpsLat!,
        driver.vehicle!.deviceGpsLng!,
      );

      if (divergenceKm <= thresholdKm) {
        continue;
      }

      const description = `Driver ${driver.user.fullName ?? driver.user.phone ?? driver.id} is ${divergenceKm.toFixed(2)} km away from assigned vehicle ${driver.vehicle!.plateNumber} GPS feed while online.`;
      const flag = await this.upsertFlag({
        entityType: 'DRIVER',
        entityId: driver.id,
        type: 'GPS_SPOOF',
        severity: divergenceKm >= thresholdKm * 2 ? 'CRITICAL' : 'HIGH',
        description,
      });

      flagged.push({
        flagId: flag.id,
        driverId: driver.id,
        driverName: driver.user.fullName ?? driver.user.phone ?? driver.id,
        vehiclePlateNumber: driver.vehicle!.plateNumber,
        divergenceKm: this.round(divergenceKm),
      });
    }

    return {
      detector: 'GPS_SPOOF',
      thresholdKm,
      totalChecked: drivers.length,
      flaggedCount: flagged.length,
      flagged,
    };
  }

  async detectGhostTrip() {
    const graceMinutes = Number(process.env.FRAUD_GHOST_TRIP_GRACE_MINUTES ?? 30);
    const cutoff = new Date(Date.now() - graceMinutes * 60 * 1000);
    const activeStatuses: BookingStatus[] = [
      BookingStatus.PICKED,
      BookingStatus.IN_TRANSIT,
      BookingStatus.ARRIVED_AT_DESTINATION,
      BookingStatus.DELIVERY_VERIFICATION,
      BookingStatus.DELIVERED,
      BookingStatus.COMPLETED,
    ];

    const bookings = await this.prisma.booking.findMany({
      where: {
        driverId: { not: null },
        status: { in: activeStatuses },
        updatedAt: { lte: cutoff },
      },
      include: {
        driver: {
          include: {
            user: {
              select: {
                fullName: true,
                phone: true,
              },
            },
          },
        },
        scanEvents: {
          select: { id: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const flagged = [];
    for (const booking of bookings) {
      if (booking.scanEvents.length > 0 || !booking.driverId) {
        continue;
      }

      const description = `Booking ${booking.reference} reached ${booking.status} with no recorded scan events after ${graceMinutes} minutes.`;
      const flag = await this.upsertFlag({
        entityType: 'DRIVER',
        entityId: booking.driverId,
        type: 'GHOST_TRIP',
        severity:
          booking.status === BookingStatus.COMPLETED || booking.status === BookingStatus.DELIVERED
            ? 'CRITICAL'
            : 'HIGH',
        description,
      });

      flagged.push({
        flagId: flag.id,
        bookingId: booking.id,
        bookingReference: booking.reference,
        driverId: booking.driverId,
        driverName:
          booking.driver?.user.fullName ?? booking.driver?.user.phone ?? booking.driverId,
        status: booking.status,
      });
    }

    return {
      detector: 'GHOST_TRIP',
      graceMinutes,
      totalChecked: bookings.length,
      flaggedCount: flagged.length,
      flagged,
    };
  }

  async detectDuplicate() {
    const lookbackHours = Number(process.env.FRAUD_DUPLICATE_LOOKBACK_HOURS ?? 72);
    const windowMinutes = Number(process.env.FRAUD_DUPLICATE_WINDOW_MINUTES ?? 10);
    const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);

    const bookings = await this.prisma.booking.findMany({
      where: {
        createdAt: { gte: since },
      },
      include: {
        stops: {
          orderBy: { sequence: 'asc' },
          select: {
            sequence: true,
            address: true,
            latitude: true,
            longitude: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const customerIds = [...new Set(bookings.map((booking) => booking.customerId))];
    const customers =
      customerIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: customerIds } },
            select: {
              id: true,
              fullName: true,
              phone: true,
              email: true,
            },
          })
        : [];
    const customerNames = new Map(
      customers.map((customer) => [
        customer.id,
        customer.fullName ?? customer.email ?? customer.phone ?? customer.id,
      ]),
    );

    const grouped = new Map<string, typeof bookings>();
    for (const booking of bookings) {
      const fingerprint = this.buildBookingFingerprint(booking);
      const key = `${booking.customerId}:${fingerprint}`;
      grouped.set(key, [...(grouped.get(key) ?? []), booking]);
    }

    const flagged = [];
    for (const group of grouped.values()) {
      if (group.length < 2) {
        continue;
      }

      const cluster = [group[0]];
      for (let index = 1; index < group.length; index += 1) {
        const previous = cluster[cluster.length - 1];
        const current = group[index];
        const ageMinutes =
          (current.createdAt.getTime() - previous.createdAt.getTime()) / (1000 * 60);

        if (ageMinutes <= windowMinutes) {
          cluster.push(current);
        }
      }

      if (cluster.length < 2) {
        continue;
      }

      const customerId = cluster[0].customerId;
      const missingKeys = cluster.filter((booking) => !booking.idempotencyKey).length;
      const description = `Customer ${customerNames.get(customerId) ?? customerId} created ${cluster.length} near-identical bookings within ${windowMinutes} minutes (${cluster
        .map((booking) => booking.reference)
        .join(', ')}). Missing idempotency keys: ${missingKeys}.`;
      const flag = await this.upsertFlag({
        entityType: 'CUSTOMER',
        entityId: customerId,
        type: 'DUPLICATE_BOOKING',
        severity: missingKeys > 0 ? 'HIGH' : 'MEDIUM',
        description,
      });

      flagged.push({
        flagId: flag.id,
        customerId,
        customerLabel: customerNames.get(customerId) ?? customerId,
        bookingReferences: cluster.map((booking) => booking.reference),
        missingIdempotencyKeys: missingKeys,
      });
    }

    return {
      detector: 'DUPLICATE_BOOKING',
      lookbackHours,
      windowMinutes,
      totalChecked: bookings.length,
      flaggedCount: flagged.length,
      flagged,
    };
  }

  async detectRouteAnomaly() {
    const thresholdKm = Number(process.env.FRAUD_ROUTE_ANOMALY_THRESHOLD_KM ?? 5);
    const activeStatuses: BookingStatus[] = [
      BookingStatus.PICKED,
      BookingStatus.IN_TRANSIT,
      BookingStatus.ARRIVED_AT_DESTINATION,
      BookingStatus.DELIVERY_VERIFICATION,
    ];

    const bookings = await this.prisma.booking.findMany({
      where: {
        driverId: { not: null },
        status: { in: activeStatuses },
        driver: {
          is: {
            currentLatitude: { not: null },
            currentLongitude: { not: null },
          },
        },
      },
      include: {
        driver: {
          include: {
            user: {
              select: {
                fullName: true,
                phone: true,
              },
            },
          },
        },
        stops: {
          orderBy: { sequence: 'asc' },
          select: {
            sequence: true,
            latitude: true,
            longitude: true,
            address: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const flagged = [];
    for (const booking of bookings) {
      if (!booking.driver || booking.stops.length < 2) {
        continue;
      }

      const deviationKm = this.distanceFromRouteKm(
        {
          lat: booking.driver.currentLatitude!,
          lng: booking.driver.currentLongitude!,
        },
        booking.stops.map((stop) => ({ lat: stop.latitude, lng: stop.longitude })),
      );

      if (deviationKm <= thresholdKm) {
        continue;
      }

      const description = `Driver ${booking.driver.user.fullName ?? booking.driver.user.phone ?? booking.driver.id} is ${deviationKm.toFixed(2)} km away from the planned stop corridor for booking ${booking.reference}.`;
      const flag = await this.upsertFlag({
        entityType: 'DRIVER',
        entityId: booking.driver.id,
        type: 'ROUTE_ANOMALY',
        severity: deviationKm >= thresholdKm * 2 ? 'CRITICAL' : 'HIGH',
        description,
      });

      flagged.push({
        flagId: flag.id,
        bookingId: booking.id,
        bookingReference: booking.reference,
        driverId: booking.driver.id,
        driverName:
          booking.driver.user.fullName ?? booking.driver.user.phone ?? booking.driver.id,
        deviationKm: this.round(deviationKm),
      });
    }

    return {
      detector: 'ROUTE_ANOMALY',
      thresholdKm,
      totalChecked: bookings.length,
      flaggedCount: flagged.length,
      flagged,
    };
  }

  async reviewFlag(flagId: string, reviewerId: string, dto: ReviewFraudFlagDto) {
    const flag = await this.prisma.fraudFlag.findUnique({ where: { id: flagId } });
    if (!flag) {
      throw new NotFoundException('Fraud flag not found');
    }

    const updated = await this.prisma.fraudFlag.update({
      where: { id: flagId },
      data: {
        status: dto.status,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
      },
    });

    await this.writeAudit(reviewerId, 'FRAUD_FLAG_REVIEWED', flagId, {
      previousStatus: flag.status,
      nextStatus: dto.status,
      note: dto.note ?? null,
      type: flag.type,
      entityType: flag.entityType,
      entityId: flag.entityId,
    });

    return this.hydrateFlag(updated);
  }

  async suspendAccount(flagId: string, reviewerId: string) {
    const flag = await this.prisma.fraudFlag.findUnique({ where: { id: flagId } });
    if (!flag) {
      throw new NotFoundException('Fraud flag not found');
    }

    let suspendedTarget: Record<string, unknown>;

    if (flag.entityType === 'DRIVER') {
      const driver = await this.prisma.driver.findUnique({
        where: { id: flag.entityId },
        select: {
          id: true,
          userId: true,
        },
      });

      if (!driver) {
        throw new NotFoundException('Driver target not found');
      }

      await this.prisma.$transaction([
        this.prisma.driver.update({
          where: { id: driver.id },
          data: {
            isBlacklisted: true,
            isAvailable: false,
            isOnline: false,
          },
        }),
        this.prisma.user.update({
          where: { id: driver.userId },
          data: { status: AccountStatus.SUSPENDED },
        }),
      ]);

      suspendedTarget = {
        targetType: 'DRIVER',
        driverId: driver.id,
        userId: driver.userId,
      };
    } else if (flag.entityType === 'CUSTOMER') {
      await this.prisma.user.update({
        where: { id: flag.entityId },
        data: { status: AccountStatus.SUSPENDED },
      });

      suspendedTarget = {
        targetType: 'CUSTOMER',
        userId: flag.entityId,
      };
    } else {
      throw new BadRequestException(
        `Fraud flags with entity type ${flag.entityType} do not support direct suspension controls`,
      );
    }

    const updated = await this.prisma.fraudFlag.update({
      where: { id: flagId },
      data: {
        status: 'SUSPENDED',
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
      },
    });

    await this.writeAudit(reviewerId, 'FRAUD_ACCOUNT_SUSPENDED', flagId, {
      type: flag.type,
      entityType: flag.entityType,
      entityId: flag.entityId,
      ...suspendedTarget,
    });

    return this.hydrateFlag(updated);
  }

  private async upsertFlag(input: {
    entityType: string;
    entityId: string;
    type: string;
    severity: string;
    description: string;
  }) {
    const existing = await this.prisma.fraudFlag.findFirst({
      where: {
        entityType: input.entityType,
        entityId: input.entityId,
        type: input.type,
        status: { not: 'FALSE_POSITIVE' },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      return this.prisma.fraudFlag.update({
        where: { id: existing.id },
        data: {
          severity: input.severity,
          description: input.description,
          status: existing.status === 'SUSPENDED' ? existing.status : 'OPEN',
        },
      });
    }

    return this.prisma.fraudFlag.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        type: input.type,
        severity: input.severity,
        description: input.description,
        status: 'OPEN',
      },
    });
  }

  private async hydrateFlags(flags: Array<{
    id: string;
    entityType: string;
    entityId: string;
    type: string;
    description: string;
    severity: string;
    status: string;
    reviewedBy: string | null;
    reviewedAt: Date | null;
    createdAt: Date;
  }>) {
    const driverIds = [
      ...new Set(
        flags.filter((flag) => flag.entityType === 'DRIVER').map((flag) => flag.entityId),
      ),
    ];
    const userIds = [
      ...new Set(
        [
          ...flags.filter((flag) => flag.entityType === 'CUSTOMER').map((flag) => flag.entityId),
          ...flags.map((flag) => flag.reviewedBy).filter((value): value is string => Boolean(value)),
        ],
      ),
    ];

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
                  status: true,
                },
              },
              vehicle: {
                select: {
                  plateNumber: true,
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

    const driversById = new Map(drivers.map((driver) => [driver.id, driver]));
    const usersById = new Map(users.map((user) => [user.id, user]));

    return flags.map((flag) => {
      let subjectLabel = flag.entityId;
      let subjectStatus: string | null = null;

      if (flag.entityType === 'DRIVER') {
        const driver = driversById.get(flag.entityId);
        if (driver) {
          subjectLabel = driver.user.fullName ?? driver.user.phone ?? driver.user.email ?? driver.id;
          subjectStatus = driver.user.status;
        }
      } else if (flag.entityType === 'CUSTOMER') {
        const user = usersById.get(flag.entityId);
        if (user) {
          subjectLabel = user.fullName ?? user.phone ?? user.email ?? user.id;
          subjectStatus = user.status;
        }
      }

      const reviewer = flag.reviewedBy ? usersById.get(flag.reviewedBy) : null;

      return {
        ...flag,
        createdAt: flag.createdAt.toISOString(),
        reviewedAt: flag.reviewedAt?.toISOString() ?? null,
        subjectLabel,
        subjectStatus,
        reviewerLabel: reviewer
          ? reviewer.fullName ?? reviewer.phone ?? reviewer.email ?? reviewer.id
          : null,
      };
    });
  }

  private async hydrateFlag(flag: {
    id: string;
    entityType: string;
    entityId: string;
    type: string;
    description: string;
    severity: string;
    status: string;
    reviewedBy: string | null;
    reviewedAt: Date | null;
    createdAt: Date;
  }) {
    const [hydrated] = await this.hydrateFlags([flag]);
    return hydrated;
  }

  private buildSummary(
    flags: Array<{ type: string; severity: string; status: string }>,
  ): FraudSummary {
    return {
      totalFlags: flags.length,
      openFlags: flags.filter((flag) => flag.status === 'OPEN').length,
      confirmedFlags: flags.filter((flag) => flag.status === 'CONFIRMED').length,
      suspendedFlags: flags.filter((flag) => flag.status === 'SUSPENDED').length,
      criticalFlags: flags.filter((flag) => flag.severity === 'CRITICAL').length,
      gpsSpoofCount: flags.filter((flag) => flag.type === 'GPS_SPOOF').length,
      ghostTripCount: flags.filter((flag) => flag.type === 'GHOST_TRIP').length,
      duplicateBookingCount: flags.filter((flag) => flag.type === 'DUPLICATE_BOOKING').length,
      routeAnomalyCount: flags.filter((flag) => flag.type === 'ROUTE_ANOMALY').length,
    };
  }

  private buildBookingFingerprint(booking: {
    serviceType: string;
    totalPrice: number;
    stops: Array<{ sequence: number; address: string; latitude: number; longitude: number }>;
  }) {
    const stops = booking.stops
      .map(
        (stop) =>
          `${stop.sequence}:${stop.address.trim().toLowerCase()}:${stop.latitude.toFixed(4)}:${stop.longitude.toFixed(4)}`,
      )
      .join('|');

    return `${booking.serviceType}:${booking.totalPrice.toFixed(2)}:${stops}`;
  }

  private distanceFromRouteKm(
    point: { lat: number; lng: number },
    route: Array<{ lat: number; lng: number }>,
  ) {
    if (route.length === 0) {
      return 0;
    }
    if (route.length === 1) {
      return this.distanceKm(point.lat, point.lng, route[0].lat, route[0].lng);
    }

    const meanLat = route.reduce((sum, stop) => sum + stop.lat, point.lat) / (route.length + 1);
    const pointProjected = this.project(point.lat, point.lng, meanLat);
    let minDistance = Number.POSITIVE_INFINITY;

    for (let index = 0; index < route.length - 1; index += 1) {
      const start = this.project(route[index].lat, route[index].lng, meanLat);
      const end = this.project(route[index + 1].lat, route[index + 1].lng, meanLat);
      minDistance = Math.min(
        minDistance,
        this.pointToSegmentDistance(pointProjected, start, end),
      );
    }

    return this.round(minDistance);
  }

  private project(lat: number, lng: number, meanLat: number) {
    const x = lng * 111.32 * Math.cos((meanLat * Math.PI) / 180);
    const y = lat * 110.574;
    return { x, y };
  }

  private pointToSegmentDistance(
    point: { x: number; y: number },
    start: { x: number; y: number },
    end: { x: number; y: number },
  ) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;

    if (dx === 0 && dy === 0) {
      return Math.sqrt((point.x - start.x) ** 2 + (point.y - start.y) ** 2);
    }

    const t = Math.max(
      0,
      Math.min(
        1,
        ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy),
      ),
    );
    const projectedX = start.x + t * dx;
    const projectedY = start.y + t * dy;
    return Math.sqrt((point.x - projectedX) ** 2 + (point.y - projectedY) ** 2);
  }

  private distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(value: number) {
    return (value * Math.PI) / 180;
  }

  private round(value: number) {
    return Number(value.toFixed(2));
  }

  private async writeAudit(
    userId: string,
    action: string,
    entityId: string,
    details: Record<string, unknown>,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action,
          entityType: 'FRAUD_FLAG',
          entityId,
          details: details as Prisma.InputJsonValue,
        },
      });
    } catch {
      // Fraud workflows should not fail just because audit logging failed.
    }
  }
}
