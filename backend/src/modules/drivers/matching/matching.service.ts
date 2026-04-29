import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { VehicleType } from '@prisma/client';

// PRD §44.1 — Driver Matching Engine
// Matches a booking to eligible drivers based on:
//   1. Proximity to pickup location (within configurable radius)
//   2. Online + available status
//   3. Not blacklisted
//   4. Vehicle type matches booking requirement
//   5. Vehicle capacity meets cargo weight
//   6. Vehicle status ACTIVE
//   7. No conflicting active trip
//   8. Rating meets minimum threshold (configurable)
//   9. Active shift (checked via DriverShift)
// Returns ranked list — nearest first, then by rating

// PRD §44.1 defaults
const DEFAULT_RADIUS_KM     = 10;
const DEFAULT_MIN_RATING    = 3.5;
const DEFAULT_MAX_RESULTS   = 10;

const ACTIVE_TRIP_STATUSES  = [
  'ACCEPTED', 'ARRIVED', 'PICKED',
  'IN_TRANSIT', 'ARRIVED_AT_DESTINATION', 'DELIVERY_VERIFICATION',
];

export interface MatchedDriver {
  driverId:      string;
  userId:        string;
  fullName:      string;
  phone:         string;
  rating:        number;
  totalTrips:    number;
  distanceKm:    number;
  vehicle: {
    id:          string;
    plateNumber: string;
    type:        VehicleType;
    capacityKg:  number;
  };
  currentLatitude:  number;
  currentLongitude: number;
}

