import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { ShiftDto, AttendanceStatus } from '../src/modules/drivers/shift/shift.dto';

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
        driverId,
        shiftEndTime: null,
      },
    });

    if (existingShift) {
      throw new BadRequestException('An active shift is already in progress for this driver.');
    }

    return this.prisma.driverShift.create({
      data: {
        driverId,
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
        driverId,
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
        driverId,
        status: 'DELIVERED',
        deliveredAt: {
          gte: activeShift.shiftStartTime,
          lte: shiftEndTime,
        },
      },
    });

    const tripHours = parseFloat(
      shiftBookings
        .reduce((acc, booking) => {
          if (booking.deliveredAt) {
            const duration =
              (booking.deliveredAt.getTime() - activeShift.shiftStartTime.getTime()) /
              (1000 * 60 * 60);
            return acc + Math.min(duration, totalHours);
          }
          return acc;
        }, 0)
        .toFixed(2),
    );

    const idleHours = parseFloat(Math.max(0, totalHours - tripHours).toFixed(2));

    return this.prisma.driverShift.update({
      where: { id: activeShift.id },
      data: {
        shiftEndTime,
        totalHours,
        tripHours,
        idleHours,
        status: 'CLOSED',
      },
    });
  }

  /**
   * PRD §44.1 Rule: No booking allowed without an active shift.
   */
  async isShiftActive(driverId: string): Promise<boolean> {
    const activeShift = await this.prisma.driverShift.findFirst({
      where: {
        driverId,
        shiftEndTime: null,
      },
    });
    return !!activeShift;
  }
}