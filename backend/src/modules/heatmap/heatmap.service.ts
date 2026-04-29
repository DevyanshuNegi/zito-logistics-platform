import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, Prisma, SurgeZone } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SetHeatmapThresholdsDto } from './dto/heatmap-thresholds.dto';

type GeoPoint = {
  latitude: number;
  longitude: number;
};

type HeatmapIntensity = 'LOW' | 'MEDIUM' | 'HIGH';

type HeatmapZoneSnapshot = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  demandCount: number;
  supplyCount: number;
  demandSupplyRatio: number;
  intensity: HeatmapIntensity;
  recommendedAction: string;
  distanceFromDriverKm?: number | null;
};

type HeatmapThresholds = {
  low: number;
  medium: number;
  high: number;
};

const DEMAND_STATUSES: BookingStatus[] = [
  BookingStatus.CREATED,
  BookingStatus.SEARCHING,
  BookingStatus.APPROVED,
  BookingStatus.ASSIGNED,
  BookingStatus.ACCEPTED,
  BookingStatus.ARRIVED,
];

@Injectable()
export class HeatmapService {
  private thresholds: HeatmapThresholds = {
    low: 0,
    medium: 1.2,
    high: 2,
  };

  constructor(private readonly prisma: PrismaService) {}

  async calcDemand() {
    const [zones, bookings, drivers] = await Promise.all([
      this.getZonesOrThrow(),
      this.prisma.booking.findMany({
        where: {
          status: { in: DEMAND_STATUSES },
        },
        include: {
          stops: {
            orderBy: { sequence: 'asc' },
            take: 1,
            select: {
              latitude: true,
              longitude: true,
            },
          },
        },
      }),
      this.prisma.driver.findMany({
        where: {
          isOnline: true,
          isAvailable: true,
          isBlacklisted: false,
          currentLatitude: { not: null },
          currentLongitude: { not: null },
        },
        select: {
          id: true,
          currentLatitude: true,
          currentLongitude: true,
        },
      }),
    ]);

    const snapshots = zones.map((zone) => {
      const demandCount = bookings.filter((booking) => {
        const pickup = booking.stops[0];
        return pickup
          ? this.isPointInsideZone(
              { latitude: pickup.latitude, longitude: pickup.longitude },
              zone,
            )
          : false;
      }).length;
      const supplyCount = drivers.filter((driver) =>
        this.isPointInsideZone(
          {
            latitude: driver.currentLatitude!,
            longitude: driver.currentLongitude!,
          },
          zone,
        ),
      ).length;
      const ratio = supplyCount === 0 ? demandCount : demandCount / supplyCount;
      const roundedRatio = this.round(ratio);
      const intensity = this.classifyIntensity(roundedRatio);

      return {
        id: zone.id,
        name: zone.name,
        latitude: zone.latitude,
        longitude: zone.longitude,
        radiusKm: zone.radiusKm,
        demandCount,
        supplyCount,
        demandSupplyRatio: roundedRatio,
        intensity,
        recommendedAction: this.buildRecommendation(intensity, demandCount, supplyCount),
      } satisfies HeatmapZoneSnapshot;
    });

    return {
      generatedAt: new Date().toISOString(),
      thresholds: this.thresholds,
      summary: {
        totalZones: snapshots.length,
        highZones: snapshots.filter((zone) => zone.intensity === 'HIGH').length,
        mediumZones: snapshots.filter((zone) => zone.intensity === 'MEDIUM').length,
        lowZones: snapshots.filter((zone) => zone.intensity === 'LOW').length,
      },
      zones: snapshots.sort((left, right) => right.demandSupplyRatio - left.demandSupplyRatio),
    };
  }

