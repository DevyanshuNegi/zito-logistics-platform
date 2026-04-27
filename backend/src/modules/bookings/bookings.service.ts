import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BookingStatus, ServiceType, UserRole } from '@prisma/client';
import { CreateBookingDto } from './dto/create-booking.dto';
import { AssignDriverDto } from './dto/assign-driver.dto';

// ─── Reference Generator ──────────────────────────────────────────────────────
function generateReference(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `ZTO-${suffix}`;
}

// ─── Status Transition Rules (PRD §6) ────────────────────────────────────────
// Defines which statuses each role can transition TO from a given current status

const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  CREATED:                [BookingStatus.SEARCHING, BookingStatus.APPROVED, BookingStatus.CANCELLED],
  SEARCHING:              [BookingStatus.APPROVED, BookingStatus.CANCELLED],
  APPROVED:               [BookingStatus.ASSIGNED, BookingStatus.CANCELLED],
  ASSIGNED:               [BookingStatus.ACCEPTED, BookingStatus.CANCELLED, BookingStatus.REJECTED],
  ACCEPTED:               [BookingStatus.ARRIVED],
  ARRIVED:                [BookingStatus.PICKED],
  PICKED:                 [BookingStatus.IN_TRANSIT],
  IN_TRANSIT:             [BookingStatus.ARRIVED_AT_DESTINATION],
  ARRIVED_AT_DESTINATION: [BookingStatus.DELIVERY_VERIFICATION],
  DELIVERY_VERIFICATION:  [BookingStatus.DELIVERED],
  DELIVERED:              [BookingStatus.PAYMENT_PENDING, BookingStatus.COMPLETED],
  PAYMENT_PENDING:        [BookingStatus.COMPLETED],
  COMPLETED:              [],
  CANCELLED:              [],
  REJECTED:               [],
};


