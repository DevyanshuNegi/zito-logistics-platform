import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ReviewFraudFlagDto } from './dto/review-fraud-flag.dto';
import { FraudService } from './fraud.service';

@ApiTags('Fraud')
@ApiBearerAuth('JWT')
@Controller('fraud')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class FraudController {
  constructor(private readonly fraudService: FraudService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Fraud dashboard and review queue (PRD §44.7)' })
  @ApiQuery({ name: 'status', required: false, type: String })
  getDashboard(@Query('status') status?: string) {
    return this.fraudService.getDashboard(status);
  }

  @Post('detect/all')
  @ApiOperation({ summary: 'Run all fraud detectors (PRD §44.7)' })
  runAll() {
    return this.fraudService.runAll();
  }

  @Post('detect/gps-spoof')
  @ApiOperation({ summary: 'Detect driver-vs-vehicle GPS spoof signals (PRD §44.7)' })
  detectGpsSpoof() {
    return this.fraudService.detectGpsSpoof();
  }

  @Post('detect/ghost-trip')
  @ApiOperation({ summary: 'Detect trips with no supporting scan events (PRD §44.7)' })
  detectGhostTrip() {
    return this.fraudService.detectGhostTrip();
  }

  @Post('detect/duplicate')
  @ApiOperation({ summary: 'Detect suspicious duplicate bookings using idempotency-aware checks (PRD §44.7)' })
  detectDuplicate() {
    return this.fraudService.detectDuplicate();
  }

  @Post('detect/route-anomaly')
  @ApiOperation({ summary: 'Detect drivers deviating from the planned booking corridor (PRD §44.7)' })
  detectRouteAnomaly() {
    return this.fraudService.detectRouteAnomaly();
  }

  @Patch(':id/review')
  @ApiOperation({ summary: 'Review or confirm a fraud flag (PRD §44.7)' })
  reviewFlag(
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: ReviewFraudFlagDto,
  ) {
    return this.fraudService.reviewFlag(id, req.user.id, dto);
  }

  @Patch(':id/suspend')
  @ApiOperation({ summary: 'Suspend the account associated with a fraud flag (PRD §44.7)' })
  suspendAccount(@Param('id') id: string, @Req() req: any) {
    return this.fraudService.suspendAccount(id, req.user.id);
  }
}
