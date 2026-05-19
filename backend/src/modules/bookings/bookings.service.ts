import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  BookingCapacitySource,
  BookingStatus,
  FreightTradeMode,
  RailCorridorCode,
  ServiceType,
  TradeDocumentStatus,
  VehicleStatus,
} from '@prisma/client';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateStatusDto, DRIVER_ALLOWED_TRANSITIONS } from './dto/update-status.dto';
import { AssignDriverDto } from './dto/assign-driver.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { RateBookingDto } from './dto/rate-booking.dto';
import { UpdateTradeControlDto } from './dto/update-trade-control.dto';
import { UpdateFreightMilestoneDto } from './dto/update-freight-milestone.dto';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { PaymentsService } from '../payments/payments.service';
import { InvoicesService } from '../invoices/invoices.service';
import { ContractsService } from '../contracts/contracts.service';
import { SurgePricingService } from '../surge-pricing/surge-pricing.service';
import { CapacityPlanningService } from '../capacity-planning/capacity-planning.service';

// ─── Status transition rules ──────────────────────────────────────────────────
// PRD §6 — complete 15-state lifecycle
// Only certain transitions are valid per role
// Admin can force any status (override mode)

const CANCELLABLE_BY_CUSTOMER: BookingStatus[] = [
  BookingStatus.CREATED,
  BookingStatus.SEARCHING,
  BookingStatus.APPROVED,
  BookingStatus.ASSIGNED,
  BookingStatus.ACCEPTED,
];

