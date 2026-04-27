import { Controller, Get, Patch, Body, UseGuards, Query } from '@nestjs/common';
import { DriversService } from './drivers.service';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('drivers')
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Roles('DRIVER')
  @Patch('location')
  updateLocation(@CurrentUser() user: any, @Body() updateDriverDto: UpdateDriverDto) {
    return this.driversService.updateLocation(user.id, updateDriverDto);
  }

  @Roles('ADMIN', 'SUPER_ADMIN', 'AGENCY_STAFF')
  @Get('available')
  findAvailable(
    @Query('lat') lat: number,
    @Query('lng') lng: number,
    @Query('radius') radius?: number,
  ) {
    return this.driversService.findAvailableDrivers(Number(lat), Number(lng), radius ? Number(radius) : 10);
  }
}
