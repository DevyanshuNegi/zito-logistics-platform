import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class PayrollService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculates driver earnings, incentives, and penalties for a given period.
   * Implementation of PRD §44.2: Driver Payroll Engine.
   * Leverages performance metrics (trip_hours) calculated in ShiftService (PRD §44.1).
   */
  async getDriverPayroll(driverId: string, startDate?: Date, endDate?: Date) {
    const start = startDate || new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate || new Date();

    // Check if driver exists and is active (PRD §3)
    const driver = await this.prisma.user.findUnique({
      where: { id: driverId },
    });

    if (!driver || driver.role !== UserRole.DRIVER) {
      throw new NotFoundException('Driver not found');
    }

    // 1. Fetch completed shifts to aggregate trip_hours and idle_hours (PRD §44.1)
    const shifts = await this.prisma.driverShift.findMany({
      where: {
        driverId: driverId,
        shiftStartTime: { gte: start },
        shiftEndTime: { lte: end, not: null },
      },
    });

    const totalTripHours = shifts.reduce((acc, s) => acc + (Number(s.tripHours) || 0), 0);
    const totalIdleHours = shifts.reduce((acc, s) => acc + (Number(s.idleHours) || 0), 0);

    // 2. Calculate trip-based earnings (PRD §44.2 / §8)
    const completedBookings = await this.prisma.booking.findMany({
      where: {
        driverId: driverId,
        status: 'COMPLETED',
        deliveredAt: { gte: start, lte: end },
      },
    });

    // Driver share is calculated from the booking price (PRD §19 / §48)
    // Default logic assumes 80% share for the driver
    const tripEarnings = completedBookings.reduce((acc, b) => acc + (Number(b.totalPrice || 0) * 0.8), 0);

    // 3. Incentives & Penalties (PRD §44.9) - Integration points for automated logic
    const incentives = 0; // Placeholder for Peak-hour/Completion bonuses
    const penalties = 0;   // Placeholder for Cancellation/SLA breach penalties

    return {
      trip_earnings: parseFloat(tripEarnings.toFixed(2)),
      trip_hours: parseFloat(totalTripHours.toFixed(2)),
      idle_hours: parseFloat(totalIdleHours.toFixed(2)),
      incentives,
      penalties,
      total_payout: parseFloat((tripEarnings + incentives - penalties).toFixed(2)),
      currency: 'KES',
      period: { start, end },
    };
  }
}