import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Cron } from '@nestjs/schedule';

const PRE_EXPIRY_ALERT_DAYS = 15;
const GPS_DIVERGENCE_THRESHOLD_METERS = 500;

@Injectable()
export class FleetExpiryService {
  private readonly logger = new Logger(FleetExpiryService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 7 * * *')
  async checkVehicleDocumentExpiry() {
    this.logger.log('Running vehicle document expiry check...');

    const alertDate = new Date();
    alertDate.setDate(alertDate.getDate() + PRE_EXPIRY_ALERT_DAYS);
    const now = new Date();

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
          include: { user: { select: { id: true, phone: true, email: true, fullName: true } } },
        },
      },
    });

    for (const vehicle of vehicles) {
      const expiries = [
        { document: 'Insurance', expiredAt: vehicle.insuranceExpiry },
        { document: 'Permit Certificate', expiredAt: vehicle.permitExpiry },
      ]
        .filter((d) => d.expiredAt)
        .map((d) => {
          const daysRemaining = Math.ceil(
            (d.expiredAt!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
          );
          return {
            ...d,
            daysRemaining,
            isExpired: daysRemaining <= 0,
            isExpiringSoon: daysRemaining > 0 && daysRemaining <= PRE_EXPIRY_ALERT_DAYS,
          };
        });

      for (const expiry of expiries) {
        if (expiry.isExpired) {
          await this.prisma.vehicle.update({
            where: { id: vehicle.id },
            data: { status: 'SUSPENDED' },
          });

          await this.createExpiryAlert(vehicle.id, expiry.document, expiry.expiredAt!, 'VEHICLE_EXPIRED');
          this.logger.warn(`Vehicle ${vehicle.plateNumber} blocked — ${expiry.document} expired on ${expiry.expiredAt}`);
        } else if (expiry.isExpiringSoon) {
          await this.createExpiryAlert(vehicle.id, expiry.document, expiry.expiredAt!, 'VEHICLE_EXPIRING_SOON');
          this.logger.log(`Vehicle ${vehicle.plateNumber} — ${expiry.document} expires in ${expiry.daysRemaining} days`);
        }
      }
    }

    await this.checkDriverDocumentExpiry(now, alertDate);

    return { checked: vehicles.length };
  }

  private async checkDriverDocumentExpiry(now: Date, alertDate: Date) {
    const drivers = await this.prisma.driver.findMany({
      where: {
        isAvailable: true,
        OR: [
          { licenseExpiry: { lte: alertDate } },
        ],
      },
      include: {
        user: { select: { id: true, phone: true, email: true, fullName: true } },
      },
    });

    for (const driver of drivers) {
      const docs = [
        { name: 'Driving License', expiry: driver.licenseExpiry },
      ].filter((d) => d.expiry);

      for (const doc of docs) {
        const daysRemaining = Math.ceil(
          (doc.expiry!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );

        if (daysRemaining <= 0) {
          await this.prisma.driver.update({
            where: { id: driver.id },
            data: { isAvailable: false },
          });
          this.logger.warn(`Driver ${driver.user.fullName} suspended — ${doc.name} expired`);
        } else if (daysRemaining <= PRE_EXPIRY_ALERT_DAYS) {
          this.logger.log(`Driver ${driver.user.fullName} — ${doc.name} expires in ${daysRemaining}d`);
        }
      }
    }
  }

  async checkGpsDivergence(vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: { driver: true },
    });

    if (!vehicle || !vehicle.driver) return null;

    const driver = vehicle.driver;

    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    if (
      !driver.currentLatitude ||
      !vehicle.deviceGpsLat ||
      (driver.lastLocationAt && driver.lastLocationAt < twoMinutesAgo) ||
      (vehicle.lastGpsAt && vehicle.lastGpsAt < twoMinutesAgo)
    ) {
      return null;
    }

    const distanceMeters = this.haversineDistance(
      driver.currentLatitude,
      driver.currentLongitude!,
      vehicle.deviceGpsLat,
      vehicle.deviceGpsLng!,
    );

    if (distanceMeters > GPS_DIVERGENCE_THRESHOLD_METERS) {
      this.logger.warn(
        `GPS DIVERGENCE ALERT: Vehicle ${vehicle.plateNumber} — driver vs device ${Math.round(distanceMeters)}m apart`,
      );

      await this.prisma.internalAlert.create({
        data: {
          type: 'GPS_DIVERGENCE',
          severity: 'HIGH',
          message: `Vehicle ${vehicle.plateNumber} gps diverging from driver by ${Math.round(distanceMeters)}m.`,
          entityType: 'VEHICLE',
          entityId: vehicleId,
          metadata: {
            driverPosition: { lat: driver.currentLatitude, lng: driver.currentLongitude },
            vehiclePosition: { lat: vehicle.deviceGpsLat, lng: vehicle.deviceGpsLng },
            divergenceMeters: Math.round(distanceMeters),
          },
        },
      });

      return {
        alert: true,
        vehicleId,
        plateNumber: vehicle.plateNumber,
        divergenceMeters: Math.round(distanceMeters),
        driverPosition: { lat: driver.currentLatitude, lng: driver.currentLongitude },
        vehiclePosition: { lat: vehicle.deviceGpsLat, lng: vehicle.deviceGpsLng },
      };
    }

    return { alert: false, divergenceMeters: Math.round(distanceMeters) };
  }

  async updateVehicleGps(vehicleId: string, lat: number, lng: number) {
    return this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: { deviceGpsLat: lat, deviceGpsLng: lng, lastGpsAt: new Date() },
    });
  }

  private async createExpiryAlert(vehicleId: string, document: string, expiryDate: Date, type: string) {
    await this.prisma.internalAlert.create({
      data: {
        type: 'DOCUMENT_EXPIRY',
        severity: 'MEDIUM',
        message: `${document} for vehicle ${type} expires/expired on ${expiryDate}`,
        entityType: 'VEHICLE',
        entityId: vehicleId,
        metadata: { document, expiryDate, type },
      },
    });
  }

  private haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
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
