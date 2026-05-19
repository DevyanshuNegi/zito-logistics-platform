import { BadRequestException, Injectable } from '@nestjs/common';
import { BookingStatus, ServiceType, VehicleStatus, VehicleType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  EnforceCapacityDto,
  FleetCapacityQueryDto,
  ForecastQueryDto,
  WarehouseCapacityQueryDto,
} from './dto/capacity-planning.dto';

type WarehouseZoneSnapshot = {
  id: string;
  name: string;
  code: string;
  type: string;
  configuredCapacity: number;
  totalBins: number;
  occupiedBins: number;
  availableBins: number;
  occupancyPercentage: number;
  itemCount: number;
  isFull: boolean;
  isNearFull: boolean;
};

type WarehouseSnapshot = {
  id: string;
  name: string;
  code: string;
  agencyId: string;
  status: string;
  configuredCapacity: number;
  totalBins: number;
  occupiedBins: number;
  availableBins: number;
  occupancyPercentage: number;
  storedItemCount: number;
  zones: WarehouseZoneSnapshot[];
  isFull: boolean;
  isNearFull: boolean;
  recommendation: string;
};

type FleetVehicleSnapshot = {
  id: string;
  plateNumber: string;
  type: VehicleType;
  status: VehicleStatus;
  capacityKg: number;
  driverId: string | null;
  hasAssignedDriver: boolean;
  onlineSignal: boolean;
  dispatchReady: boolean;
  availableNow: boolean;
  activeTripCount: number;
  openBreakdownCount: number;
};

const ACTIVE_TRIP_STATUSES: BookingStatus[] = [
  BookingStatus.ASSIGNED,
  BookingStatus.ACCEPTED,
  BookingStatus.ARRIVED,
  BookingStatus.PICKED,
  BookingStatus.IN_TRANSIT,
  BookingStatus.ARRIVED_AT_DESTINATION,
  BookingStatus.DELIVERY_VERIFICATION,
];

@Injectable()
export class CapacityPlanningService {
  constructor(private readonly prisma: PrismaService) {}

