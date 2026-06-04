import {
  Controller,
  Post,
  Patch,
  Get,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { DispatchService } from './dispatch.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

/**
 * Module 5: Dispatch Controller (PRD §16-18)
 * 
 * Admin/Ops endpoints for:
 * - Manual driver assignment
 * - Driver reassignment
 * - Fallback logic triggering
 * - Dispatch audit trail viewing
 */
@ApiTags('Dispatch')
@Controller('admin/dispatch')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DispatchController {
  constructor(private readonly dispatchService: DispatchService) {}

  /**
   * POST /admin/dispatch/bookings/:bookingId/assign-driver
   * Manual assignment of driver to booking by ops team
   * 
   * PRD §16.4: "Ops team can manually assign drivers when auto-matching fails"
   */
  @Post('bookings/:bookingId/assign-driver')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.ADMIN, UserRole.HEAD_OFFICE_STAFF)
  @ApiOperation({
    summary: 'Manually assign driver to booking',
    description: 'Ops team endpoint for manual driver assignment when auto-matching fails',
  })
  @ApiResponse({
    status: 201,
    description: 'Driver assigned successfully',
    schema: {
      example: {
        id: 'assignment-uuid',
        bookingId: 'booking-uuid',
        driverId: 'driver-uuid',
        vehicleId: 'vehicle-uuid',
        status: 'OFFERED',
        matchScore: 100,
        offeredAt: '2026-05-30T10:30:00Z',
        manuallyOfferedBy: 'staff-uuid',
        manuallyOfferedAt: '2026-05-30T10:30:00Z',
      },
    },
  })
  async manualAssignDriver(
    @Param('bookingId') bookingId: string,
    @Body() body: { driverId: string; reason: string },
    @CurrentUser() user: any,
  ) {
    return this.dispatchService.manualAssign(
      bookingId,
      body.driverId,
      user.id,
      body.reason,
    );
  }

  /**
   * PATCH /admin/dispatch/bookings/:bookingId/reassign-driver
   * Reassign driver after rejection or no-show
   */
  @Patch('bookings/:bookingId/reassign-driver')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN, UserRole.HEAD_OFFICE_STAFF)
  @ApiOperation({
    summary: 'Reassign driver to booking',
    description: 'Create new assignment after driver rejection or no-show',
  })
  async reassignDriver(
    @Param('bookingId') bookingId: string,
    @Body() body: { driverId: string; reason: string },
  ) {
    return this.dispatchService.reassignDriver(
      bookingId,
      body.driverId,
      body.reason,
    );
  }

  /**
   * POST /admin/dispatch/bookings/:bookingId/dispatch-expand-radius
   * Trigger fallback logic: expand search radius and retry matching
   */
  @Post('bookings/:bookingId/dispatch-expand-radius')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN, UserRole.HEAD_OFFICE_STAFF)
  @ApiOperation({
    summary: 'Expand search radius and retry matching',
    description: 'Fallback logic: expand radius 50% and attempt matching again',
  })
  async expandRadiusRetry(
    @Param('bookingId') bookingId: string,
    @Body() body?: { currentRadius?: number },
  ) {
    return this.dispatchService.expandRadiusRetry(
      bookingId,
      body?.currentRadius || 10,
    );
  }

  /**
   * GET /admin/dispatch/bookings/:bookingId/dispatch-status
   * Get dispatch audit trail and current status
   */
  @Get('bookings/:bookingId/dispatch-status')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN, UserRole.HEAD_OFFICE_STAFF, UserRole.AGENT)
  @ApiOperation({
    summary: 'Get dispatch status and audit trail',
    description: 'View full assignment history, matching info, and current dispatch status',
  })
  @ApiResponse({
    status: 200,
    description: 'Dispatch status with assignment history',
    schema: {
      example: {
        bookingId: 'booking-uuid',
        bookingStatus: 'ASSIGNED',
        currentDriver: {
          id: 'driver-uuid',
          name: 'John Doe',
          phone: '+254712345678',
          rating: 4.8,
        },
        currentVehicle: {
          id: 'vehicle-uuid',
          plateNumber: 'KBA123XYZ',
          type: 'TRUCK_7T',
        },
        dispatchTimeline: {
          assignedAt: '2026-05-30T10:30:00Z',
          acceptedAt: '2026-05-30T10:35:00Z',
          manuallyAssignedAt: null,
        },
        assignmentHistory: [
          {
            id: 'assignment-uuid',
            status: 'ACCEPTED',
            driverId: 'driver-uuid',
            driverName: 'John Doe',
            matchScore: 87,
            distanceKm: 3.5,
            offeredAt: '2026-05-30T10:30:00Z',
            acceptedAt: '2026-05-30T10:35:00Z',
            rejectedAt: null,
            rejectionReason: null,
          },
        ],
      },
    },
  })
  async getDispatchStatus(@Param('bookingId') bookingId: string) {
    return this.dispatchService.getDispatchStatus(bookingId);
  }
}
