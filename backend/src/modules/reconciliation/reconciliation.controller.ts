import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ReconciliationQueryDto } from './dto/reconciliation.dto';
import { ReconciliationService } from './reconciliation.service';

@ApiTags('Reconciliation')
@ApiBearerAuth('JWT')
@Controller('reconciliation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class ReconciliationController {
  constructor(private readonly reconciliationService: ReconciliationService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Admin reconciliation dashboard snapshot (PRD §35, §44.12)' })
  @ApiQuery({ name: 'date', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getDashboard(
    @Query('date') date?: string,
    @Query('limit') limit = '200',
  ) {
    return this.reconciliationService.getDashboard(date, Number(limit));
  }

  @Post('auto-match')
  @ApiOperation({ summary: 'Auto-match invoices and payments using booking/invoice reference IDs (PRD §35)' })
  autoMatch(@Body() dto: ReconciliationQueryDto) {
    return this.reconciliationService.autoMatch(dto.date, dto.limit);
  }

  @Post('detect-mismatch')
  @ApiOperation({ summary: 'Detect amount, duplicate, and missing reconciliation mismatches (PRD §35, §44.12)' })
  detectMismatch(@Body() dto: ReconciliationQueryDto) {
    return this.reconciliationService.detectMismatch(dto.date, dto.limit);
  }

  @Get('daily-report')
  @ApiOperation({ summary: 'Generate a daily reconciliation report snapshot (PRD §35)' })
  @ApiQuery({ name: 'date', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  dailyReport(
    @Query('date') date?: string,
    @Query('limit') limit = '200',
  ) {
    return this.reconciliationService.dailyReport(date, Number(limit));
  }
}
