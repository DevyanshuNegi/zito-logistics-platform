import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  ConvertDriverReferralDto,
  RegisterDriverReferralDto,
} from './dto/driver-referral.dto';
import { RetentionService } from './retention.service';

@ApiTags('Retention')
@ApiBearerAuth('JWT')
@Controller('retention')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RetentionController {
  constructor(private readonly retentionService: RetentionService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Customer retention analytics snapshot (PRD Section 27B)' })
  getOverview() {
    return this.retentionService.overview();
  }

  @Get('promos')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Promo, loyalty, and referral readiness snapshot (PRD Section 27B)' })
  getPromos() {
    return this.retentionService.promos();
  }

  @Get('driver-referrals')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.TRANSPORTER)
  @ApiOperation({ summary: 'Driver referral pipeline and activation payouts (PRD Section 50)' })
  getDriverReferrals() {
    return this.retentionService.listDriverReferrals();
  }

  @Post('driver-referrals/register')
  @Roles(
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.TRANSPORTER,
    UserRole.DRIVER,
  )
  @ApiOperation({ summary: 'Register a driver referral invitation (PRD Section 50)' })
  registerDriverReferral(
    @Body() dto: RegisterDriverReferralDto,
    @Req() req: any,
  ) {
    return this.retentionService.registerDriverReferral(
      dto,
      req.user.id,
      req.user.driverId ?? null,
    );
  }

  @Post('driver-referrals/:referralId/convert')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.TRANSPORTER)
  @ApiOperation({ summary: 'Convert an active referred driver and release referral payouts (PRD Section 50)' })
  convertDriverReferral(
    @Param('referralId', ParseUUIDPipe) referralId: string,
    @Body() dto: ConvertDriverReferralDto,
    @Req() req: any,
  ) {
    return this.retentionService.convertDriverReferral(
      referralId,
      req.user.id,
      dto.note,
    );
  }
}
