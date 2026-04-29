import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  HttpStatus,
  HttpCode,
  ForbiddenException,
  Query,
} from '@nestjs/common';
import { ShiftService } from './shift.service';
import { ShiftDto } from './shift.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';

@Controller('drivers/shift')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DRIVER')
export class ShiftController {
  constructor(private readonly shiftService: ShiftService) {}

  /**
   * POST /api/v1/drivers/shift/start
   * Mandatory as per PRD §44.1: Driver must START SHIFT before going online.
   */
  @Post('start')
  @HttpCode(HttpStatus.CREATED)
  async start(@Req() req: any, @Body() dto: ShiftDto) {
    if (!req.user?.driverId) {
      throw new ForbiddenException('Driver profile not found for this account');
    }

    const shiftResult = await this.shiftService.startShift(req.user.driverId);
    
    return {
      message: shiftResult.message,
      data: {
        ...shiftResult,
        shift_id: shiftResult.shift.id, // Explicit mapping for PRD field compliance and test compatibility
      },
    };
  }

  /**
   * POST /api/v1/drivers/shift/end
   * Ends the active shift session and triggers performance metric calculations.
   */
  @Post('end')
  @HttpCode(HttpStatus.OK)
  async end(@Req() req: any) {
    if (!req.user?.driverId) {
      throw new ForbiddenException('Driver profile not found for this account');
    }

    const shift = await this.shiftService.endShift(req.user.driverId);
    return {
      message: 'Shift ended successfully',
      data: shift,
    };
  }

  @Get('status')
  async getStatus(@Req() req: any) {
    if (!req.user?.driverId) {
      throw new ForbiddenException('Driver profile not found for this account');
    }

    return this.shiftService.getActiveShift(req.user.driverId);
  }

  @Get('history')
  async getHistory(
    @Req() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    if (!req.user?.driverId) {
      throw new ForbiddenException('Driver profile not found for this account');
    }

    return this.shiftService.getShiftHistory(
      req.user.driverId,
      Number(page),
      Number(limit),
    );
  }
}
