import {
  Body,
  Controller,
  Get,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SetHeatmapThresholdsDto } from './dto/heatmap-thresholds.dto';
import { HeatmapService } from './heatmap.service';

@ApiTags('Heatmap')
@ApiBearerAuth('JWT')
@Controller('heatmap')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HeatmapController {
  constructor(private readonly heatmapService: HeatmapService) {}

  @Get('dashboard')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.AGENCY_STAFF)
  @ApiOperation({ summary: 'Demand heatmap dashboard by zone (PRD §44.21)' })
  dashboard() {
    return this.heatmapService.calcDemand();
  }

  @Get('driver')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Driver heatmap data with move-to-zone suggestions (PRD §44.21)' })
  driverHeatmap(@Req() req: any) {
    return this.heatmapService.getDriverHeatmap(req.user.driverId);
  }

  @Get('thresholds')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get heatmap zone intensity thresholds (PRD §44.21)' })
  thresholds() {
    return this.heatmapService.getThresholds();
  }

  @Patch('thresholds')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Set low, medium, and high heatmap thresholds (PRD §44.21)' })
  setThresholds(@Body() dto: SetHeatmapThresholdsDto, @Req() req: any) {
    return this.heatmapService.setThresholds(dto, req.user.id);
  }
}
