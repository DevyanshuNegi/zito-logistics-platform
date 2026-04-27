import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ cors: true })
export class TrackingGateway {
  @WebSocketServer()
  server: Server;

  @SubscribeMessage('updateLocation')
  handleLocationUpdate(@MessageBody() data: { bookingId: string; lat: number; lng: number }) {
    this.server.emit(`location-${data.bookingId}`, data);
    return data;
  }
}
