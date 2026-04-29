import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics')
@ApiBearerAuth('JWT')
@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Admin analytics dashboard snapshot (PRD §27A, §27B)' })
  @ApiQuery({ name: 'period', required: false, enum: ['daily', 'monthly'] })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  getDashboard(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.dashboard(query);
  }

  @Get('revenue')
  @ApiOperation({ summary: 'Revenue analytics by period, service, and agency (PRD §27A)' })
  @ApiQuery({ name: 'period', required: false, enum: ['daily', 'monthly'] })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  getRevenue(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.revenue(query);
  }

  @Get('drivers')
  @ApiOperation({ summary: 'Driver KPI analytics (PRD §27A)' })
  @ApiQuery({ name: 'period', required: false, enum: ['daily', 'monthly'] })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  getDriverKpis(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.driverKpis(query);
  }

  @Get('warehouses')
  @ApiOperation({ summary: 'Warehouse utilization analytics (PRD §27A)' })
  @ApiQuery({ name: 'period', required: false, enum: ['daily', 'monthly'] })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  getWarehouseKpis(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.warehouseKpis(query);
  }
}
