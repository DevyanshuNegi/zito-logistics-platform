import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, Prisma, SurgeZone } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ActivateSurgeZoneDto,
  CreateSurgeZoneDto,
  OverrideSurgeZoneDto,
  UpdateSurgeZoneDto,
} from './dto/surge-zone.dto';

type GeoPoint = {
  latitude: number;
  longitude: number;
};

type PeakHourRule = {
  id: string;
  name: string;
  days: number[];
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  multiplier: number;
};

type ZoneRatioSnapshot = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  surgeMultiplier: number;
  isActive: boolean;
  activatedAt: string | null;
  deactivatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  demandCount: number;
  supplyCount: number;
  demandSupplyRatio: number;
  demandPressure: 'NORMAL' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
  recommendedZoneMultiplier: number;
  peakHourMultiplier: number;
  suggestedTotalMultiplier: number;
  currentAppliedMultiplier: number;
  activePeakRules: string[];
};

const DEMAND_STATUSES: BookingStatus[] = [
  BookingStatus.CREATED,
  BookingStatus.SEARCHING,
  BookingStatus.APPROVED,
  BookingStatus.ASSIGNED,
  BookingStatus.ACCEPTED,
  BookingStatus.ARRIVED,
];

const DEFAULT_PEAK_HOUR_RULES: PeakHourRule[] = [
  {
    id: 'weekday-morning',
    name: 'Weekday morning commute',
    days: [1, 2, 3, 4, 5],
    startHour: 7,
    startMinute: 0,
    endHour: 9,
    endMinute: 30,
    multiplier: 1.15,
  },
  {
    id: 'weekday-evening',
    name: 'Weekday evening commute',
    days: [1, 2, 3, 4, 5],
    startHour: 17,
    startMinute: 0,
    endHour: 20,
    endMinute: 0,
    multiplier: 1.2,
  },
  {
    id: 'weekend-afternoon',
    name: 'Weekend delivery peak',
    days: [0, 6],
    startHour: 11,
    startMinute: 0,
    endHour: 15,
    endMinute: 0,
    multiplier: 1.1,
  },
];

@Injectable()
export class SurgePricingService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard() {
    const [zones, peakHour] = await Promise.all([
      this.prisma.surgeZone.findMany({
        orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
      }),
      Promise.resolve(this.peakHourRules()),
    ]);

    const snapshots = await Promise.all(zones.map((zone) => this.calcRatio(zone.id, peakHour)));