// Which roles can set which statuses
const STATUS_ROLE_PERMISSIONS: Partial<Record<BookingStatus, UserRole[]>> = {
  [BookingStatus.APPROVED]:               [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.AGENCY_STAFF],
  [BookingStatus.ASSIGNED]:               [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.AGENCY_STAFF],
  [BookingStatus.ACCEPTED]:               [UserRole.DRIVER],
  [BookingStatus.ARRIVED]:                [UserRole.DRIVER],
  [BookingStatus.PICKED]:              [UserRole.DRIVER],
  [BookingStatus.IN_TRANSIT]:             [UserRole.DRIVER],
  [BookingStatus.ARRIVED_AT_DESTINATION]: [UserRole.DRIVER],
  [BookingStatus.DELIVERY_VERIFICATION]:  [UserRole.DRIVER],
  [BookingStatus.DELIVERED]:              [UserRole.DRIVER],
  [BookingStatus.COMPLETED]:              [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.AGENCY_STAFF],
  [BookingStatus.CANCELLED]:              [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CUSTOMER, UserRole.AGENCY_STAFF],
  [BookingStatus.REJECTED]:               [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.DRIVER],
};

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── CREATE BOOKING (PRD §6) ──────────────────────────────────────────────
  /**
   * Customer, Agent, or Admin creates a booking.
   * Idempotency key prevents duplicate bookings on retry.
   * PRD §6: Multi-stop support, service type, cargo details.
   */
  async create(dto: CreateBookingDto, creatorId: string, idempotencyKey?: string) {
    // PRD §28: Idempotency — return existing if key already used
    if (idempotencyKey) {
      const existing = await this.prisma.booking.findUnique({
        where: { idempotencyKey },
        include: { stops: true },
      });
      if (existing) return existing;
    }

    // Ensure at least pickup + delivery stops provided
    if (!dto.stops || dto.stops.length < 2) {
      throw new BadRequestException('At least 2 stops required (pickup and delivery)');
    }

    // Generate unique reference
    let reference: string;
    let attempts = 0;
    do {
      reference = generateReference();
      attempts++;
      if (attempts > 10) throw new BadRequestException('Failed to generate unique reference');
    } while (await this.prisma.booking.findUnique({ where: { reference } }));

    const booking = await this.prisma.booking.create({
      data: {
        reference,
        customerId:     creatorId,
        agencyId:       dto.agencyId,
        serviceType:    dto.serviceType ?? ServiceType.COURIER,
        status:         BookingStatus.CREATED,
        totalPrice:     dto.totalPrice ?? 0,
        baseFare:       dto.baseFare ?? 0,
        distanceFare:   dto.distanceFare ?? 0,
        stopFare:       dto.stopFare ?? 0,
        surgeMultiplier: dto.surgeMultiplier ?? 1.0,
        estimatedDistKm: dto.estimatedDistKm ?? 0,
        idempotencyKey,
        stops: {
          create: dto.stops.map((stop, index) => ({
            sequence:    index + 1,
            address:     stop.address,
            latitude:    stop.latitude,
            longitude:   stop.longitude,
            landmark:    stop.landmark,
            contactName:  stop.contactName,
            contactPhone: stop.contactPhone,
            stopType:    stop.stopType,
          })),
        },
      },
      include: { stops: { orderBy: { sequence: 'asc' } } },
    });

    // PRD §40: Audit log
    await this.auditLog(creatorId, 'BOOKING_CREATED', 'booking', booking.id, {
      reference: booking.reference,
      serviceType: booking.serviceType,
    });

    return booking;
  }

  // ─── GET BOOKING (PRD §6) ─────────────────────────────────────────────────
  async findOne(id: string, requesterId?: string, requesterRole?: UserRole) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        stops:    { orderBy: { sequence: 'asc' } },
        driver:   {
          select: {
            id: true,
            rating: true,
            currentLatitude: true,
            currentLongitude: true,
            user: { select: { fullName: true, phone: true } },
          },
        },
        vehicle:  { select: { plateNumber: true, type: true, make: true, model: true } },
        payments: { orderBy: { createdAt: 'desc' }, take: 1 },
        invoice:  { select: { id: true, number: true, status: true, totalAmount: true } },
      },
    });

    if (!booking) throw new NotFoundException(`Booking not found`);

    // PRD §23: Scope — customers can only see their own bookings
    if (
      requesterRole === UserRole.CUSTOMER &&
      booking.customerId !== requesterId
    ) {
      throw new ForbiddenException('You can only view your own bookings');
    }

    return booking;
  }

  // ─── LIST BOOKINGS ────────────────────────────────────────────────────────

  // Customer: own bookings only
  async findByCustomer(customerId: string, page = 1, limit = 20, status?: BookingStatus) {
    const where: any = { customerId };
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          stops:  { orderBy: { sequence: 'asc' } },
          driver: { select: { user: { select: { fullName: true } } } },
        },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return { data, meta: { total, page, limit, lastPage: Math.ceil(total / limit) } };
  }

  // Driver: assigned trips only
  async findByDriver(driverId: string, page = 1, limit = 20, status?: BookingStatus) {
    const where: any = { driverId };
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { stops: { orderBy: { sequence: 'asc' } } },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return { data, meta: { total, page, limit, lastPage: Math.ceil(total / limit) } };
  }

  // Admin: all bookings with full filters
  async findAll(
    page = 1,
    limit = 20,
    filters: {
      status?: BookingStatus;
      serviceType?: ServiceType;
      agencyId?: string;
      driverId?: string;
      customerId?: string;
      from?: string;
      to?: string;
    } = {},
  ) {
    const where: any = {};
    if (filters.status)      where.status      = filters.status;
    if (filters.serviceType) where.serviceType = filters.serviceType;
    if (filters.agencyId)    where.agencyId    = filters.agencyId;
    if (filters.driverId)    where.driverId    = filters.driverId;
    if (filters.customerId)  where.customerId  = filters.customerId;
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = new Date(filters.from);
      if (filters.to)   where.createdAt.lte = new Date(filters.to);
    }

    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: Math.min(limit, 100),
        include: {
          stops:  { orderBy: { sequence: 'asc' } },
          driver: { select: { user: { select: { fullName: true, phone: true } } } },
          vehicle: { select: { plateNumber: true, type: true } },
        },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return { data, meta: { total, page, limit, lastPage: Math.ceil(total / limit) } };
  }

  // ─── UPDATE STATUS (PRD §6) ───────────────────────────────────────────────
  /**
   * Validates transition rules before updating status.
   * Every transition is audit-logged.
   */
  async updateStatus(
    id: string,
    newStatus: BookingStatus,
    actorId: string,
    actorRole: UserRole,
    reason?: string,
  ) {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException('Booking not found');

    // PRD §6: Validate allowed transition
    const allowed = ALLOWED_TRANSITIONS[booking.status] ?? [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${booking.status} to ${newStatus}`,
      );
    }

    // PRD §6: Validate role permission for this status
    const permittedRoles = STATUS_ROLE_PERMISSIONS[newStatus];
    if (permittedRoles && !permittedRoles.includes(actorRole)) {
      throw new ForbiddenException(
        `Role ${actorRole} cannot set status to ${newStatus}`,
      );
    }

    const updateData: any = { status: newStatus };

    // Set deliveredAt timestamp when marked DELIVERED
    if (newStatus === BookingStatus.DELIVERED) {
      updateData.deliveredAt = new Date();
    }

    const updated = await this.prisma.booking.update({
      where: { id },
      data: updateData,
      include: { stops: { orderBy: { sequence: 'asc' } } },
    });

    // PRD §40: Audit every status transition
    await this.auditLog(actorId, 'BOOKING_STATUS_UPDATED', 'booking', id, {
      from: booking.status,
      to: newStatus,
      reason,
    });

    return updated;
  }

  // ─── ASSIGN DRIVER (PRD §6, Admin only) ──────────────────────────────────
  async assignDriver(id: string, dto: AssignDriverDto, adminId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException('Booking not found');

    if (!([BookingStatus.APPROVED, BookingStatus.CREATED] as BookingStatus[])
        .includes(booking.status)) {
        throw new BadRequestException(
            `Cannot assign driver to booking with status ${booking.status}`,
        );
        }

    // PRD §17.1: Validate driver compliance before assignment
    const driver = await this.prisma.driver.findUnique({
      where: { id: dto.driverId },
      include: { vehicle: true },
    });
    if (!driver) throw new NotFoundException('Driver not found');
    if (driver.isBlacklisted) throw new BadRequestException('Driver is blacklisted');
    if (!driver.licenseVerified) throw new BadRequestException('Driver license not verified');

    // Check driver has no active conflicting trip
    const activeTrip = await this.prisma.booking.findFirst({
      where: {
        driverId: dto.driverId,
        status: {
          in: [
            BookingStatus.ACCEPTED,
            BookingStatus.ARRIVED,
            BookingStatus.PICKED,
            BookingStatus.IN_TRANSIT,
            BookingStatus.ARRIVED_AT_DESTINATION,
            BookingStatus.DELIVERY_VERIFICATION,
          ],
        },
      },
    });
    if (activeTrip) {
      throw new BadRequestException('Driver already has an active trip');
    }

    const updated = await this.prisma.booking.update({
      where: { id },
      data: {
        driverId:  dto.driverId,
        vehicleId: dto.vehicleId ?? driver.vehicle?.driverId ?? null,
        status:    BookingStatus.ASSIGNED,
      },
      include: { stops: true, driver: { select: { user: true } } },
    });

    await this.auditLog(adminId, 'DRIVER_ASSIGNED', 'booking', id, {
      driverId:  dto.driverId,
      vehicleId: dto.vehicleId,
    });

    return updated;
  }

  // ─── CANCEL BOOKING (PRD §6, §20) ────────────────────────────────────────
  /**
   * PRD §20: Cancellation rules differ by stage.
   * Customer cannot cancel after PICKED.
   * Admin can cancel at any stage.
   */
  async cancel(
    id: string,
    actorId: string,
    actorRole: UserRole,
    reason?: string,
  ) {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException('Booking not found');

    if (booking.status === BookingStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel a completed booking');
    }
    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Booking is already cancelled');
    }

    // PRD §20.1: Customer cannot cancel after PICKED
    if (actorRole === UserRole.CUSTOMER) {
      const blockedStatuses: BookingStatus[] = [
        BookingStatus.PICKED,
        BookingStatus.IN_TRANSIT,
        BookingStatus.ARRIVED_AT_DESTINATION,
        BookingStatus.DELIVERY_VERIFICATION,
        BookingStatus.DELIVERED,
      ];
      if (blockedStatuses.includes(booking.status)) {
        throw new ForbiddenException(
          'Cancellation not permitted after cargo has been picked up. Contact admin.',
        );
      }
    }

    const updated = await this.prisma.booking.update({
      where: { id },
      data: {
        status:             BookingStatus.CANCELLED,
        cancelledAt:        new Date(),
        cancelledBy:        actorId,
        cancellationReason: reason ?? 'No reason provided',
      },
    });

    await this.auditLog(actorId, 'BOOKING_CANCELLED', 'booking', id, {
      reason,
      cancelledBy: actorRole,
      previousStatus: booking.status,
    });

    return updated;
  }

  // ─── PRICE ESTIMATE (PRD §7, §19) ────────────────────────────────────────
  /**
   * Returns a real-time price estimate before booking confirmation.
   * PRD §7: No hidden fees — show customer total before confirming.
   */
  async estimatePrice(
    vehicleType: string,
    distanceKm: number,
    stopCount: number,
    surgeMultiplier = 1.0,
  ) {
    const rateCard = await this.prisma.rateCard.findFirst({
      where: { vehicleType: vehicleType as any, isActive: true },
    });

    if (!rateCard) {
      throw new NotFoundException(`No active rate card for vehicle type ${vehicleType}`);
    }

    const baseFare     = rateCard.baseFare;
    const distanceFare = distanceKm * rateCard.ratePerKm;
    const stopFare     = Math.max(0, stopCount - 1) * rateCard.perStopRate;
    const subtotal     = baseFare + distanceFare + stopFare;
    const totalPrice   = subtotal * surgeMultiplier;

    return {
      vehicleType,
      distanceKm,
      stopCount,
      baseFare,
      distanceFare,
      stopFare,
      surgeMultiplier,
      totalPrice: Math.round(totalPrice),
      currency: 'KES',
    };
  }

  // ─── ADMIN OVERRIDE STATUS (PRD §42) ─────────────────────────────────────
  /**
   * Admin can force any status regardless of normal transition rules.
   * Requires mandatory reason — logged in audit trail.
   */
  async adminOverrideStatus(
    id: string,
    newStatus: BookingStatus,
    adminId: string,
    reason: string,
  ) {
    if (!reason?.trim()) {
      throw new BadRequestException('Reason is mandatory for admin status override');
    }

    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException('Booking not found');

    const updated = await this.prisma.booking.update({
      where: { id },
      data: {
        status: newStatus,
        ...(newStatus === BookingStatus.DELIVERED && { deliveredAt: new Date() }),
      },
    });

    await this.auditLog(adminId, 'ADMIN_STATUS_OVERRIDE', 'booking', id, {
      from: booking.status,
      to: newStatus,
      reason,
    });

    return updated;
  }

  // ─── RATE BOOKING (PRD §18) ───────────────────────────────────────────────
  /**
   * Customer rates a completed booking within 48hr window.
   */
  async rateBooking(
    id: string,
    customerId: string,
    rating: number,
    comment?: string,
  ) {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException('Booking not found');

    if (booking.customerId !== customerId) {
      throw new ForbiddenException('You can only rate your own bookings');
    }

    if (booking.status !== BookingStatus.COMPLETED) {
      throw new BadRequestException('You can only rate completed bookings');
    }

    // PRD §18: 48-hour rating window
    if (booking.deliveredAt) {
      const hoursSinceDelivery =
        (Date.now() - new Date(booking.deliveredAt).getTime()) / (1000 * 60 * 60);
      if (hoursSinceDelivery > 48) {
        throw new BadRequestException('Rating window has closed (48 hours after delivery)');
      }
    }

    // Update driver average rating
    if (booking.driverId) {
      const driver = await this.prisma.driver.findUnique({ where: { id: booking.driverId } });
      if (driver) {
        const newRating = (driver.rating * driver.totalTrips + rating) / (driver.totalTrips + 1);
        await this.prisma.driver.update({
          where: { id: booking.driverId },
          data: { rating: Math.round(newRating * 10) / 10 },
        });
      }
    }

    await this.auditLog(customerId, 'BOOKING_RATED', 'booking', id, { rating, comment });

    return { message: 'Rating submitted successfully', rating };
  }

  // ─── AUDIT LOG HELPER (PRD §40) ───────────────────────────────────────────
  private async auditLog(
    userId: string,
    action: string,
    entityType: string,
    entityId: string,
    details?: object,
  ) {
    await this.prisma.auditLog.create({
      data: { userId, action, entityType, entityId, details },
    });
  }
}