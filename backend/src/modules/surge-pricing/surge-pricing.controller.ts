import {
  Body,
  Controller,
  Get,
  Param,
  ParseBoolPipe,
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
import {
  ActivateSurgeZoneDto,
  CreateSurgeZoneDto,
  OverrideSurgeZoneDto,
  UpdateSurgeZoneDto,
} from './dto/surge-zone.dto';
import { SurgePricingService } from './surge-pricing.service';

@ApiTags('Surge Pricing')
@ApiBearerAuth('JWT')
@Controller('surge-pricing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class SurgePricingController {
  constructor(private readonly surgePricingService: SurgePricingService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Surge pricing dashboard with zone ratios and peak-hour rules (PRD §44.8)' })
  getDashboard() {
    return this.surgePricingService.dashboard();
  }

  @Get('peak-hour-rules')
  @ApiOperation({ summary: 'Time-based surge pricing rules (PRD §44.8)' })
  getPeakHourRules() {
    return this.surgePricingService.peakHourRules();
  }

  @Get()
  @ApiOperation({ summary: 'List configured surge zones (PRD §44.8 support)' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  list(
    @Query('includeInactive', new ParseBoolPipe({ optional: true }))
    includeInactive?: boolean,
  ) {
    return this.surgePricingService.list(includeInactive ?? true);
  }

  @Get(':id/ratio')
  @ApiOperation({ summary: 'Calculate the demand-supply ratio for a surge zone (PRD §44.8)' })
  getRatio(@Param('id', ParseUUIDPipe) id: string) {
    return this.surgePricingService.calcRatio(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a surge zone (PRD §44.8 support)' })
  create(@Body() dto: CreateSurgeZoneDto, @Req() req: any) {
    return this.surgePricingService.createZone(dto, req.user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a surge zone (PRD §44.8 support)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSurgeZoneDto,
    @Req() req: any,
  ) {
    return this.surgePricingService.updateZone(id, dto, req.user.id);
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate surge pricing for a zone (PRD §44.8)' })
  activate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActivateSurgeZoneDto,
    @Req() req: any,
  ) {
    return this.surgePricingService.activateZone(id, dto, req.user.id);
  }

  @Post(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate surge pricing for a zone (PRD §44.8)' })
  deactivate(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.surgePricingService.deactivateZone(id, req.user.id);
  }

  @Post(':id/override')
  @ApiOperation({ summary: 'Emergency surge override by Super Admin (PRD §44.8)' })
  @Roles(UserRole.SUPER_ADMIN)
  override(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OverrideSurgeZoneDto,
    @Req() req: any,
  ) {
    return this.surgePricingService.override(id, dto, req.user.id);
  }
}
