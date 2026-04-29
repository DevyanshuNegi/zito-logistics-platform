import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SystemHealthService } from './system-health.service';

@ApiTags('SystemHealth')
@Controller()
export class SystemHealthController {
  constructor(private readonly systemHealthService: SystemHealthService) {}

  @Get('health')
  @ApiOperation({ summary: 'Runtime health endpoint with database and Redis checks (PRD §44.11)' })
  health() {
    return this.systemHealthService.health();
  }

  @Get('system-health/dashboard')
  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Admin system-health dashboard and monitoring snapshot (PRD §44.11)' })
  dashboard() {
    return this.systemHealthService.dashboard();
  }

  @Post('system-health/run-checks')
  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Evaluate system-health thresholds and raise internal alerts (PRD §44.11)' })
  runChecks() {
    return this.systemHealthService.runChecks();
  }
}
