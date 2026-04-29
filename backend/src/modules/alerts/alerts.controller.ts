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
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AlertsService } from './alerts.service';
import { ResolveAlertDto, TriggerAlertDto } from './dto/alerts.dto';

@ApiTags('Alerts')
@ApiBearerAuth('JWT')
@Controller('alerts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.AGENCY_STAFF)
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Internal alerts dashboard and queue (PRD §39)' })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, type: String })
  dashboard(
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.alertsService.getDashboard({ status, type });
  }

  @Post('trigger')
  @ApiOperation({ summary: 'Run internal alert triggers (PRD §39)' })
  trigger(@Body() dto: TriggerAlertDto) {
    return this.alertsService.trigger(dto.type);
  }

  @Post('capacity-alert')
  @ApiOperation({ summary: 'Create low warehouse capacity alerts (PRD §39)' })
  capacityAlert() {
    return this.alertsService.capacityAlert();
  }

  @Post('driver-offline-alert')
  @ApiOperation({ summary: 'Create driver offline alerts for active trips (PRD §39)' })
  driverOfflineAlert() {
    return this.alertsService.driverOfflineAlert();
  }

  @Post('route-pending')
  @ApiOperation({ summary: 'Route all pending internal alerts (PRD §39)' })
  routePending() {
    return this.alertsService.routePending();
  }

  @Post(':id/route')
  @ApiOperation({ summary: 'Route one internal alert to the relevant recipients (PRD §39)' })
  routeAlert(@Param('id', ParseUUIDPipe) id: string) {
    return this.alertsService.route(id);
  }

  @Patch(':id/resolve')
  @ApiOperation({ summary: 'Resolve an internal alert from the admin queue (PRD §39)' })
  resolveAlert(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveAlertDto,
    @Req() req: any,
  ) {
    return this.alertsService.resolve(id, req.user.id, dto.note);
  }
}
