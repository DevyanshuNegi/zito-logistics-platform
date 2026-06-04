import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AccountStatus } from '@prisma/client';
import { TrackingService } from './tracking.service';
import { websocketCorsOptions } from '../../config/cors.config';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * PRD §26: Real-time GPS tracking gateway.
 *
 * Rooms:
 *   booking:{bookingId}  — Customer joins to receive driver location for their booking
 *   driver:{driverId}    — Driver's own room for receiving assignment notifications
 *   admin:map            — Admin joins to see all active drivers on live map
 *
 * Events emitted:
 *   location-update      — Sent to booking room when driver location changes
 *   driver-online        — Sent to admin:map when driver comes online
 *   driver-offline       — Sent to admin:map when driver disconnects
 */
@WebSocketGateway({
  cors: websocketCorsOptions,
  namespace: '/tracking',
  transports: ['websocket', 'polling'],
})
export class TrackingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TrackingGateway.name);

  // Map of socketId → driverId for disconnect cleanup
  private connectedDrivers = new Map<string, string>();
  private lastLocationBySocket = new Map<string, { at: number; lat: number; lng: number }>();

  constructor(
    private readonly trackingService: TrackingService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  async handleConnection(client: Socket) {
    try {
      const user = await this.authenticateSocket(client);
      client.data.user = user;
      this.logger.log(`Authenticated tracking socket ${client.id} for user ${user.id}`);
    } catch (error) {
      this.logger.warn(
        `Rejected unauthenticated tracking socket ${client.id}: ${
          error instanceof Error ? error.message : 'unauthorized'
        }`,
      );
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const driverId = this.connectedDrivers.get(client.id);
    if (driverId) {
      // Notify admin map that driver went offline
      this.server.to('admin:map').emit('driver-offline', { driverId });
      this.connectedDrivers.delete(client.id);
      this.logger.log(`Driver ${driverId} disconnected`);
    }
    this.lastLocationBySocket.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // ─── Driver: Join Own Room ────────────────────────────────────────────────
  /**
   * Driver calls this after connecting to register their room.
   * Used to receive assignment notifications pushed by the booking engine.
   */
  @SubscribeMessage('driver:join')
  handleDriverJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { driverId: string },
  ) {
    if (!data?.driverId) throw new WsException('driverId required');
    this.assertSocketAuthenticated(client);
    this.assertDriverSocket(client, data.driverId);
    client.join(`driver:${data.driverId}`);
    this.connectedDrivers.set(client.id, data.driverId);
    this.logger.log(`Driver ${data.driverId} joined their room`);
    return { event: 'driver:joined', driverId: data.driverId };
  }

  // ─── Driver: Push Location Update ────────────────────────────────────────
  /**
   * PRD §26: Driver app sends GPS update every ~5 seconds during active trip.
   * Gateway persists to DB via TrackingService and broadcasts to booking room.
   */
  @SubscribeMessage('driver:location')
  async handleLocationUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { driverId: string; bookingId?: string; lat: number; lng: number },
  ) {
    if (!data?.driverId || data.lat == null || data.lng == null) {
      throw new WsException('driverId, lat, and lng are required');
    }
    this.assertSocketAuthenticated(client);
    this.assertDriverSocket(client, data.driverId);
    this.assertValidCoordinates(data.lat, data.lng);
    this.assertLocationRate(client, data.lat, data.lng);

    if (data.bookingId) {
      await this.assertDriverAssignedToBooking(data.driverId, data.bookingId);
    }

    // Persist location to DB
    const location = await this.trackingService.updateDriverLocation(
      data.driverId,
      data.lat,
      data.lng,
      data.bookingId,
    );

    // Broadcast to booking-specific room so customer gets live update
    if (data.bookingId) {
      this.server.to(`booking:${data.bookingId}`).emit('location-update', location);
    }

    // Broadcast to admin map room
    this.server.to('admin:map').emit('driver-location', location);

    return location;
  }

  // ─── Customer: Join Booking Room ─────────────────────────────────────────
  /**
   * Customer joins the room for their booking to receive live driver location.
   * PRD §26: Customer tracking page subscribes via this event.
   */
  @SubscribeMessage('customer:track')
  handleCustomerTrack(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { bookingId: string },
  ) {
    if (!data?.bookingId) throw new WsException('bookingId required');
    this.assertSocketAuthenticated(client);
    void this.assertCustomerCanTrack(client, data.bookingId)
      .then(() => {
        client.join(`booking:${data.bookingId}`);
        this.logger.log(`Customer tracking booking ${data.bookingId}`);
        client.emit('tracking:started', { bookingId: data.bookingId });
      })
      .catch((error) => {
        client.emit('tracking:error', {
          message: error instanceof Error ? error.message : 'Tracking not authorized',
        });
        client.disconnect(true);
      });
    return { event: 'tracking:authorizing', bookingId: data.bookingId };
  }

  // ─── Admin: Join Live Map Room ────────────────────────────────────────────
  /**
   * Admin joins admin:map room to receive all driver location updates.
   * Used by admin dashboard live driver map.
   */
  @SubscribeMessage('admin:map')
  handleAdminMap(@ConnectedSocket() client: Socket) {
    this.assertSocketAuthenticated(client);
    this.assertAdminSocket(client);
    client.join('admin:map');
    this.logger.log(`Admin joined live map room: ${client.id}`);
    return { event: 'admin:map-joined' };
  }

  // ─── Server-side: Push Assignment to Driver ───────────────────────────────
  /**
   * Called by BookingsService when a driver is assigned.
   * Pushes trip details directly to the driver's socket room.
   */
  emitAssignmentToDriver(driverId: string, booking: any) {
    this.server.to(`driver:${driverId}`).emit('trip:assigned', booking);
  }

  /**
   * Called by BookingsService on cancellation.
   */
  emitCancellationToDriver(driverId: string, bookingId: string) {
    this.server.to(`driver:${driverId}`).emit('trip:cancelled', { bookingId });
  }

  private extractToken(client: Socket) {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.trim()) {
      return authToken.replace(/^Bearer\s+/i, '').trim();
    }

    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.toLowerCase().startsWith('bearer ')) {
      return header.slice(7).trim();
    }

    const queryToken = client.handshake.query.token;
    if (typeof queryToken === 'string' && queryToken.trim()) {
      return queryToken.trim();
    }

    return '';
  }

  private async authenticateSocket(client: Socket) {
    const token = this.extractToken(client);
    if (!token) {
      throw new WsException('Tracking socket requires a bearer token');
    }

    const payload = this.jwtService.verify(token);
    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, role: true, status: true, agencyId: true },
    });
    if (!user || user.status !== AccountStatus.ACTIVE) {
      throw new WsException('Tracking socket user is not active');
    }

    const driver =
      user.role === 'DRIVER'
        ? await this.prisma.driver.findUnique({
            where: { userId: user.id },
            select: { id: true },
          })
        : null;

    return {
      id: user.id,
      role: user.role,
      agencyId: user.agencyId,
      driverId: driver?.id ?? null,
    };
  }

  private assertSocketAuthenticated(client: Socket) {
    if (!client.data.user?.id) {
      throw new WsException('Tracking socket is not authenticated');
    }
  }

  private assertDriverSocket(client: Socket, driverId: string) {
    const user = client.data.user;
    if (user?.role !== 'DRIVER' || user.driverId !== driverId) {
      throw new WsException('Drivers can only use their own tracking room');
    }
  }

  private assertAdminSocket(client: Socket) {
    const role = String(client.data.user?.role ?? '').toUpperCase();
    if (!['ADMIN', 'SUPER_ADMIN', 'AGENCY_STAFF'].includes(role)) {
      throw new WsException('Admin live map access is restricted');
    }
  }

  private async assertCustomerCanTrack(client: Socket, bookingId: string) {
    const user = client.data.user;
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { customerId: true, agencyId: true },
    });
    if (!booking) {
      throw new WsException('Booking not found');
    }

    const role = String(user?.role ?? '').toUpperCase();
    if (['ADMIN', 'SUPER_ADMIN'].includes(role)) {
      return;
    }
    if (role === 'AGENCY_STAFF' && user.agencyId && booking.agencyId === user.agencyId) {
      return;
    }
    if (booking.customerId === user.id) {
      return;
    }
    throw new WsException('You can only track your own bookings');
  }

  private async assertDriverAssignedToBooking(driverId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { driverId: true, status: true },
    });
    if (!booking || booking.driverId !== driverId) {
      throw new WsException('Driver is not assigned to this booking');
    }
    if (['CANCELLED', 'COMPLETED', 'REJECTED'].includes(String(booking.status))) {
      throw new WsException('Tracking updates are not allowed for closed bookings');
    }
  }

  private assertValidCoordinates(lat: number, lng: number) {
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      throw new WsException('Invalid GPS coordinates');
    }
  }

  private assertLocationRate(client: Socket, lat: number, lng: number) {
    const now = Date.now();
    const previous = this.lastLocationBySocket.get(client.id);
    if (previous) {
      const seconds = Math.max(1, (now - previous.at) / 1000);
      if (seconds < 2) {
        throw new WsException('GPS updates are rate limited');
      }
      const km = this.distanceKm(previous.lat, previous.lng, lat, lng);
      const speedKmh = (km / seconds) * 3600;
      if (speedKmh > 220) {
        throw new WsException('GPS update rejected as impossible movement');
      }
    }
    this.lastLocationBySocket.set(client.id, { at: now, lat, lng });
  }

  private distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
    const radiusKm = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLng / 2) ** 2;
    return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private toRad(value: number) {
    return (value * Math.PI) / 180;
  }
}
