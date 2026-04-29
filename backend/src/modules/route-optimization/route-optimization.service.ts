import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CalculateRouteDto,
  DetectDeviationDto,
  RecalculateRouteDto,
  RoutePointDto,
} from './dto/route-optimization.dto';

type RouteStop = {
  latitude: number;
  longitude: number;
  label: string;
  address?: string | null;
  sequence?: number | null;
};

type RoutePoint = {
  latitude: number;
  longitude: number;
};

type RouteLeg = {
  from: string;
  to: string;
  distanceKm: number;
  durationMinutes: number;
};

type RoutePlan = {
  source: 'google-directions' | 'fallback';
  optimized: boolean;
  trafficLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  distanceKm: number;
  durationMinutes: number;
  eta: string | null;
  estimatedArrivalAt: string | null;
  path: RoutePoint[];
  stops: RouteStop[];
  legs: RouteLeg[];
  waypointOrder: number[];
  notes: string[];
  recalculationReason?: string | null;
};

type RouteCalculationOptions = {
  currentLocation?: RouteStop | null;
  optimizeStops?: boolean;
  considerTraffic?: boolean;
  includeCurrentLocation?: boolean;
  reason?: string | null;
};

const ACTIVE_TRACKING_STATUSES: BookingStatus[] = [
  BookingStatus.ASSIGNED,
  BookingStatus.ACCEPTED,
  BookingStatus.ARRIVED,
  BookingStatus.PICKED,
  BookingStatus.IN_TRANSIT,
  BookingStatus.ARRIVED_AT_DESTINATION,
  BookingStatus.DELIVERY_VERIFICATION,
];

@Injectable()
export class RouteOptimizationService {
  constructor(private readonly prisma: PrismaService) {}

  async calculate(dto: CalculateRouteDto) {
    const route = await this.buildRoutePlan(this.normalizeStops(dto.stops), {
      currentLocation: dto.currentLocation
        ? this.normalizePoint(dto.currentLocation, dto.currentLocation.label ?? 'Driver')
        : null,
      optimizeStops: dto.optimizeStops ?? dto.stops.length > 2,
      considerTraffic: dto.considerTraffic ?? true,
      includeCurrentLocation: true,
    });

    return {
      generatedAt: new Date().toISOString(),
      route,
    };
  }

  async optimizeStops(dto: CalculateRouteDto) {
    const stops = this.normalizeStops(dto.stops);
    const optimized = this.optimizeWaypointOrder(stops);
    const route = await this.buildRoutePlan(stops, {
      currentLocation: dto.currentLocation
        ? this.normalizePoint(dto.currentLocation, dto.currentLocation.label ?? 'Driver')
        : null,
      optimizeStops: true,
      considerTraffic: dto.considerTraffic ?? true,
      includeCurrentLocation: true,
    });

    return {
      optimizedStops: optimized.stops,
      waypointOrder: optimized.waypointOrder,
      route,
    };
  }

  async calculateForBooking(
    bookingId: string,
    options: RouteCalculationOptions = {},
  ) {
    const booking = await this.getBookingRouteContext(bookingId);
    const currentLocation =
      options.currentLocation ??
      (booking.driver?.currentLatitude != null &&
      booking.driver?.currentLongitude != null
        ? {
            latitude: booking.driver.currentLatitude,
            longitude: booking.driver.currentLongitude,
            label: 'Driver',
            address: booking.driver.user?.fullName ?? booking.driver.id,
          }
        : null);

    const route = await this.buildRoutePlan(
      booking.stops.map((stop) => ({
        latitude: stop.latitude,
        longitude: stop.longitude,
        label: stop.sequence ? `Stop ${stop.sequence}` : stop.stopType,
        address: stop.address,
        sequence: stop.sequence,
      })),
      {
        currentLocation,
        optimizeStops: options.optimizeStops ?? booking.stops.length > 2,
        considerTraffic: options.considerTraffic ?? true,
        includeCurrentLocation: options.includeCurrentLocation ?? true,
        reason: options.reason ?? null,
      },
    );

    return {
      bookingId: booking.id,
      bookingReference: booking.reference,
      status: booking.status,
      route,
    };
  }