// Cancellation penalty threshold — PRD §20
const PENALTY_THRESHOLD_STATUS = BookingStatus.ACCEPTED;
const PENALTY_PERCENT = 0.10; // 10% of total price
const ESCROW_RELEASE_STATUSES: BookingStatus[] = [
  BookingStatus.DELIVERED,
  BookingStatus.COMPLETED,
];
const ADMIN_AUTO_REFUND_STATUSES: BookingStatus[] = [
  BookingStatus.CREATED,
  BookingStatus.SEARCHING,
  BookingStatus.APPROVED,
  BookingStatus.ASSIGNED,
];

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly invoicesService: InvoicesService,
    private readonly contractsService: ContractsService,
    private readonly surgePricingService: SurgePricingService,
    private readonly capacityPlanningService: CapacityPlanningService,
  ) {}

  // ─── CREATE ────────────────────────────────────────────────────────────────

  async create(customerId: string, dto: CreateBookingDto, requesterRole = 'CUSTOMER') {
    // Idempotency: if booking with this key already exists, return it
    const existing = await this.prisma.booking.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
      include: { stops: { orderBy: { sequence: 'asc' } } },
    });
    if (existing) return { booking: existing, idempotent: true };

    // Validate stops — need at least 2 (pickup + delivery)
    if (!dto.stops || dto.stops.length < 2) {
      throw new BadRequestException('At least 2 stops required: pickup and delivery');
    }

    this.validateStopStructure(dto.stops);
    this.validateRailContainerWorkflow(dto);

    await this.capacityPlanningService.enforceLimit({
      agencyId: dto.agencyId,
      serviceType: dto.serviceType,
      vehicleType: dto.vehicleType,
      cargoWeightKg: dto.cargoWeightKg,
    });

    // Calculate pricing from RateCard when available, otherwise allow a review flow
    // for customer-facing bookings where admin or marketplace pricing may follow later.
    const pricing = await this.resolveBookingPricing(dto, requesterRole);

    if (requesterRole === 'CORPORATE' && !pricing.pricingReviewRequired) {
      await this.contractsService.checkCredit(customerId, pricing.totalPrice);
    }

    // Generate unique reference
    const reference = await this.generateReference();

    const booking = await this.prisma.booking.create({
        data: {
          reference,
          customerId,
          agencyId: dto.agencyId ?? null,
          serviceType: dto.serviceType,
          capacitySource: dto.capacitySource ?? BookingCapacitySource.CFA_NETWORK,
          requiredVehicleType: dto.vehicleType,
          status: pricing.pricingReviewRequired ? BookingStatus.SEARCHING : BookingStatus.CREATED,
        idempotencyKey: dto.idempotencyKey,
        cargoType: dto.cargoType ?? null,
        cargoWeightKg: dto.cargoWeightKg ?? null,
        cargoDescription: dto.cargoDescription ?? null,
        specialInstructions: dto.specialInstructions ?? null,
        isScheduled: dto.isScheduled ?? false,
        tradeMode: dto.tradeMode ?? null,
        railCorridorCode: dto.railCorridorCode ?? null,
        originNode: dto.originNode ?? null,
        destinationNode: dto.destinationNode ?? null,
        containerReference: dto.containerReference ?? null,
        billOfLadingNumber: dto.billOfLadingNumber ?? null,
        idfNumber: dto.idfNumber ?? null,
        pacReady: dto.pacReady ?? false,
        customsStatus: dto.customsStatus ?? null,
        icmsStatus: dto.icmsStatus ?? null,
        baseFare: pricing.baseFare,
        distanceFare: pricing.distanceFare,
        stopFare: pricing.stopFare,
        surgeMultiplier: pricing.surgeMultiplier,
        totalPrice: pricing.totalPrice,
        estimatedDistKm: pricing.estimatedDistKm,
        stops: {
          create: dto.stops.map((s) => ({
            sequence: s.sequence,
            address: s.address,
            latitude: s.latitude,
            longitude: s.longitude,
            landmark: s.landmark ?? null,
            contactName: s.contactName,
            contactPhone: s.contactPhone,
            stopType: s.stopType,
          })),
        },
      },
      include: {
        stops: { orderBy: { sequence: 'asc' } },
        driver: { include: { user: { select: { id: true, fullName: true, phone: true } } } },
        vehicle: { select: { id: true, plateNumber: true, type: true } },
        _count: {
          select: {
            parcels: true,
            scanEvents: true,
            waybills: true,
          },
        },
      },
    });

    if (
      this.isRailContainerBooking(
        booking.serviceType,
        booking.requiredVehicleType,
        booking.tradeMode,
        booking.railCorridorCode,
        booking.containerReference,
      )
    ) {
      await this.ensureFreightMilestones(booking.id);
    }

    await this.writeAudit(customerId, 'BOOKING_CREATED', 'BOOKING', booking.id, {
      reference: booking.reference,
      serviceType: booking.serviceType,
      capacitySource: booking.capacitySource,
      tradeMode: booking.tradeMode,
      railCorridorCode: booking.railCorridorCode,
      customsStatus: booking.customsStatus,
      icmsStatus: booking.icmsStatus,
      totalPrice: booking.totalPrice,
      pricingReviewRequired: pricing.pricingReviewRequired,
    });

    if (requesterRole === 'CORPORATE') {
      try {
        await this.contractsService.syncCreditUsage(customerId);
      } catch {
        // Corporate booking creation should not fail if credit sync refresh needs retry.
      }
    }

    return { booking, idempotent: false };
  }

  // ─── LIST (Customer) ───────────────────────────────────────────────────────

  async listForCustomer(customerId: string, filters: {
    status?: BookingStatus;
    page?: number;
    limit?: number;
  }) {
    const { status, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where = {
      customerId,
      ...(status && { status }),
    };

    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          stops: { orderBy: { sequence: 'asc' }, take: 3 },
          driver: { include: { user: { select: { fullName: true, phone: true } } } },
          vehicle: { select: { plateNumber: true, type: true } },
          _count: {
            select: {
              parcels: true,
              scanEvents: true,
              waybills: true,
            },
          },
        },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return { bookings, total, page, limit, pages: Math.ceil(total / limit) };
  }

  // ─── LIST (Admin) ──────────────────────────────────────────────────────────

  async listForAdmin(filters: {
    status?: BookingStatus;
    serviceType?: ServiceType;
    customerId?: string;
    driverId?: string;
    agencyId?: string;
    page?: number;
    limit?: number;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const { status, serviceType, customerId, driverId, agencyId, page = 1, limit = 20, dateFrom, dateTo } = filters;
    const skip = (page - 1) * limit;

    const where: any = {
      ...(status && { status }),
      ...(serviceType && { serviceType }),
      ...(customerId && { customerId }),
      ...(driverId && { driverId }),
      ...(agencyId && { agencyId }),
      ...(dateFrom || dateTo) && {
        createdAt: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(dateTo) }),
        },
      },
    };

    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: Math.min(limit, 100),
        include: {
          stops: { orderBy: { sequence: 'asc' }, take: 2 },
          driver: { include: { user: { select: { fullName: true, phone: true } } } },
          vehicle: { select: { plateNumber: true, type: true } },
          escrow: { select: { status: true, amount: true } },
          freightMilestones: { orderBy: { sequence: 'asc' } },
        },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return { bookings, total, page, limit, pages: Math.ceil(total / limit) };
  }

  // ─── GET DETAIL ────────────────────────────────────────────────────────────

  async getById(bookingId: string, requesterId: string, requesterRole: string) {
    let booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        stops: { orderBy: { sequence: 'asc' } },
        driver: { include: { user: { select: { id: true, fullName: true, phone: true } } } },
        vehicle: true,
        payments: true,
        escrow: true,
        supportTickets: { orderBy: { createdAt: 'desc' }, take: 5 },
        freightMilestones: { orderBy: { sequence: 'asc' } },
        waybills: true,
        parcels: {
          select: {
            id: true,
            parcelId: true,
            status: true,
            currentVehicleId: true,
          },
        },
        _count: {
          select: {
            parcels: true,
            scanEvents: true,
            waybills: true,
          },
        },
      },
    });

    if (!booking) throw new NotFoundException('Booking not found');

    if (
      this.isRailContainerBooking(
        booking.serviceType,
        booking.requiredVehicleType,
        booking.tradeMode,
        booking.railCorridorCode,
        booking.containerReference,
      ) &&
      booking.freightMilestones.length === 0
    ) {
      await this.ensureFreightMilestones(booking.id);
      booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          stops: { orderBy: { sequence: 'asc' } },
          driver: { include: { user: { select: { id: true, fullName: true, phone: true } } } },
          vehicle: true,
          payments: true,
          escrow: true,
          supportTickets: { orderBy: { createdAt: 'desc' }, take: 5 },
          freightMilestones: { orderBy: { sequence: 'asc' } },
          waybills: true,
          parcels: {
            select: {
              id: true,
              parcelId: true,
              status: true,
              currentVehicleId: true,
            },
          },
          _count: {
            select: {
              parcels: true,
              scanEvents: true,
              waybills: true,
            },
          },
        },
      });
      if (!booking) throw new NotFoundException('Booking not found');
    }

    // Scope check: customers can only see their own bookings
    if (
      (requesterRole === 'CUSTOMER' ||
        requesterRole === 'CORPORATE' ||
        requesterRole === 'COURIER_COMPANY') &&
      booking.customerId !== requesterId
    ) {
      throw new ForbiddenException('Access denied');
    }
    // Drivers can only see their assigned bookings
    if (requesterRole === 'DRIVER') {
      const driver = await this.prisma.driver.findUnique({ where: { userId: requesterId } });
      if (!driver || booking.driverId !== driver.id) {
        throw new ForbiddenException('Access denied');
      }
    }

    return booking;
  }

  // ─── UPDATE STATUS (Driver) ────────────────────────────────────────────────

  async updateStatusByDriver(bookingId: string, driverId: string, dto: UpdateStatusDto) {
    const booking = await this.findOrThrow(bookingId);

    // Validate driver is assigned to this booking
    const driver = await this.prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver || booking.driverId !== driverId) {
      throw new ForbiddenException('You are not assigned to this booking');
    }

    // Validate transition
    const allowedNext = DRIVER_ALLOWED_TRANSITIONS[booking.status];
    if (!allowedNext || allowedNext !== dto.status) {
      throw new BadRequestException(
        `Invalid transition: ${booking.status} → ${dto.status}. Expected next: ${allowedNext ?? 'none'}`,
      );
    }

    // Delivery requires OTP verification + proof
    if (dto.status === BookingStatus.DELIVERED) {
      if (!dto.deliveryProofUrl) {
        throw new BadRequestException('Proof of delivery photo is required');
      }
      
      // Rate limiting check for OTP attempts
      if (booking.deliveryOtpLockedUntil && new Date() < booking.deliveryOtpLockedUntil) {
        throw new BadRequestException(
          `Delivery OTP verification is temporarily locked due to multiple failed attempts. Please try again later.`,
        );
      }
      
      // Verify OTP using bcrypt (security best practice)
      if (booking.deliveryOtp) {
        const isValidOtp = await bcrypt.compare(dto.deliveryOtp || '', booking.deliveryOtp);
        if (!isValidOtp) {
          const attempts = booking.deliveryOtpAttempts + 1;
          const maxAttempts = 5;
          
          if (attempts >= maxAttempts) {
            // Lock the booking for 15 minutes after 5 failed attempts
            const lockUntil = new Date(Date.now() + 15 * 60 * 1000);
            await this.prisma.booking.update({
              where: { id: bookingId },
              data: {
                deliveryOtpAttempts: attempts,
                deliveryOtpLockedUntil: lockUntil,
              },
            });
            throw new BadRequestException(
              `Invalid delivery OTP. Maximum attempts exceeded. Please try again in 15 minutes.`,
            );
          }
          
          // Update attempts counter
          await this.prisma.booking.update({
            where: { id: bookingId },
            data: { deliveryOtpAttempts: attempts },
          });
          
          throw new BadRequestException(
            `Invalid delivery OTP. Attempts remaining: ${maxAttempts - attempts}`,
          );
        }
      }
    }

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: dto.status,
        ...(dto.status === BookingStatus.DELIVERED && {
          deliveredAt: new Date(),
          deliveryProofUrl: dto.deliveryProofUrl,
        }),
      },
    });

    await this.writeAudit(driver.userId, 'BOOKING_STATUS_CHANGED', 'BOOKING', bookingId, {
      from: booking.status,
      to: dto.status,
      note: dto.note,
    });

    if (ESCROW_RELEASE_STATUSES.includes(dto.status)) {
      await this.paymentsService.releaseEscrowForBooking(
        bookingId,
        `Released after driver updated booking to ${dto.status}`,
      );
    }

    if (
      dto.status === BookingStatus.DELIVERED ||
      dto.status === BookingStatus.COMPLETED
    ) {
      try {
        await this.invoicesService.generateForBooking(bookingId, {
          actorId: driver.userId,
        });
      } catch {
        // Trip completion should not fail if downstream invoice generation needs retry.
      }
    }

    return updated;
  }

  // ─── UPDATE STATUS (Admin — any transition) ────────────────────────────────

  async updateStatusByAdmin(bookingId: string, adminId: string, dto: UpdateStatusDto) {
    const booking = await this.findOrThrow(bookingId);

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: dto.status,
        ...(dto.status === BookingStatus.DELIVERED && {
          deliveredAt: new Date(),
          deliveryProofUrl: dto.deliveryProofUrl ?? null,
        }),
        ...(dto.status === BookingStatus.COMPLETED && {
          // Payment must be confirmed before completing — enforce in payments flow
        }),
      },
    });

    await this.writeAudit(adminId, 'ADMIN_OVERRIDE', 'BOOKING', bookingId, {
      action: 'STATUS_OVERRIDE',
      from: booking.status,
      to: dto.status,
      note: dto.note,
    });

    if (ESCROW_RELEASE_STATUSES.includes(dto.status)) {
      await this.paymentsService.releaseEscrowForBooking(
        bookingId,
        `Released after admin updated booking to ${dto.status}`,
      );
    }

    if (
      dto.status === BookingStatus.DELIVERED ||
      dto.status === BookingStatus.COMPLETED
    ) {
      try {
        await this.invoicesService.generateForBooking(bookingId, {
          actorId: adminId,
        });
      } catch {
        // Booking lifecycle should not be blocked by a failed invoice side effect.
      }
    }

    return updated;
  }

  // ─── ASSIGN DRIVER (Admin) ─────────────────────────────────────────────────

  async updateTradeControlByAdmin(
    bookingId: string,
    adminId: string,
    dto: UpdateTradeControlDto,
  ) {
    const booking = await this.findOrThrow(bookingId);
    const isRailOrContainer = this.isRailContainerBooking(
      booking.serviceType,
      booking.requiredVehicleType,
      booking.tradeMode,
      booking.railCorridorCode,
      booking.containerReference,
    );

    if (!isRailOrContainer) {
      throw new BadRequestException(
        'Trade control can only be managed for rail or container workflows',
      );
    }

    const nextState = {
      tradeMode: dto.tradeMode ?? booking.tradeMode ?? null,
      railCorridorCode: dto.railCorridorCode ?? booking.railCorridorCode ?? null,
      originNode: (dto.originNode ?? booking.originNode ?? '').trim(),
      destinationNode: (dto.destinationNode ?? booking.destinationNode ?? '').trim(),
      containerReference: (dto.containerReference ?? booking.containerReference ?? '').trim(),
      billOfLadingNumber: (dto.billOfLadingNumber ?? booking.billOfLadingNumber ?? '').trim(),
      idfNumber: (dto.idfNumber ?? booking.idfNumber ?? '').trim(),
      pacReady: dto.pacReady ?? booking.pacReady ?? false,
      customsStatus: dto.customsStatus ?? booking.customsStatus ?? null,
      icmsStatus: dto.icmsStatus ?? booking.icmsStatus ?? null,
      specialInstructions:
        dto.specialInstructions?.trim() ?? booking.specialInstructions ?? null,
    };

    if (!nextState.tradeMode) {
      throw new BadRequestException(
        'Rail and container workflows must declare the trade mode before control updates',
      );
    }

    if (!nextState.originNode || !nextState.destinationNode) {
      throw new BadRequestException(
        'Rail and container workflows must define both an origin node and destination node',
      );
    }

    if (booking.serviceType === ServiceType.RAIL && !nextState.railCorridorCode) {
      throw new BadRequestException(
        'Rail / SGR workflows must keep an enabled corridor code on the booking',
      );
    }

    if (nextState.tradeMode !== FreightTradeMode.LOCAL) {
      if (!nextState.containerReference) {
        throw new BadRequestException(
          'Import, export, and transit flows require a container reference',
        );
      }
      if (!nextState.billOfLadingNumber) {
        throw new BadRequestException(
          'Import, export, and transit flows require a bill of lading number',
        );
      }
      if (!nextState.idfNumber) {
        throw new BadRequestException(
          'Import, export, and transit flows require an IDF number',
        );
      }
      if (
        !nextState.customsStatus ||
        nextState.customsStatus === TradeDocumentStatus.NOT_REQUIRED
      ) {
        throw new BadRequestException(
          'Import, export, and transit flows require a customs document status',
        );
      }
      if (
        !nextState.icmsStatus ||
        nextState.icmsStatus === TradeDocumentStatus.NOT_REQUIRED
      ) {
        throw new BadRequestException(
          'Import, export, and transit flows require an iCMS status',
        );
      }
    }

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        tradeMode: nextState.tradeMode,
        railCorridorCode: nextState.railCorridorCode,
        originNode: nextState.originNode,
        destinationNode: nextState.destinationNode,
        containerReference: nextState.containerReference || null,
        billOfLadingNumber: nextState.billOfLadingNumber || null,
        idfNumber: nextState.idfNumber || null,
        pacReady: nextState.pacReady,
        customsStatus: nextState.customsStatus,
        icmsStatus: nextState.icmsStatus,
        specialInstructions: nextState.specialInstructions,
      },
    });

    await this.ensureFreightMilestones(updated.id);
    await this.syncFreightMilestonesFromBooking(updated.id);

    await this.writeAudit(adminId, 'ADMIN_OVERRIDE', 'BOOKING', bookingId, {
      action: 'TRADE_CONTROL_UPDATED',
      tradeMode: updated.tradeMode,
      railCorridorCode: updated.railCorridorCode,
      customsStatus: updated.customsStatus,
      icmsStatus: updated.icmsStatus,
      pacReady: updated.pacReady,
    });

    return this.getById(bookingId, adminId, 'ADMIN');
  }

  async listFreightMilestonesByAdmin(bookingId: string, adminId: string) {
    await this.findOrThrow(bookingId);
    await this.ensureFreightMilestones(bookingId);
    await this.writeAudit(adminId, 'ADMIN_VIEW', 'BOOKING', bookingId, {
      action: 'FREIGHT_MILESTONES_VIEWED',
    });

    return this.prisma.freightMilestone.findMany({
      where: { bookingId },
      orderBy: { sequence: 'asc' },
    });
  }

  async updateFreightMilestoneByAdmin(
    bookingId: string,
    milestoneId: string,
    adminId: string,
    dto: UpdateFreightMilestoneDto,
  ) {
    await this.ensureFreightMilestones(bookingId);

    const milestone = await this.prisma.freightMilestone.findFirst({
      where: { id: milestoneId, bookingId },
    });
    if (!milestone) {
      throw new NotFoundException('Freight milestone not found');
    }

    const normalizedStatus = String(dto.status ?? '').trim().toUpperCase();
    if (!['PENDING', 'READY', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED'].includes(normalizedStatus)) {
      throw new BadRequestException('Invalid freight milestone status');
    }

    await this.prisma.freightMilestone.update({
      where: { id: milestoneId },
      data: {
        status: normalizedStatus,
        note: dto.note?.trim() || null,
        blockedReason:
          normalizedStatus === 'BLOCKED' ? dto.blockedReason?.trim() || 'Blocked by operations desk' : null,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        startedAt: normalizedStatus === 'IN_PROGRESS' && !milestone.startedAt ? new Date() : milestone.startedAt,
        completedAt: normalizedStatus === 'COMPLETED' ? new Date() : normalizedStatus === 'BLOCKED' ? null : milestone.completedAt,
        recordedBy: adminId,
      },
    });

    await this.writeAudit(adminId, 'ADMIN_OVERRIDE', 'BOOKING', bookingId, {
      action: 'FREIGHT_MILESTONE_UPDATED',
      milestoneId,
      milestoneCode: milestone.code,
      status: normalizedStatus,
      blockedReason: dto.blockedReason?.trim() || null,
    });

    return this.getById(bookingId, adminId, 'ADMIN');
  }

  async assignDriver(bookingId: string, adminId: string, dto: AssignDriverDto) {
    const booking = await this.findOrThrow(bookingId);

    if (!([BookingStatus.CREATED, BookingStatus.SEARCHING, BookingStatus.APPROVED] as string[]).includes(booking.status)) {
      throw new BadRequestException(
        `Cannot assign driver — booking status is ${booking.status}`,
      );
    }

    // Validate driver exists and is eligible
    const driver = await this.prisma.driver.findUnique({
      where: { id: dto.driverId },
    });
    if (!driver) throw new NotFoundException('Driver not found');
    if (driver.isBlacklisted) throw new BadRequestException('Driver is blacklisted');
    if (!driver.isAvailable) throw new BadRequestException('Driver is not available');

    // Validate vehicle exists
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: dto.vehicleId },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    if (vehicle.status !== VehicleStatus.ACTIVE) throw new BadRequestException('Vehicle is not active');
    if (String(vehicle.verificationStatus ?? '').toUpperCase() !== 'APPROVED') {
      throw new BadRequestException('Vehicle is pending fleet approval');
    }

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
      throw new BadRequestException(
        `Driver already has an active trip (${activeTrip.reference})`,
      );
    }

    // Generate delivery OTP and hash it before storing (security best practice)
    const deliveryOtpPlain = crypto.randomInt(1000, 9999).toString();
    const deliveryOtpHashed = await bcrypt.hash(deliveryOtpPlain, 10);

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        driverId: dto.driverId,
        vehicleId: dto.vehicleId,
        status: BookingStatus.ASSIGNED,
        deliveryOtp: deliveryOtpHashed,
        deliveryOtpAttempts: 0,
        deliveryOtpLockedUntil: null,
      },
      include: {
        driver: { include: { user: { select: { fullName: true, phone: true } } } },
        vehicle: { select: { plateNumber: true, type: true } },
      },
    });

    await this.writeAudit(adminId, 'BOOKING_ASSIGNED', 'BOOKING', bookingId, {
      driverId: dto.driverId,
      vehicleId: dto.vehicleId,
      note: dto.note,
    });

    return updated;
  }

  // ─── CANCEL ────────────────────────────────────────────────────────────────

  async cancelByCustomer(bookingId: string, customerId: string, dto: CancelBookingDto) {
    const booking = await this.findOrThrow(bookingId);

    if (booking.customerId !== customerId) {
      throw new ForbiddenException('Access denied');
    }

    if (!(CANCELLABLE_BY_CUSTOMER as string[]).includes(booking.status)) {
      throw new BadRequestException(
        `Cannot cancel at this stage (${booking.status}). Contact support.`,
      );
    }

    // Determine penalty — PRD §20
    const penaltyApplies = (
      [BookingStatus.ACCEPTED] as string[]
    ).includes(booking.status);

    const penaltyAmount = penaltyApplies
      ? parseFloat((booking.totalPrice * PENALTY_PERCENT).toFixed(2))
      : 0;

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledBy: customerId,
        cancellationReason: dto.reason,
      },
    });

    await this.writeAudit(customerId, 'BOOKING_CANCELLED', 'BOOKING', bookingId, {
      reason: dto.reason,
      previousStatus: booking.status,
      penaltyAmount,
    });

    const refund =
      penaltyAmount === 0
        ? await this.paymentsService.refundBookingPayment(
            bookingId,
            `Customer cancellation: ${dto.reason}`,
          )
        : {
            action: 'MANUAL_REVIEW_REQUIRED',
            penaltyAmount,
          };

    try {
      await this.contractsService.syncCreditUsage(customerId);
    } catch {
      // Cancellation should not fail if contract exposure sync needs retry.
    }

    return { booking: updated, penaltyAmount, refund };
  }

  async cancelByAdmin(bookingId: string, adminId: string, dto: CancelBookingDto) {
    const booking = await this.findOrThrow(bookingId);

    if (booking.status === BookingStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel a completed booking');
    }

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledBy: adminId,
        cancellationReason: dto.reason,
      },
    });

    await this.writeAudit(adminId, 'ADMIN_OVERRIDE', 'BOOKING', bookingId, {
      action: 'ADMIN_CANCEL',
      reason: dto.reason,
      penaltyOverrideNote: dto.penaltyOverrideNote,
    });

    const penaltyAmount = booking.status === PENALTY_THRESHOLD_STATUS
      ? parseFloat((booking.totalPrice * PENALTY_PERCENT).toFixed(2))
      : 0;
    const autoRefundEligible = ADMIN_AUTO_REFUND_STATUSES.includes(booking.status);

    const refund =
      autoRefundEligible
        ? await this.paymentsService.refundBookingPayment(
            bookingId,
            `Admin cancellation: ${dto.reason}`,
          )
        : {
            action: 'MANUAL_REVIEW_REQUIRED',
            penaltyAmount,
            note: dto.penaltyOverrideNote ?? null,
          };

    return { booking: updated, penaltyAmount, refund };
  }

  // ─── RATE BOOKING ──────────────────────────────────────────────────────────

  async rateBooking(bookingId: string, customerId: string, dto: RateBookingDto) {
    const booking = await this.findOrThrow(bookingId);

    if (booking.customerId !== customerId) {
      throw new ForbiddenException('Access denied');
    }
    if (booking.status !== BookingStatus.COMPLETED) {
      throw new BadRequestException('Can only rate completed bookings');
    }

    // 48-hour rating window — PRD §18
    const hoursElapsed =
      (Date.now() - booking.updatedAt.getTime()) / (1000 * 60 * 60);
    if (hoursElapsed > 48) {
      throw new BadRequestException('Rating window has closed (48 hours after completion)');
    }

    // Update driver average rating
    if (booking.driverId) {
      const driver = await this.prisma.driver.findUnique({
        where: { id: booking.driverId },
      });
      if (driver) {
        const newAvg = parseFloat(
          ((driver.rating * driver.totalTrips + dto.rating) / (driver.totalTrips + 1)).toFixed(2),
        );
        await this.prisma.driver.update({
          where: { id: booking.driverId },
          data: { rating: newAvg },
        });
      }
    }

    await this.writeAudit(customerId, 'BOOKING_STATUS_CHANGED', 'BOOKING', bookingId, {
      action: 'RATED',
      rating: dto.rating,
      comment: dto.comment,
    });

    return { message: 'Rating submitted successfully', rating: dto.rating };
  }

  // ─── DRIVER: List assigned trips ──────────────────────────────────────────

  async listForDriver(driverId: string, filters: { status?: BookingStatus; page?: number; limit?: number }) {
    const { status, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: any = {
      driverId,
      ...(status && { status }),
    };

    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          stops: { orderBy: { sequence: 'asc' } },
        },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return { bookings, total, page, limit, pages: Math.ceil(total / limit) };
  }

  // ─── DRIVER: Reject trip ──────────────────────────────────────────────────

  async rejectByDriver(bookingId: string, driverId: string, reason: string) {
    const booking = await this.findOrThrow(bookingId);

    if (booking.driverId !== driverId) {
      throw new ForbiddenException('You are not assigned to this booking');
    }
    if (booking.status !== BookingStatus.ASSIGNED) {
      throw new BadRequestException('Can only reject a booking in ASSIGNED status');
    }

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.SEARCHING,
        driverId: null,
        vehicleId: null,
      },
    });

    // Penalise driver acceptance rate
    const driver = await this.prisma.driver.findUnique({ where: { id: driverId } });
    if (driver && driver.totalTrips > 0) {
      const newRate = parseFloat(
        ((driver.acceptanceRate * driver.totalTrips) / (driver.totalTrips + 1)).toFixed(2),
      );
      await this.prisma.driver.update({
        where: { id: driverId },
        data: { acceptanceRate: newRate },
      });
    }

    await this.writeAudit(driver?.userId ?? driverId, 'BOOKING_STATUS_CHANGED', 'BOOKING', bookingId, {
      action: 'DRIVER_REJECTED',
      reason,
    });

    return updated;
  }

  // ─── PRICING ENGINE ───────────────────────────────────────────────────────

  private async resolveBookingPricing(dto: CreateBookingDto, requesterRole: string) {
    try {
      return {
        ...(await this.calculatePrice(dto)),
        pricingReviewRequired: false,
      };
    } catch (error) {
      if (!this.canDeferPricingReview(error, requesterRole)) {
        throw error;
      }

      return {
        baseFare: 0,
        distanceFare: 0,
        stopFare: 0,
        surgeMultiplier: 1,
        totalPrice: 0,
        estimatedDistKm: this.estimateStopsDistance(dto),
        surgeBreakdown: null,
        pricingReviewRequired: true,
      };
    }
  }

  private canDeferPricingReview(error: unknown, requesterRole: string) {
    if (!(error instanceof BadRequestException)) {
      return false;
    }

    if (!['CUSTOMER', 'CORPORATE'].includes(requesterRole)) {
      return false;
    }

    const response = error.getResponse();
    const message =
      typeof response === 'string'
        ? response
        : Array.isArray((response as { message?: unknown }).message)
          ? (response as { message: string[] }).message.join(' ')
          : String((response as { message?: unknown }).message ?? '');

    return message.toLowerCase().includes('no active rate card');
  }

  private estimateStopsDistance(dto: CreateBookingDto) {
    const first = dto.stops[0];
    const last = dto.stops[dto.stops.length - 1];

    return this.haversineKm(first.latitude, first.longitude, last.latitude, last.longitude);
  }

  private async calculatePrice(dto: CreateBookingDto) {
    // Look up rate card for this vehicle + service type
    const rateCard = await this.prisma.rateCard.findFirst({
      where: {
        vehicleType: dto.vehicleType,
        serviceType: dto.serviceType,
        isActive: true,
      },
    });

    if (!rateCard) {
      throw new BadRequestException(
        `No active rate card for vehicle type ${dto.vehicleType} + service ${dto.serviceType}`,
      );
    }

    // Estimate distance (haversine between first and last stop)
    const first = dto.stops[0];
    const last = dto.stops[dto.stops.length - 1];
    const estimatedDistKm = this.haversineKm(
      first.latitude, first.longitude,
      last.latitude, last.longitude,
    );

    const effectiveDist = Math.max(estimatedDistKm, rateCard.minDistance);
    const baseFare = rateCard.baseFare;
    const distanceFare = parseFloat((effectiveDist * rateCard.ratePerKm).toFixed(2));
    const stopCount = Math.max(0, dto.stops.length - 2); // intermediate stops only
    const stopFare = parseFloat((stopCount * rateCard.perStopRate).toFixed(2));
    const surgeContext = await this.surgePricingService.resolveMultiplierForStops(
      dto.stops.map((stop) => ({
        latitude: stop.latitude,
        longitude: stop.longitude,
      })),
    );
    const surgeMultiplier = parseFloat(
      (
        rateCard.surgeMultiplier *
        surgeContext.zoneMultiplier *
        surgeContext.peakHourMultiplier
      ).toFixed(2),
    );

    const totalPrice = parseFloat(
      ((baseFare + distanceFare + stopFare) * surgeMultiplier).toFixed(2),
    );

    return {
      baseFare,
      distanceFare,
      stopFare,
      surgeMultiplier,
      totalPrice,
      estimatedDistKm,
      surgeBreakdown: surgeContext,
    };
  }

  // ─── HELPERS ─────────────────────────────────────────────────────────────

  private async findOrThrow(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException(`Booking ${bookingId} not found`);
    return booking;
  }

  private async writeAudit(
    userId: string,
    action: string,
    entityType: string,
    entityId: string,
    details?: Record<string, any>,
  ) {
    try {
      // Only write if userId is a valid user — skip for system events
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) return;
      await this.prisma.auditLog.create({
        data: { userId, action, entityType, entityId, details: details ?? {} },
      });
    } catch {
      // Audit must never crash the main flow
    }
  }

  private async generateReference(): Promise<string> {
    const ref = 'ZT-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    const exists = await this.prisma.booking.findUnique({ where: { reference: ref } });
    return exists ? this.generateReference() : ref;
  }

  private validateRailContainerWorkflow(dto: CreateBookingDto) {
    const isContainerWorkflow = this.isRailContainerBooking(
      dto.serviceType,
      dto.vehicleType,
      dto.tradeMode,
      dto.railCorridorCode,
      dto.containerReference,
    );

    if (!isContainerWorkflow) {
      return;
    }

    if (!dto.tradeMode) {
      throw new BadRequestException(
        'Container and rail bookings must declare whether the move is local, import, export, or transit.',
      );
    }

    if (!dto.originNode?.trim() || !dto.destinationNode?.trim()) {
      throw new BadRequestException(
        'Container and rail bookings must define the origin node and destination node.',
      );
    }

    if (dto.serviceType === ServiceType.RAIL && !dto.railCorridorCode) {
      throw new BadRequestException(
        'Rail / SGR bookings must select an enabled corridor before creation.',
      );
    }

    if (dto.tradeMode === FreightTradeMode.LOCAL) {
      return;
    }

    if (!dto.containerReference?.trim()) {
      throw new BadRequestException(
        'Import, export, and transit rail/container bookings require a container reference.',
      );
    }

    if (!dto.billOfLadingNumber?.trim()) {
      throw new BadRequestException(
        'Import, export, and transit bookings require a bill of lading number.',
      );
    }

    if (!dto.idfNumber?.trim()) {
      throw new BadRequestException(
        'Import, export, and transit bookings require an IDF number.',
      );
    }

    if (!dto.customsStatus || dto.customsStatus === TradeDocumentStatus.NOT_REQUIRED) {
      throw new BadRequestException(
        'Import, export, and transit bookings must declare the customs document status.',
      );
    }

    if (!dto.icmsStatus || dto.icmsStatus === TradeDocumentStatus.NOT_REQUIRED) {
      throw new BadRequestException(
        'Import, export, and transit bookings must declare the iCMS release status.',
      );
    }
  }

  private isRailContainerBooking(
    serviceType: ServiceType,
    vehicleType?: string | null,
    tradeMode?: FreightTradeMode | null,
    railCorridorCode?: RailCorridorCode | null,
    containerReference?: string | null,
  ) {
    return (
      serviceType === ServiceType.RAIL ||
      vehicleType === 'CONTAINER_20FT' ||
      vehicleType === 'CONTAINER_40FT' ||
      tradeMode != null ||
      railCorridorCode != null ||
      Boolean(containerReference)
    );
  }

  private buildFreightMilestoneTemplates(booking: {
    serviceType: ServiceType;
    tradeMode?: FreightTradeMode | null;
    railCorridorCode?: string | null;
    originNode?: string | null;
    destinationNode?: string | null;
    customsStatus?: TradeDocumentStatus | null;
    icmsStatus?: TradeDocumentStatus | null;
    pacReady?: boolean | null;
  }) {
    const templates = [
      {
        code: 'BOOKING_CONFIRMED',
        title: 'Booking confirmed',
        nodeLabel: booking.originNode ?? null,
        status: 'COMPLETED',
      },
      {
        code: 'DOCUMENT_PACK',
        title: 'Trade document pack',
        nodeLabel: booking.originNode ?? null,
        status:
          booking.tradeMode && booking.tradeMode !== FreightTradeMode.LOCAL
            ? booking.customsStatus === TradeDocumentStatus.CLEARED ||
              booking.customsStatus === TradeDocumentStatus.SUBMITTED ||
              booking.customsStatus === TradeDocumentStatus.READY
              ? 'READY'
              : 'PENDING'
            : 'READY',
      },
      {
        code: 'CUSTOMS_CLEARANCE',
        title: 'Customs and release control',
        nodeLabel: booking.originNode ?? null,
        status:
          booking.tradeMode && booking.tradeMode !== FreightTradeMode.LOCAL
            ? booking.customsStatus === TradeDocumentStatus.CLEARED
              ? 'COMPLETED'
              : booking.customsStatus === TradeDocumentStatus.HOLD
              ? 'BLOCKED'
              : booking.customsStatus === TradeDocumentStatus.SUBMITTED
              ? 'IN_PROGRESS'
              : 'PENDING'
            : 'READY',
      },
      {
        code: 'PAC_RELEASE',
        title: 'PAC / gate release',
        nodeLabel: booking.originNode ?? null,
        status: booking.pacReady ? 'READY' : 'PENDING',
      },
      {
        code: 'ORIGIN_HANDOFF',
        title: booking.serviceType === ServiceType.RAIL ? 'Port / terminal handoff' : 'Origin gate-out',
        nodeLabel: booking.originNode ?? null,
        status: 'PENDING',
      },
      {
        code: booking.serviceType === ServiceType.RAIL ? 'RAIL_LINEHAUL' : 'ROAD_LINEHAUL',
        title: booking.serviceType === ServiceType.RAIL ? 'Rail line-haul' : 'Container line-haul',
        nodeLabel: booking.serviceType === ServiceType.RAIL ? booking.railCorridorCode ?? null : null,
        status:
          booking.icmsStatus === TradeDocumentStatus.CLEARED
            ? 'READY'
            : booking.icmsStatus === TradeDocumentStatus.HOLD
            ? 'BLOCKED'
            : 'PENDING',
      },
      {
        code: booking.serviceType === ServiceType.RAIL ? 'ICD_OFFLOAD' : 'DESTINATION_GATE_IN',
        title: booking.serviceType === ServiceType.RAIL ? 'ICD / terminal offload' : 'Destination gate-in',
        nodeLabel: booking.destinationNode ?? null,
        status: 'PENDING',
      },
      {
        code: 'LAST_MILE_DISPATCH',
        title: 'Last-mile dispatch',
        nodeLabel: booking.destinationNode ?? null,
        status: 'PENDING',
      },
      {
        code: 'DELIVERY_CONFIRMATION',
        title: 'Delivery confirmation',
        nodeLabel: booking.destinationNode ?? null,
        status: 'PENDING',
      },
    ];

    return templates.map((template, index) => ({
      sequence: index + 1,
      ...template,
    }));
  }

  private async ensureFreightMilestones(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        serviceType: true,
        requiredVehicleType: true,
        tradeMode: true,
        railCorridorCode: true,
        containerReference: true,
        originNode: true,
        destinationNode: true,
        customsStatus: true,
        icmsStatus: true,
        pacReady: true,
        freightMilestones: {
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (
      !this.isRailContainerBooking(
        booking.serviceType,
        booking.requiredVehicleType,
        booking.tradeMode,
        booking.railCorridorCode,
        booking.containerReference,
      )
    ) {
      return;
    }

    if (booking.freightMilestones.length > 0) {
      return;
    }

    const templates = this.buildFreightMilestoneTemplates(booking);
    await this.prisma.freightMilestone.createMany({
      data: templates.map((template) => ({
        bookingId,
        sequence: template.sequence,
        code: template.code,
        title: template.title,
        nodeLabel: template.nodeLabel,
        status: template.status,
      })),
    });
  }

  private async syncFreightMilestonesFromBooking(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        serviceType: true,
        tradeMode: true,
        railCorridorCode: true,
        originNode: true,
        destinationNode: true,
        customsStatus: true,
        icmsStatus: true,
        pacReady: true,
      },
    });

    if (!booking) {
      return;
    }

    const templates = this.buildFreightMilestoneTemplates(booking);
    for (const template of templates) {
      await this.prisma.freightMilestone.updateMany({
        where: {
          bookingId,
          code: template.code,
          status: { in: ['PENDING', 'READY', 'BLOCKED'] },
        },
        data: {
          nodeLabel: template.nodeLabel,
          status: template.status,
        },
      });
    }
  }

  private validateStopStructure(
    stops: Array<{ sequence: number; stopType: string }>,
  ) {
    const ordered = [...stops].sort((left, right) => left.sequence - right.sequence);
    const hasPickupLike = ordered.some((stop) =>
      ['PICKUP', 'LOAD'].includes(String(stop.stopType).trim().toUpperCase()),
    );
    const hasDeliveryLike = ordered.some((stop) =>
      ['DELIVERY', 'DROPOFF', 'UNLOAD'].includes(
        String(stop.stopType).trim().toUpperCase(),
      ),
    );

    if (!hasPickupLike || !hasDeliveryLike) {
      throw new BadRequestException(
        'Bookings must include at least one pickup or load stop and one delivery or unload stop.',
      );
    }
  }

  private haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return parseFloat((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));
  }

  private toRad(deg: number) { return (deg * Math.PI) / 180; }
}
