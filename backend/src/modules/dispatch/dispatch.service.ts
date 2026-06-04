import { Injectable, BadRequestException, NotFoundException, Logger, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DriverMatchingService } from '../drivers/matching/matching.service';
import { BookingStatus, DriverAssignmentStatus, Driver } from '@prisma/client';

/**
 * Module 5: Dispatch Service (PRD §16-18)
 * 
 * Central orchestration layer for driver assignment workflow:
 * 1. Call MatchingService to find suitable drivers
 * 2. Implement fallback logic (expand radius → retry → notify → manual)
 * 3. Create DriverAssignment records (audit trail)
 * 4. Trigger events for integration with other modules
 * 5. Handle manual overrides from ops team
 */
@Injectable()
export class DispatchService {
  private readonly logger = new Logger(DispatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly matchingService: DriverMatchingService,
  ) {}

  /**
   * Main dispatch orchestration: attempt assignment with fallback logic
   * PRD §16.3: "Fallback logic: expand radius → retry → notify dispatch team → manual assign"
   * 
   * @param bookingId - Booking to dispatch
   * @param options - Configuration for matching
   * @returns DriverAssignment if successful, or status if manual intervention needed
   */
  async assignDriver(
    bookingId: string,
    options: {
      initialRadiusKm?: number;
      minRating?: number;
      maxAttempts?: number;
      notifyOpsOnFailure?: boolean;
    } = {},
  ) {
    const {
      initialRadiusKm = 10,
      minRating = 3.5,
      maxAttempts = 3,
      notifyOpsOnFailure = true,
    } = options;

    // Load booking with stops and required vehicle info
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        stops: { take: 1 }, // Get pickup location
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking ${bookingId} not found`);
    }

    if (!booking.stops || booking.stops.length === 0) {
      throw new BadRequestException(`Booking ${bookingId} has no stops/pickup location`);
    }

    // Prevent reassignment if already assigned
    if (booking.driverId && booking.status === BookingStatus.ASSIGNED) {
      throw new ConflictException(`Booking ${bookingId} is already assigned to driver ${booking.driverId}`);
    }

    const pickupStop = booking.stops[0];

    // Implement fallback logic: attempt matching with increasing radius
    let currentRadius = initialRadiusKm;
    let matchedDrivers: any[] = [];

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      this.logger.debug(
        `[Dispatch] Attempt ${attempt}/${maxAttempts} for booking ${bookingId} with radius ${currentRadius}km`,
      );

      try {
        // Call matching service with current radius
        matchedDrivers = await this.matchingService.findForBooking(bookingId, {
          radiusKm: currentRadius,
          minRating: minRating,
          maxResults: 10,
        }) as any;

        if (matchedDrivers.length > 0) {
          this.logger.log(
            `[Dispatch] Found ${matchedDrivers.length} matches for booking ${bookingId} on attempt ${attempt}`,
          );
          break; // Success - exit fallback loop
        }

        // No matches found - expand radius for next attempt
        currentRadius = currentRadius * 1.5; // 50% radius expansion per PRD §7
      } catch (error) {
        this.logger.error(
          `[Dispatch] Matching error on attempt ${attempt}: ${error.message}`,
        );
        // Continue to next attempt despite error
      }
    }

    if (matchedDrivers.length === 0) {
      this.logger.warn(
        `[Dispatch] No drivers matched for booking ${bookingId} after ${maxAttempts} attempts`,
      );

      if (notifyOpsOnFailure) {
        // Notify dispatch team that manual intervention needed
        await this.notifyDispatchTeamManualIntervention(bookingId, {
          reason: `Failed to find drivers after ${maxAttempts} fallback attempts (max radius: ${currentRadius}km)`,
          cargoWeightKg: booking.cargoWeightKg,
          vehicleType: booking.requiredVehicleType,
          maxRadius: currentRadius,
        });
      }

      return {
        status: 'MANUAL_INTERVENTION_REQUIRED',
        reason: `Failed to match drivers. Manual assignment required by ops team.`,
        bookingId,
      };
    }

    // Assign first matched driver (highest priority/nearest)
    const selectedDriver = matchedDrivers[0];

    // Create DriverAssignment record with audit trail
    const assignment = await this.prisma.driverAssignment.create({
      data: {
        bookingId,
        driverId: selectedDriver.driverId,
        vehicleId: selectedDriver.vehicle?.id,
        status: DriverAssignmentStatus.OFFERED,
        matchScore: this.calculateMatchScore(selectedDriver),
        priorityScore: 100 - matchedDrivers.indexOf(selectedDriver), // Descending priority
        distanceKm: selectedDriver.distanceKm,
        estimatedArrivalMinutes: Math.ceil(selectedDriver.distanceKm / 50 * 60), // Assume 50km/h avg
        radiusKmAtOffer: currentRadius,
        attemptNumber: maxAttempts - (3 - Math.ceil(currentRadius / initialRadiusKm)),
      },
      include: {
        driver: { include: { user: true } },
        vehicle: true,
      },
    });

    this.logger.log(
      `[Dispatch] Assignment created: booking=${bookingId}, driver=${selectedDriver.driverId}, attempt=${assignment.attemptNumber}`,
    );

    // Update booking with assigned driver and pending status
    await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        driverId: selectedDriver.driverId,
        vehicleId: selectedDriver.vehicle?.id,
        assignedAt: new Date(),
        status: BookingStatus.ASSIGNED,
      },
    });

    // TODO: Emit event for other modules (tracking, notifications, etc)
    // this.eventEmitter.emit('booking.assigned', {...});

    return assignment;
  }

  /**
   * Expand search radius and retry matching (fallback logic)
   * Called when initial assignment fails
   * 
   * @param bookingId 
   * @param currentRadius 
   * @returns 
   */
  async expandRadiusRetry(bookingId: string, currentRadius: number = 10) {
    const expandedRadius = currentRadius * 1.5;

    this.logger.debug(
      `[Dispatch] Expanding radius for booking ${bookingId}: ${currentRadius}km → ${expandedRadius}km`,
    );

    // Retry matching with expanded radius
    return this.assignDriver(bookingId, {
      initialRadiusKm: expandedRadius,
      maxAttempts: 1, // Only one attempt with expanded radius
    });
  }

  /**
   * Manual assignment by ops team (override auto-matching)
   * PRD §16.4: "Ops team can manually assign drivers when auto-matching fails"
   * 
   * @param bookingId 
   * @param driverId 
   * @param staffId - Admin/ops staff performing override
   * @param reason - Reason for manual override
   * @returns DriverAssignment
   */
  async manualAssign(
    bookingId: string,
    driverId: string,
    staffId: string,
    reason: string,
  ) {
    // Verify booking exists
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException(`Booking ${bookingId} not found`);
    }

    // Verify driver exists and is online/available
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      include: { vehicle: true },
    });

    if (!driver) {
      throw new NotFoundException(`Driver ${driverId} not found`);
    }

    if (!driver.isOnline || !driver.isAvailable) {
      throw new BadRequestException(
        `Driver ${driverId} is not online/available for assignment`,
      );
    }

    // Create manual assignment record
    const assignment = await this.prisma.driverAssignment.create({
      data: {
        bookingId,
        driverId,
        vehicleId: driver.vehicle?.id,
        status: DriverAssignmentStatus.OFFERED,
        matchScore: 100, // Manual override gets max score
        manuallyOfferedBy: staffId,
        manuallyOfferedAt: new Date(),
      },
      include: {
        driver: { include: { user: true } },
        vehicle: true,
      },
    });

    this.logger.log(
      `[Dispatch] Manual assignment: booking=${bookingId}, driver=${driverId}, staff=${staffId}, reason="${reason}"`,
    );

    // Update booking
    await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        driverId,
        vehicleId: driver.vehicle?.id,
        assignedAt: new Date(),
        manuallyAssignedBy: staffId,
        manuallyAssignedAt: new Date(),
        status: BookingStatus.ASSIGNED,
      },
    });

    // Emit event
    // TODO: Emit event for other modules
    // this.eventEmitter.emit('booking.manually-assigned', {...});

    return assignment;
  }

  /**
   * Handle driver acceptance of assignment offer
   * Transitions: OFFERED → ACCEPTED
   * 
   * @param assignmentId 
   * @param driverId - For verification
   * @returns Updated DriverAssignment
   */
  async acceptAssignment(assignmentId: string, driverId: string) {
    const assignment = await this.prisma.driverAssignment.findUnique({
      where: { id: assignmentId },
      include: { booking: true },
    });

    if (!assignment) {
      throw new NotFoundException(`Assignment ${assignmentId} not found`);
    }

    if (assignment.driverId !== driverId) {
      throw new BadRequestException(
        `Driver ${driverId} cannot accept assignment for driver ${assignment.driverId}`,
      );
    }

    if (assignment.status !== DriverAssignmentStatus.OFFERED) {
      throw new ConflictException(
        `Assignment ${assignmentId} is in ${assignment.status} state, cannot accept`,
      );
    }

    // Update assignment
    const updated = await this.prisma.driverAssignment.update({
      where: { id: assignmentId },
      data: {
        status: DriverAssignmentStatus.ACCEPTED,
        acceptedAt: new Date(),
      },
      include: {
        driver: { include: { user: true } },
        booking: true,
      },
    });

    // Update booking status
    await this.prisma.booking.update({
      where: { id: assignment.bookingId },
      data: {
        acceptedAt: new Date(),
        status: BookingStatus.ACCEPTED,
      },
    });

    this.logger.log(
      `[Dispatch] Assignment accepted: assignmentId=${assignmentId}, driverId=${driverId}`,
    );

    // TODO: Emit event for other modules
    // this.eventEmitter.emit('driver.accepted-assignment', {...});

    return updated;
  }

  /**
   * Handle driver rejection of assignment offer
   * Transitions: OFFERED → REJECTED
   * Triggers reassignment logic
   * 
   * @param assignmentId 
   * @param driverId - For verification
   * @param reason - Rejection reason
   * @returns Updated DriverAssignment or new assignment
   */
  async rejectAssignment(assignmentId: string, driverId: string, reason: string) {
    const assignment = await this.prisma.driverAssignment.findUnique({
      where: { id: assignmentId },
      include: { booking: true },
    });

    if (!assignment) {
      throw new NotFoundException(`Assignment ${assignmentId} not found`);
    }

    if (assignment.driverId !== driverId) {
      throw new BadRequestException(
        `Driver ${driverId} cannot reject assignment for driver ${assignment.driverId}`,
      );
    }

    if (assignment.status !== DriverAssignmentStatus.OFFERED) {
      throw new ConflictException(
        `Assignment ${assignmentId} is in ${assignment.status} state, cannot reject`,
      );
    }

    // Update assignment
    const updated = await this.prisma.driverAssignment.update({
      where: { id: assignmentId },
      data: {
        status: DriverAssignmentStatus.REJECTED,
        rejectedAt: new Date(),
        rejectionReason: reason,
      },
    });

    this.logger.log(
      `[Dispatch] Assignment rejected: assignmentId=${assignmentId}, driverId=${driverId}, reason="${reason}"`,
    );

    // TODO: Emit event for other modules
    // this.eventEmitter.emit('driver.rejected-assignment', {...});

    // TODO: Implement auto-reassignment logic or notify ops
    // For now, return rejection - ops team will need to reassign

    return updated;
  }

  /**
   * Reassign driver after rejection or no-show
   * Creates new DriverAssignment record
   * 
   * @param bookingId 
   * @param newDriverId 
   * @param reason - Reason for reassignment
   * @returns New DriverAssignment
   */
  async reassignDriver(bookingId: string, newDriverId: string, reason: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException(`Booking ${bookingId} not found`);
    }

    const newDriver = await this.prisma.driver.findUnique({
      where: { id: newDriverId },
      include: { vehicle: true },
    });

    if (!newDriver) {
      throw new NotFoundException(`Driver ${newDriverId} not found`);
    }

    // Mark old assignment as REASSIGNED
    if (booking.driverId) {
      const oldAssignment = await this.prisma.driverAssignment.findFirst({
        where: {
          bookingId,
          driverId: booking.driverId,
          status: DriverAssignmentStatus.OFFERED,
        },
      });

      if (oldAssignment) {
        await this.prisma.driverAssignment.update({
          where: { id: oldAssignment.id },
          data: {
            status: DriverAssignmentStatus.REASSIGNED,
            reassignedAt: new Date(),
          },
        });
      }
    }

    // Create new assignment
    const newAssignment = await this.prisma.driverAssignment.create({
      data: {
        bookingId,
        driverId: newDriverId,
        vehicleId: newDriver.vehicle?.id,
        status: DriverAssignmentStatus.OFFERED,
      },
      include: {
        driver: { include: { user: true } },
        vehicle: true,
      },
    });

    // Update booking
    await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        driverId: newDriverId,
        vehicleId: newDriver.vehicle?.id,
      },
    });

    this.logger.log(
      `[Dispatch] Reassignment: bookingId=${bookingId}, oldDriver=${booking.driverId}, newDriver=${newDriverId}, reason="${reason}"`,
    );

    // TODO: Emit event for other modules
    // this.eventEmitter.emit('booking.reassigned', {...});

    return newAssignment;
  }

  /**
   * Get dispatch status and audit trail for a booking
   * Returns assignment history, current status, matching info
   * 
   * @param bookingId 
   * @returns Dispatch history and current status
   */
  async getDispatchStatus(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        driver: { include: { user: true } },
        vehicle: true,
        assignments: {
          orderBy: { createdAt: 'desc' },
          include: {
            driver: { include: { user: true } },
            vehicle: true,
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking ${bookingId} not found`);
    }

    return {
      bookingId,
      bookingStatus: booking.status,
      currentDriver: booking.driver ? {
        id: booking.driver.id,
        name: booking.driver.user.fullName,
        phone: booking.driver.user.phone,
        rating: booking.driver.rating,
      } : null,
      currentVehicle: booking.vehicle ? {
        id: booking.vehicle.id,
        plateNumber: booking.vehicle.plateNumber,
        type: booking.vehicle.type,
      } : null,
      dispatchTimeline: {
        assignedAt: booking.assignedAt,
        acceptedAt: booking.acceptedAt,
        manuallyAssignedAt: booking.manuallyAssignedAt,
      },
      assignmentHistory: booking.assignments.map((a) => ({
        id: a.id,
        status: a.status,
        driverId: a.driverId,
        driverName: a.driver.user.fullName,
        matchScore: a.matchScore,
        distanceKm: a.distanceKm,
        offeredAt: a.offeredAt,
        acceptedAt: a.acceptedAt,
        rejectedAt: a.rejectedAt,
        rejectionReason: a.rejectionReason,
        manuallyOfferedBy: a.manuallyOfferedBy,
      })),
    };
  }

  /**
   * Notify dispatch/ops team that manual intervention is needed
   * Called when all automated fallback attempts fail
   * 
   * @param bookingId 
   * @param context - Additional context about why manual intervention needed
   */
  private async notifyDispatchTeamManualIntervention(
    bookingId: string,
    context: {
      reason: string;
      cargoWeightKg?: number;
      vehicleType?: string;
      maxRadius?: number;
    },
  ) {
    this.logger.warn(
      `[Dispatch] Manual intervention needed for booking ${bookingId}: ${context.reason}`,
    );

    // TODO: Integrate with notification system
    // - Send email to ops team
    // - Create ticket in ops dashboard
    // - Send SMS alert to dispatch manager

    // TODO: Emit event for other modules
    // this.eventEmitter.emit('dispatch.manual-intervention-required', {...});
  }

  /**
   * Calculate overall match score for a driver
   * PRD §7: Matching considers distance, rating, acceptance rate, completion rate
   * 
   * @param driver - Matched driver data
   * @returns Score 0-100
   */
  private calculateMatchScore(driver: any): number {
    // Distance score (inverted: closer is better)
    const maxDistance = 50; // km
    const distanceScore = Math.max(0, 100 - (driver.distanceKm / maxDistance) * 100);

    // Rating score (3.5-5.0 maps to 50-100)
    const ratingScore = ((driver.rating - 3.5) / 1.5) * 50 + 50;

    // Completion rate score
    const completionScore = (driver.completionRate ?? 0.9) * 100;

    // Acceptance rate score
    const acceptanceScore = (driver.acceptanceRate ?? 0.85) * 100;

    // Weighted average: distance 40%, rating 30%, completion 15%, acceptance 15%
    // Note: Clamped at 100 to avoid exceeding max score
    const finalScore =
      distanceScore * 0.4 +
      Math.min(ratingScore, 100) * 0.3 +
      Math.min(completionScore, 100) * 0.15 +
      Math.min(acceptanceScore, 100) * 0.15;

    return Math.round(Math.min(finalScore, 100));
  }
}