  async detectDeviation(bookingId: string, dto?: DetectDeviationDto) {
    const booking = await this.getBookingRouteContext(bookingId);
    const livePoint = dto
      ? { latitude: dto.latitude, longitude: dto.longitude }
      : booking.driver?.currentLatitude != null &&
          booking.driver?.currentLongitude != null
        ? {
            latitude: booking.driver.currentLatitude,
            longitude: booking.driver.currentLongitude,
          }
        : null;

    if (!livePoint) {
      return {
        bookingId,
        isOffRoute: false,
        deviationKm: 0,
        thresholdKm: Number(process.env.ROUTE_DEVIATION_THRESHOLD_KM ?? 3),
        alertStatus: null,
        routeAvailable: false,
      };
    }

    const routePlan = await this.calculateForBooking(bookingId, {
      includeCurrentLocation: false,
      optimizeStops: booking.stops.length > 2,
      considerTraffic: true,
    });
    const thresholdKm = dto?.thresholdKm ?? Number(process.env.ROUTE_DEVIATION_THRESHOLD_KM ?? 3);
    const deviationKm = this.distanceFromRouteKm(livePoint, routePlan.route.path);
    const isOffRoute =
      ACTIVE_TRACKING_STATUSES.includes(booking.status) &&
      deviationKm > thresholdKm;

    let alertStatus: string | null = null;
    if (isOffRoute) {
      const alert = await this.upsertDeviationAlert(booking, deviationKm, thresholdKm);
      alertStatus = alert.status;
    } else {
      const alert = await this.resolveDeviationAlert(booking.id, deviationKm);
      alertStatus = alert?.status ?? null;
    }

    return {
      bookingId,
      bookingReference: booking.reference,
      isOffRoute,
      deviationKm: this.round(deviationKm),
      thresholdKm,
      alertStatus,
      routeAvailable: routePlan.route.path.length > 1,
    };
  }

  async recalculate(bookingId: string, dto: RecalculateRouteDto, actorId?: string) {
    const reason = dto.reason?.trim() || 'Traffic or road-block update';
    const currentLocation = dto.currentLocation
      ? this.normalizePoint(dto.currentLocation, dto.currentLocation.label ?? 'Driver')
      : null;
    const route = await this.calculateForBooking(bookingId, {
      currentLocation,
      includeCurrentLocation: true,
      optimizeStops: true,
      considerTraffic: dto.considerTraffic ?? true,
      reason,
    });

    await this.writeAudit(actorId ?? null, 'ROUTE_RECALCULATED', bookingId, {
      reason,
      source: route.route.source,
      optimized: route.route.optimized,
      durationMinutes: route.route.durationMinutes,
      distanceKm: route.route.distanceKm,
    });

    return {
      ...route,
      recalculatedAt: new Date().toISOString(),
    };
  }

  private async buildRoutePlan(
    stops: RouteStop[],
    options: RouteCalculationOptions,
  ): Promise<RoutePlan> {
    if (stops.length < 2) {
      throw new BadRequestException('At least two route stops are required');
    }

    const optimize = options.optimizeStops ?? stops.length > 2;
    const ordered = optimize ? this.optimizeWaypointOrder(stops) : {
      stops,
      waypointOrder: stops.map((_, index) => index),
    };
    const trafficLevel = this.resolveTrafficLevel(options.considerTraffic ?? true);
    const fullPathStops = [
      ...(options.includeCurrentLocation !== false && options.currentLocation
        ? [options.currentLocation]
        : []),
      ...ordered.stops,
    ];

    const googleRoute = await this.tryGoogleDirections(
      ordered.stops,
      options.currentLocation ?? null,
      options.includeCurrentLocation !== false,
      optimize,
      trafficLevel,
      options.reason ?? null,
    );
    if (googleRoute) {
      return googleRoute;
    }

    return this.buildFallbackRoute(
      fullPathStops,
      ordered.stops,
      ordered.waypointOrder,
      optimize,
      trafficLevel,
      options.reason ?? null,
    );
  }

