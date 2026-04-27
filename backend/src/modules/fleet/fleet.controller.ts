import { Controller, Post, Body, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { FleetService } from './fleet.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('fleet')
export class FleetController {
  constructor(private readonly fleetService: FleetService) {}

  @Roles('ADMIN', 'SUPER_ADMIN', 'TRANSPORTER')
  @Post()
  create(@Body() createVehicleDto: any) {
    return this.fleetService.create(createVehicleDto);
  }

  @Roles('ADMIN', 'SUPER_ADMIN', 'AGENCY_STAFF', 'TRANSPORTER')
  @Get()
  findAll() {
    return this.fleetService.findAll();
  }

  @Roles('DRIVER', 'ADMIN')
  @Post(':id/breakdown')
  reportBreakdown(@Param('id') id: string, @Body('details') details: string) {
    return this.fleetService.reportBreakdown(id, details);
  }
}
