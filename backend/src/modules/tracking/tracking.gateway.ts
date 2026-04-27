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
import { TrackingService } from './tracking.service';

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
  cors: {
    origin: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3001')
      .split(',')
      .map((o) => o.trim()),
    credentials: true,
  },
  namespace: '/tracking',
  transports: ['websocket', 'polling'],
})
export class TrackingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TrackingGateway.name);

  // Map of socketId → driverId for disconnect cleanup
  private connectedDrivers = new Map<string, string>();

  constructor(private readonly trackingService: TrackingService) {}

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    const driverId = this.connectedDrivers.get(client.id);
    if (driverId) {
      // Notify admin map that driver went offline
      this.server.to('admin:map').emit('driver-offline', { driverId });
      this.connectedDrivers.delete(client.id);
      this.logger.log(`Driver ${driverId} disconnected`);
    }
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
    client.join(`booking:${data.bookingId}`);
    this.logger.log(`Customer tracking booking ${data.bookingId}`);
    return { event: 'tracking:started', bookingId: data.bookingId };
  }

  // ─── Admin: Join Live Map Room ────────────────────────────────────────────
  /**
   * Admin joins admin:map room to receive all driver location updates.
   * Used by admin dashboard live driver map.
   */
  @SubscribeMessage('admin:map')
  handleAdminMap(@ConnectedSocket() client: Socket) {
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
}