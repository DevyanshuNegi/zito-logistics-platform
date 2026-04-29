import { Controller, Post, Body, Get, Put, Patch, UseGuards, Req, Query } from '@nestjs/common';
import { DriversService } from './drivers.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverStatusDto } from './dto/update-driver-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('drivers')
@UseGuards(JwtAuthGuard)
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Get()
  @Roles('ADMIN', 'SUPER_ADMIN', 'AGENCY_STAFF', 'TRANSPORTER')
  @UseGuards(RolesGuard)
  async list(
    @Query('available') available?: string,
    @Query('online') online?: string,
  ) {
    return this.driversService.listDrivers({
      isAvailable: available === undefined ? undefined : available === 'true',
      isOnline: online === undefined ? undefined : online === 'true',
    });
  }

  @Post('register')
  @Roles('DRIVER')
  @UseGuards(RolesGuard)
  async register(@Req() req: any, @Body() dto: CreateDriverDto) {
    return this.driversService.registerDriver(req.user.id, dto);
  }

  @Get('me')
  @Roles('DRIVER')
  @UseGuards(RolesGuard)
  async getProfile(@Req() req: any) {
    return this.driversService.getMyProfile(req.user.id);
  }

  @Patch('me/status')
  @Roles('DRIVER')
  @UseGuards(RolesGuard)
  async updateStatus(@Req() req: any, @Body() dto: UpdateDriverStatusDto) {
    return this.driversService.updateStatus(req.user.id, dto);
  }

  @Put('me/location')
  @Roles('DRIVER')
  @UseGuards(RolesGuard)
  async updateLocation(
    @Req() req: any, 
    @Body() dto: { currentLatitude: number; currentLongitude: number }
  ) {
    return this.driversService.updateLocation(req.user.id, dto.currentLatitude, dto.currentLongitude);
  }
}
