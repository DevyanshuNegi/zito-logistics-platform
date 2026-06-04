import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { DispatchService } from './dispatch.service';

@ApiTags('Driver Dispatch')
@Controller('drivers/dispatch')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.DRIVER)
@ApiBearerAuth()
export class DriverDispatchController {
  constructor(private readonly dispatchService: DispatchService) {}

  /**
   * POST /drivers/dispatch/assignments/:assignmentId/accept
   * Driver accepts an offered assignment.
   */
  @Post('assignments/:assignmentId/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Accept assignment offer',
    description: 'Driver-facing endpoint for accepting a dispatch assignment offer',
  })
  @ApiResponse({
    status: 200,
    description: 'Assignment accepted successfully',
  })
  acceptAssignment(@Param('assignmentId') assignmentId: string, @Req() req: any) {
    const driverId = this.getDriverId(req);
    return this.dispatchService.acceptAssignment(assignmentId, driverId);
  }

  /**
   * POST /drivers/dispatch/assignments/:assignmentId/reject
   * Driver rejects an offered assignment.
   */
  @Post('assignments/:assignmentId/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reject assignment offer',
    description: 'Driver-facing endpoint for rejecting a dispatch assignment offer',
  })
  @ApiResponse({
    status: 200,
    description: 'Assignment rejected successfully',
  })
  rejectAssignment(
    @Param('assignmentId') assignmentId: string,
    @Body() body: { reason?: string },
    @Req() req: any,
  ) {
    const driverId = this.getDriverId(req);
    return this.dispatchService.rejectAssignment(
      assignmentId,
      driverId,
      body?.reason?.trim() || 'Rejected by driver',
    );
  }

  private getDriverId(req: any): string {
    if (!req.user?.driverId) {
      throw new ForbiddenException('Driver profile not found for this account');
    }

    return req.user.driverId;
  }
}
