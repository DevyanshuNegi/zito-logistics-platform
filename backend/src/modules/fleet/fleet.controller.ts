import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { VehicleStatus } from '@prisma/client';
import { FleetService } from './fleet.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { BulkOnboardFleetDto } from './dto/bulk-onboard.dto';
import { CreateFuelLogDto, FuelLogQueryDto } from './fuel/dto/fuel.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('fleet')
export class FleetController {
  constructor(private readonly fleetService: FleetService) {}

  @Roles('ADMIN', 'SUPER_ADMIN', 'TRANSPORTER')
  @Post()
  create(@Body() createVehicleDto: any) {
    return this.fleetService.create(createVehicleDto);
  }

  @Roles('ADMIN', 'SUPER_ADMIN', 'TRANSPORTER')
  @Post('bulk-onboard')
  bulkOnboard(@Body() dto: BulkOnboardFleetDto, @Req() req: any) {
    return this.fleetService.bulkOnboard(dto.vehicles, req.user.id);
  }

  @Roles('ADMIN', 'SUPER_ADMIN', 'AGENCY_STAFF', 'TRANSPORTER')
  @Get()
  findAll(
    @Query('status') status?: VehicleStatus,
    @Query('driverId') driverId?: string,
  ) {
    return this.fleetService.findAll({ status, driverId });
  }

  @Roles('ADMIN', 'SUPER_ADMIN', 'AGENCY_STAFF', 'TRANSPORTER')
  @Get('breakdowns')
  listBreakdowns(
    @Query('status') status?: string,
    @Query('driverId') driverId?: string,
    @Query('vehicleId') vehicleId?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.fleetService.listBreakdowns({
      status,
      driverId,
      vehicleId,
      page: Number(page),
      limit: Number(limit),
    });
  }

  @Roles('ADMIN', 'SUPER_ADMIN', 'AGENCY_STAFF', 'TRANSPORTER')
  @Get('breakdowns/:breakdownId')
  getBreakdown(@Param('breakdownId', ParseUUIDPipe) breakdownId: string) {
    return this.fleetService.getBreakdown(breakdownId);
  }

  @Roles('DRIVER', 'ADMIN', 'SUPER_ADMIN', 'TRANSPORTER')
  @Post('fuel/logs')
  createFuelLog(@Body() body: CreateFuelLogDto, @Req() req: any) {
    return this.fleetService.createFuelLog(
      {
        ...body,
        driverId:
          (req.user.activeRole ?? req.user.role) === 'DRIVER'
            ? req.user.driverId
            : body.driverId,
      },
      req.user.id,
    );
  }

  @Roles('ADMIN', 'SUPER_ADMIN', 'AGENCY_STAFF', 'TRANSPORTER')
  @Get('fuel/logs')
  listFuelLogs(@Query() query: FuelLogQueryDto) {
    return this.fleetService.listFuelLogs({
      ...query,
      flagged:
        typeof query.flagged === 'string'
          ? query.flagged.toLowerCase() === 'true'
          : undefined,
    });
  }

  @Roles('ADMIN', 'SUPER_ADMIN', 'AGENCY_STAFF', 'TRANSPORTER')
  @Get('fuel/logs/:logId')
  getFuelLog(@Param('logId', ParseUUIDPipe) logId: string) {
    return this.fleetService.getFuelLog(logId);
  }

  @Roles('ADMIN', 'SUPER_ADMIN', 'TRANSPORTER')
  @Post('fuel/logs/:logId/detect-theft')
  detectFuelTheft(@Param('logId', ParseUUIDPipe) logId: string) {
    return this.fleetService.detectFuelTheft(logId);
  }

  @Roles('ADMIN', 'SUPER_ADMIN', 'AGENCY_STAFF', 'TRANSPORTER')
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.fleetService.findOne(id);
  }

  @Roles('ADMIN', 'SUPER_ADMIN', 'TRANSPORTER')
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: any) {
    return this.fleetService.update(id, dto);
  }

  @Roles('ADMIN', 'SUPER_ADMIN', 'TRANSPORTER')
  @Patch(':id/assign-driver')
  assignDriver(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('driverId') driverId: string,
  ) {
    return this.fleetService.assignDriver(id, driverId);
  }

  @Roles('ADMIN', 'SUPER_ADMIN', 'TRANSPORTER')
  @Patch(':id/retire')
  retire(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('note') note?: string,
  ) {
    return this.fleetService.retire(id, note);
  }

  @Roles('ADMIN', 'SUPER_ADMIN', 'TRANSPORTER')
  @Patch(':id/gps')
  updateGps(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { lat: number; lng: number },
  ) {
    return this.fleetService.updateLocation(id, body.lat, body.lng);
  }

  @Roles('DRIVER', 'ADMIN')
  @Post(':id/breakdown')
  reportBreakdown(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: {
      details: string;
      bookingId?: string;
      latitude?: number;
      longitude?: number;
    },
    @Req() req: any,
  ) {
    const driverId = req.user?.driverId;
    return this.fleetService.reportBreakdown(
      id,
      driverId,
      body.details,
      body.bookingId,
      body.latitude,
      body.longitude,
    );
  }

  @Roles('ADMIN', 'SUPER_ADMIN')
  @Post('breakdowns/:breakdownId/assign-backup')
  assignBackupVehicle(
    @Param('breakdownId', ParseUUIDPipe) breakdownId: string,
    @Body('backupVehicleId') backupVehicleId: string,
    @Req() req: any,
  ) {
    return this.fleetService.assignBackupVehicle(
      breakdownId,
      backupVehicleId,
      req.user.id,
    );
  }

  @Roles('ADMIN', 'SUPER_ADMIN')
  @Post('breakdowns/:breakdownId/resolve')
  resolveBreakdown(
    @Param('breakdownId', ParseUUIDPipe) breakdownId: string,
    @Req() req: any,
  ) {
    return this.fleetService.resolveBreakdown(breakdownId, req.user.id);
  }
}