@Injectable()
export class DriverMatchingService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Find matching drivers for a booking ──────────────────────────────────
  // Called by admin/assignment engine before assigning a driver

  async findMatchingDrivers(params: {
    pickupLatitude:  number;
    pickupLongitude: number;
    vehicleType:     VehicleType;
    cargoWeightKg?:  number;
    radiusKm?:       number;
    minRating?:      number;
    maxResults?:     number;
  }): Promise<MatchedDriver[]> {
    const {
      pickupLatitude,
      pickupLongitude,
      vehicleType,
      cargoWeightKg   = 0,
      radiusKm        = DEFAULT_RADIUS_KM,
      minRating       = DEFAULT_MIN_RATING,
      maxResults      = DEFAULT_MAX_RESULTS,
    } = params;

    // Fetch all online, available, non-blacklisted drivers
    // with an assigned vehicle matching type + capacity
    const candidates = await this.prisma.driver.findMany({
      where: {
        isOnline:       true,
        isAvailable:    true,
        isBlacklisted:  false,
        rating:         { gte: minRating },
        currentLatitude:  { not: null },
        currentLongitude: { not: null },
        // Must have an assigned vehicle of correct type and capacity
        vehicle: {
          type:       vehicleType,
          status:     'ACTIVE',
          capacityKg: { gte: cargoWeightKg },
        },
      },
      include: {
        user:    { select: { id: true, fullName: true, phone: true } },
        vehicle: { select: { id: true, plateNumber: true, type: true, capacityKg: true } },
        shifts:  {
          where:   { status: 'ACTIVE' },
          take:    1,
          orderBy: { shiftStartTime: 'desc' },
        },
      },
    });

    if (candidates.length === 0) return [];

    // Filter: must have active shift (PRD §44.1 — no shift = no assignment)
    const withActiveShift = candidates.filter(d => d.shifts.length > 0);

    // Filter: no conflicting active trip
    const driverIds = withActiveShift.map(d => d.id);
    const busyDriverIds = await this.getBusyDriverIds(driverIds);
    const available = withActiveShift.filter(d => !busyDriverIds.has(d.id));

    // Calculate distance from pickup and filter by radius
    const withDistance = available
      .map(driver => {
        const distanceKm = this.haversineKm(
          pickupLatitude,
          pickupLongitude,
          driver.currentLatitude,
          driver.currentLongitude,
        );
        return { driver, distanceKm };
      })
      .filter(({ distanceKm }) => distanceKm <= radiusKm);

    // Rank: nearest first, then by rating descending
    withDistance.sort((a, b) => {
      if (Math.abs(a.distanceKm - b.distanceKm) < 0.5) {
        // Within 500m — prefer higher rating
        return b.driver.rating - a.driver.rating;
      }
      return a.distanceKm - b.distanceKm;
    });

    return withDistance.slice(0, maxResults).map(({ driver, distanceKm }) => ({
      driverId:         driver.id,
      userId:           driver.user.id,
      fullName:         driver.user.fullName ?? '',
      phone:            driver.user.phone,
      rating:           driver.rating,
      totalTrips:       driver.totalTrips,
      distanceKm:       parseFloat(distanceKm.toFixed(2)),
      vehicle: {
        id:             driver.vehicle.id,
        plateNumber:    driver.vehicle.plateNumber,
        type:           driver.vehicle.type,
        capacityKg:     driver.vehicle.capacityKg,
      },
      currentLatitude:  driver.currentLatitude,
      currentLongitude: driver.currentLongitude,
    }));
  }

  // ── Find matches from a booking record directly ───────────────────────────

  async findForBooking(bookingId: string, options?: {
    radiusKm?:    number;
    minRating?:   number;
    maxResults?:  number;
  }): Promise<MatchedDriver[]> {
    const booking = await this.prisma.booking.findUnique({
      where:   { id: bookingId },
      include: { stops: { orderBy: { sequence: 'asc' }, take: 1 } },
    });

    if (!booking) throw new BadRequestException('Booking not found');

    const pickup = booking.stops[0];
    if (!pickup) throw new BadRequestException('Booking has no pickup stop');

    // Determine required vehicle type from the booking's rate card or stored vehicleId
    // For Phase 1 — vehicle type is inferred from first assigned vehicle or defaults to VAN
    // Phase 3: store vehicleType on Booking directly
    const vehicleType = await this.inferVehicleType(booking);

    return this.findMatchingDrivers({
      pickupLatitude:  pickup.latitude,
      pickupLongitude: pickup.longitude,
      vehicleType,
      cargoWeightKg:   booking.cargoWeightKg ?? 0,
      ...options,
    });
  }

  // ── Update driver GPS location ────────────────────────────────────────────
  // Called by tracking service on every driver location ping

  async updateDriverLocation(driverId: string, latitude: number, longitude: number) {
    return this.prisma.driver.update({
      where: { id: driverId },
      data:  { currentLatitude: latitude, currentLongitude: longitude, lastLocationAt: new Date() },
    });
  }

  // ── Get nearby available drivers (admin map view) ─────────────────────────

  async getNearbyDrivers(latitude: number, longitude: number, radiusKm = 20) {
    const allOnline = await this.prisma.driver.findMany({
      where: {
        isOnline:         true,
        isAvailable:      true,
        isBlacklisted:    false,
        currentLatitude:  { not: null },
        currentLongitude: { not: null },
      },
      include: {
        user:    { select: { fullName: true, phone: true } },
        vehicle: { select: { plateNumber: true, type: true } },
      },
    });

    return allOnline
      .map(d => ({
        driverId:        d.id,
        fullName:        d.user.fullName,
        phone:           d.user.phone,
        rating:          d.rating,
        vehicle:         d.vehicle,
        currentLatitude: d.currentLatitude,
        currentLongitude: d.currentLongitude,
        distanceKm:      parseFloat(
          this.haversineKm(latitude, longitude, d.currentLatitude, d.currentLongitude).toFixed(2)
        ),
      }))
      .filter(d => d.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async getBusyDriverIds(driverIds: string[]): Promise<Set<string>> {
    if (driverIds.length === 0) return new Set();
    const busy = await this.prisma.booking.findMany({
      where: {
        driverId: { in: driverIds },
        status:   { in: ACTIVE_TRIP_STATUSES as any },
      },
      select: { driverId: true },
    });
    return new Set(busy.map(b => b.driverId));
  }

  private async inferVehicleType(booking: any): Promise<VehicleType> {
    if (booking.vehicleId) {
      const vehicle = await this.prisma.vehicle.findUnique({
        where:  { id: booking.vehicleId },
        select: { type: true },
      });
      if (vehicle) return vehicle.type;
    }
    // Default fallback based on cargo weight
    const weight = booking.cargoWeightKg ?? 0;
    if (weight <= 30)   return VehicleType.MOTORBIKE;
    if (weight <= 500)  return VehicleType.VAN;
    if (weight <= 3000) return VehicleType.TRUCK_3T;
    if (weight <= 7000) return VehicleType.TRUCK_7T;
    return VehicleType.TRUCK_14T;
  }

  private haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R    = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a    =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private toRad(deg: number) { return (deg * Math.PI) / 180; }
}