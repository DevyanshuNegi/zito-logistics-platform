import { Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { WarehouseService } from './warehouse.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('warehouse')
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  @Roles('SUPER_ADMIN', 'ADMIN', 'AGENCY_STAFF')
  @Post()
  create(@Body() data: any, @Req() req: any) {
    if (req.user.role === 'AGENCY_STAFF') {
      data.agencyId = req.user.agencyId;
    }
    return this.warehouseService.createWarehouse(data);
  }

  @Roles('SUPER_ADMIN', 'ADMIN', 'AGENCY_STAFF', 'TRANSPORTER')
  @Get()
  findAll(@Req() req: any, @Query('agencyId') agencyId?: string) {
    if (req.user.role === 'AGENCY_STAFF') {
      return this.warehouseService.findAll(req.user.agencyId);
    }
    return this.warehouseService.findAll(agencyId);
  }

  @Get(':id/capacity')
  getCapacity(@Param('id') id: string) {
    return this.warehouseService.getCapacity(id);
  }

  @Post(':id/zones')
  createZone(@Param('id') id: string, @Body() data: any) {
    return this.warehouseService.createZone(id, data);
  }

  @Post('zones/:zoneId/racks')
  createRack(@Param('zoneId') zoneId: string, @Body() data: any) {
    return this.warehouseService.createRack(zoneId, data);
  }

  @Post('racks/:rackId/bins')
  createBin(@Param('rackId') rackId: string, @Body() data: any) {
    return this.warehouseService.createBin(rackId, data);
  }
}