    return {
      generatedAt: new Date().toISOString(),
      summary: {
        totalZones: snapshots.length,
        activeZones: snapshots.filter((zone) => zone.isActive).length,
        recommendedZones: snapshots.filter((zone) => zone.recommendedZoneMultiplier > 1).length,
        highestSuggestedTotalMultiplier: Math.max(
          1,
          ...snapshots.map((zone) => zone.suggestedTotalMultiplier),
        ),
        peakHourMultiplier: peakHour.activeMultiplier,
      },
      peakHour,
      zones: snapshots,
      notes: [
        'Demand-supply ratio uses open pickup-side bookings against online available drivers inside each surge zone radius.',
        'Peak-hour rules are time-based and schema-free in this phase, so they are delivered as service configuration rather than editable database records.',
      ],
    };
  }

  async list(includeInactive = true) {
    return this.prisma.surgeZone.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async createZone(dto: CreateSurgeZoneDto, actorId: string) {
    const created = await this.prisma.surgeZone.create({
      data: {
        name: dto.name,
        latitude: dto.latitude,
        longitude: dto.longitude,
        radiusKm: dto.radiusKm,
        surgeMultiplier: dto.surgeMultiplier ?? 1.25,
        isActive: dto.isActive ?? false,
        activatedAt: dto.isActive ? new Date() : null,
      },
    });

    await this.writeAudit(actorId, 'SURGE_ZONE_CREATED', created.id, {
      values: created,
    });

    return created;
  }

  async updateZone(id: string, dto: UpdateSurgeZoneDto, actorId: string) {
    await this.findZoneOrThrow(id);

    const updated = await this.prisma.surgeZone.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.latitude !== undefined && { latitude: dto.latitude }),
        ...(dto.longitude !== undefined && { longitude: dto.longitude }),
        ...(dto.radiusKm !== undefined && { radiusKm: dto.radiusKm }),
        ...(dto.surgeMultiplier !== undefined && { surgeMultiplier: dto.surgeMultiplier }),
      },
    });

    await this.writeAudit(actorId, 'SURGE_ZONE_UPDATED', updated.id, {
      values: updated,
    });

    return updated;
  }

  async calcRatio(zoneId: string, peakHour = this.peakHourRules()): Promise<ZoneRatioSnapshot> {
    const zone = await this.findZoneOrThrow(zoneId);
    const [bookings, drivers] = await Promise.all([
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

    const demandCount = bookings.filter((booking) => {
      const pickup = booking.stops[0];
      if (!pickup) {
        return false;
      }
      return this.isPointInsideZone(
        { latitude: pickup.latitude, longitude: pickup.longitude },
        zone,
      );
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

    const demandSupplyRatio =
      supplyCount === 0
        ? demandCount > 0
          ? this.round(demandCount)
          : 0
        : this.round(demandCount / supplyCount);

    const recommendedZoneMultiplier = this.recommendZoneMultiplier(demandSupplyRatio);
    const pressure = this.classifyPressure(demandSupplyRatio);
    const suggestedTotalMultiplier = this.round(
      recommendedZoneMultiplier * peakHour.activeMultiplier,
    );
    const currentAppliedMultiplier = this.round(
      (zone.isActive ? zone.surgeMultiplier : 1) * peakHour.activeMultiplier,
    );

    return {
      id: zone.id,
      name: zone.name,
      latitude: zone.latitude,
      longitude: zone.longitude,
      radiusKm: zone.radiusKm,
      surgeMultiplier: zone.surgeMultiplier,
      isActive: zone.isActive,
      activatedAt: zone.activatedAt?.toISOString() ?? null,
      deactivatedAt: zone.deactivatedAt?.toISOString() ?? null,
      createdAt: zone.createdAt.toISOString(),
      updatedAt: zone.updatedAt.toISOString(),
      demandCount,
      supplyCount,
      demandSupplyRatio,
      demandPressure: pressure,
      recommendedZoneMultiplier,
      peakHourMultiplier: peakHour.activeMultiplier,
      suggestedTotalMultiplier,
      currentAppliedMultiplier,
      activePeakRules: peakHour.activeRules.map((rule) => rule.name),
    };
  }

  async activateZone(id: string, dto: ActivateSurgeZoneDto, actorId: string) {
    const ratio = await this.calcRatio(id);
    const multiplier = dto.surgeMultiplier ?? ratio.recommendedZoneMultiplier;

    if (multiplier < 1) {
      throw new BadRequestException('Surge multiplier must be at least 1');
    }

    const updated = await this.prisma.surgeZone.update({
      where: { id },
      data: {
        isActive: true,
        surgeMultiplier: multiplier,
        activatedAt: new Date(),
        deactivatedAt: null,
      },
    });

    await this.writeAudit(actorId, 'SURGE_ZONE_ACTIVATED', updated.id, {
      reason: dto.reason ?? null,
      appliedMultiplier: multiplier,
      recommendedZoneMultiplier: ratio.recommendedZoneMultiplier,
      demandSupplyRatio: ratio.demandSupplyRatio,
    });

    return updated;
  }

  async deactivateZone(id: string, actorId: string) {
    await this.findZoneOrThrow(id);

    const updated = await this.prisma.surgeZone.update({
      where: { id },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
      },
    });

    await this.writeAudit(actorId, 'SURGE_ZONE_DEACTIVATED', updated.id, {
      deactivatedAt: updated.deactivatedAt?.toISOString() ?? null,
    });

    return updated;
  }

  async override(id: string, dto: OverrideSurgeZoneDto, actorId: string) {
    await this.findZoneOrThrow(id);

    const updated = await this.prisma.surgeZone.update({
      where: { id },
      data: {
        surgeMultiplier: dto.surgeMultiplier,
        isActive: dto.forceActive ?? true,
        activatedAt: dto.forceActive === false ? undefined : new Date(),
        deactivatedAt: dto.forceActive === false ? new Date() : null,
      },
    });

    await this.writeAudit(actorId, 'SURGE_ZONE_OVERRIDE', updated.id, {
      overrideMultiplier: dto.surgeMultiplier,
      forceActive: dto.forceActive ?? true,
      reason: dto.reason ?? null,
    });

    return updated;
  }

  peakHourRules(at = new Date()) {
    const rules = DEFAULT_PEAK_HOUR_RULES.map((rule) => ({
      ...rule,
      isActive: this.isPeakHourRuleActive(rule, at),
      windowLabel: `${this.formatTime(rule.startHour, rule.startMinute)}-${this.formatTime(
        rule.endHour,
        rule.endMinute,
      )}`,
      dayLabels: rule.days.map((day) => this.formatDay(day)),
    }));

    const activeRules = rules.filter((rule) => rule.isActive);
    return {
      evaluatedAt: at.toISOString(),
      activeMultiplier: this.round(
        activeRules.reduce((max, rule) => Math.max(max, rule.multiplier), 1),
      ),
      activeRules,
      rules,
    };
  }

  async resolveMultiplierForStops(stops: Array<GeoPoint>) {
    if (stops.length === 0) {
      return {
        zoneMultiplier: 1,
        peakHourMultiplier: this.peakHourRules().activeMultiplier,
        finalMultiplier: this.peakHourRules().activeMultiplier,
        matchingZones: [],
        activePeakRules: this.peakHourRules().activeRules.map((rule) => rule.name),
      };
    }

    const [activeZones, peakHour] = await Promise.all([
      this.prisma.surgeZone.findMany({
        where: { isActive: true },
        orderBy: { surgeMultiplier: 'desc' },
      }),
      Promise.resolve(this.peakHourRules()),
    ]);

    const matchingZones = activeZones.filter((zone) =>
      stops.some((stop) => this.isPointInsideZone(stop, zone)),
    );
    const zoneMultiplier = this.round(
      Math.max(1, ...matchingZones.map((zone) => zone.surgeMultiplier)),
    );
    const finalMultiplier = this.round(zoneMultiplier * peakHour.activeMultiplier);

    return {
      zoneMultiplier,
      peakHourMultiplier: peakHour.activeMultiplier,
      finalMultiplier,
      matchingZones: matchingZones.map((zone) => ({
        id: zone.id,
        name: zone.name,
        surgeMultiplier: zone.surgeMultiplier,
      })),
      activePeakRules: peakHour.activeRules.map((rule) => rule.name),
    };
  }

  private async findZoneOrThrow(id: string) {
    const zone = await this.prisma.surgeZone.findUnique({ where: { id } });
    if (!zone) {
      throw new NotFoundException(`Surge zone ${id} not found`);
    }
    return zone;
  }

  private recommendZoneMultiplier(ratio: number) {
    if (ratio >= 3) {
      return 1.8;
    }
    if (ratio >= 2) {
      return 1.5;
    }
    if (ratio >= 1.2) {
      return 1.25;
    }
    return 1;
  }

  private classifyPressure(ratio: number): ZoneRatioSnapshot['demandPressure'] {
    if (ratio >= 3) {
      return 'CRITICAL';
    }
    if (ratio >= 2) {
      return 'HIGH';
    }
    if (ratio >= 1.2) {
      return 'ELEVATED';
    }
    return 'NORMAL';
  }

  private isPointInsideZone(point: GeoPoint, zone: SurgeZone) {
    return (
      this.distanceKm(point.latitude, point.longitude, zone.latitude, zone.longitude) <=
      zone.radiusKm
    );
  }

  private isPeakHourRuleActive(rule: PeakHourRule, at: Date) {
    if (!rule.days.includes(at.getDay())) {
      return false;
    }

    const currentMinutes = at.getHours() * 60 + at.getMinutes();
    const startMinutes = rule.startHour * 60 + rule.startMinute;
    const endMinutes = rule.endHour * 60 + rule.endMinute;
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }

  private formatTime(hour: number, minute: number) {
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  private formatDay(day: number) {
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day] ?? 'Day';
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
          entityType: 'SURGE_ZONE',
          entityId,
          details: details as Prisma.InputJsonValue,
        },
      });
    } catch {
      // Surge controls should not fail if audit logging needs retry.
    }
  }
}
