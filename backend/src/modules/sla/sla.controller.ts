import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ServiceType, UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  DetectSlaBreachDto,
  ScanSlaBreachesDto,
} from './dto/sla.dto';
import { SlaService } from './sla.service';

@ApiTags('SLA')
@ApiBearerAuth('JWT')
@Controller('sla')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.AGENCY_STAFF)
export class SlaController {
  constructor(private readonly slaService: SlaService) {}

  @Get('config')
  @ApiOperation({ summary: 'List service-type SLA timer configuration (PRD §21, §44.10)' })
  @ApiQuery({ name: 'serviceType', required: false, enum: ServiceType })
  getConfig(@Query('serviceType') serviceType?: ServiceType) {
    return this.slaService.getConfig(serviceType);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'View the current SLA queue, breaches, and escalation counts (PRD §21)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getDashboard(@Query('limit') limit = '25') {
    return this.slaService.getDashboard(Number(limit));
  }

  @Get('bookings/:id')
  @ApiOperation({ summary: 'Inspect the current SLA timer and breach state for a booking (PRD §21)' })
  getBookingSla(@Param('id', ParseUUIDPipe) id: string) {
    return this.slaService.getBookingSla(id);
  }

  @Post('bookings/:id/start')
  @ApiOperation({ summary: 'Start or preview the active SLA timer for a booking (PRD §21)' })
  startTimer(@Param('id', ParseUUIDPipe) id: string) {
    return this.slaService.startTimer(id);
  }

  @Post('bookings/:id/detect-breach')
  @ApiOperation({ summary: 'Detect delay breaches and escalate alerts for a booking (PRD §21, §44.10)' })
  detectBreach(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DetectSlaBreachDto,
    @Req() req: any,
  ) {
    return this.slaService.detectBreach(id, {
      autoHandleNoShow: dto.autoHandleNoShow,
      actorId: req.user.id,
    });
  }

  @Post('bookings/:id/handle-no-show')
  @ApiOperation({ summary: 'Auto-reassign or requeue a driver no-show booking (PRD §44.10)' })
  handleNoShow(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.slaService.handleNoShow(id, req.user.id);
  }

  @Post('scan-active')
  @ApiOperation({ summary: 'Scan active bookings for SLA breaches and optional no-show handling (PRD §21)' })
  scanActive(@Body() dto: ScanSlaBreachesDto, @Req() req: any) {
    return this.slaService.scanActiveBreaches({
      autoHandleNoShow: dto.autoHandleNoShow,
      actorId: req.user.id,
      limit: dto.limit,
    });
  }
}
