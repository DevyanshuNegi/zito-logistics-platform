import {
  Controller, Get, Post, Patch, Body, Param,
  Req, Query, UseGuards, Headers, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { BookingStatus, ServiceType, UserRole } from '@prisma/client';

import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { AssignDriverDto } from './dto/assign-driver.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { RateBookingDto } from './dto/rate-booking.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Bookings')
@ApiBearerAuth('JWT')
@Controller('bookings')
@UseGuards(JwtAuthGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  // ─── Price Estimate (PRD §7) — public to authenticated users ─────────────
  @Get('estimate')
  @ApiOperation({ summary: 'Get real-time price estimate before booking (PRD §7, §19)' })
  @ApiQuery({ name: 'vehicleType', required: true })
  @ApiQuery({ name: 'distanceKm', required: true, type: Number })
  @ApiQuery({ name: 'stopCount', required: false, type: Number })
  @ApiQuery({ name: 'surgeMultiplier', required: false, type: Number })
  estimatePrice(
    @Query('vehicleType') vehicleType: string,
    @Query('distanceKm') distanceKm: string,
    @Query('stopCount') stopCount = '2',
    @Query('surgeMultiplier') surgeMultiplier = '1.0',
  ) {
    return this.bookingsService.estimatePrice(
      vehicleType,
      parseFloat(distanceKm),
      parseInt(stopCount),
      parseFloat(surgeMultiplier),
    );
  }

  // ─── Create Booking (PRD §6) ──────────────────────────────────────────────
  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.AGENCY_STAFF)
  @ApiOperation({ summary: 'Create a new booking (PRD §6)' })
  create(
    @Body() dto: CreateBookingDto,
    @Req() req: any,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    return this.bookingsService.create(dto, req.user.id, idempotencyKey);
  }

  // ─── Customer: Own Bookings ───────────────────────────────────────────────
  @Get('my')
  @ApiOperation({ summary: 'Customer: list own bookings (PRD §6)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: BookingStatus })
  getMyBookings(
    @Req() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: BookingStatus,
  ) {
    return this.bookingsService.findByCustomer(
      req.user.id,
      Number(page),
      Number(limit),
      status,
    );
  }

  // ─── Driver: Assigned Trips ───────────────────────────────────────────────
  @Get('my-trips')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Driver: list assigned trips (PRD §6)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: BookingStatus })
  getMyTrips(
    @Req() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: BookingStatus,
  ) {
    return this.bookingsService.findByDriver(
      req.user.driverId,
      Number(page),
      Number(limit),
      status,
    );
  }

  // ─── Admin: All Bookings ──────────────────────────────────────────────────
  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.AGENCY_STAFF)
  @ApiOperation({ summary: 'Admin: list all bookings with filters (PRD §42)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: BookingStatus })
  @ApiQuery({ name: 'serviceType', required: false, enum: ServiceType })
  @ApiQuery({ name: 'driverId', required: false })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiQuery({ name: 'from', required: false, description: 'ISO date e.g. 2026-01-01' })
  @ApiQuery({ name: 'to', required: false })
  findAll(
    @Req() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: BookingStatus,
    @Query('serviceType') serviceType?: ServiceType,
    @Query('driverId') driverId?: string,
    @Query('customerId') customerId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    // AGENCY_STAFF scoped to their agency
    const agencyId = req.user.role === UserRole.AGENCY_STAFF ? req.user.agencyId : undefined;

    return this.bookingsService.findAll(Number(page), Number(limit), {
      status, serviceType, agencyId, driverId, customerId, from, to,
    });
  }

  // ─── Get Single Booking ───────────────────────────────────────────────────
  @Get(':id')
  @ApiOperation({ summary: 'Get booking by ID (PRD §6)' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ) {
    return this.bookingsService.findOne(id, req.user.id, req.user.role);
  }

  // ─── Update Status (PRD §6) ───────────────────────────────────────────────
  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.AGENCY_STAFF, UserRole.DRIVER)
  @ApiOperation({ summary: 'Update booking status (PRD §6)' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
    @Req() req: any,
  ) {
    return this.bookingsService.updateStatus(
      id,
      dto.status,
      req.user.id,
      req.user.role,
      dto.reason,
    );
  }

  // ─── Assign Driver (PRD §6, Admin only) ──────────────────────────────────
  @Patch(':id/assign')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.AGENCY_STAFF)
  @ApiOperation({ summary: 'Admin: assign driver to booking (PRD §6)' })
  assignDriver(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignDriverDto,
    @Req() req: any,
  ) {
    return this.bookingsService.assignDriver(id, dto, req.user.id);
  }

  // ─── Cancel Booking (PRD §6, §20) ────────────────────────────────────────
  @Patch(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.AGENCY_STAFF)
  @ApiOperation({ summary: 'Cancel a booking (PRD §6, §20)' })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelBookingDto,
    @Req() req: any,
  ) {
    return this.bookingsService.cancel(id, req.user.id, req.user.role, dto.reason);
  }

  // ─── Admin Override Status (PRD §42) ─────────────────────────────────────
  @Patch(':id/override')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Admin: force override booking status (PRD §42)' })
  adminOverride(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { status: BookingStatus; reason: string },
    @Req() req: any,
  ) {
    return this.bookingsService.adminOverrideStatus(
      id,
      body.status,
      req.user.id,
      body.reason,
    );
  }

  // ─── Rate Booking (PRD §18) ───────────────────────────────────────────────
  @Post(':id/rate')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({ summary: 'Customer: rate a completed booking within 48hrs (PRD §18)' })
  rate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RateBookingDto,
    @Req() req: any,
  ) {
    return this.bookingsService.rateBooking(id, req.user.id, dto.rating, dto.comment);
  }
}