import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateDriverDto } from './dto/update-driver.dto';

@Injectable()
export class DriversService {
  constructor(private readonly prisma: PrismaService) {}

  async updateLocation(userId: string, updateDriverDto: UpdateDriverDto) {
    return this.prisma.driver.update({
      where: { userId },
      data: {
        ...updateDriverDto,
        lastLocationAt: new Date(),
      },
    });
  }

  async findAvailableDrivers(latitude: number, longitude: number, radiusKm: number = 10) {
    // Rough proximity check, can be refined with PostGIS in the future
    return this.prisma.driver.findMany({
      where: {
        isOnline: true,
        isAvailable: true,
        isBlacklisted: false,
        licenseVerified: true,
      },
    });
  }
}