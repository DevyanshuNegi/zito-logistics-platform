import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RouteOptimizationService } from '../route-optimization/route-optimization.service';

@Injectable()
export class TrackingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly routeOptimizationService: RouteOptimizationService,
  ) {}

  async updateDriverLocation(
    driverId: string,
    lat: number,
    lng: number,
    bookingId?: string,
  ) {
    await this.prisma.driver.update({
      where: { id: driverId },
      data: {
        currentLatitude: lat,
        currentLongitude: lng,
        lastLocationAt: new Date(),
      },
    });

    const updatedAt = new Date();
    let routeDeviationKm: number | null = null;
    let isOffRoute = false;
    let alertStatus: string | null = null;

    if (bookingId) {
      try {
        const deviation = await this.routeOptimizationService.detectDeviation(bookingId, {
          latitude: lat,
          longitude: lng,
        });
        routeDeviationKm = deviation.deviationKm;
        isOffRoute = deviation.isOffRoute;
        alertStatus = deviation.alertStatus;
      } catch {
        routeDeviationKm = null;
      }
    }

    return {
      driverId,
      lat,
      lng,
      bookingId,
      updatedAt,
      timestamp: updatedAt,
      routeDeviationKm,
      isOffRoute,
      alertStatus,
    };
  }

  async getBookingTracking(bookingId: string, customerId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        driver: {
          select: {
            id: true,
            currentLatitude: true,
            currentLongitude: true,
            lastLocationAt: true,
            rating: true,
            user: { select: { fullName: true, phone: true } },
          },
        },
        stops: { orderBy: { sequence: 'asc' } },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.customerId !== customerId) {
      throw new ForbiddenException('You can only track your own bookings');
    }

    const routePlan = await this.routeOptimizationService.calculateForBooking(bookingId);
    const deviation =
      booking.driver?.currentLatitude != null && booking.driver?.currentLongitude != null
        ? await this.routeOptimizationService.detectDeviation(bookingId)
        : null;

    return {
      bookingId: booking.id,
      reference: booking.reference,
      status: booking.status,
      driver: booking.driver
        ? {
            name: booking.driver.user?.fullName,
            phone: booking.driver.user?.phone,
            rating: booking.driver.rating,
            location: {
              lat: booking.driver.currentLatitude,
              lng: booking.driver.currentLongitude,
              updatedAt: booking.driver.lastLocationAt,
            },
          }
        : null,
      stops: booking.stops,
      eta: routePlan.route.eta,
      route: {
        ...routePlan.route,
        deviation,
      },
    };
  }

  async getBookingTrackingAdmin(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        driver: {
          select: {
            id: true,
            currentLatitude: true,
            currentLongitude: true,
            lastLocationAt: true,
            user: { select: { fullName: true, phone: true } },
          },
        },
        stops: { orderBy: { sequence: 'asc' } },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const routePlan = await this.routeOptimizationService.calculateForBooking(bookingId);
    const deviation =
      booking.driver?.currentLatitude != null && booking.driver?.currentLongitude != null
        ? await this.routeOptimizationService.detectDeviation(bookingId)
        : null;

    return {
      ...booking,
      eta: routePlan.route.eta,
      route: {
        ...routePlan.route,
        deviation,
      },
    };
  }

  async getActiveDriversMap(agencyId?: string) {
    const where: any = {
      isOnline: true,
      currentLatitude: { not: null },
      currentLongitude: { not: null },
    };

    const drivers = await this.prisma.driver.findMany({
      where,
      select: {
        id: true,
        currentLatitude: true,
        currentLongitude: true,
        lastLocationAt: true,
        isAvailable: true,
        user: { select: { fullName: true, phone: true } },
        vehicle: { select: { plateNumber: true, type: true } },
      },
    });

    return drivers;
  }
}
