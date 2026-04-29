import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { VehicleStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BreakdownService } from './breakdown/breakdown.service';
import { FleetExpiryService } from './fleet-expiry.service';
import { FuelService } from './fuel/fuel.service';

@Injectable()
export class FleetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly breakdownService: BreakdownService,
    private readonly fleetExpiryService: FleetExpiryService,
    private readonly fuelService: FuelService,
  ) {}

  async create(createVehicleDto: any) {
    const existing = await this.prisma.vehicle.findUnique({
      where: { plateNumber: createVehicleDto.plateNumber },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Vehicle with this plate number already exists');
    }

    if (createVehicleDto.driverId) {
      await this.assertDriverAssignable(createVehicleDto.driverId);
    }

    return this.prisma.vehicle.create({
      data: {
        ...createVehicleDto,
        status: createVehicleDto.status ?? VehicleStatus.ACTIVE,
        insuranceExpiry: createVehicleDto.insuranceExpiry
          ? new Date(createVehicleDto.insuranceExpiry)
          : undefined,
        permitExpiry: createVehicleDto.permitExpiry
          ? new Date(createVehicleDto.permitExpiry)
          : undefined,
      },
      include: {
        driver: { include: { user: { select: { id: true, fullName: true, phone: true } } } },
      },
    });
  }

  async findAll(filters: { status?: VehicleStatus; driverId?: string } = {}) {
    const where = {
      ...(filters.status && { status: filters.status }),
      ...(filters.driverId && { driverId: filters.driverId }),
    };

    return this.prisma.vehicle.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        driver: { include: { user: { select: { id: true, fullName: true, phone: true } } } },
        _count: { select: { bookings: true, breakdowns: true, maintenanceLogs: true } },
      },
    });
  }

  async findOne(id: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id },
      include: {
        driver: { include: { user: { select: { id: true, fullName: true, phone: true } } } },
        breakdowns: { orderBy: { createdAt: 'desc' }, take: 10 },
        maintenanceLogs: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    return vehicle;
  }

  async update(id: string, dto: any) {
    await this.findOne(id);

    if (dto.plateNumber) {
      const duplicate = await this.prisma.vehicle.findFirst({
        where: {
          plateNumber: dto.plateNumber,
          NOT: { id },
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new ConflictException('Vehicle with this plate number already exists');
      }
    }

    if (dto.driverId) {
      await this.assertDriverAssignable(dto.driverId, id);
    }

    return this.prisma.vehicle.update({
      where: { id },
      data: {
        ...dto,
        insuranceExpiry: dto.insuranceExpiry ? new Date(dto.insuranceExpiry) : undefined,
        permitExpiry: dto.permitExpiry ? new Date(dto.permitExpiry) : undefined,
      },
      include: {
        driver: { include: { user: { select: { id: true, fullName: true, phone: true } } } },
      },
    });
  }

  async assignDriver(id: string, driverId: string) {
    await this.findOne(id);
    await this.assertDriverAssignable(driverId, id);

    return this.prisma.vehicle.update({
      where: { id },
      data: { driverId },
      include: {
        driver: { include: { user: { select: { id: true, fullName: true, phone: true } } } },
      },
    });
  }

  async retire(id: string, note?: string) {
    await this.findOne(id);

    return this.prisma.vehicle.update({
      where: { id },
      data: {
        status: VehicleStatus.INACTIVE,
        driverId: null,
      },
      include: {
        driver: { include: { user: { select: { id: true, fullName: true, phone: true } } } },
      },
    });
  }

  async updateLocation(id: string, lat: number, lng: number) {
    await this.findOne(id);

    const vehicle = await this.fleetExpiryService.updateVehicleGps(id, lat, lng);
    const divergence = await this.fleetExpiryService.checkGpsDivergence(id);

    return {
      vehicle,
      divergence,
    };
  }

  async reportBreakdown(
    id: string,
    driverId: string,
    details: string,
    bookingId?: string,
    latitude?: number,
    longitude?: number,
  ) {
    if (!driverId) {
      throw new BadRequestException('Driver profile is required to report a breakdown');
    }

    return this.breakdownService.reportBreakdown({
      vehicleId: id,
      driverId,
      bookingId,
      description: details,
      latitude,
      longitude,
    });
  }

  async listBreakdowns(filters: {
    status?: string;
    driverId?: string;
    vehicleId?: string;
    page?: number;
    limit?: number;
  }) {
    return this.breakdownService.listAll(filters);
  }

  async getBreakdown(id: string) {
    return this.breakdownService.getBreakdown(id);
  }

  async assignBackupVehicle(breakdownId: string, backupVehicleId: string, adminId: string) {
    return this.breakdownService.assignBackupVehicle(breakdownId, backupVehicleId, adminId);
  }

  async resolveBreakdown(breakdownId: string, adminId: string) {
    return this.breakdownService.resolveBreakdown(breakdownId, adminId);
  }

  async createFuelLog(data: any, reportedBy: string) {
    return this.fuelService.createFuelLog(data, reportedBy);
  }

  async listFuelLogs(filters: any = {}) {
    return this.fuelService.listFuelLogs(filters);
  }

  async getFuelLog(id: string) {
    return this.fuelService.getFuelLog(id);
  }

  async detectFuelTheft(logId: string) {
    return this.fuelService.detectTheft(logId);
  }

  private async assertDriverAssignable(driverId: string, currentVehicleId?: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      select: { id: true, isBlacklisted: true },
    });
    if (!driver) throw new NotFoundException('Driver not found');
    if (driver.isBlacklisted) {
      throw new BadRequestException('Cannot assign a blacklisted driver');
    }

    const assignedElsewhere = await this.prisma.vehicle.findFirst({
      where: {
        driverId,
        NOT: { id: currentVehicleId ?? undefined },
      },
      select: { plateNumber: true },
    });
    if (assignedElsewhere) {
      throw new ConflictException(
        `Driver is already assigned to vehicle ${assignedElsewhere.plateNumber}`,
      );
    }
  }
}
