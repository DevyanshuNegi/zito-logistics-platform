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
      include: { driver: true },
    });
  }

  async updateLocation(id: string, lat: number, lng: number) {
    return this.prisma.vehicle.update({
      where: { id },
      data: { currentLatitude: lat, currentLongitude: lng, lastLocationAt: new Date() },
    });
  }

  async reportBreakdown(id: string, details: string) {
    return this.prisma.vehicleBreakdown.create({
      data: {
        vehicleId: id,
        details,
        reportedAt: new Date(),
        status: 'REPORTED',
      },
    });
  }
}
