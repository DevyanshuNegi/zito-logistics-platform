import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

// PRD §44.2 — Payroll Engine
// Path: src/modules/drivers/payroll/payroll.service.ts
// Schema: DriverPayroll, DriverIncentive, DriverPenalty, DriverShift, Booking

@Injectable()
export class PayrollService {
  constructor(private readonly prisma: PrismaService) {}

  async generatePayroll(driverId: string, periodStart: Date, periodEnd: Date) {
    const driver = await this.prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) throw new NotFoundException('Driver not found');

    const existing = await this.prisma.driverPayroll.findFirst({
      where: { driverId, periodStart, periodEnd, status: { not: 'CANCELLED' } },
    });
    if (existing) throw new ConflictException('Payroll already exists for this period');

    const completedBookings = await this.prisma.booking.findMany({
      where: { driverId, status: 'COMPLETED', updatedAt: { gte: periodStart, lte: periodEnd } },
      select: { id: true },
    });
    const totalTrips = completedBookings.length;

    const incentives = await this.prisma.driverIncentive.findMany({
      where: { driverId, createdAt: { gte: periodStart, lte: periodEnd } },
    });
    const incentiveTotal = incentives.reduce((sum, i) => sum + i.amount, 0);

    const penalties = await this.prisma.driverPenalty.findMany({
      where: { driverId, createdAt: { gte: periodStart, lte: periodEnd } },
    });
    const penaltyTotal = penalties.reduce((sum, p) => sum + p.amount, 0);

    const shifts = await this.prisma.driverShift.findMany({
      where: { driverId, shiftStartTime: { gte: periodStart, lte: periodEnd }, status: 'ENDED' },
      select: { totalHours: true, tripHours: true },
    });
    const tripHours = shifts.reduce((sum, s) => sum + (s.tripHours ?? 0), 0);

    const BASE_RATE_PER_TRIP = 200;
    const HOURLY_RATE        = 150;
    const tripEarnings   = parseFloat((totalTrips * BASE_RATE_PER_TRIP).toFixed(2));
    const hourlyEarnings = parseFloat((tripHours  * HOURLY_RATE).toFixed(2));
    const netPayout      = parseFloat(
      Math.max(0, tripEarnings + hourlyEarnings + incentiveTotal - penaltyTotal).toFixed(2),
    );

    const payroll = await this.prisma.driverPayroll.create({
      data: { driverId, periodStart, periodEnd, totalTrips, tripEarnings, hourlyEarnings, incentiveTotal, penaltyTotal, netPayout, status: 'PENDING' },
    });

    return { payroll, breakdown: { totalTrips, tripEarnings, hourlyEarnings, incentiveTotal, penaltyTotal, netPayout } };
  }

  async approvePayroll(payrollId: string, adminId: string) {
    const payroll = await this.getOrThrow(payrollId);
    if (payroll.status !== 'PENDING') {
      throw new BadRequestException(`Cannot approve payroll with status ${payroll.status}`);
    }
    return this.prisma.driverPayroll.update({
      where: { id: payrollId },
      data: { status: 'APPROVED', approvedBy: adminId, approvedAt: new Date() },
    });
  }

  async markPaid(payrollId: string, transactionRef: string) {
    const payroll = await this.getOrThrow(payrollId);
    if (payroll.status !== 'APPROVED') {
      throw new BadRequestException('Payroll must be APPROVED before marking as paid');
    }
    return this.prisma.driverPayroll.update({
      where: { id: payrollId },
      data: { status: 'PAID', paidAt: new Date(), transactionRef },
    });
  }

  async overridePayout(
    payrollId: string,
    overrideAmount: number,
    adminId: string,
    reason: string,
  ) {
    if (overrideAmount < 0) {
      throw new BadRequestException('Override amount cannot be negative');
    }

    const payroll = await this.getOrThrow(payrollId);
    if (payroll.status === 'PAID') {
      throw new BadRequestException('Paid payroll cannot be overridden');
    }

    const updated = await this.prisma.driverPayroll.update({
      where: { id: payrollId },
      data: {
        netPayout: parseFloat(overrideAmount.toFixed(2)),
      },
    });

    try {
      const user = await this.prisma.user.findUnique({ where: { id: adminId } });
      if (user) {
        await this.prisma.auditLog.create({
          data: {
            userId: adminId,
            action: 'PAYROLL_PAYOUT_OVERRIDDEN',
            entityType: 'DRIVER_PAYROLL',
            entityId: payrollId,
            details: {
              previousNetPayout: payroll.netPayout,
              overrideAmount: updated.netPayout,
              reason,
            },
          },
        });
      }
    } catch {
      // Payout override should not fail because audit logging failed.
    }

    return updated;
  }

  async addIncentive(dto: { driverId: string; type: string; amount: number; reason?: string; bookingId?: string }) {
    const driver = await this.prisma.driver.findUnique({ where: { id: dto.driverId } });
    if (!driver) throw new NotFoundException('Driver not found');
    return this.prisma.driverIncentive.create({
      data: { driverId: dto.driverId, type: dto.type, amount: dto.amount, reason: dto.reason ?? null, bookingId: dto.bookingId ?? null },
    });
  }

  async addPenalty(dto: { driverId: string; type: string; amount: number; reason: string; bookingId?: string }) {
    const driver = await this.prisma.driver.findUnique({ where: { id: dto.driverId } });
    if (!driver) throw new NotFoundException('Driver not found');
    return this.prisma.driverPenalty.create({
      data: { driverId: dto.driverId, type: dto.type, amount: dto.amount, reason: dto.reason, bookingId: dto.bookingId ?? null },
    });
  }

  async listForDriver(driverId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [payrolls, total] = await Promise.all([
      this.prisma.driverPayroll.findMany({ where: { driverId }, orderBy: { periodStart: 'desc' }, skip, take: limit }),
      this.prisma.driverPayroll.count({ where: { driverId } }),
    ]);
    return { payrolls, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async listForAdmin(filters: { driverId?: string; status?: string; page?: number; limit?: number }) {
    const { driverId, status, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;
    const where = { ...(driverId && { driverId }), ...(status && { status }) };
    const [payrolls, total] = await Promise.all([
      this.prisma.driverPayroll.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      this.prisma.driverPayroll.count({ where }),
    ]);
    return { payrolls, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async getPayroll(payrollId: string) { return this.getOrThrow(payrollId); }

  async getEarningsSummary(driverId: string) {
    const [payrolls, incentives, penalties] = await Promise.all([
      this.prisma.driverPayroll.findMany({ where: { driverId }, orderBy: { periodStart: 'desc' }, take: 12 }),
      this.prisma.driverIncentive.findMany({ where: { driverId }, orderBy: { createdAt: 'desc' }, take: 10 }),
      this.prisma.driverPenalty.findMany({ where: { driverId }, orderBy: { createdAt: 'desc' }, take: 10 }),
    ]);
    const totalEarned   = payrolls.filter(p => p.status === 'PAID').reduce((s, p) => s + p.netPayout, 0);
    const pendingAmount = payrolls.filter(p => ['PENDING','APPROVED'].includes(p.status)).reduce((s,p)=>s+p.netPayout,0);
    return { totalEarned: parseFloat(totalEarned.toFixed(2)), pendingAmount: parseFloat(pendingAmount.toFixed(2)), recentPayrolls: payrolls, recentIncentives: incentives, recentPenalties: penalties };
  }

  private async getOrThrow(payrollId: string) {
    const p = await this.prisma.driverPayroll.findUnique({ where: { id: payrollId } });
    if (!p) throw new NotFoundException('Payroll record not found');
    return p;
  }
}
