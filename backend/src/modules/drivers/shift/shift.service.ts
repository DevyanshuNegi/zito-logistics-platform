import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ShiftDto } from './shift.dto';
import { AttendanceStatus } from '@prisma/client';

@Injectable()
export class ShiftService {
  constructor(private prisma: PrismaService) {}

  /**
   * Starts a new driver shift.
   * PRD §44.1: Driver must START SHIFT before going online.
   */
  async startShift(driverId: string, dto: ShiftDto) {
    const existingShift = await this.prisma.driverShift.findFirst({
      where: {
        driverId: driverId,
        shiftEndTime: null,
      },
    });

    if (existingShift) {
      throw new BadRequestException('An active shift is already in progress for this driver.');
    }

    return this.prisma.driverShift.create({
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
   * PRD §44.1: Calculates total_hours, trip_hours, idle_hours for the session.
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
    const totalHours = parseFloat((durationMs / (1000 * 60 * 60)).toFixed(2));

    // PRD §44.1: Sum trip durations from bookings completed within this shift window.
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

    // PRD §44.1: Calculate trip_hours. 
    // If actual_pickup_at is missing, use a 1-hour proxy per completed booking for operational estimation.
    let tripDurationMs = 0;
    for (const booking of shiftBookings) {
      const startTime = (booking as any).actualPickupAt || (booking as any).startedAt;
      const endTime = (booking as any).deliveredAt;
      
      if (startTime && endTime) {
        tripDurationMs += (new Date(endTime).getTime() - new Date(startTime).getTime());
      } else {
        tripDurationMs += (1000 * 60 * 60); 
      }
    }

    const tripHours = parseFloat(Math.min(totalHours, tripDurationMs / (1000 * 60 * 60)).toFixed(2));
    const idleHours = parseFloat(Math.max(0, totalHours - tripHours).toFixed(2));

    return this.prisma.driverShift.update({
      where: { id: activeShift.id },
      data: {
        shiftEndTime: shiftEndTime,
        totalHours: totalHours,
        tripHours: tripHours,
        idleHours: idleHours,
      },
    });
  }

  /**
   * PRD §44.1 Rule: No booking allowed without an active shift.
   * Used by ShiftActiveGuard.
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