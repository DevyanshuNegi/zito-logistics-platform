import {
  Controller, Get, Patch, Body, Param,
  Query, UseGuards, Request, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { DriverMatchingService } from './matching.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { VehicleType } from '@prisma/client';

// ── Admin: find matching drivers for a booking ────────────────────────────
@Controller('admin/matching')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminMatchingController {
  constructor(private readonly matchingService: DriverMatchingService) {}

  // GET /admin/matching/booking/:bookingId
  // Returns ranked list of eligible drivers for a specific booking
  @Get('booking/:bookingId')
  findForBooking(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Query('radiusKm')   radiusKm   = '10',
    @Query('minRating')  minRating  = '3.5',
    @Query('maxResults') maxResults = '10',
  ) {
    return this.matchingService.findForBooking(bookingId, {
      radiusKm:   parseFloat(radiusKm),
      minRating:  parseFloat(minRating),
      maxResults: parseInt(maxResults),
    });
  }

  // GET /admin/matching/search
  // Free-form search: lat, lng, vehicleType, radius
  @Get('search')
  search(
    @Query('lat')          lat:          string,
    @Query('lng')          lng:          string,
    @Query('vehicleType')  vehicleType:  VehicleType,
    @Query('cargoWeightKg') cargoWeightKg = '0',
    @Query('radiusKm')     radiusKm      = '10',
    @Query('minRating')    minRating     = '3.5',
    @Query('maxResults')   maxResults    = '10',
  ) {
    return this.matchingService.findMatchingDrivers({
      pickupLatitude:  parseFloat(lat),
      pickupLongitude: parseFloat(lng),
      vehicleType,
      cargoWeightKg:   parseFloat(cargoWeightKg),
      radiusKm:        parseFloat(radiusKm),
      minRating:       parseFloat(minRating),
      maxResults:      parseInt(maxResults),
    });
  }

  // GET /admin/matching/nearby
  // Admin map view — all online drivers near a point
  @Get('nearby')
  nearby(
    @Query('lat')      lat:      string,
    @Query('lng')      lng:      string,
    @Query('radiusKm') radiusKm  = '20',
  ) {
    return this.matchingService.getNearbyDrivers(
      parseFloat(lat),
      parseFloat(lng),
      parseFloat(radiusKm),
    );
  }
}

// ── Driver: update own GPS location ──────────────────────────────────────
@Controller('driver/location')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DRIVER')
export class DriverLocationController {
  constructor(private readonly matchingService: DriverMatchingService) {}

  // PATCH /driver/location
  // Called by driver app every 30s when online
  @Patch()
  @HttpCode(HttpStatus.OK)
  updateLocation(
    @Request() req,
    @Body('latitude')  latitude:  number,
    @Body('longitude') longitude: number,
  ) {
    return this.matchingService.updateDriverLocation(
      req.user.driverId,
      latitude,
      longitude,
    );
  }
}