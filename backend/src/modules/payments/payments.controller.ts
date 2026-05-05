import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PaymentStatus, UserRole } from '@prisma/client';

import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { AuditService } from '../audit/audit.service';

@ApiTags('Payments')
@ApiBearerAuth('JWT')
@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly auditService: AuditService,
  ) {}

  @Post('initiate')
  @ApiOperation({ summary: 'Initiate payment for a booking or invoice (PRD §15, §16)' })
  initiatePayment(
    @Body() dto: InitiatePaymentDto,
    @Headers('x-idempotency-key') idempotencyKey: string,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException('X-Idempotency-Key header is required');
    }
    if (!dto.bookingId && !dto.invoiceId) {
      throw new BadRequestException('Either bookingId or invoiceId is required');
    }
    return this.paymentsService.initiatePayment(
      {
        bookingId: dto.bookingId,
        invoiceId: dto.invoiceId,
      },
      dto.amount,
      dto.method,
      idempotencyKey,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get payment by ID (PRD §15)' })
  getPayment(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentsService.getPayment(id);
  }

  @Get('booking/:bookingId')
  @ApiOperation({ summary: 'Get all payments for a booking (PRD §15)' })
  getBookingPayments(@Param('bookingId', ParseUUIDPipe) bookingId: string) {
    return this.paymentsService.getBookingPayments(bookingId);
  }

  @Get('invoice/:invoiceId')
  @ApiOperation({ summary: 'Get all payments linked directly to an invoice (PRD §16, §18)' })
  getInvoicePayments(@Param('invoiceId', ParseUUIDPipe) invoiceId: string) {
    return this.paymentsService.getInvoicePayments(invoiceId);
  }

  @Post(':id/retry')
  @ApiOperation({ summary: 'Retry a failed payment - max 3 attempts (PRD §15)' })
  retryPayment(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentsService.retryPayment(id);
  }

  @Get('escrow/:bookingId')
  @ApiOperation({ summary: 'Get escrow status for a booking (PRD §15)' })
  getEscrow(@Param('bookingId', ParseUUIDPipe) bookingId: string) {
    return this.paymentsService.getEscrow(bookingId);
  }

  @Get('wallet/me')
  @ApiOperation({ summary: 'Get own wallet balance (PRD §15)' })
  getWallet(@Req() req: any) {
    return this.paymentsService.getWallet(req.user.id);
  }

  @Get('wallet/me/transactions')
  @ApiOperation({ summary: 'Get wallet transaction history (PRD §15)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getWalletTransactions(
    @Req() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.paymentsService.getWalletTransactions(
      req.user.id,
      Number(page),
      Math.min(Number(limit), 100),
    );
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.AGENCY_STAFF)
  @ApiOperation({ summary: 'Admin: list all payments (PRD §42)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: PaymentStatus })
  getAllPayments(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: PaymentStatus,
  ) {
    return this.paymentsService.getAllPayments(Number(page), Number(limit), status);
  }

  @Patch(':id/confirm')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.AGENCY_STAFF)
  @ApiOperation({ summary: 'Admin: confirm a payment (PRD §15)' })
  confirmPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { mpesaRef?: string },
  ) {
    return this.paymentsService.confirmPayment(id, body.mpesaRef);
  }

  @Patch(':id/refund')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.AGENCY_STAFF)
  @ApiOperation({ summary: 'Admin: refund a payment (PRD §15)' })
  refundPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason?: string },
    @Req() req: any,
  ) {
    if (!body.reason) {
      throw new BadRequestException('Refund reason is required');
    }
    return this.auditService.requestRefundApproval(id, req.user.id, body.reason);
  }
}
