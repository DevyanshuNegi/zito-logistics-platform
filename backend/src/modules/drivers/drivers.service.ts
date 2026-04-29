import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateDriverStatusDto } from './dto/update-driver-status.dto';
import { CreateDriverDto } from './dto/create-driver.dto';

@Injectable()
export class DriversService {
  constructor(private readonly prisma: PrismaService) {}

  async listDrivers(filters: { isAvailable?: boolean; isOnline?: boolean } = {}) {
    return this.prisma.driver.findMany({
      where: {
        ...(filters.isAvailable !== undefined && { isAvailable: filters.isAvailable }),
        ...(filters.isOnline !== undefined && { isOnline: filters.isOnline }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, fullName: true, phone: true, email: true } },
        vehicle: { select: { id: true, plateNumber: true, type: true, status: true } },
      },
    });
  }

  async registerDriver(userId: string, dto: CreateDriverDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    
    if (user.role !== 'DRIVER') {
      throw new ForbiddenException('User must have the DRIVER role');
    }

    const existingDriver = await this.prisma.driver.findUnique({ where: { userId } });
    if (existingDriver) {
      throw new ConflictException('Driver profile already exists for this user');
    }

    return this.prisma.driver.create({
      data: {
        userId,
        licenseNumber: dto.licenseNumber,
        licenseExpiry: dto.licenseExpiry ? new Date(dto.licenseExpiry) : null,
      },
      include: {
        user: { select: { id: true, fullName: true, phone: true, email: true } },
      }
    });
  }

  async getMyProfile(userId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, fullName: true, phone: true, email: true } },
        vehicle: { select: { id: true, plateNumber: true, make: true, model: true, capacityKg: true, status: true } },
      },
    });

    if (!driver) throw new NotFoundException('Driver profile not found');
    return driver;
  }

  async updateLocation(userId: string, currentLatitude: number, currentLongitude: number) {
    const driver = await this.prisma.driver.findUnique({ where: { userId } });
    if (!driver) throw new NotFoundException('Driver profile not found');

    return this.prisma.driver.update({
      where: { userId },
      data: {
        currentLatitude,
        currentLongitude,
        lastLocationAt: new Date(),
      },
      select: {
        id: true,
        currentLatitude: true,
        currentLongitude: true,
        lastLocationAt: true,
      }
    });
  }

  async updateStatus(userId: string, dto: UpdateDriverStatusDto) {
    const driver = await this.prisma.driver.findUnique({ where: { userId } });
    if (!driver) throw new NotFoundException('Driver profile not found');
    
    if (driver.isBlacklisted) {
      throw new ForbiddenException('Your account is blacklisted. Contact support.');
    }
    
    return this.prisma.driver.update({
      where: { userId },
      data: {
        ...(dto.isOnline !== undefined && { isOnline: dto.isOnline }),
        ...(dto.isAvailable !== undefined && { isAvailable: dto.isAvailable }),
      }
    });
  }

  async findAvailableDrivers(latitude: number, longitude: number, radiusKm: number, requiredCapacityKg: number) {
    const drivers = await this.prisma.driver.findMany({
      where: {
        isOnline: true,
        isAvailable: true,
        isBlacklisted: false,
        licenseVerified: true,
        currentLatitude: { not: null },
        currentLongitude: { not: null },
      },
      include: {
        vehicle: true,
        user: { select: { fullName: true, phone: true } }
      }
    });

    return drivers.filter(d => {
      if (requiredCapacityKg > 0 && (!d.vehicle || d.vehicle.capacityKg < requiredCapacityKg)) {
        return false;
      }
      
      const distance = this.haversine(latitude, longitude, d.currentLatitude!, d.currentLongitude!);
      return distance <= radiusKm;
    });
  }

  private haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(value: number) {
    return value * Math.PI / 180;
  }
}
