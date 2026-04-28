import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// Schema reality:
// Vehicle fields: deviceGpsLat, deviceGpsLng, lastGpsAt, insuranceExpiry, permitExpiry
//   — NO inspectionExpiry, NO ntsaExpiry, NO isAssignmentBlocked, NO currentDriver
//   — relation name: driver (not currentDriver)
// Driver fields: licenseExpiry, isAvailable, isOnline, isBlacklisted
//   — NO canReceiveAssignments, NO complianceStatus, NO policeClearanceExpiry, NO medicalCertExpiry
//
// @nestjs/schedule may not be installed — using plain interval instead of @Cron

const PRE_EXPIRY_ALERT_DAYS = 15;
const GPS_DIVERGENCE_THRESHOLD_METERS = 500;

@Injectable()
export class FleetExpiryService {
  private readonly logger = new Logger(FleetExpiryService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Call this from a scheduled job in app.module or a cron service
  // Run daily at 07:00
  async checkAllDocumentExpiry(): Promise<{ vehiclesChecked: number; driversChecked: number }> {
    this.logger.log('Running document expiry check...');
    const now = new Date();
    const alertDate = new Date();
    alertDate.setDate(alertDate.getDate() + PRE_EXPIRY_ALERT_DAYS);

    const [vehicleCount, driverCount] = await Promise.all([
      this.checkVehicleExpiry(now, alertDate),
      this.checkDriverExpiry(now, alertDate),
    ]);

    return { vehiclesChecked: vehicleCount, driversChecked: driverCount };
  }

  private async checkVehicleExpiry(now: Date, alertDate: Date): Promise<number> {
    const vehicles = await this.prisma.vehicle.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { insuranceExpiry: { lte: alertDate } },
          { permitExpiry: { lte: alertDate } },
        ],
      },
      include: {
        driver: {
          select: { id: true, userId: true },
        },
      },
    });

    for (const vehicle of vehicles) {
      const docs = [
        { name: 'Insurance', expiry: vehicle.insuranceExpiry },
        { name: 'Permit', expiry: vehicle.permitExpiry },
      ].filter((d) => d.expiry !== null);

      for (const doc of docs) {
        const daysRemaining = Math.ceil(
          (doc.expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );

        if (daysRemaining <= 0) {
          this.logger.warn(`Vehicle ${vehicle.plateNumber} — ${doc.name} EXPIRED`);
          // Suspend vehicle
          await this.prisma.vehicle.update({
            where: { id: vehicle.id },
            data: { status: 'SUSPENDED' },
          });
          await this.createSystemAlert('VEHICLE', vehicle.id, `${doc.name} expired`, 'HIGH');
        } else if (daysRemaining <= PRE_EXPIRY_ALERT_DAYS) {
          this.logger.log(`Vehicle ${vehicle.plateNumber} — ${doc.name} expires in ${daysRemaining}d`);
          await this.createSystemAlert('VEHICLE', vehicle.id, `${doc.name} expires in ${daysRemaining} days`, 'MEDIUM');
        }
      }
    }

    return vehicles.length;
  }

  private async checkDriverExpiry(now: Date, alertDate: Date): Promise<number> {
    const drivers = await this.prisma.driver.findMany({
      where: {
        licenseExpiry: { lte: alertDate },
        isBlacklisted: false,
      },
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true } },
      },
    });

    for (const driver of drivers) {
      if (!driver.licenseExpiry) continue;

      const daysRemaining = Math.ceil(
        (driver.licenseExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysRemaining <= 0) {
        this.logger.warn(`Driver ${driver.user.fullName} — Licence EXPIRED`);
        // Block driver from receiving assignments
        await this.prisma.driver.update({
          where: { id: driver.id },
          data: { isAvailable: false },
        });
        await this.createSystemAlert('DRIVER', driver.id, 'Driving licence expired', 'HIGH');
      } else if (daysRemaining <= PRE_EXPIRY_ALERT_DAYS) {
        this.logger.log(`Driver ${driver.user.fullName} — Licence expires in ${daysRemaining}d`);
        await this.createSystemAlert('DRIVER', driver.id, `Licence expires in ${daysRemaining} days`, 'MEDIUM');
      }
    }

    return drivers.length;
  }

  // Dual GPS divergence check — driver mobile vs vehicle hardware GPS
  // Call from tracking service when processing location updates
  async checkGpsDivergence(vehicleId: string): Promise<{
    alert: boolean;
    divergenceMeters?: number;
    message?: string;
  }> {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        driver: {
          select: {
            id: true,
            currentLatitude: true,
            currentLongitude: true,
            lastLocationAt: true,
          },
        },
      },
    });

    if (!vehicle || !vehicle.driver) return { alert: false };
    if (!vehicle.deviceGpsLat || !vehicle.deviceGpsLng) return { alert: false };
    if (!vehicle.driver.currentLatitude || !vehicle.driver.currentLongitude) return { alert: false };

    // Reject stale data (older than 2 minutes)
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    if (vehicle.lastGpsAt && vehicle.lastGpsAt < twoMinutesAgo) return { alert: false };
    if (vehicle.driver.lastLocationAt && vehicle.driver.lastLocationAt < twoMinutesAgo) return { alert: false };

    const distanceMeters = this.haversineMeters(
      vehicle.driver.currentLatitude,
      vehicle.driver.currentLongitude,
      vehicle.deviceGpsLat,
      vehicle.deviceGpsLng,
    );

    if (distanceMeters > GPS_DIVERGENCE_THRESHOLD_METERS) {
      this.logger.warn(
        `GPS DIVERGENCE: Vehicle ${vehicle.plateNumber} — ${Math.round(distanceMeters)}m between driver and vehicle`,
      );
      await this.createSystemAlert(
        'VEHICLE',
        vehicleId,
        `GPS divergence detected: ${Math.round(distanceMeters)}m`,
        'HIGH',
      );
      return {
        alert: true,
        divergenceMeters: Math.round(distanceMeters),
        message: `Driver and vehicle GPS positions are ${Math.round(distanceMeters)}m apart`,
      };
    }

    return { alert: false, divergenceMeters: Math.round(distanceMeters) };
  }

  // Update vehicle hardware GPS (called by IoT device webhook)
  async updateVehicleGps(vehicleId: string, lat: number, lng: number) {
    return this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        deviceGpsLat: lat,
        deviceGpsLng: lng,
        lastGpsAt: new Date(),
      },
    });
  }

  private async createSystemAlert(entityType: string, entityId: string, message: string, severity: string) {
    try {
      await this.prisma.internalAlert.create({
        data: {
          type: 'DOCUMENT_EXPIRY',
          severity,
          message,
          entityType,
          entityId,
          status: 'PENDING',
        },
      });
    } catch {
      // Never crash main expiry flow
    }
  }

  private haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private toRad(deg: number) {
    return (deg * Math.PI) / 180;
  }
}
