import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { WarehouseService } from './warehouse.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CreateWarehouseBookingDto,
  CreateWarehouseBinDto,
  CreateWarehouseDto,
  CreateWarehouseListingDto,
  CreateWarehouseRackDto,
  CreateWarehouseZoneDto,
  ReviewWarehouseListingDto,
  UpdateWarehouseBookingStatusDto,
  UpdateWarehouseDto,
} from './dto/warehouse.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('warehouse')
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  @Roles('SUPER_ADMIN', 'ADMIN', 'AGENCY_STAFF')
  @Post()
  create(@Body() data: CreateWarehouseDto, @Req() req: any) {
    const activeRole = req.user.activeRole ?? req.user.role;

    if (activeRole === 'AGENCY_STAFF') {
      data.agencyId = req.user.agencyId;
    }

    return this.warehouseService.createWarehouse(data);
  }

  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'AGENCY_STAFF',
    'CUSTOMER',
    'TRANSPORTER',
    'WAREHOUSE_PARTNER',
    'COURIER_COMPANY',
  )
  @Get()
  findAll(@Req() req: any, @Query('agencyId') agencyId?: string) {
    return this.warehouseService.findAll({
      viewerRole: req.user.activeRole ?? req.user.role,
      viewerAgencyId: req.user.agencyId,
      viewerUserId: req.user.id,
      agencyId,
    });
  }

  @Roles('CUSTOMER', 'CORPORATE')
  @Get('listings/public')
  listApprovedListings(
    @Query('location') location?: string,
    @Query('storageType') storageType?: string,
    @Query('latitude') latitude?: string,
    @Query('longitude') longitude?: string,
    @Query('radiusKm') radiusKm?: string,
  ) {
    return this.warehouseService.listApprovedListings({
      location,
      storageType,
      latitude: latitude ? Number(latitude) : undefined,
      longitude: longitude ? Number(longitude) : undefined,
      radiusKm: radiusKm ? Number(radiusKm) : undefined,
    });
  }

  @Roles('WAREHOUSE_PARTNER')
  @Post('partner/listings')
  createPartnerListing(@Body() data: CreateWarehouseListingDto, @Req() req: any) {
    return this.warehouseService.createListing(req.user.id, data);
  }

  @Roles('WAREHOUSE_PARTNER')
  @Get('partner/listings')
  listPartnerListings(@Req() req: any) {
    return this.warehouseService.listPartnerListings(req.user.id);
  }

  @Roles('WAREHOUSE_PARTNER')
  @Get('partner/bookings')
  listPartnerBookings(@Req() req: any) {
    return this.warehouseService.listPartnerBookings(req.user.id);
  }

  @Roles('WAREHOUSE_PARTNER')
  @Patch('partner/bookings/:id/status')
  updatePartnerBookingStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: UpdateWarehouseBookingStatusDto,
    @Req() req: any,
  ) {
    return this.warehouseService.updateBookingStatus(id, data, {
      userId: req.user.id,
      role: 'WAREHOUSE_PARTNER',
    });
  }

  @Roles('SUPER_ADMIN', 'ADMIN')
  @Get('admin/listings')
  listAdminListings(@Query('status') status?: string) {
    return this.warehouseService.listAdminListings({ status });
  }

  @Roles('SUPER_ADMIN', 'ADMIN')
  @Patch('admin/listings/:id/review')
  reviewListing(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: ReviewWarehouseListingDto,
    @Req() req: any,
  ) {
    return this.warehouseService.reviewListing(id, data, req.user.id);
  }

  @Roles('SUPER_ADMIN', 'ADMIN')
  @Get('admin/bookings')
  listAdminBookings() {
    return this.warehouseService.listAdminBookings();
  }

  @Roles('SUPER_ADMIN', 'ADMIN')
  @Patch('admin/bookings/:id/status')
  updateAdminBookingStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: UpdateWarehouseBookingStatusDto,
    @Req() req: any,
  ) {
    return this.warehouseService.updateBookingStatus(id, data, {
      userId: req.user.id,
      role: req.user.activeRole ?? req.user.role,
    });
  }

  @Roles('CUSTOMER', 'CORPORATE')
  @Post('bookings')
  createBooking(@Body() data: CreateWarehouseBookingDto, @Req() req: any) {
    return this.warehouseService.createBooking(req.user.id, data);
  }

  @Roles('CUSTOMER', 'CORPORATE')
  @Get('bookings')
  listCustomerBookings(@Req() req: any) {
    return this.warehouseService.listCustomerBookings(req.user.id);
  }

  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'AGENCY_STAFF',
    'CUSTOMER',
    'TRANSPORTER',
    'WAREHOUSE_PARTNER',
    'COURIER_COMPANY',
  )
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.warehouseService.findOne(id, {
      viewerRole: req.user.activeRole ?? req.user.role,
      viewerAgencyId: req.user.agencyId,
      viewerUserId: req.user.id,
    });
  }

  @Roles('SUPER_ADMIN', 'ADMIN', 'AGENCY_STAFF')
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: UpdateWarehouseDto,
    @Req() req: any,
  ) {
    return this.warehouseService.updateWarehouse(id, data, {
      viewerRole: req.user.activeRole ?? req.user.role,
      viewerAgencyId: req.user.agencyId,
      viewerUserId: req.user.id,
    });
  }

  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'AGENCY_STAFF',
    'CUSTOMER',
    'TRANSPORTER',
    'WAREHOUSE_PARTNER',
    'COURIER_COMPANY',
  )
  @Get(':id/capacity')
  getCapacity(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.warehouseService.getCapacity(id, {
      viewerRole: req.user.activeRole ?? req.user.role,
      viewerAgencyId: req.user.agencyId,
      viewerUserId: req.user.id,
    });
  }

  @Roles('SUPER_ADMIN', 'ADMIN', 'AGENCY_STAFF', 'WAREHOUSE_PARTNER')
  @Post(':id/zones')
  createZone(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: CreateWarehouseZoneDto,
    @Req() req: any,
  ) {
    return this.warehouseService.createZone(id, data, {
      viewerRole: req.user.activeRole ?? req.user.role,
      viewerAgencyId: req.user.agencyId,
      viewerUserId: req.user.id,
    });
  }

  @Roles('SUPER_ADMIN', 'ADMIN', 'AGENCY_STAFF', 'WAREHOUSE_PARTNER')
  @Post('zones/:zoneId/racks')
  createRack(
    @Param('zoneId', ParseUUIDPipe) zoneId: string,
    @Body() data: CreateWarehouseRackDto,
    @Req() req: any,
  ) {
    return this.warehouseService.createRack(zoneId, data, {
      viewerRole: req.user.activeRole ?? req.user.role,
      viewerAgencyId: req.user.agencyId,
      viewerUserId: req.user.id,
    });
  }

  @Roles('SUPER_ADMIN', 'ADMIN', 'AGENCY_STAFF', 'WAREHOUSE_PARTNER')
  @Post('racks/:rackId/bins')
  createBin(
    @Param('rackId', ParseUUIDPipe) rackId: string,
    @Body() data: CreateWarehouseBinDto,
    @Req() req: any,
  ) {
    return this.warehouseService.createBin(rackId, data, {
      viewerRole: req.user.activeRole ?? req.user.role,
      viewerAgencyId: req.user.agencyId,
      viewerUserId: req.user.id,
    });
  }
}

