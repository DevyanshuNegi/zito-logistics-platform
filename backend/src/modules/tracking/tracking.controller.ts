import { Controller, Get, Patch, Post, Param, Body, Req, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { TrackingService } from './tracking.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CrossBorderHandoffDto } from './dto/cross-border-handoff.dto';

@ApiTags('Tracking')
@ApiBearerAuth('JWT')
@Controller('tracking')
@UseGuards(JwtAuthGuard)
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  /**
   * PRD §26: Customer — get live tracking data for their booking.
   * Returns driver location, ETA, booking status, and stops.
   */
  @Get('booking/:bookingId')
  @ApiOperation({ summary: 'Get live tracking for a booking (PRD §26)' })
  getBookingTracking(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Req() req: any,
  ) {
    return this.trackingService.getBookingTracking(bookingId, req.user.id);
  }

  /**
   * PRD §26, §42: Admin — get tracking for any booking.
   */
  @Get('admin/booking/:bookingId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.AGENCY_STAFF)
  @ApiOperation({ summary: 'Admin: get tracking for any booking (PRD §26)' })
  getBookingTrackingAdmin(@Param('bookingId', ParseUUIDPipe) bookingId: string) {
    return this.trackingService.getBookingTrackingAdmin(bookingId);
  }

  @Post('admin/booking/:bookingId/cross-border-handoff')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.AGENCY_STAFF)
  @ApiOperation({ summary: 'Admin: record cross-border or cross-agency handoff with scan confirmation (PRD Â§49)' })
  crossBorderHandoff(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Body() dto: CrossBorderHandoffDto,
    @Req() req: any,
  ) {
    return this.trackingService.crossBorderHandoff(bookingId, dto, req.user.id);
  }

  @Get('admin/booking/:bookingId/cross-border-handoffs')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.AGENCY_STAFF)
  @ApiOperation({ summary: 'Admin: list cross-border handoff history for a booking (PRD Â§49)' })
  getCrossBorderHandoffs(@Param('bookingId', ParseUUIDPipe) bookingId: string) {
    return this.trackingService.getCrossBorderHandoffs(bookingId);
  }

  /**
   * PRD §26: Admin — get all active drivers on live map.
   */
  @Get('admin/drivers')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.AGENCY_STAFF)
  @ApiOperation({ summary: 'Admin: get all active drivers for live map (PRD §26)' })
  getActiveDriversMap(@Req() req: any) {
    const agencyId = req.user.role === UserRole.AGENCY_STAFF ? req.user.agencyId : undefined;
    return this.trackingService.getActiveDriversMap(agencyId);
  }

  /**
   * PRD §26: Driver — push GPS location update via REST (fallback for WebSocket).
   * Primary channel is WebSocket gateway. This is the REST fallback.
   */
  @Patch('driver/location')
  @ApiOperation({ summary: 'Driver: push GPS location update (REST fallback for WS) (PRD §26)' })
  updateLocation(
    @Req() req: any,
    @Body() body: { lat: number; lng: number; bookingId?: string },
  ) {
    return this.trackingService.updateDriverLocation(
      req.user.driverId,
      body.lat,
      body.lng,
      body.bookingId,
    );
  }
}