  private buildFallbackRoute(
    fullPathStops: RouteStop[],
    orderedStops: RouteStop[],
    waypointOrder: number[],
    optimized: boolean,
    trafficLevel: RoutePlan['trafficLevel'],
    reason: string | null,
  ): RoutePlan {
    const legs: RouteLeg[] = [];
    let distanceKm = 0;
    let durationMinutes = 0;

    for (let index = 0; index < fullPathStops.length - 1; index += 1) {
      const from = fullPathStops[index];
      const to = fullPathStops[index + 1];
      const legDistance = this.distanceKm(
        from.latitude,
        from.longitude,
        to.latitude,
        to.longitude,
      );
      const legDuration = this.estimateDurationMinutes(legDistance, trafficLevel);
      distanceKm += legDistance;
      durationMinutes += legDuration;
      legs.push({
        from: from.label,
        to: to.label,
        distanceKm: this.round(legDistance),
        durationMinutes: this.round(legDuration),
      });
    }

    const dwellMinutes = Math.max(0, orderedStops.length - 1) * 4;
    durationMinutes += dwellMinutes;
    const eta = this.buildEtaLabel(durationMinutes);
    const estimatedArrivalAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();

    return {
      source: 'fallback',
      optimized,
      trafficLevel,
      distanceKm: this.round(distanceKm),
      durationMinutes: this.round(durationMinutes),
      eta,
      estimatedArrivalAt,
      path: fullPathStops.map((stop) => ({
        latitude: stop.latitude,
        longitude: stop.longitude,
      })),
      stops: orderedStops,
      legs,
      waypointOrder,
      notes: [
        'Fallback route uses shortest-stop heuristics until a live Google Maps response is available.',
        ...(reason ? [`Route recalculated because: ${reason}.`] : []),
      ],
      recalculationReason: reason,
    };
  }

  private async tryGoogleDirections(
    orderedStops: RouteStop[],
    currentLocation: RouteStop | null,
    includeCurrentLocation: boolean,
    optimized: boolean,
    trafficLevel: RoutePlan['trafficLevel'],
    reason: string | null,
  ): Promise<RoutePlan | null> {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey || orderedStops.length < 2) {
      return null;
    }

    const useCurrentLocation = includeCurrentLocation && currentLocation;
    const origin = useCurrentLocation
      ? `${currentLocation.latitude},${currentLocation.longitude}`
      : `${orderedStops[0].latitude},${orderedStops[0].longitude}`;
    const destination = `${orderedStops[orderedStops.length - 1].latitude},${orderedStops[orderedStops.length - 1].longitude}`;
    const intermediateStops = useCurrentLocation
      ? orderedStops.slice(0, -1)
      : orderedStops.slice(1, -1);
    const waypointValue =
      intermediateStops.length > 0
        ? `${optimized ? 'optimize:true|' : ''}${intermediateStops
            .map((stop) => `${stop.latitude},${stop.longitude}`)
            .join('|')}`
        : null;

