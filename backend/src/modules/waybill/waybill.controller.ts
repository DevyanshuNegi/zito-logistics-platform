import { Controller, Get, Post, Body, Param, Patch, UseGuards } from '@nestjs/common';
import { WaybillService } from './waybill.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('waybill')
export class WaybillController {
  constructor(private readonly waybillService: WaybillService) {}

  @Roles('SUPER_ADMIN', 'ADMIN', 'AGENCY_STAFF')
  @Post()
  create(@Body() data: any) {
    return this.waybillService.createWaybill(data);
  }

  @Roles('SUPER_ADMIN', 'ADMIN', 'AGENCY_STAFF', 'DRIVER', 'CUSTOMER')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.waybillService.findOne(id);
  }

  @Roles('SUPER_ADMIN', 'ADMIN', 'AGENCY_STAFF')
  @Patch(':id/lock')
  lock(@Param('id') id: string) {
    return this.waybillService.lockWaybill(id);
  }

  @Roles('SUPER_ADMIN', 'ADMIN', 'AGENCY_STAFF', 'DRIVER')
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.waybillService.updateStatus(id, status);
  }
}

