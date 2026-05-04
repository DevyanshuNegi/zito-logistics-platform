import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { AccountStatus, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateDriverStatusDto } from './dto/update-driver-status.dto';
import { CreateDriverDto } from './dto/create-driver.dto';
import { OnboardPartnerDriverDto } from './dto/onboard-partner-driver.dto';

@Injectable()
export class DriversService {
  constructor(private readonly prisma: PrismaService) {}

  async listDrivers(
    filters: { isAvailable?: boolean; isOnline?: boolean } = {},
    actor?: { id: string; role?: string; activeRole?: string },
  ) {
    return this.prisma.driver.findMany({
      where: {
        ...(filters.isAvailable !== undefined && { isAvailable: filters.isAvailable }),
        ...(filters.isOnline !== undefined && { isOnline: filters.isOnline }),
        ...this.buildOwnershipScope(actor),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            email: true,
            status: true,
          },
        },
        vehicle: { select: { id: true, plateNumber: true, type: true, status: true } },
        ownerUser: {
          select: { id: true, fullName: true, companyName: true, role: true },
        },
      },
    });
  }

  async onboardPartnerDriver(
    dto: OnboardPartnerDriverDto,
    actor?: { id: string; role?: string; activeRole?: string },
  ) {
    const role = this.normalizeRole(actor);
    const ownerUserId =
      this.isOwnedDriverRole(role)
        ? actor?.id ?? null
        : dto.ownerUserId ?? null;
    const normalizedEmail = dto.email?.trim().toLowerCase() || null;
    const normalizedPhone = dto.phone.trim();

    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          normalizedEmail ? { email: normalizedEmail } : undefined,
          { phone: normalizedPhone },
        ].filter(Boolean) as any,
      },
      select: { id: true },
    });
    if (existingUser) {
      throw new ConflictException('Driver user with this email or phone already exists');
    }

    if (ownerUserId) {
      const owner = await this.prisma.user.findUnique({
        where: { id: ownerUserId },
        select: { id: true, role: true },
      });
      if (!owner) {
        throw new NotFoundException('Partner owner account not found');
      }
      if (!this.isOwnedDriverRole(owner.role)) {
        throw new ForbiddenException(
          'Driver ownership can only be assigned to fleet-owning customer or partner accounts.',
        );
      }
    }

    const temporaryPassword = dto.password?.trim() || this.generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    const created = await this.prisma.user.create({
      data: {
        fullName: dto.fullName.trim(),
        email: normalizedEmail,
        phone: normalizedPhone,
        password: hashedPassword,
        role: UserRole.DRIVER,
        status: AccountStatus.PENDING,
        driverProfile: {
          create: {
            ownerUserId,
            licenseNumber: dto.licenseNumber?.trim() || null,
            licenseExpiry: dto.licenseExpiry ? new Date(dto.licenseExpiry) : null,
          },
        },
      },
      include: {
        driverProfile: true,
      },
    });

    return {
      message: 'Driver onboarding draft created. The account remains pending activation.',
      data: {
        id: created.id,
        status: created.status,
        role: created.role,
        temporaryPassword: dto.password ? null : temporaryPassword,
        driver: created.driverProfile,
      },
    };
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

  private normalizeRole(actor?: { role?: string; activeRole?: string }) {
    return String(actor?.activeRole ?? actor?.role ?? '').trim().toUpperCase();
  }

  private buildOwnershipScope(actor?: { id: string; role?: string; activeRole?: string }) {
    const role = this.normalizeRole(actor);
    if (actor?.id && this.isOwnedDriverRole(role)) {
      return { ownerUserId: actor.id };
    }
    return {};
  }

  private isOwnedDriverRole(role?: string | UserRole | null) {
    const normalized = String(role ?? '').trim().toUpperCase();
    return ['AGENT', 'TRANSPORTER', 'CUSTOMER', 'CORPORATE', 'COURIER_COMPANY'].includes(
      normalized,
    );
  }

  private generateTemporaryPassword() {
    return `Drv!${Math.random().toString(36).slice(-8)}A1`;
  }
}
