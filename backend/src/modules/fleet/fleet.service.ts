import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FleetService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createVehicleDto: any) {
    return this.prisma.vehicle.create({
      data: {
        ...createVehicleDto,
        status: 'ACTIVE',
      },
    });
  }

  async findAll() {
    return this.prisma.vehicle.findMany({
      include: { driver: true }, // wait does Vehicle have a driver?
    });
  }

  async updateLocation(id: string, lat: number, lng: number) {
    return this.prisma.vehicle.update({
      where: { id },
      data: { deviceGpsLat: lat, deviceGpsLng: lng, lastGpsAt: new Date() },
    });
  }

  async reportBreakdown(id: string, driverId: string, details: string) {
    return this.prisma.vehicleBreakdown.create({
      data: {
        vehicleId: id,
        driverId: driverId,
        description: details,
        status: 'REPORTED',
      },
    });
  }
}

