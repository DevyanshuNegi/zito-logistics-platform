import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { AssignDriverDto } from './dto/assign-driver.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { RateBookingDto } from './dto/rate-booking.dto';
import { UpdateTradeControlDto } from './dto/update-trade-control.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { BookingStatus, ServiceType } from '@prisma/client';
import { ShiftActiveGuard } from '../drivers/shift/shift-active.guard';
import { AuditService } from '../audit/audit.service';

// ─── Customer routes ──────────────────────────────────────────────────────────
@Controller('customer/bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CUSTOMER')
export class CustomerBookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  // POST /customer/bookings
  // Client sends Idempotency-Key: <uuid> in header — idempotency enforced via idempotencyKey field in body
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Request() req, @Body() dto: CreateBookingDto) {
    return this.bookingsService.create(req.user.id, dto, req.user.role);
  }

  // GET /customer/bookings
  @Get()
  list(
    @Request() req,
    @Query('status') status?: BookingStatus,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.bookingsService.listForCustomer(req.user.id, {
      status,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  }

  // GET /customer/bookings/:id
  @Get(':id')
  getOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
  ) {
    return this.bookingsService.getById(id, req.user.id, req.user.role);
  }

  // POST /customer/bookings/:id/cancel
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Body() dto: CancelBookingDto,
  ) {
    return this.bookingsService.cancelByCustomer(id, req.user.id, dto);
  }

  // POST /customer/bookings/:id/rate
  @Post(':id/rate')
  @HttpCode(HttpStatus.OK)
  rate(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Body() dto: RateBookingDto,
  ) {
    return this.bookingsService.rateBooking(id, req.user.id, dto);
  }
}

@Controller('corporate/bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CORPORATE')
export class CorporateBookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Request() req, @Body() dto: CreateBookingDto) {
    return this.bookingsService.create(req.user.id, dto, req.user.role);
  }

  @Get()
  list(
    @Request() req,
    @Query('status') status?: BookingStatus,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.bookingsService.listForCustomer(req.user.id, {
      status,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  }

  @Get(':id')
  getOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
  ) {
    return this.bookingsService.getById(id, req.user.id, req.user.role);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Body() dto: CancelBookingDto,
  ) {
    return this.bookingsService.cancelByCustomer(id, req.user.id, dto);
  }
}

@Controller('courier-company/bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('COURIER_COMPANY')
export class CourierCompanyBookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Request() req, @Body() dto: CreateBookingDto) {
    return this.bookingsService.create(req.user.id, dto, req.user.role);
  }

  @Get()
  list(
    @Request() req,
    @Query('status') status?: BookingStatus,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.bookingsService.listForCustomer(req.user.id, {
      status,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  }

  @Get(':id')
  getOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
  ) {
    return this.bookingsService.getById(id, req.user.id, req.user.role);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Body() dto: CancelBookingDto,
  ) {
    return this.bookingsService.cancelByCustomer(id, req.user.id, dto);
  }
}

// ─── Driver routes ────────────────────────────────────────────────────────────
@Controller('driver/trips')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DRIVER')
export class DriverTripsController {
  constructor(private readonly bookingsService: BookingsService) {}

  // GET /driver/trips
  @Get()
  list(
    @Request() req,
    @Query('status') status?: BookingStatus,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.bookingsService.listForDriver(req.user.driverId, {
      status,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  }

  // GET /driver/trips/:id
  @Get(':id')
  getOne(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.bookingsService.getById(id, req.user.id, 'DRIVER');
  }

  // PATCH /driver/trips/:id/status
  // ShiftActiveGuard applied here — driver must have active shift
  @Patch(':id/status')
  @UseGuards(ShiftActiveGuard)
  @HttpCode(HttpStatus.OK)
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.bookingsService.updateStatusByDriver(id, req.user.driverId, dto);
  }

  // POST /driver/trips/:id/reject
  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Body('reason') reason: string,
  ) {
    return this.bookingsService.rejectByDriver(id, req.user.driverId, reason);
  }
}

// ─── Admin routes ─────────────────────────────────────────────────────────────
@Controller('admin/bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN', 'AGENCY_STAFF')
export class AdminBookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly auditService: AuditService,
  ) {}

  // GET /admin/bookings
  @Get()
  list(
    @Query('status') status?: BookingStatus,
    @Query('serviceType') serviceType?: ServiceType,
    @Query('customerId') customerId?: string,
    @Query('driverId') driverId?: string,
    @Query('agencyId') agencyId?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.bookingsService.listForAdmin({
      status, serviceType, customerId, driverId, agencyId,
      page: parseInt(page),
      limit: parseInt(limit),
      dateFrom, dateTo,
    });
  }

  // GET /admin/bookings/:id
  @Get(':id')
  getOne(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.bookingsService.getById(id, req.user.id, 'ADMIN');
  }

  // PATCH /admin/bookings/:id/assign
  @Patch(':id/assign')
  @HttpCode(HttpStatus.OK)
  assignDriver(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Body() dto: AssignDriverDto,
  ) {
    return this.bookingsService.assignDriver(id, req.user.id, dto);
  }

  // PATCH /admin/bookings/:id/status
  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  overrideStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.bookingsService.updateStatusByAdmin(id, req.user.id, dto);
  }

  @Patch(':id/trade-control')
  @HttpCode(HttpStatus.OK)
  updateTradeControl(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Body() dto: UpdateTradeControlDto,
  ) {
    return this.bookingsService.updateTradeControlByAdmin(id, req.user.id, dto);
  }

  // POST /admin/bookings/:id/cancel
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Body() dto: CancelBookingDto,
  ) {
    return this.auditService.requestBookingCancelApproval(
      {
        bookingId: id,
        reason: dto.reason,
        penaltyOverrideNote: dto.penaltyOverrideNote,
      },
      req.user.id,
    );
  }
}
