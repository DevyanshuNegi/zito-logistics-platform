import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RetentionService } from './retention.service';

@ApiTags('Retention')
@ApiBearerAuth('JWT')
@Controller('retention')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class RetentionController {
  constructor(private readonly retentionService: RetentionService) {}

  @Get()
  @ApiOperation({ summary: 'Customer retention analytics snapshot (PRD §27B)' })
  getOverview() {
    return this.retentionService.overview();
  }

  @Get('promos')
  @ApiOperation({ summary: 'Promo, loyalty, and referral readiness snapshot (PRD §27B)' })
  getPromos() {
    return this.retentionService.promos();
  }
}
