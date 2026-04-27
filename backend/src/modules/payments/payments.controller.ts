import {
  Controller, Post, Get, Patch, Param, Body,
  Req, UseGuards, Query, Headers, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UserRole, PaymentStatus } from '@prisma/client';

import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';

@ApiTags('Payments')
@ApiBearerAuth('JWT')
@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // ─── Customer / Self ──────────────────────────────────────────────────────

  /**
   * PRD §15: Initiate payment for a booking.
   * X-Idempotency-Key header required to prevent duplicate charges.
   */
  @Post('initiate')
  @ApiOperation({ summary: 'Initiate payment for a booking (PRD §15)' })
  initiatePayment(
    @Body() dto: InitiatePaymentDto,
    @Headers('x-idempotency-key') idempotencyKey: string,
  ) {
    if (!idempotencyKey) {
      throw new Error('X-Idempotency-Key header is required');
    }
    return this.paymentsService.initiatePayment(
      dto.bookingId,
      dto.amount,
      dto.method,
      idempotencyKey,
    );
  }

  /**
   * PRD §15: Get payment details by ID.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get payment by ID (PRD §15)' })
  getPayment(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentsService.getPayment(id);
  }

  /**
   * PRD §15: Get all payments for a booking.
   */
  @Get('booking/:bookingId')
  @ApiOperation({ summary: 'Get all payments for a booking (PRD §15)' })
  getBookingPayments(@Param('bookingId', ParseUUIDPipe) bookingId: string) {
    return this.paymentsService.getBookingPayments(bookingId);
  }

  /**
   * PRD §15: Retry a failed payment. Max 3 retries.
   */
  @Post(':id/retry')
  @ApiOperation({ summary: 'Retry a failed payment — max 3 attempts (PRD §15)' })
  retryPayment(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentsService.retryPayment(id);
  }

  /**
   * PRD §15: Get escrow status for a booking.
   */
  @Get('escrow/:bookingId')
  @ApiOperation({ summary: 'Get escrow status for a booking (PRD §15)' })
  getEscrow(@Param('bookingId', ParseUUIDPipe) bookingId: string) {
    return this.paymentsService.getEscrow(bookingId);
  }

  // ─── Wallet ───────────────────────────────────────────────────────────────

  /**
   * PRD §15: Get own wallet balance.
   */
  @Get('wallet/me')
  @ApiOperation({ summary: 'Get own wallet balance (PRD §15)' })
  getWallet(@Req() req: any) {
    return this.paymentsService.getWallet(req.user.id);
  }

  /**
   * PRD §15: Get wallet transaction history with pagination.
   */
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

  // ─── Admin ────────────────────────────────────────────────────────────────

  /**
   * PRD §42: Admin — list all payments with optional status filter.
   */
  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
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

  /**
   * PRD §15: Admin confirm payment (e.g. after manual bank transfer verification).
   */
  @Patch(':id/confirm')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin: confirm a payment (PRD §15)' })
  confirmPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { mpesaRef?: string },
  ) {
    return this.paymentsService.confirmPayment(id, body.mpesaRef);
  }

  /**
   * PRD §15: Admin refund a payment.
   */
  @Patch(':id/refund')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin: refund a payment (PRD §15)' })
  refundPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason?: string },
  ) {
    return this.paymentsService.refundPayment(id, body.reason);
  }
}