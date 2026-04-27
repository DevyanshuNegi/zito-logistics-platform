import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

// Schema reality check:
// - Table: driverShift (not shift)
// - Fields: shiftStartTime, shiftEndTime, totalHours, status (String)
// - Driver fields: isOnline, isAvailable, isBlacklisted (no complianceStatus, no status)
// - BookingStatus enum values used for active trip check

const MAX_SHIFT_HOURS = 12;
const MIN_REST_HOURS = 8;

const ACTIVE_TRIP_STATUSES = [
  'ACCEPTED',
  'ARRIVED',
  'PICKED',
  'IN_TRANSIT',
  'ARRIVED_AT_DESTINATION',
  'DELIVERY_VERIFICATION',
];

@Injectable()
export class ShiftService {
  constructor(private readonly prisma: PrismaService) {}

  async startShift(driverId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
    });
    if (!driver) throw new NotFoundException('Driver not found');
    if (driver.isBlacklisted) {
      throw new ForbiddenException('Driver is blacklisted and cannot start a shift');
    }

    // Block if already has an active shift
    const activeShift = await this.prisma.driverShift.findFirst({
      where: { driverId, status: 'ACTIVE' },
    });
    if (activeShift) {
      throw new BadRequestException('Driver already has an active shift');
    }

    // Enforce minimum rest between shifts
    const lastShift = await this.prisma.driverShift.findFirst({
      where: { driverId, status: 'ENDED' },
      orderBy: { shiftEndTime: 'desc' },
    });
    if (lastShift?.shiftEndTime) {
      const hoursSince =
        (Date.now() - lastShift.shiftEndTime.getTime()) / (1000 * 60 * 60);
      if (hoursSince < MIN_REST_HOURS) {
        const remaining = Math.ceil(MIN_REST_HOURS - hoursSince);
        throw new BadRequestException(
          `Minimum rest period not met. ${remaining}h remaining before next shift.`,
        );
      }
    }

    const shift = await this.prisma.driverShift.create({
      data: {
        driverId,
        shiftStartTime: new Date(),
        status: 'ACTIVE',
        attendanceStatus: 'PRESENT',
      },
    });

    await this.prisma.driver.update({
      where: { id: driverId },
      data: { isOnline: true, isAvailable: true },
    });

    return {
      message: 'Shift started successfully',
      shift,
      maxHoursAllowed: MAX_SHIFT_HOURS,
      shiftEndsAt: new Date(
        shift.shiftStartTime.getTime() + MAX_SHIFT_HOURS * 60 * 60 * 1000,
      ),
    };
  }

  async endShift(driverId: string) {
    const activeShift = await this.prisma.driverShift.findFirst({
      where: { driverId, status: 'ACTIVE' },
    });
    if (!activeShift) throw new NotFoundException('No active shift found');

    // Block end if driver has an active trip
    const activeTrip = await this.prisma.booking.findFirst({
      where: {
        driverId,
        status: { in: ACTIVE_TRIP_STATUSES as any },
      },
    });
    if (activeTrip) {
      throw new BadRequestException(
        'Cannot end shift with an active trip in progress. Complete the trip first.',
      );
    }

    const endTime = new Date();
    const totalHours =
      (endTime.getTime() - activeShift.shiftStartTime.getTime()) /
      (1000 * 60 * 60);

    const shift = await this.prisma.driverShift.update({
      where: { id: activeShift.id },
      data: {
        shiftEndTime: endTime,
        totalHours: parseFloat(totalHours.toFixed(2)),
        status: 'ENDED',
      },
    });

    await this.prisma.driver.update({
      where: { id: driverId },
      data: { isOnline: false, isAvailable: false },
    });

    return {
      message: 'Shift ended successfully',
      shift,
      totalHours: shift.totalHours,
    };
  }

  async getActiveShift(driverId: string) {
    const shift = await this.prisma.driverShift.findFirst({
      where: { driverId, status: 'ACTIVE' },
    });

    if (!shift) return { active: false, shift: null };

    const hoursElapsed =
      (Date.now() - shift.shiftStartTime.getTime()) / (1000 * 60 * 60);
    const hoursRemaining = Math.max(0, MAX_SHIFT_HOURS - hoursElapsed);
    const isFatigueRisk = hoursElapsed >= 10;

    // Auto-end if max hours exceeded
    if (hoursElapsed >= MAX_SHIFT_HOURS) {
      await this.endShift(driverId);
      return {
        active: false,
        shift: null,
        message: 'Shift auto-ended: maximum hours reached',
      };
    }

    return {
      active: true,
      shift,
      hoursElapsed: parseFloat(hoursElapsed.toFixed(2)),
      hoursRemaining: parseFloat(hoursRemaining.toFixed(2)),
      isFatigueRisk,
      fatigueAlert: isFatigueRisk
        ? `You have been driving for ${Math.floor(hoursElapsed)} hours. Please plan your rest.`
        : null,
    };
  }

  async getShiftHistory(driverId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [shifts, total] = await Promise.all([
      this.prisma.driverShift.findMany({
        where: { driverId },
        orderBy: { shiftStartTime: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.driverShift.count({ where: { driverId } }),
    ]);
    return { shifts, total, page, limit, pages: Math.ceil(total / limit) };
  }

  // Called by ShiftActiveGuard before trip acceptance
  async assertActiveShift(driverId: string): Promise<void> {
    const shift = await this.prisma.driverShift.findFirst({
      where: { driverId, status: 'ACTIVE' },
    });
    if (!shift) {
      throw new ForbiddenException(
        'Driver must start a shift before accepting trip assignments',
      );
    }
    const hoursElapsed =
      (Date.now() - shift.shiftStartTime.getTime()) / (1000 * 60 * 60);
    if (hoursElapsed >= MAX_SHIFT_HOURS) {
      throw new ForbiddenException(
        'Maximum shift hours reached. End this shift and rest before continuing.',
      );
    }
  }
}