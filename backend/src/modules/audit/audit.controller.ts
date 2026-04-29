import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
  APPROVAL_ACTION_TYPES,
  ApprovalListQueryDto,
  RequestBookingCancelApprovalDto,
  RequestPayoutOverrideApprovalDto,
  RequestRefundApprovalDto,
  ReviewApprovalDto,
} from './dto/approval.dto';
import { AuditService } from './audit.service';

@ApiTags('Admin Control')
@ApiBearerAuth('JWT')
@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('approvals')
  @ApiOperation({ summary: 'Admin action control queue for high-risk operations (PRD §44.14)' })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'actionType', required: false, enum: APPROVAL_ACTION_TYPES })
  listApprovals(@Query() query: ApprovalListQueryDto) {
    return this.auditService.listApprovalRequests(query);
  }

  @Get('approvals/:id')
  @ApiOperation({ summary: 'Get approval request detail (PRD §44.14)' })
  getApproval(@Param('id', ParseUUIDPipe) id: string) {
    return this.auditService.getApprovalRequest(id);
  }

  @Post('approvals/refund-request')
  @ApiOperation({ summary: 'Request refund approval before executing the payment reversal (PRD §44.14)' })
  requestRefund(@Body() dto: RequestRefundApprovalDto, @Req() req: any) {
    return this.auditService.requestRefundApproval(dto.paymentId, req.user.id, dto.reason);
  }

  @Post('approvals/booking-cancel-request')
  @ApiOperation({ summary: 'Request booking cancellation approval with audit trail (PRD §44.14)' })
  requestBookingCancel(@Body() dto: RequestBookingCancelApprovalDto, @Req() req: any) {
    return this.auditService.requestBookingCancelApproval(dto, req.user.id);
  }

  @Post('approvals/payout-override-request')
  @ApiOperation({ summary: 'Request dual approval for a payroll payout override (PRD §44.14)' })
  requestPayoutOverride(
    @Body() dto: RequestPayoutOverrideApprovalDto,
    @Req() req: any,
  ) {
    return this.auditService.requestPayoutOverrideApproval(dto, req.user.id);
  }

  @Post('approvals/:id/approve')
  @ApiOperation({ summary: 'Approve and, when thresholds are met, execute a high-risk action (PRD §44.14)' })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewApprovalDto,
    @Req() req: any,
  ) {
    return this.auditService.dualApprove(id, req.user.id, dto.note);
  }

  @Post('approvals/:id/reject')
  @ApiOperation({ summary: 'Reject a high-risk action request (PRD §44.14)' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewApprovalDto,
    @Req() req: any,
  ) {
    return this.auditService.rejectApprovalRequest(id, req.user.id, dto.reason);
  }
}