    const params = new URLSearchParams({
      origin,
      destination,
      key: apiKey,
      departure_time: 'now',
      traffic_model: 'best_guess',
      mode: 'driving',
    });
    if (waypointValue) {
      params.set('waypoints', waypointValue);
    }

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`,
      );
      if (!response.ok) {
        return null;
      }

      const payload = (await response.json()) as {
        status?: string;
        routes?: Array<{
          summary?: string;
          waypoint_order?: number[];
          overview_polyline?: { points?: string };
          legs?: Array<{
            distance?: { value?: number };
            duration?: { value?: number };
            duration_in_traffic?: { value?: number };
            start_address?: string;
            end_address?: string;
          }>;
        }>;
      };
      if (payload.status !== 'OK' || !payload.routes?.[0]) {
        return null;
      }

      const primary = payload.routes[0];
      const path = primary.overview_polyline?.points
        ? this.decodePolyline(primary.overview_polyline.points)
        : [];
      const legs = (primary.legs ?? []).map((leg) => {
        const legDurationSeconds =
          leg.duration_in_traffic?.value ?? leg.duration?.value ?? 0;
        return {
          from: leg.start_address ?? 'Origin',
          to: leg.end_address ?? 'Destination',
          distanceKm: this.round((leg.distance?.value ?? 0) / 1000),
          durationMinutes: this.round(legDurationSeconds / 60),
        };
      });
      const distanceKm = this.round(
        legs.reduce((sum, leg) => sum + leg.distanceKm, 0),
      );
      const durationMinutes = this.round(
        legs.reduce((sum, leg) => sum + leg.durationMinutes, 0),
      );
      const estimatedArrivalAt = new Date(
        Date.now() + durationMinutes * 60 * 1000,
      ).toISOString();

      return {
        source: 'google-directions',
        optimized,
        trafficLevel,
        distanceKm,
        durationMinutes,
        eta: this.buildEtaLabel(durationMinutes),
        estimatedArrivalAt,
        path:
          path.length > 0
            ? path
            : [
                ...(useCurrentLocation
                  ? [
                      {
                        latitude: currentLocation.latitude,
                        longitude: currentLocation.longitude,
                      },
                    ]
                  : []),
                ...orderedStops.map((stop) => ({
                  latitude: stop.latitude,
                  longitude: stop.longitude,
                })),
              ],
        stops: orderedStops,
        legs,
        waypointOrder: primary.waypoint_order ?? orderedStops.map((_, index) => index),
        notes: [
          `Google Maps Directions API route${primary.summary ? ` via ${primary.summary}` : ''}.`,
          ...(reason ? [`Route recalculated because: ${reason}.`] : []),
        ],
        recalculationReason: reason,
      };
    } catch {
      return null;
    }
  }

  private optimizeWaypointOrder(stops: RouteStop[]) {
    if (stops.length <= 2) {
      return {
        stops,
        waypointOrder: stops.map((_, index) => index),
      };
    }

    const first = stops[0];
    const last = stops[stops.length - 1];
    const remaining = stops.slice(1, -1).map((stop, index) => ({
      stop,
      originalIndex: index + 1,
    }));
    const ordered: RouteStop[] = [first];
    const waypointOrder = [0];
    let current = first;

    while (remaining.length > 0) {
      remaining.sort(
        (left, right) =>
          this.distanceKm(
            current.latitude,
            current.longitude,
            left.stop.latitude,
            left.stop.longitude,
          ) -
          this.distanceKm(
            current.latitude,
            current.longitude,
            right.stop.latitude,
            right.stop.longitude,
          ),
      );

      const next = remaining.shift();
      if (!next) {
        break;
      }
      ordered.push(next.stop);
      waypointOrder.push(next.originalIndex);
      current = next.stop;
    }

    ordered.push(last);
    waypointOrder.push(stops.length - 1);
    return { stops: ordered, waypointOrder };
  }

  private normalizeStops(stops: RoutePointDto[]) {
    return stops
      .filter(
        (stop) =>
          stop?.latitude != null &&
          stop?.longitude != null &&
          Number.isFinite(stop.latitude) &&
          Number.isFinite(stop.longitude),
      )
      .map((stop, index) => this.normalizePoint(stop, stop.label ?? `Stop ${index + 1}`));
  }

  private normalizePoint(point: RoutePointDto, fallbackLabel: string): RouteStop {
    return {
      latitude: point.latitude,
      longitude: point.longitude,
      label: fallbackLabel,
      address: point.address ?? null,
      sequence: point.sequence ?? null,
    };
  }

  private resolveTrafficLevel(considerTraffic: boolean): RoutePlan['trafficLevel'] {
    if (!considerTraffic) {
      return 'LOW';
    }

    const hour = new Date().getHours();
    if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20)) {
      return 'HIGH';
    }
    if ((hour >= 6 && hour < 7) || (hour > 9 && hour < 11) || (hour >= 15 && hour < 17)) {
      return 'MEDIUM';
    }
    return 'LOW';
  }

  private estimateDurationMinutes(
    distanceKm: number,
    trafficLevel: RoutePlan['trafficLevel'],
  ) {
    const speedKmh =
      trafficLevel === 'HIGH' ? 22 : trafficLevel === 'MEDIUM' ? 30 : 40;
    return (distanceKm / speedKmh) * 60;
  }

  private buildEtaLabel(durationMinutes: number) {
    if (!Number.isFinite(durationMinutes)) {
      return null;
    }
    return `${Math.max(1, Math.round(durationMinutes))} min`;
  }

  private distanceFromRouteKm(point: RoutePoint, route: RoutePoint[]) {
    if (route.length === 0) {
      return 0;
    }
    if (route.length === 1) {
      return this.distanceKm(
        point.latitude,
        point.longitude,
        route[0].latitude,
        route[0].longitude,
      );
    }

    const meanLat =
      route.reduce((sum, stop) => sum + stop.latitude, point.latitude) /
      (route.length + 1);
    const projectedPoint = this.project(point.latitude, point.longitude, meanLat);
    let minDistance = Number.POSITIVE_INFINITY;

    for (let index = 0; index < route.length - 1; index += 1) {
      const start = this.project(route[index].latitude, route[index].longitude, meanLat);
      const end = this.project(route[index + 1].latitude, route[index + 1].longitude, meanLat);
      minDistance = Math.min(
        minDistance,
        this.pointToSegmentDistance(projectedPoint, start, end),
      );
    }

    return minDistance;
  }

  private project(lat: number, lng: number, meanLat: number) {
    return {
      x: lng * 111.32 * Math.cos((meanLat * Math.PI) / 180),
      y: lat * 110.574,
    };
  }

  private pointToSegmentDistance(
    point: { x: number; y: number },
    start: { x: number; y: number },
    end: { x: number; y: number },
  ) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    if (dx === 0 && dy === 0) {
      return Math.sqrt((point.x - start.x) ** 2 + (point.y - start.y) ** 2);
    }

    const t = Math.max(
      0,
      Math.min(
        1,
        ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy),
      ),
    );

    const projectedX = start.x + t * dx;
    const projectedY = start.y + t * dy;
    return Math.sqrt((point.x - projectedX) ** 2 + (point.y - projectedY) ** 2);
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

  private decodePolyline(value: string): RoutePoint[] {
    let index = 0;
    let lat = 0;
    let lng = 0;
    const coordinates: RoutePoint[] = [];

    while (index < value.length) {
      let result = 0;
      let shift = 0;
      let byte: number;
      do {
        byte = value.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
      lat += deltaLat;

      result = 0;
      shift = 0;
      do {
        byte = value.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
      lng += deltaLng;

      coordinates.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5,
      });
    }

    return coordinates;
  }

  private async getBookingRouteContext(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        driver: {
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
        },
        stops: {
          orderBy: { sequence: 'asc' },
          select: {
            sequence: true,
            address: true,
            latitude: true,
            longitude: true,
            stopType: true,
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking ${bookingId} not found`);
    }

    if (booking.stops.length < 2) {
      throw new BadRequestException(
        `Booking ${booking.reference} does not have enough route stops to optimize`,
      );
    }

    return booking;
  }

  private async upsertDeviationAlert(
    booking: {
      id: string;
      reference: string;
      agencyId: string | null;
      driverId: string | null;
    },
    deviationKm: number,
    thresholdKm: number,
  ) {
    const existing = await this.prisma.internalAlert.findFirst({
      where: {
        type: 'ROUTE_DEVIATION',
        entityType: 'BOOKING',
        entityId: booking.id,
      },
      orderBy: { createdAt: 'desc' },
    });

    const metadata = {
      bookingReference: booking.reference,
      driverId: booking.driverId,
      deviationKm: this.round(deviationKm),
      thresholdKm: this.round(thresholdKm),
    } as Prisma.InputJsonValue;

    if (existing) {
      return this.prisma.internalAlert.update({
        where: { id: existing.id },
        data: {
          severity: deviationKm >= thresholdKm * 2 ? 'CRITICAL' : 'HIGH',
          message: `Booking ${booking.reference} is ${deviationKm.toFixed(2)} km off the planned route.`,
          status: 'OPEN',
          metadata,
        },
      });
    }

    return this.prisma.internalAlert.create({
      data: {
        type: 'ROUTE_DEVIATION',
        severity: deviationKm >= thresholdKm * 2 ? 'CRITICAL' : 'HIGH',
        message: `Booking ${booking.reference} is ${deviationKm.toFixed(2)} km off the planned route.`,
        status: 'OPEN',
        agencyId: booking.agencyId,
        entityType: 'BOOKING',
        entityId: booking.id,
        metadata,
      },
    });
  }

  private async resolveDeviationAlert(bookingId: string, deviationKm: number) {
    const existing = await this.prisma.internalAlert.findFirst({
      where: {
        type: 'ROUTE_DEVIATION',
        entityType: 'BOOKING',
        entityId: bookingId,
        status: { in: ['OPEN', 'PENDING'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!existing) {
      return null;
    }

    return this.prisma.internalAlert.update({
      where: { id: existing.id },
      data: {
        status: 'RESOLVED',
        metadata: {
          ...(typeof existing.metadata === 'object' && existing.metadata !== null
            ? (existing.metadata as Record<string, unknown>)
            : {}),
          resolvedDeviationKm: this.round(deviationKm),
          resolvedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    });
  }

  private async writeAudit(
    userId: string | null,
    action: string,
    entityId: string,
    details: Record<string, unknown>,
  ) {
    if (!userId) {
      return;
    }

    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return;
      }

      await this.prisma.auditLog.create({
        data: {
          userId,
          action,
          entityType: 'BOOKING_ROUTE',
          entityId,
          details: details as Prisma.InputJsonValue,
        },
      });
    } catch {
      // Route recalculation should not fail if audit logging needs retry.
    }
  }
}
