import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { StaffPerformanceService } from './staff-performance.service';

@ApiTags('Staff Performance')
@ApiBearerAuth('JWT')
@Controller('staff-performance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class StaffPerformanceController {
  constructor(private readonly staffPerformanceService: StaffPerformanceService) {}

  @Get()
  @ApiOperation({ summary: 'Admin staff performance dashboard (PRD §44.14)' })
  @ApiQuery({ name: 'agencyId', required: false, type: String })
  list(@Query('agencyId') agencyId?: string) {
    return this.staffPerformanceService.listPerformance(agencyId);
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Get detailed staff performance for a single user (PRD §44.14)' })
  getOne(@Param('userId') userId: string) {
    return this.staffPerformanceService.getPerformance(userId);
  }
}
