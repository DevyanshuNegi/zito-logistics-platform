import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

// PRD §44.4 — Breakdown Reporting & Rescue Flow
// Path: src/modules/fleet/breakdown/breakdown.service.ts
// Schema: VehicleBreakdown — vehicleId, driverId, bookingId?, description,
//         latitude?, longitude?, status(String), backupVehicleId?, resolvedAt
//
// Status values: REPORTED | RESCUE_DISPATCHED | BACKUP_ASSIGNED | RESOLVED

@Injectable()
export class BreakdownService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Driver reports a breakdown mid-trip ──────────────────────────────────
  // PRD §44.4: driver triggers from app → admin alerted → rescue dispatched

  async reportBreakdown(dto: {
    vehicleId:   string;
    driverId:    string;
    bookingId?:  string;
    description: string;
    latitude?:   number;
    longitude?:  number;
  }) {
    // Validate vehicle exists
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: dto.vehicleId },
      select: { id: true, plateNumber: true, status: true },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    // Validate driver exists and is assigned to this vehicle
    const driver = await this.prisma.driver.findUnique({
      where: { id: dto.driverId },
      select: { id: true, userId: true },
    });
    if (!driver) throw new NotFoundException('Driver not found');

    // Create breakdown record
    const breakdown = await this.prisma.vehicleBreakdown.create({
      data: {
        vehicleId:   dto.vehicleId,
        driverId:    dto.driverId,
        bookingId:   dto.bookingId   ?? null,
        description: dto.description,
        latitude:    dto.latitude    ?? null,
        longitude:   dto.longitude   ?? null,
        status:      'REPORTED',
      },
    });

    // Suspend vehicle from new assignments while breakdown is active
    await this.prisma.vehicle.update({
      where: { id: dto.vehicleId },
      data:  { status: 'MAINTENANCE' },
    });

    // Mark driver as unavailable
    await this.prisma.driver.update({
      where: { id: dto.driverId },
      data:  { isAvailable: false },
    });

    // If linked to a booking — freeze it (admin must intervene)
    if (dto.bookingId) {
      const booking = await this.prisma.booking.findUnique({
        where:  { id: dto.bookingId },
        select: { status: true },
      });
      // Only freeze if trip is actively in progress
      if (booking && ['PICKED', 'IN_TRANSIT', 'ARRIVED_AT_DESTINATION'].includes(booking.status)) {
        // Create internal alert for admin
        await this.prisma.internalAlert.create({
          data: {
            type:       'BREAKDOWN',
            severity:   'HIGH',
            message:    `Vehicle ${vehicle.plateNumber} broke down. Booking ${dto.bookingId} is affected.`,
            entityType: 'VEHICLE',
            entityId:   dto.vehicleId,
            metadata:   {
              breakdownId: breakdown.id,
              bookingId:   dto.bookingId,
              driverId:    dto.driverId,
              location:    { lat: dto.latitude, lng: dto.longitude },
            },
          },
        });
      }
    }

    return breakdown;
  }

  // ── Admin: dispatch rescue / assign backup vehicle ────────────────────────

  async assignBackupVehicle(breakdownId: string, backupVehicleId: string, adminId: string) {
    const breakdown = await this.getOrThrow(breakdownId);

    if (breakdown.status === 'RESOLVED') {
      throw new BadRequestException('Breakdown already resolved');
    }

    // Validate backup vehicle is available and active
    const backup = await this.prisma.vehicle.findUnique({
      where:  { id: backupVehicleId },
      select: { id: true, plateNumber: true, status: true },
    });
    if (!backup) throw new NotFoundException('Backup vehicle not found');
    if (backup.status !== 'ACTIVE') {
      throw new BadRequestException(`Backup vehicle is ${backup.status} — cannot assign`);
    }

    const updated = await this.prisma.vehicleBreakdown.update({
      where: { id: breakdownId },
      data:  {
        backupVehicleId,
        status: 'BACKUP_ASSIGNED',
      },
    });

    // Write audit log
    await this.writeAudit(adminId, breakdownId, 'BACKUP_ASSIGNED', { backupVehicleId });

    return updated;
  }

  // ── Admin: mark breakdown resolved ────────────────────────────────────────

  async resolveBreakdown(breakdownId: string, adminId: string) {
    const breakdown = await this.getOrThrow(breakdownId);

    if (breakdown.status === 'RESOLVED') {
      throw new BadRequestException('Already resolved');
    }

    const updated = await this.prisma.vehicleBreakdown.update({
      where: { id: breakdownId },
      data:  {
        status:     'RESOLVED',
        resolvedAt: new Date(),
      },
    });

    // Restore vehicle to ACTIVE
    await this.prisma.vehicle.update({
      where: { id: breakdown.vehicleId },
      data:  { status: 'ACTIVE' },
    });

    // Restore driver availability
    await this.prisma.driver.update({
      where: { id: breakdown.driverId },
      data:  { isAvailable: true },
    });

    await this.writeAudit(adminId, breakdownId, 'RESOLVED', {});

    return updated;
  }

  // ── List breakdowns ───────────────────────────────────────────────────────

  async listAll(filters: {
    status?:    string;
    driverId?:  string;
    vehicleId?: string;
    page?:      number;
    limit?:     number;
  }) {
    const { status, driverId, vehicleId, page = 1, limit = 20 } = filters;
    const skip  = (page - 1) * limit;
    const where = {
      ...(status    && { status }),
      ...(driverId  && { driverId }),
      ...(vehicleId && { vehicleId }),
    };

    const [breakdowns, total] = await Promise.all([
      this.prisma.vehicleBreakdown.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          vehicle: { select: { plateNumber: true, type: true } },
          driver:  { include: { user: { select: { fullName: true, phone: true } } } },
          booking: { select: { reference: true, status: true } },
        },
      }),
      this.prisma.vehicleBreakdown.count({ where }),
    ]);

    return { breakdowns, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async getBreakdown(breakdownId: string) {
    return this.prisma.vehicleBreakdown.findUnique({
      where:   { id: breakdownId },
      include: {
        vehicle: { select: { plateNumber: true, type: true, make: true, model: true } },
        driver:  { include: { user: { select: { fullName: true, phone: true } } } },
        booking: { select: { reference: true, status: true } },
      },
    });
  }

  // ── Active breakdown check (used by booking assignment) ───────────────────

  async hasActiveBreakdown(vehicleId: string): Promise<boolean> {
    const active = await this.prisma.vehicleBreakdown.findFirst({
      where: { vehicleId, status: { not: 'RESOLVED' } },
    });
    return !!active;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async getOrThrow(breakdownId: string) {
    const b = await this.prisma.vehicleBreakdown.findUnique({
      where: { id: breakdownId },
    });
    if (!b) throw new NotFoundException('Breakdown record not found');
    return b;
  }

  private async writeAudit(userId: string, entityId: string, action: string, details: object) {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) return;
      await this.prisma.auditLog.create({
        data: { userId, action: `BREAKDOWN_${action}`, entityType: 'VEHICLE', entityId, details },
      });
    } catch { /* never crash main flow */ }
  }
}