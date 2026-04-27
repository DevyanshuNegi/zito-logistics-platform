import { Controller, Post, Body, UseGuards, Req, HttpStatus, HttpCode } from '@nestjs/common';
import { ShiftService } from './shift.service';
import { ShiftDto } from './shift.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('drivers/shift')
@UseGuards(JwtAuthGuard)
export class ShiftController {
  constructor(private readonly shiftService: ShiftService) {}

  /**
   * POST /api/v1/drivers/shift/start
   * Mandatory as per PRD §44.1: Driver must START SHIFT before going online.
   */
  @Post('start')
  @HttpCode(HttpStatus.CREATED)
  async start(@Req() req: any, @Body() dto: ShiftDto) {
    const shiftResult = await this.shiftService.startShift(req.user.id);
    
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
    const shift = await this.shiftService.endShift(req.user.id);
    return {
      message: 'Shift ended successfully',
      data: shift,
    };
  }
}