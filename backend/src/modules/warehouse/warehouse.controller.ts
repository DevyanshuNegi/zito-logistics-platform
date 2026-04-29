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
  CreateWarehouseBinDto,
  CreateWarehouseDto,
  CreateWarehouseRackDto,
  CreateWarehouseZoneDto,
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
    'TRANSPORTER',
    'WAREHOUSE_PARTNER',
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

  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'AGENCY_STAFF',
    'TRANSPORTER',
    'WAREHOUSE_PARTNER',
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
    'TRANSPORTER',
    'WAREHOUSE_PARTNER',
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