  async warehouse(query: WarehouseCapacityQueryDto = {}) {
    const warehouses = await this.prisma.warehouse.findMany({
      where: {
        ...(query.agencyId && { agencyId: query.agencyId }),
        ...(query.warehouseId && { id: query.warehouseId }),
      },
      orderBy: [{ name: 'asc' }],
      select: {
        id: true,
        name: true,
        code: true,
        agencyId: true,
        status: true,
        _count: {
          select: {
            items: true,
          },
        },
        zones: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
            capacity: true,
            racks: {
              select: {
                bins: {
                  select: {
                    id: true,
                    isOccupied: true,
                    _count: {
                      select: {
                        items: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const snapshots: WarehouseSnapshot[] = warehouses.map((warehouse) => {
      let configuredCapacity = 0;
      let totalBins = 0;
      let occupiedBins = 0;

      const zones = warehouse.zones.map((zone) => {
        const bins = zone.racks.flatMap((rack) => rack.bins);
        const zoneOccupiedBins = bins.filter(
          (bin) => bin.isOccupied || bin._count.items > 0,
        ).length;
        const zoneTotalBins = bins.length;
        const zoneItemCount = bins.reduce((sum, bin) => sum + bin._count.items, 0);
        const occupancyPercentage = zoneTotalBins
          ? Number(((zoneOccupiedBins / zoneTotalBins) * 100).toFixed(2))
          : 0;

        configuredCapacity += zone.capacity;
        totalBins += zoneTotalBins;
        occupiedBins += zoneOccupiedBins;

        return {
          id: zone.id,
          name: zone.name,
          code: zone.code,
          type: zone.type,
          configuredCapacity: zone.capacity,
          totalBins: zoneTotalBins,
          occupiedBins: zoneOccupiedBins,
          availableBins: Math.max(zoneTotalBins - zoneOccupiedBins, 0),
          occupancyPercentage,
          itemCount: zoneItemCount,
          isFull: zoneTotalBins > 0 && zoneOccupiedBins >= zoneTotalBins,
          isNearFull: occupancyPercentage >= 90,
        };
      });

      const occupancyPercentage = totalBins
        ? Number(((occupiedBins / totalBins) * 100).toFixed(2))
        : 0;
      const availableBins = Math.max(totalBins - occupiedBins, 0);
      const isFull = totalBins > 0 && availableBins === 0;
      const isNearFull = occupancyPercentage >= 90;

      return {
        id: warehouse.id,
        name: warehouse.name,
        code: warehouse.code,
        agencyId: warehouse.agencyId,
        status: warehouse.status,
        configuredCapacity,
        totalBins,
        occupiedBins,
        availableBins,
        occupancyPercentage,
        storedItemCount: warehouse._count.items,
        zones,
        isFull,
        isNearFull,
        recommendation: isFull
          ? 'Warehouse is full. Block new warehouse-intake bookings until space is freed.'
          : isNearFull
            ? 'Warehouse is nearing capacity. Prioritize dispatch and zone balancing.'
            : 'Warehouse has usable capacity for additional intake.',
      };
    });

    return {
      generatedAt: new Date().toISOString(),
      summary: {
        totalWarehouses: snapshots.length,
        fullWarehouses: snapshots.filter((warehouse) => warehouse.isFull).length,
        nearFullWarehouses: snapshots.filter((warehouse) => warehouse.isNearFull).length,
        averageOccupancyPercentage: snapshots.length
          ? Number(
              (
                snapshots.reduce((sum, warehouse) => sum + warehouse.occupancyPercentage, 0) /
                snapshots.length
              ).toFixed(2),
            )
          : 0,
      },
      warehouses: snapshots,
    };
  }

  async fleet(query: FleetCapacityQueryDto = {}) {
    const vehicles = await this.buildFleetVehicleSnapshots(query.vehicleType);

    const totalCapacityKg = vehicles.reduce((sum, vehicle) => sum + vehicle.capacityKg, 0);
    const availableVehicles = vehicles.filter((vehicle) => vehicle.availableNow);
    const dispatchReadyVehicles = vehicles.filter((vehicle) => vehicle.dispatchReady);
    const onlineVehicles = vehicles.filter((vehicle) => vehicle.onlineSignal);

    const byType = Object.values(VehicleType).map((vehicleType) => {
      const scoped = vehicles.filter((vehicle) => vehicle.type === vehicleType);
      if (query.vehicleType && vehicleType !== query.vehicleType) {
        return null;
      }

      const typeAvailable = scoped.filter((vehicle) => vehicle.availableNow);
      const typeDispatchReady = scoped.filter((vehicle) => vehicle.dispatchReady);

      return {
        vehicleType,
        totalVehicles: scoped.length,
        availableVehicles: typeAvailable.length,
        dispatchReadyVehicles: typeDispatchReady.length,
        activeTripVehicles: scoped.filter((vehicle) => vehicle.activeTripCount > 0).length,
        blockedByBreakdown: scoped.filter((vehicle) => vehicle.openBreakdownCount > 0).length,
        availableCapacityKg: Number(
          typeAvailable.reduce((sum, vehicle) => sum + vehicle.capacityKg, 0).toFixed(2),
        ),
      };
    }).filter(Boolean);

    return {
      generatedAt: new Date().toISOString(),
      summary: {
        totalVehicles: vehicles.length,
        onlineVehicles: onlineVehicles.length,
        availableVehicles: availableVehicles.length,
        dispatchReadyVehicles: dispatchReadyVehicles.length,
        maintenanceVehicles: vehicles.filter((vehicle) => vehicle.status === VehicleStatus.MAINTENANCE).length,
        suspendedVehicles: vehicles.filter((vehicle) => vehicle.status === VehicleStatus.SUSPENDED).length,
        utilizedOnTrips: vehicles.filter((vehicle) => vehicle.activeTripCount > 0).length,
        totalCapacityKg: Number(totalCapacityKg.toFixed(2)),
        availableCapacityKg: Number(
          availableVehicles.reduce((sum, vehicle) => sum + vehicle.capacityKg, 0).toFixed(2),
        ),
        dispatchReadyCapacityKg: Number(
          dispatchReadyVehicles.reduce((sum, vehicle) => sum + vehicle.capacityKg, 0).toFixed(2),
        ),
      },
      vehicles,
      byType,
    };
  }

  async enforceLimit(input: EnforceCapacityDto) {
    if (input.serviceType === ServiceType.WAREHOUSE) {
      const snapshot = await this.warehouse({ agencyId: input.agencyId });
      const availableWarehouses = snapshot.warehouses
        .filter((warehouse) => !warehouse.isFull)
        .sort((left, right) => left.occupancyPercentage - right.occupancyPercentage);

      if (availableWarehouses.length === 0) {
        throw new BadRequestException(
          'Warehouse capacity is full. New warehouse bookings are blocked until space is freed.',
        );
      }

      const recommendedWarehouse = availableWarehouses[0];
      return {
        allowed: true,
        constraintType: 'WAREHOUSE',
        recommendedWarehouse: {
          id: recommendedWarehouse.id,
          name: recommendedWarehouse.name,
          occupancyPercentage: recommendedWarehouse.occupancyPercentage,
          availableBins: recommendedWarehouse.availableBins,
        },
      };
    }

    const vehicles = await this.buildFleetVehicleSnapshots(input.vehicleType);
    const eligibleVehicles = vehicles
      .filter((vehicle) => vehicle.availableNow)
      .filter((vehicle) =>
        input.cargoWeightKg != null ? vehicle.capacityKg >= input.cargoWeightKg : true,
      )
      .sort((left, right) => left.capacityKg - right.capacityKg);

    if (eligibleVehicles.length === 0) {
      const maxCapacityKg = vehicles.length
        ? Math.max(...vehicles.filter((vehicle) => vehicle.availableNow).map((vehicle) => vehicle.capacityKg), 0)
        : 0;

      throw new BadRequestException(
        input.cargoWeightKg != null && maxCapacityKg > 0
          ? `No available ${input.vehicleType} vehicle can safely handle ${input.cargoWeightKg} kg right now. Highest free capacity is ${maxCapacityKg} kg.`
          : `No available ${input.vehicleType} fleet capacity is free right now. Booking creation is blocked until a vehicle becomes available.`,
      );
    }

    const recommendedVehicle = eligibleVehicles[0];
    return {
      allowed: true,
      constraintType: 'FLEET',
      recommendedVehicle: {
        id: recommendedVehicle.id,
        plateNumber: recommendedVehicle.plateNumber,
        capacityKg: recommendedVehicle.capacityKg,
      },
      availableVehicleCount: eligibleVehicles.length,
    };
  }

  async forecast(query: ForecastQueryDto = {}) {
    const days = query.days ?? 30;
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - (days - 1));

    const bookings = await this.prisma.booking.findMany({
      where: {
        createdAt: { gte: startDate },
      },
      select: {
        createdAt: true,
        serviceType: true,
        requiredVehicleType: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const totalByDay = new Map<string, number>();
    const warehouseByDay = new Map<string, number>();
    const sameWeekdayBuckets = new Map<number, number[]>();
    const serviceMix = new Map<ServiceType, number>();
    const vehicleDemand = new Map<string, number>();

    for (const booking of bookings) {
      const dateKey = booking.createdAt.toISOString().slice(0, 10);
      totalByDay.set(dateKey, (totalByDay.get(dateKey) ?? 0) + 1);

      if (booking.serviceType === ServiceType.WAREHOUSE) {
        warehouseByDay.set(dateKey, (warehouseByDay.get(dateKey) ?? 0) + 1);
      }

      serviceMix.set(
        booking.serviceType,
        (serviceMix.get(booking.serviceType) ?? 0) + 1,
      );

      if (booking.requiredVehicleType) {
        vehicleDemand.set(
          booking.requiredVehicleType,
          (vehicleDemand.get(booking.requiredVehicleType) ?? 0) + 1,
        );
      }
    }

    const history = this.buildDailySeries(startDate, days, totalByDay);
    const warehouseHistory = this.buildDailySeries(startDate, days, warehouseByDay);

    for (const day of history) {
      const weekday = new Date(day.date).getDay();
      sameWeekdayBuckets.set(weekday, [
        ...(sameWeekdayBuckets.get(weekday) ?? []),
        day.bookings,
      ]);
    }

    const recentWindow = history.slice(-7);
    const recentAverage =
      recentWindow.length > 0
        ? recentWindow.reduce((sum, day) => sum + day.bookings, 0) / recentWindow.length
        : 0;
    const recentWarehouseAverage =
      warehouseHistory.slice(-7).length > 0
        ? warehouseHistory.slice(-7).reduce((sum, day) => sum + day.bookings, 0) /
          warehouseHistory.slice(-7).length
        : 0;

    const upcoming = Array.from({ length: 7 }, (_, index) => {
      const forecastDate = new Date();
      forecastDate.setHours(0, 0, 0, 0);
      forecastDate.setDate(forecastDate.getDate() + index + 1);
      const weekday = forecastDate.getDay();
      const weekdaySeries = sameWeekdayBuckets.get(weekday) ?? [];
      const weekdayAverage =
        weekdaySeries.length > 0
          ? weekdaySeries.reduce((sum, value) => sum + value, 0) / weekdaySeries.length
          : recentAverage;
      const projectedBookings = Math.max(
        0,
        Math.round(weekdayAverage * 0.6 + recentAverage * 0.4),
      );
      const projectedWarehouseBookings = Math.max(
        0,
        Math.round(recentWarehouseAverage),
      );

      return {
        date: forecastDate.toISOString().slice(0, 10),
        projectedBookings,
        projectedWarehouseBookings,
      };
    });

    const currentWarehouse = await this.warehouse();
    const currentFleet = await this.fleet();

    return {
      generatedAt: new Date().toISOString(),
      historyWindowDays: days,
      history,
      warehouseHistory,
      upcoming,
      serviceMix: Object.values(ServiceType).map((serviceType) => ({
        serviceType,
        bookingCount: serviceMix.get(serviceType) ?? 0,
      })),
      vehicleDemand: Object.values(VehicleType).map((vehicleType) => ({
        vehicleType,
        bookingCount: vehicleDemand.get(vehicleType) ?? 0,
      })),
      currentPressure: {
        warehouseAverageOccupancyPercentage:
          currentWarehouse.summary.averageOccupancyPercentage,
        fleetAvailableVehicles: currentFleet.summary.availableVehicles,
        forecastedDailyAverageBookings: Number(recentAverage.toFixed(2)),
      },
      notes: [
        'Forecast uses recent booking history with a same-weekday weighting for the next seven days.',
        'Warehouse capacity pressure is derived from live bin occupancy because the current schema does not store a separate reserved-space ledger.',
      ],
    };
  }

  private async buildFleetVehicleSnapshots(vehicleType?: VehicleType) {
    const freshnessCutoff = new Date(
      Date.now() - Number(process.env.CAPACITY_PLANNING_GPS_FRESHNESS_MINUTES ?? 20) * 60 * 1000,
    );

    const vehicles = await this.prisma.vehicle.findMany({
      where: {
        ...(vehicleType && { type: vehicleType }),
      },
      orderBy: [{ type: 'asc' }, { plateNumber: 'asc' }],
      select: {
        id: true,
        plateNumber: true,
        type: true,
        status: true,
        verificationStatus: true,
        capacityKg: true,
        driverId: true,
        lastGpsAt: true,
        driver: {
          select: {
            id: true,
            isOnline: true,
            isAvailable: true,
            isBlacklisted: true,
          },
        },
        breakdowns: {
          where: {
            status: { not: 'RESOLVED' },
          },
          select: {
            id: true,
          },
        },
        bookings: {
          where: {
            status: { in: ACTIVE_TRIP_STATUSES },
          },
          select: {
            id: true,
          },
        },
      },
    });

    return vehicles.map((vehicle) => {
      const activeTripCount = vehicle.bookings.length;
      const openBreakdownCount = vehicle.breakdowns.length;
      const onlineSignal =
        vehicle.driver?.isOnline === true ||
        (vehicle.lastGpsAt != null && vehicle.lastGpsAt >= freshnessCutoff);
      const hasAssignedDriver = Boolean(vehicle.driverId);
      const availableNow =
        vehicle.status === VehicleStatus.ACTIVE &&
        String(vehicle.verificationStatus ?? '').toUpperCase() === 'APPROVED' &&
        activeTripCount === 0 &&
        openBreakdownCount === 0;
      const dispatchReady =
        availableNow &&
        hasAssignedDriver &&
        vehicle.driver?.isBlacklisted !== true &&
        vehicle.driver?.isAvailable === true &&
        onlineSignal;

      return {
        id: vehicle.id,
        plateNumber: vehicle.plateNumber,
        type: vehicle.type,
        status: vehicle.status,
        capacityKg: vehicle.capacityKg,
        driverId: vehicle.driverId,
        hasAssignedDriver,
        onlineSignal,
        dispatchReady,
        availableNow,
        activeTripCount,
        openBreakdownCount,
      } satisfies FleetVehicleSnapshot;
    });
  }

  private buildDailySeries(
    startDate: Date,
    days: number,
    values: Map<string, number>,
  ) {
    return Array.from({ length: days }, (_, index) => {
      const current = new Date(startDate);
      current.setDate(startDate.getDate() + index);
      const date = current.toISOString().slice(0, 10);
      return {
        date,
        bookings: values.get(date) ?? 0,
      };
    });
  }
}
