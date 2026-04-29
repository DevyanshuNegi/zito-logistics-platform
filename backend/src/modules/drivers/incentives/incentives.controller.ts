import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CreateJoiningBonusDto, IncentiveQueryDto } from './dto/incentive.dto';
import { IncentivesService } from './incentives.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('drivers/incentives')
export class IncentivesController {
  constructor(private readonly incentivesService: IncentivesService) {}

  @Roles('ADMIN', 'SUPER_ADMIN', 'TRANSPORTER')
  @Get()
  list(@Query() query: IncentiveQueryDto) {
    return this.incentivesService.list({
      driverId: query.driverId,
      type: query.type,
    });
  }

  @Roles('ADMIN', 'SUPER_ADMIN', 'TRANSPORTER')
  @Post('joining-bonus')
  createJoiningBonus(
    @Body() dto: CreateJoiningBonusDto,
    @Req() req: any,
  ) {
    return this.incentivesService.grantJoiningBonus(
      {
        driverId: dto.driverId,
        amount: dto.amount,
        reason: dto.reason ?? null,
        reference: dto.reference ?? null,
      },
      req.user.id,
    );
  }
}