  async getDriverHeatmap(driverId: string) {
    const [snapshot, driver] = await Promise.all([
      this.calcDemand(),
      this.prisma.driver.findUnique({
        where: { id: driverId },
        select: {
          id: true,
          currentLatitude: true,
          currentLongitude: true,
          user: {
            select: {
              fullName: true,
            },
          },
        },
      }),
    ]);

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    const driverLocation =
      driver.currentLatitude != null && driver.currentLongitude != null
        ? {
            latitude: driver.currentLatitude,
            longitude: driver.currentLongitude,
          }
        : null;

    const zones = snapshot.zones.map((zone) => ({
      ...zone,
      distanceFromDriverKm: driverLocation
        ? this.round(
            this.distanceKm(
              driverLocation.latitude,
              driverLocation.longitude,
              zone.latitude,
              zone.longitude,
            ),
          )
        : null,
    }));
    const suggestions = zones
      .filter((zone) => zone.intensity !== 'LOW')
      .sort((left, right) => {
        if (right.demandSupplyRatio !== left.demandSupplyRatio) {
          return right.demandSupplyRatio - left.demandSupplyRatio;
        }
        return (left.distanceFromDriverKm ?? Number.POSITIVE_INFINITY) -
          (right.distanceFromDriverKm ?? Number.POSITIVE_INFINITY);
      })
      .slice(0, 3)
      .map((zone, index) => ({
        rank: index + 1,
        zoneId: zone.id,
        zoneName: zone.name,
        intensity: zone.intensity,
        demandSupplyRatio: zone.demandSupplyRatio,
        distanceFromDriverKm: zone.distanceFromDriverKm,
        recommendation:
          zone.intensity === 'HIGH'
            ? 'Move now for the strongest booking demand.'
            : 'Stage nearby to improve pickup odds.',
      }));

    return {
      generatedAt: snapshot.generatedAt,
      thresholds: snapshot.thresholds,
      driver: {
        id: driver.id,
        name: driver.user?.fullName ?? 'Driver',
        location: driverLocation,
      },
      zones,
      suggestions,
    };
  }

  getThresholds() {
    return {
      ...this.thresholds,
      updatedAt: new Date().toISOString(),
    };
  }

  async setThresholds(dto: SetHeatmapThresholdsDto, actorId: string) {
    if (!(dto.low <= dto.medium && dto.medium <= dto.high)) {
      throw new BadRequestException(
        'Heatmap thresholds must satisfy low <= medium <= high',
      );
    }

    this.thresholds = {
      low: dto.low,
      medium: dto.medium,
      high: dto.high,
    };

    await this.writeAudit(
      actorId,
      'HEATMAP_THRESHOLDS_UPDATED',
      'HEATMAP_THRESHOLDS',
      'SYSTEM',
      {
      thresholds: this.thresholds,
      },
    );

    return this.getThresholds();
  }

  private classifyIntensity(ratio: number): HeatmapIntensity {
    if (ratio >= this.thresholds.high) {
      return 'HIGH';
    }
    if (ratio >= this.thresholds.medium) {
      return 'MEDIUM';
    }
    return 'LOW';
  }

  private buildRecommendation(
    intensity: HeatmapIntensity,
    demandCount: number,
    supplyCount: number,
  ) {
    if (intensity === 'HIGH') {
      return supplyCount === 0
        ? 'No active drivers nearby. Move into this zone immediately.'
        : 'Demand is outpacing supply. Reposition here now.';
    }
    if (intensity === 'MEDIUM') {
      return 'Balanced opportunity. Stage close to this zone for the next dispatch.';
    }
    return demandCount === 0
      ? 'Quiet zone. Stay mobile unless directed otherwise.'
      : 'Coverage is healthy. Keep current positioning unless a better zone spikes.';
  }

  private async getZonesOrThrow() {
    const zones = await this.prisma.surgeZone.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });

    if (zones.length === 0) {
      throw new NotFoundException(
        'No configured zones found. Create surge zones first so the driver heatmap has zone geometry.',
      );
    }

    return zones;
  }

  private isPointInsideZone(point: GeoPoint, zone: SurgeZone) {
    return (
      this.distanceKm(point.latitude, point.longitude, zone.latitude, zone.longitude) <=
      zone.radiusKm
    );
  }

  private distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private toRad(value: number) {
    return (value * Math.PI) / 180;
  }

  private round(value: number) {
    return Number(value.toFixed(2));
  }

  private async writeAudit(
    userId: string,
    action: string,
    entityId: string,
    entityType: string,
    details: Record<string, unknown>,
  ) {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return;
      }

      await this.prisma.auditLog.create({
        data: {
          userId,
          action,
          entityType,
          entityId,
          details: details as Prisma.InputJsonValue,
        },
      });
    } catch {
      // Threshold updates should not fail because audit logging needs retry.
    }
  }
}
