import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

type FuelContext = PrismaService | PrismaClient | Prisma.TransactionClient;

@Injectable()
export class FuelService {
  private readonly varianceThresholdPercent = Number(
    process.env.FUEL_VARIANCE_THRESHOLD_PERCENT ?? 15,
  );

  constructor(private readonly prisma: PrismaService) {}

  private async assertFuelReferences(data: any, db: FuelContext) {
    const vehicle = await db.vehicle.findUnique({
      where: { id: data.vehicleId },
      select: { id: true, driverId: true, plateNumber: true },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    if (data.driverId) {
      const driver = await db.driver.findUnique({
        where: { id: data.driverId },
        select: { id: true },
      });

      if (!driver) {
        throw new NotFoundException('Driver not found');
      }
    }

    if (data.bookingId) {
      const booking = await db.booking.findUnique({
        where: { id: data.bookingId },
        select: { id: true, vehicleId: true, driverId: true },
      });

      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      if (booking.vehicleId && booking.vehicleId !== data.vehicleId) {
        throw new BadRequestException(
          'Fuel log vehicle does not match the vehicle assigned to the booking',
        );
      }

      if (data.driverId && booking.driverId && booking.driverId !== data.driverId) {
        throw new BadRequestException(
          'Fuel log driver does not match the driver assigned to the booking',
        );
      }
    }

    return vehicle;
  }

  async detectTheft(
    input:
      | {
          fuelExpected: number;
          fuelActual: number;
        }
      | string,
  ) {
    let fuelExpected: number;
    let fuelActual: number;
    let logId: string | null = null;

    if (typeof input === 'string') {
      const log = await this.prisma.fuelLog.findUnique({
        where: { id: input },
      });

      if (!log) {
        throw new NotFoundException('Fuel log not found');
      }

      fuelExpected = log.fuelExpected;
      fuelActual = log.fuelActual;
      logId = log.id;
    } else {
      fuelExpected = input.fuelExpected;
      fuelActual = input.fuelActual;
    }

    if (fuelExpected < 0 || fuelActual < 0) {
      throw new BadRequestException('Fuel values cannot be negative');
    }

    const variance = Number((fuelActual - fuelExpected).toFixed(2));
    const variancePercentage =
      fuelExpected > 0
        ? Number(((variance / fuelExpected) * 100).toFixed(2))
        : fuelActual > 0
          ? 100
          : 0;

    const isFlagged =
      variance > 0 && variancePercentage >= this.varianceThresholdPercent;

    return {
      logId,
      variance,
      variancePercentage,
      thresholdPercentage: this.varianceThresholdPercent,
      isFlagged,
    };
  }

  async createFuelLog(data: any, reportedBy: string) {
    return this.prisma.$transaction(async tx => {
      const vehicle = await this.assertFuelReferences(data, tx);
      const detection = await this.detectTheft({
        fuelExpected: data.fuelExpected,
        fuelActual: data.fuelActual,
      });

      const fuelLog = await tx.fuelLog.create({
        data: {
          vehicleId: data.vehicleId,
          driverId: data.driverId,
          bookingId: data.bookingId,
          fuelExpected: data.fuelExpected,
          fuelActual: data.fuelActual,
          fuelCost: data.fuelCost,
          variance: detection.variance,
          notes: data.notes,
          isFlagged: detection.isFlagged,
        },
        include: {
          vehicle: true,
          driver: {
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  phone: true,
                },
              },
            },
          },
          booking: {
            select: {
              id: true,
              reference: true,
              status: true,
            },
          },
        },
      });

      if (fuelLog.isFlagged) {
        await tx.internalAlert.create({
          data: {
            type: 'FUEL_VARIANCE',
            severity: 'HIGH',
            message: `Fuel variance threshold exceeded for vehicle ${vehicle.plateNumber}`,
            status: 'PENDING',
            entityType: 'FUEL_LOG',
            entityId: fuelLog.id,
            metadata: {
              variance: detection.variance,
              variancePercentage: detection.variancePercentage,
              thresholdPercentage: detection.thresholdPercentage,
              reportedBy,
            },
          },
        });
      }

      return {
        ...fuelLog,
        variancePercentage: detection.variancePercentage,
        thresholdPercentage: detection.thresholdPercentage,
      };
    });
  }

  async listFuelLogs(filters: any = {}) {
    const page = Math.max(Number(filters.page ?? 1), 1);
    const limit = Math.max(Number(filters.limit ?? 20), 1);
    const skip = (page - 1) * limit;

    const where: Prisma.FuelLogWhereInput = {
      ...(filters.vehicleId && { vehicleId: filters.vehicleId }),
      ...(filters.driverId && { driverId: filters.driverId }),
      ...(filters.bookingId && { bookingId: filters.bookingId }),
      ...(typeof filters.flagged === 'boolean' && { isFlagged: filters.flagged }),
    };

    const [items, total] = await Promise.all([
      this.prisma.fuelLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          vehicle: true,
          driver: {
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  phone: true,
                },
              },
            },
          },
          booking: {
            select: {
              id: true,
              reference: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.fuelLog.count({ where }),
    ]);

    const summary = items.reduce(
      (acc, item) => {
        acc.totalExpected += item.fuelExpected;
        acc.totalActual += item.fuelActual;
        acc.totalVariance += item.variance;
        acc.flaggedCount += item.isFlagged ? 1 : 0;
        return acc;
      },
      {
        totalExpected: 0,
        totalActual: 0,
        totalVariance: 0,
        flaggedCount: 0,
      },
    );

    return {
      items,
      total,
      page,
      limit,
      summary: {
        totalExpected: Number(summary.totalExpected.toFixed(2)),
        totalActual: Number(summary.totalActual.toFixed(2)),
        totalVariance: Number(summary.totalVariance.toFixed(2)),
        flaggedCount: summary.flaggedCount,
      },
    };
  }

  async getFuelLog(id: string) {
    const log = await this.prisma.fuelLog.findUnique({
      where: { id },
      include: {
        vehicle: true,
        driver: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                phone: true,
              },
            },
          },
        },
        booking: {
          select: {
            id: true,
            reference: true,
            status: true,
          },
        },
      },
    });

    if (!log) {
      throw new NotFoundException('Fuel log not found');
    }

    const detection = await this.detectTheft(log.id);
    return {
      ...log,
      variancePercentage: detection.variancePercentage,
      thresholdPercentage: detection.thresholdPercentage,
    };
  }
}
