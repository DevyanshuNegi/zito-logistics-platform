import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ShiftDto } from '../shift/shift.dto';
import { AttendanceStatus } from '@prisma/client';

@Injectable()
export class ShiftService {
  constructor(private prisma: PrismaService) {}

  /**
   * Starts a new driver shift.
   * Implementation of PRD §44.1: Drivers must start shift before going online.
   */
  async startShift(driverId: string, dto: ShiftDto) {
    // Check for an existing active shift to prevent duplicates
    const existingShift = await this.prisma.driverShift.findFirst({
      where: {
        driverId: driverId,
        shiftEndTime: null,
      },
    });

    if (existingShift) {
      throw new BadRequestException('An active shift is already in progress for this driver.');
    }

    return await this.prisma.driverShift.create({
      data: {
        driverId: driverId,
        shiftStartTime: new Date(),
        attendanceStatus: dto.attendance_status ?? AttendanceStatus.PRESENT,
        totalHours: 0,
        tripHours: 0,
        idleHours: 0,
      },
    });
  }

  /**
   * Ends an active driver shift and calculates performance metrics.
   * Implementation of PRD §44.1: Calculates total, trip, and idle hours.
   */
  async endShift(driverId: string) {
    const activeShift = await this.prisma.driverShift.findFirst({
      where: {
        driverId: driverId,
        shiftEndTime: null,
      },
    });

    if (!activeShift) {
      throw new NotFoundException('No active shift found to end.');
    }
    const shiftEndTime = new Date();
    const durationMs = shiftEndTime.getTime() - activeShift.shiftStartTime.getTime();
    const totalHoursCalculated = parseFloat((durationMs / (1000 * 60 * 60)).toFixed(2));

    // PRD §44.1: Calculate trip_hours by summing durations of bookings completed during this shift window.
    const shiftBookings = await this.prisma.booking.findMany({
      where: {
        driverId: driverId,
        status: 'COMPLETED',
        deliveredAt: {
          gte: activeShift.shiftStartTime,
          lte: shiftEndTime,
        },
      },
    });

    let tripDurationMs = 0;
    for (const booking of shiftBookings) {
      const startTime = (booking as any).actualPickupAt || (booking as any).startedAt;
      const endTime = (booking as any).deliveredAt;
      if (startTime && endTime) {
        tripDurationMs += (new Date(endTime).getTime() - new Date(startTime).getTime());
      }
    }

    const tripHoursCalculated = parseFloat((tripDurationMs / (1000 * 60 * 60)).toFixed(2));
    const idleHoursCalculated = parseFloat(Math.max(0, totalHoursCalculated - tripHoursCalculated).toFixed(2));

    return await this.prisma.driverShift.update({
      where: { id: activeShift.id },
      data: {
        shiftEndTime: shiftEndTime,
        totalHours: totalHoursCalculated,
        tripHours: tripHoursCalculated,
        idleHours: idleHoursCalculated,
      },
    });
  }
  /**
   * Validation helper for booking and online status checks.
   * PRD §44.1 Rule: No booking allowed without an active shift.
   */
  async isShiftActive(driverId: string): Promise<boolean> {
    const activeShift = await this.prisma.driverShift.findFirst({
      where: {
        driverId: driverId,
        shiftEndTime: null,
      },
    });
    return !!activeShift;
  }
}