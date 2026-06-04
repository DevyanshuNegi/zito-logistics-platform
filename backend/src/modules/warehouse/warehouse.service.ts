import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';

type WarehouseAccessContext = {
  viewerRole?: string;
  viewerAgencyId?: string | null;
  viewerUserId?: string;
  agencyId?: string;
};

const CAPACITY_RELEASE_STATUSES = ['REJECTED', 'CANCELLED', 'COMPLETED'];

@Injectable()
export class WarehouseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsService: EventsService,
  ) {}

  private readonly warehouseInclude = {
    manager: {
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
      },
    },
    zones: {
      include: {
        racks: {
          include: {
            bins: {
              include: {
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
    _count: {
      select: {
        items: true,
      },
    },
  };

  private buildAccessWhere(
    context: WarehouseAccessContext = {},
  ): Prisma.WarehouseWhereInput {
    const where: Prisma.WarehouseWhereInput = {};

    if (context.viewerRole === 'AGENCY_STAFF') {
      if (!context.viewerAgencyId) {
        throw new BadRequestException(
          'Agency staff account is not linked to an agency',
        );
      }
      where.agencyId = context.viewerAgencyId;
      return where;
    }

    if (context.viewerRole === 'WAREHOUSE_PARTNER') {
      where.managerId = context.viewerUserId;
      return where;
    }

    if (context.agencyId) {
      where.agencyId = context.agencyId;
    }

    return where;
  }

  private async ensureAgencyExists(agencyId: string) {
    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
      select: { id: true },
    });

    if (!agency) {
      throw new NotFoundException('Agency not found');
    }
  }

  private async ensureManagerIsValid(managerId: string, agencyId: string) {
    const manager = await this.prisma.user.findUnique({
      where: { id: managerId },
      select: {
        id: true,
        agencyId: true,
      },
    });

    if (!manager) {
      throw new NotFoundException('Warehouse manager not found');
    }

    if (manager.agencyId && manager.agencyId !== agencyId) {
      throw new BadRequestException(
        'Warehouse manager must belong to the same agency',
      );
    }
  }

  async createWarehouse(data: any) {
    await this.ensureAgencyExists(data.agencyId);

    if (data.managerId) {
      await this.ensureManagerIsValid(data.managerId, data.agencyId);
    }

    return this.prisma.warehouse.create({
      data: {
        name: data.name,
        code: data.code,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
        status: data.status || 'ACTIVE',
        agencyId: data.agencyId,
        managerId: data.managerId,
      },
      include: this.warehouseInclude,
    });
  }

  async findAll(context: WarehouseAccessContext = {}) {
    return this.prisma.warehouse.findMany({
      where: this.buildAccessWhere(context),
      include: this.warehouseInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, context: WarehouseAccessContext = {}) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: {
        id,
        ...this.buildAccessWhere(context),
      },
      include: this.warehouseInclude,
    });

    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }

    return warehouse;
  }

  async updateWarehouse(
    id: string,
    data: any,
    context: WarehouseAccessContext = {},
  ) {
    const warehouse = await this.findOne(id, context);
    const agencyId = data.agencyId ?? warehouse.agencyId;

    if (data.agencyId && data.agencyId !== warehouse.agencyId) {
      await this.ensureAgencyExists(data.agencyId);
    }

    if (data.managerId) {
      await this.ensureManagerIsValid(data.managerId, agencyId);
    }

    return this.prisma.warehouse.update({
      where: { id: warehouse.id },
      data: {
        name: data.name,
        code: data.code,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
        status: data.status,
        agencyId: data.agencyId,
        managerId: data.managerId,
      },
      include: this.warehouseInclude,
    });
  }

  async createZone(
    warehouseId: string,
    data: any,
    context: WarehouseAccessContext = {},
  ) {
    const warehouse = await this.findOne(warehouseId, context);

    return this.prisma.warehouseZone.create({
      data: {
        name: data.name,
        code: data.code,
        type: data.type || 'DRY',
        capacity: data.capacity,
        warehouseId: warehouse.id,
      },
    });
  }

  async createRack(
    zoneId: string,
    data: any,
    context: WarehouseAccessContext = {},
  ) {
    const zone = await this.prisma.warehouseZone.findUnique({
      where: { id: zoneId },
      include: {
        warehouse: true,
      },
    });

    if (!zone) {
      throw new NotFoundException('Warehouse zone not found');
    }

    await this.findOne(zone.warehouseId, context);

    return this.prisma.warehouseRack.create({
      data: {
        label: data.label,
        zoneId,
      },
    });
  }

  async createBin(
    rackId: string,
    data: any,
    context: WarehouseAccessContext = {},
  ) {
    const rack = await this.prisma.warehouseRack.findUnique({
      where: { id: rackId },
      include: {
        zone: {
          include: {
            warehouse: true,
          },
        },
      },
    });

    if (!rack) {
      throw new NotFoundException('Warehouse rack not found');
    }

    await this.findOne(rack.zone.warehouseId, context);

    return this.prisma.warehouseBin.create({
      data: {
        label: data.label,
        rackId,
        isOccupied: false,
      },
    });
  }

  async getCapacity(id: string, context: WarehouseAccessContext = {}) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: {
        id,
        ...this.buildAccessWhere(context),
      },
      select: {
        id: true,
        name: true,
        code: true,
        zones: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
            capacity: true,
            racks: {
              select: {
                id: true,
                label: true,
                bins: {
                  select: {
                    id: true,
                    label: true,
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
      },
    });

    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }

    let totalCapacity = 0;
    let totalOccupiedBins = 0;
    let totalBins = 0;

    const zones = warehouse.zones.map(zone => {
      const totalZoneBins = zone.racks.reduce(
        (sum, rack) => sum + rack.bins.length,
        0,
      );
      const occupiedZoneBins = zone.racks.reduce(
        (sum, rack) =>
          sum +
          rack.bins.filter(
            bin => bin.isOccupied || bin._count.items > 0,
          ).length,
        0,
      );

      totalCapacity += zone.capacity || 0;
      totalBins += totalZoneBins;
      totalOccupiedBins += occupiedZoneBins;

      return {
        id: zone.id,
        name: zone.name,
        code: zone.code,
        type: zone.type,
        configuredCapacity: zone.capacity,
        totalBins: totalZoneBins,
        occupiedBins: occupiedZoneBins,
        availableBins: Math.max(totalZoneBins - occupiedZoneBins, 0),
        occupancyPercentage: totalZoneBins
          ? Number(((occupiedZoneBins / totalZoneBins) * 100).toFixed(2))
          : 0,
      };
    });

    return {
      warehouseId: warehouse.id,
      warehouseName: warehouse.name,
      warehouseCode: warehouse.code,
      totalCapacity,
      totalBins,
      totalOccupiedBins,
      totalAvailableBins: Math.max(totalBins - totalOccupiedBins, 0),
      occupancyPercentage: totalBins
        ? Number(((totalOccupiedBins / totalBins) * 100).toFixed(2))
        : 0,
      zones,
    };
  }

  async createListing(partnerId: string, data: any) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: data.warehouseId },
      select: { id: true, managerId: true },
    });

    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }
    if (warehouse.managerId !== partnerId) {
      throw new BadRequestException(
        'Warehouse partners can only list warehouses they manage',
      );
    }
    if (data.availableCapacity > data.totalCapacity) {
      throw new BadRequestException(
        'Available capacity cannot be greater than total capacity',
      );
    }

    const listing = await this.prisma.warehouseListing.create({
      data: {
        warehouseId: data.warehouseId,
        partnerId,
        companyName: data.companyName,
        companyEmail: data.companyEmail,
        companyPhone: data.companyPhone,
        vatNumber: data.vatNumber,
        vatApplies: data.vatApplies ?? false,
        vatRatePct: data.vatApplies ? data.vatRatePct ?? 16 : 0,
        title: data.title,
        description: data.description,
        areaLabel: data.areaLabel,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
        serviceRadiusKm: data.serviceRadiusKm,
        storageTypes: data.storageTypes,
        amenities: data.amenities ?? [],
        photoUrls: data.photoUrls ?? [],
        documentUrls: data.documentUrls ?? [],
        totalCapacity: data.totalCapacity,
        availableCapacity: data.availableCapacity,
        capacityUnit: data.capacityUnit ?? 'SQM',
        rateAmount: data.rateAmount,
        rateUnit: data.rateUnit ?? 'DAY',
        handlingFee: data.handlingFee ?? 0,
        minimumBookingDays: data.minimumBookingDays ?? 1,
        status: 'PENDING_REVIEW',
        reviewNote: null,
        reviewedAt: null,
        reviewedBy: null,
      },
      include: this.listingInclude(),
    });

    await this.eventsService.publish({
      eventType: 'WarehouseListingSubmitted',
      aggregateType: 'WAREHOUSE',
      aggregateId: listing.id,
      actorId: partnerId,
      idempotencyKey: `warehouse-listing-submitted:${listing.id}`,
      data: {
        warehouseId: listing.warehouseId,
        partnerId: listing.partnerId,
        status: listing.status,
        areaLabel: listing.areaLabel,
        hasCoordinates: listing.latitude != null && listing.longitude != null,
      },
    });

    return listing;
  }

  async listPartnerListings(partnerId: string) {
    return this.prisma.warehouseListing.findMany({
      where: { partnerId },
      include: this.listingInclude(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async listApprovedListings(
    filters: {
      location?: string;
      storageType?: string;
      latitude?: number;
      longitude?: number;
      radiusKm?: number;
    } = {},
  ) {
    const location = filters.location?.trim();
    const storageType = filters.storageType?.trim();
    const hasNearbyFilter =
      Number.isFinite(filters.latitude) && Number.isFinite(filters.longitude);

    const listings = await this.prisma.warehouseListing.findMany({
      where: {
        status: 'APPROVED',
        ...(location
          ? {
              OR: [
                { title: { contains: location, mode: 'insensitive' } },
                { areaLabel: { contains: location, mode: 'insensitive' } },
                { address: { contains: location, mode: 'insensitive' } },
                { companyName: { contains: location, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: this.listingInclude(),
      orderBy: [{ updatedAt: 'desc' }],
    });

    const filteredByStorage =
      !storageType || storageType === 'ALL'
        ? listings
        : listings.filter((listing) =>
            this.asStringArray(listing.storageTypes).some(
              (item) => item.toUpperCase() === storageType.toUpperCase(),
            ),
          );

    if (!hasNearbyFilter) {
      return filteredByStorage;
    }

    const radiusKm =
      Number.isFinite(filters.radiusKm) && Number(filters.radiusKm) > 0
        ? Number(filters.radiusKm)
        : 25;

    return filteredByStorage
      .map((listing) => {
        const distanceKm =
          listing.latitude == null || listing.longitude == null
            ? null
            : this.calculateDistanceKm(
                Number(filters.latitude),
                Number(filters.longitude),
                listing.latitude,
                listing.longitude,
              );

        return {
          ...listing,
          distanceKm: distanceKm == null ? null : this.round(distanceKm),
        };
      })
      .filter((listing) => listing.distanceKm == null || listing.distanceKm <= radiusKm)
      .sort((left, right) => {
        if (left.distanceKm == null && right.distanceKm == null) return 0;
        if (left.distanceKm == null) return 1;
        if (right.distanceKm == null) return -1;
        return left.distanceKm - right.distanceKm;
      });
  }

  async listAdminListings(filters: { status?: string } = {}) {
    return this.prisma.warehouseListing.findMany({
      where: filters.status ? { status: filters.status } : {},
      include: this.listingInclude(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async reviewListing(id: string, data: any, reviewerId: string) {
    const listing = await this.prisma.warehouseListing.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!listing) {
      throw new NotFoundException('Warehouse listing not found');
    }

    const reviewed = await this.prisma.warehouseListing.update({
      where: { id },
      data: {
        status: data.status,
        reviewNote: data.note ?? null,
        reviewedAt: new Date(),
        reviewedBy: reviewerId,
      },
      include: this.listingInclude(),
    });

    await this.eventsService.publish({
      eventType: 'WarehouseListingReviewed',
      aggregateType: 'WAREHOUSE',
      aggregateId: reviewed.id,
      actorId: reviewerId,
      idempotencyKey: `warehouse-listing-reviewed:${reviewed.id}:${reviewed.status}:${reviewed.reviewedAt?.toISOString()}`,
      data: {
        warehouseId: reviewed.warehouseId,
        partnerId: reviewed.partnerId,
        status: reviewed.status,
        reviewNote: reviewed.reviewNote,
      },
    });

    return reviewed;
  }

  async createBooking(customerId: string, data: any) {
    const listing = await this.prisma.warehouseListing.findUnique({
      where: { id: data.listingId },
    });

    if (!listing || listing.status !== 'APPROVED') {
      throw new NotFoundException('Approved warehouse listing not found');
    }

    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid booking dates');
    }
    if (endDate <= startDate) {
      throw new BadRequestException('End date must be after start date');
    }
    if (data.capacityRequested > listing.availableCapacity) {
      throw new BadRequestException('Requested capacity is not available');
    }

    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    const durationDays = Math.max(
      listing.minimumBookingDays,
      Math.ceil((endDate.getTime() - startDate.getTime()) / millisecondsPerDay),
    );
    const baseAmount = this.round(
      data.capacityRequested * listing.rateAmount * durationDays,
    );
    const handlingFee = this.round(listing.handlingFee);
    const taxableAmount = baseAmount + handlingFee;
    const vatAmount = listing.vatApplies
      ? this.round(taxableAmount * (listing.vatRatePct / 100))
      : 0;
    const totalAmount = this.round(taxableAmount + vatAmount);
    const commissionRatePct = 10;
    const commissionAmount = this.round(taxableAmount * (commissionRatePct / 100));
    const partnerNetAmount = this.round(totalAmount - commissionAmount);

    const reference = await this.generateWarehouseBookingReference();
    const booking = await this.prisma.$transaction(async (tx) => {
      const capacityReserved = await tx.warehouseListing.updateMany({
        where: {
          id: listing.id,
          status: 'APPROVED',
          availableCapacity: { gte: data.capacityRequested },
        },
        data: {
          availableCapacity: { decrement: data.capacityRequested },
        },
      });

      if (capacityReserved.count !== 1) {
        throw new BadRequestException('Requested capacity is no longer available');
      }

      return tx.warehouseBooking.create({
        data: {
          reference,
          listingId: listing.id,
          customerId,
          partnerId: listing.partnerId,
          storageType: data.storageType,
          goodsDescription: data.goodsDescription,
          startDate,
          endDate,
          capacityRequested: data.capacityRequested,
          capacityUnit: data.capacityUnit ?? listing.capacityUnit,
          baseAmount,
          handlingFee,
          vatAmount,
          totalAmount,
          commissionRatePct,
          commissionAmount,
          partnerNetAmount,
          customerNote: data.customerNote,
        },
        include: this.bookingInclude(),
      });
    });

    await this.eventsService.publish({
      eventType: 'WarehouseBookingCreated',
      aggregateType: 'WAREHOUSE',
      aggregateId: booking.id,
      actorId: customerId,
      idempotencyKey: `warehouse-booking-created:${booking.id}`,
      data: {
        reference: booking.reference,
        listingId: booking.listingId,
        customerId: booking.customerId,
        partnerId: booking.partnerId,
        status: booking.status,
        totalAmount: booking.totalAmount,
        commissionAmount: booking.commissionAmount,
        partnerNetAmount: booking.partnerNetAmount,
      },
    });

    return booking;
  }

  async listCustomerBookings(customerId: string) {
    return this.prisma.warehouseBooking.findMany({
      where: { customerId },
      include: this.bookingInclude(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async listPartnerBookings(partnerId: string) {
    return this.prisma.warehouseBooking.findMany({
      where: { partnerId },
      include: this.bookingInclude(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async listAdminBookings() {
    return this.prisma.warehouseBooking.findMany({
      include: this.bookingInclude(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateBookingStatus(
    id: string,
    data: any,
    actor: { userId: string; role: string },
  ) {
    const booking = await this.prisma.warehouseBooking.findUnique({
      where: { id },
      select: {
        id: true,
        listingId: true,
        partnerId: true,
        status: true,
        capacityRequested: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Warehouse booking not found');
    }
    if (
      actor.role === 'WAREHOUSE_PARTNER' &&
      booking.partnerId !== actor.userId
    ) {
      throw new BadRequestException(
        'Warehouse partners can only update their own bookings',
      );
    }

    const previousReleased = CAPACITY_RELEASE_STATUSES.includes(booking.status);
    const nextReleased = CAPACITY_RELEASE_STATUSES.includes(data.status);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (!previousReleased && nextReleased) {
        await tx.warehouseListing.update({
          where: { id: booking.listingId },
          data: {
            availableCapacity: { increment: booking.capacityRequested },
          },
        });
      }

      if (previousReleased && !nextReleased) {
        const capacityReserved = await tx.warehouseListing.updateMany({
          where: {
            id: booking.listingId,
            availableCapacity: { gte: booking.capacityRequested },
          },
          data: {
            availableCapacity: { decrement: booking.capacityRequested },
          },
        });

        if (capacityReserved.count !== 1) {
          throw new BadRequestException(
            'Cannot reactivate booking because listing capacity is no longer available',
          );
        }
      }

      return tx.warehouseBooking.update({
        where: { id },
        data: {
          status: data.status,
          partnerNote: actor.role === 'WAREHOUSE_PARTNER' ? data.note : undefined,
          adminNote: actor.role !== 'WAREHOUSE_PARTNER' ? data.note : undefined,
          acceptedAt: data.status === 'ACCEPTED' ? new Date() : undefined,
          completedAt: data.status === 'COMPLETED' ? new Date() : undefined,
          cancelledAt: data.status === 'CANCELLED' ? new Date() : undefined,
        },
        include: this.bookingInclude(),
      });
    });

    await this.eventsService.publish({
      eventType: 'WarehouseBookingStatusChanged',
      aggregateType: 'WAREHOUSE',
      aggregateId: updated.id,
      actorId: actor.userId,
      idempotencyKey: `warehouse-booking-status:${updated.id}:${updated.status}:${Date.now()}`,
      data: {
        reference: updated.reference,
        listingId: updated.listingId,
        customerId: updated.customerId,
        partnerId: updated.partnerId,
        status: updated.status,
        actorRole: actor.role,
      },
    });

    return updated;
  }

  private listingInclude() {
    return {
      warehouse: {
        select: {
          id: true,
          name: true,
          code: true,
          status: true,
        },
      },
      _count: {
        select: {
          bookings: true,
        },
      },
    };
  }

  private bookingInclude() {
    return {
      listing: {
        include: this.listingInclude(),
      },
    };
  }

  private asStringArray(value: Prisma.JsonValue) {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  }

  private round(value: number) {
    return Number(value.toFixed(2));
  }

  private calculateDistanceKm(
    originLatitude: number,
    originLongitude: number,
    destinationLatitude: number,
    destinationLongitude: number,
  ) {
    const earthRadiusKm = 6371;
    const toRadians = (value: number) => (value * Math.PI) / 180;
    const latitudeDelta = toRadians(destinationLatitude - originLatitude);
    const longitudeDelta = toRadians(destinationLongitude - originLongitude);
    const originLatRad = toRadians(originLatitude);
    const destinationLatRad = toRadians(destinationLatitude);

    const haversine =
      Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
      Math.cos(originLatRad) *
        Math.cos(destinationLatRad) *
        Math.sin(longitudeDelta / 2) *
        Math.sin(longitudeDelta / 2);

    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  }

  private async generateWarehouseBookingReference(): Promise<string> {
    const reference = `WH-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const existing = await this.prisma.warehouseBooking.findUnique({
      where: { reference },
      select: { id: true },
    });
    return existing ? this.generateWarehouseBookingReference() : reference;
  }
}

