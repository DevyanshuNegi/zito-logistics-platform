import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, Prisma, ScanCheckpoint } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RouteOptimizationService } from '../route-optimization/route-optimization.service';

type CrossBorderHandoffRecord = {
  handoffId: string;
  bookingId: string;
  bookingReference: string;
  fromAgencyId: string;
  toAgencyId: string;
  receivingWarehouseId: string | null;
  confirmedItemIds: string[];
  expectedItemIds: string[];
  originCountryCode: string | null;
  destinationCountryCode: string | null;
  initiatedBy: string;
  initiatedAt: string;
  note: string | null;
  latitude: number | null;
  longitude: number | null;
};

@Injectable()
export class TrackingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly routeOptimizationService: RouteOptimizationService,
  ) {}

  async updateDriverLocation(
    driverId: string,
    lat: number,
    lng: number,
    bookingId?: string,
  ) {
    await this.prisma.driver.update({
      where: { id: driverId },
      data: {
        currentLatitude: lat,
        currentLongitude: lng,
        lastLocationAt: new Date(),
      },
    });

    const updatedAt = new Date();
    let routeDeviationKm: number | null = null;
    let isOffRoute = false;
    let alertStatus: string | null = null;

    if (bookingId) {
      try {
        const deviation = await this.routeOptimizationService.detectDeviation(bookingId, {
          latitude: lat,
          longitude: lng,
        });
        routeDeviationKm = deviation.deviationKm;
        isOffRoute = deviation.isOffRoute;
        alertStatus = deviation.alertStatus;
      } catch {
        routeDeviationKm = null;
      }
    }

    return {
      driverId,
      lat,
      lng,
      bookingId,
      updatedAt,
      timestamp: updatedAt,
      routeDeviationKm,
      isOffRoute,
      alertStatus,
    };
  }

  async getBookingTracking(bookingId: string, customerId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        driver: {
          select: {
            id: true,
            currentLatitude: true,
            currentLongitude: true,
            lastLocationAt: true,
            rating: true,
            user: { select: { fullName: true, phone: true } },
          },
        },
        stops: { orderBy: { sequence: 'asc' } },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.customerId !== customerId) {
      throw new ForbiddenException('You can only track your own bookings');
    }

    const routePlan = await this.routeOptimizationService.calculateForBooking(bookingId);
    const deviation =
      booking.driver?.currentLatitude != null && booking.driver?.currentLongitude != null
        ? await this.routeOptimizationService.detectDeviation(bookingId)
        : null;

    return {
      bookingId: booking.id,
      reference: booking.reference,
      status: booking.status,
      driver: booking.driver
        ? {
            name: booking.driver.user?.fullName,
            phone: booking.driver.user?.phone,
            rating: booking.driver.rating,
            location: {
              lat: booking.driver.currentLatitude,
              lng: booking.driver.currentLongitude,
              updatedAt: booking.driver.lastLocationAt,
            },
          }
        : null,
      stops: booking.stops,
      eta: routePlan.route.eta,
      route: {
        ...routePlan.route,
        deviation,
      },
    };
  }

  async getBookingTrackingAdmin(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        driver: {
          select: {
            id: true,
            currentLatitude: true,
            currentLongitude: true,
            lastLocationAt: true,
            user: { select: { fullName: true, phone: true } },
          },
        },
        stops: { orderBy: { sequence: 'asc' } },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const routePlan = await this.routeOptimizationService.calculateForBooking(bookingId);
    const deviation =
      booking.driver?.currentLatitude != null && booking.driver?.currentLongitude != null
        ? await this.routeOptimizationService.detectDeviation(bookingId)
        : null;

    return {
      ...booking,
      eta: routePlan.route.eta,
      route: {
        ...routePlan.route,
        deviation,
      },
    };
  }

  async getActiveDriversMap(agencyId?: string) {
    const where: any = {
      isOnline: true,
      currentLatitude: { not: null },
      currentLongitude: { not: null },
    };

    const drivers = await this.prisma.driver.findMany({
      where,
      select: {
        id: true,
        currentLatitude: true,
        currentLongitude: true,
        lastLocationAt: true,
        isAvailable: true,
        user: { select: { fullName: true, phone: true } },
        vehicle: { select: { plateNumber: true, type: true } },
      },
    });

    return drivers;
  }

  async crossBorderHandoff(
    bookingId: string,
    dto: {
      toAgencyId: string;
      confirmedItemIds?: string[];
      receivingWarehouseId?: string;
      originCountryCode?: string;
      destinationCountryCode?: string;
      note?: string;
      latitude?: number;
      longitude?: number;
    },
    actorId: string,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        parcels: {
          select: {
            id: true,
            waybillId: true,
          },
        },
      },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    if (!booking.agencyId) {
      throw new BadRequestException(
        'Booking must belong to an origin agency before a cross-border handoff can be recorded.',
      );
    }
    const blockedStatuses: BookingStatus[] = [
      BookingStatus.CANCELLED,
      BookingStatus.COMPLETED,
      BookingStatus.REJECTED,
    ];
    if (blockedStatuses.includes(booking.status)) {
      throw new BadRequestException(
        `Cross-border handoff is not allowed for booking status ${booking.status}.`,
      );
    }
    if (dto.toAgencyId === booking.agencyId) {
      throw new BadRequestException('Destination agency must differ from the origin agency.');
    }

    const [fromAgency, toAgency, warehouse] = await Promise.all([
      this.prisma.agency.findUnique({
        where: { id: booking.agencyId },
        select: { id: true, name: true, status: true },
      }),
      this.prisma.agency.findUnique({
        where: { id: dto.toAgencyId },
        select: { id: true, name: true, status: true },
      }),
      dto.receivingWarehouseId
        ? this.prisma.warehouse.findUnique({
            where: { id: dto.receivingWarehouseId },
            select: { id: true, agencyId: true, name: true, code: true },
          })
        : Promise.resolve(null),
    ]);

    if (!fromAgency || !toAgency) {
      throw new NotFoundException('Origin or destination agency not found');
    }
    if (fromAgency.status !== 'ACTIVE' || toAgency.status !== 'ACTIVE') {
      throw new BadRequestException('Both agencies must be ACTIVE for cross-border handoff.');
    }
    if (warehouse && warehouse.agencyId !== dto.toAgencyId) {
      throw new BadRequestException(
        'Receiving warehouse must belong to the destination agency.',
      );
    }

    const expectedItemIds = booking.parcels.map((parcel) => parcel.id);
    const confirmedItemIds = [...new Set(dto.confirmedItemIds ?? [])];
    if (expectedItemIds.length === 0 && confirmedItemIds.length > 0) {
      throw new BadRequestException(
        'This booking has no linked parcel records, so no parcel scan confirmations should be supplied.',
      );
    }
    if (expectedItemIds.length > 0) {
      const unexpected = confirmedItemIds.filter(
        (itemId) => !expectedItemIds.includes(itemId),
      );
      if (unexpected.length > 0) {
        throw new BadRequestException(
          `Unexpected parcel IDs were supplied for handoff confirmation: ${unexpected.join(', ')}`,
        );
      }

      const missing = expectedItemIds.filter((itemId) => !confirmedItemIds.includes(itemId));
      if (missing.length > 0) {
        throw new BadRequestException(
          `All linked parcels must be scan-confirmed before handoff. Missing: ${missing.join(', ')}`,
        );
      }
    }

    const handoffId = `handoff_${Date.now()}`;
    const initiatedAt = new Date().toISOString();
    const handoff: CrossBorderHandoffRecord = {
      handoffId,
      bookingId: booking.id,
      bookingReference: booking.reference,
      fromAgencyId: booking.agencyId,
      toAgencyId: dto.toAgencyId,
      receivingWarehouseId: dto.receivingWarehouseId ?? null,
      confirmedItemIds,
      expectedItemIds,
      originCountryCode: dto.originCountryCode?.trim().toUpperCase() ?? null,
      destinationCountryCode:
        dto.destinationCountryCode?.trim().toUpperCase() ?? null,
      initiatedBy: actorId,
      initiatedAt,
      note: dto.note?.trim() || null,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: booking.id },
        data: { agencyId: dto.toAgencyId },
      });

      if (confirmedItemIds.length > 0) {
        const checkpoint = dto.receivingWarehouseId
          ? ScanCheckpoint.WAREHOUSE_ENTRY
          : ScanCheckpoint.VEHICLE_UNLOAD;
        await tx.scanEvent.createMany({
          data: confirmedItemIds.map((itemId) => {
            const parcel = booking.parcels.find((candidate) => candidate.id === itemId);
            return {
              itemId,
              bookingId: booking.id,
              waybillId: parcel?.waybillId ?? null,
              checkpoint,
              latitude: dto.latitude ?? null,
              longitude: dto.longitude ?? null,
              performedBy: actorId,
              notes:
                dto.note?.trim() ||
                `Cross-border handoff from ${fromAgency.name} to ${toAgency.name}`,
            };
          }),
        });
      }

      await tx.idempotencyRecord.create({
        data: {
          key: this.crossBorderHandoffKey(booking.id, handoffId),
          status: 'COMPLETED',
          requestHash: booking.id,
          response: handoff as Prisma.InputJsonValue,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: 'CROSS_BORDER_HANDOFF_COMPLETED',
          entityType: 'BOOKING',
          entityId: booking.id,
          details: {
            handoffId,
            fromAgencyId: fromAgency.id,
            toAgencyId: toAgency.id,
            receivingWarehouseId: warehouse?.id ?? null,
            confirmedItemCount: confirmedItemIds.length,
            expectedItemCount: expectedItemIds.length,
            originCountryCode: handoff.originCountryCode,
            destinationCountryCode: handoff.destinationCountryCode,
          } as Prisma.InputJsonValue,
        },
      });
    });

    return {
      handoff,
      fromAgency,
      toAgency,
      receivingWarehouse: warehouse,
      notes: [
        expectedItemIds.length > 0
          ? 'Parcel-linked scan confirmation was recorded before the agency handoff was persisted.'
          : 'The booking had no linked parcel records yet, so the handoff was stored at booking level with audit coverage.',
      ],
    };
  }

  async getCrossBorderHandoffs(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, reference: true },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const rows = await this.prisma.idempotencyRecord.findMany({
      where: {
        key: { startsWith: this.crossBorderHandoffBookingPrefix(bookingId) },
      },
      select: {
        response: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return {
      bookingId: booking.id,
      bookingReference: booking.reference,
      handoffs: rows
        .map((row) => this.asCrossBorderHandoffRecord(row.response))
        .filter((row): row is CrossBorderHandoffRecord => Boolean(row)),
    };
  }

  private crossBorderHandoffKey(bookingId: string, handoffId: string) {
    return `${this.crossBorderHandoffBookingPrefix(bookingId)}${handoffId}`;
  }

  private crossBorderHandoffBookingPrefix(bookingId: string) {
    return `cross-border-handoff:${bookingId}:`;
  }

  private asCrossBorderHandoffRecord(value: Prisma.JsonValue | null | undefined) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const record = value as Record<string, Prisma.JsonValue>;
    if (
      typeof record.handoffId !== 'string' ||
      typeof record.bookingId !== 'string' ||
      typeof record.bookingReference !== 'string' ||
      typeof record.fromAgencyId !== 'string' ||
      typeof record.toAgencyId !== 'string'
    ) {
      return null;
    }

    return {
      handoffId: record.handoffId,
      bookingId: record.bookingId,
      bookingReference: record.bookingReference,
      fromAgencyId: record.fromAgencyId,
      toAgencyId: record.toAgencyId,
      receivingWarehouseId:
        typeof record.receivingWarehouseId === 'string'
          ? record.receivingWarehouseId
          : null,
      confirmedItemIds: this.asStringArray(record.confirmedItemIds),
      expectedItemIds: this.asStringArray(record.expectedItemIds),
      originCountryCode:
        typeof record.originCountryCode === 'string'
          ? record.originCountryCode
          : null,
      destinationCountryCode:
        typeof record.destinationCountryCode === 'string'
          ? record.destinationCountryCode
          : null,
      initiatedBy:
        typeof record.initiatedBy === 'string' ? record.initiatedBy : 'system',
      initiatedAt:
        typeof record.initiatedAt === 'string'
          ? record.initiatedAt
          : new Date().toISOString(),
      note: typeof record.note === 'string' ? record.note : null,
      latitude: typeof record.latitude === 'number' ? record.latitude : null,
      longitude: typeof record.longitude === 'number' ? record.longitude : null,
    } satisfies CrossBorderHandoffRecord;
  }

  private asStringArray(value: Prisma.JsonValue | null | undefined) {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter((item): item is string => typeof item === 'string');
  }
}
