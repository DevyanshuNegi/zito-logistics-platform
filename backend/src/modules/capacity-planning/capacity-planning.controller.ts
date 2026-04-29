import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  EnforceCapacityDto,
  FleetCapacityQueryDto,
  ForecastQueryDto,
  WarehouseCapacityQueryDto,
} from './dto/capacity-planning.dto';
import { CapacityPlanningService } from './capacity-planning.service';

@ApiTags('CapacityPlanning')
@ApiBearerAuth('JWT')
@Controller('capacity-planning')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.AGENCY_STAFF, UserRole.TRANSPORTER)
export class CapacityPlanningController {
  constructor(
    private readonly capacityPlanningService: CapacityPlanningService,
  ) {}

  @Get('warehouse')
  @ApiOperation({ summary: 'Warehouse capacity occupancy planning snapshot (PRD §44.18)' })
  warehouse(@Query() query: WarehouseCapacityQueryDto) {
    return this.capacityPlanningService.warehouse(query);
  }

  @Get('fleet')
  @ApiOperation({ summary: 'Fleet availability and capacity planning snapshot (PRD §44.18)' })
  fleet(@Query() query: FleetCapacityQueryDto) {
    return this.capacityPlanningService.fleet(query);
  }

  @Post('enforce-limit')
  @ApiOperation({ summary: 'Validate capacity and block overbooking when full (PRD §44.18)' })
  enforceLimit(@Body() dto: EnforceCapacityDto) {
    return this.capacityPlanningService.enforceLimit(dto);
  }

  @Get('forecast')
  @ApiOperation({ summary: 'Historical-demand forecast for capacity planning (PRD §44.18)' })
  forecast(@Query() query: ForecastQueryDto) {
    return this.capacityPlanningService.forecast(query);
  }
}
