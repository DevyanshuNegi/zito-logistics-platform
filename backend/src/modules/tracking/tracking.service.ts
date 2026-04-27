import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TrackingService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Driver: Update GPS Location (PRD §26) ────────────────────────────────
  /**
   * Called by driver app every N seconds to push live location.
   * Also updates the Driver record's currentLatitude/Longitude.
   */
  async updateDriverLocation(
    driverId: string,
    lat: number,
    lng: number,
    bookingId?: string,
  ) {
    // Update driver's live location in Driver table
    await this.prisma.driver.update({
      where: { id: driverId },
      data: {
        currentLatitude: lat,
        currentLongitude: lng,
        lastLocationAt: new Date(),
      },
    });

    // Return location payload for gateway to broadcast
    return { driverId, lat, lng, bookingId, timestamp: new Date() };
  }

  // ─── Customer: Get Live Tracking Data (PRD §26) ───────────────────────────
  /**
   * Returns current driver location + booking status + ETA for a booking.
   * Customer can only track their own bookings.
   */
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

    if (!booking) throw new NotFoundException('Booking not found');

    // PRD §26: Customer can only track own bookings
    if (booking.customerId !== customerId) {
      throw new ForbiddenException('You can only track your own bookings');
    }

    // Basic ETA — will be replaced with Google Maps in Phase 4
    const eta = this.estimateEta(booking.driver);

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
      eta,
    };
  }

  // ─── Admin: Get Any Booking Tracking (PRD §42) ────────────────────────────
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

    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  // ─── Get All Active Drivers Map (PRD §26, Admin Dashboard) ───────────────
  /**
   * Returns all online drivers with their current GPS positions.
   * Used by Admin live map dashboard.
   */
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

  // ─── ETA Estimation (Phase 1 stub — replaced by Maps API in Phase 4) ──────
  private estimateEta(driver: any): string | null {
    if (!driver?.lastLocationAt) return null;
    const lastUpdate = new Date(driver.lastLocationAt);
    const ageMs = Date.now() - lastUpdate.getTime();
    if (ageMs > 5 * 60 * 1000) return 'Location data stale — driver may be offline';
    // Phase 1: static placeholder — Phase 4 integrates Google Maps Directions API
    return 'ETA available after Google Maps integration (Phase 4)';
  }
}