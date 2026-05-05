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
import {
  DisbursementRail,
  DisbursementStatus,
  PaymentStatus,
  UserRole,
} from '@prisma/client';

import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { CreateDisbursementDto } from './dto/create-disbursement.dto';
import { RequestMpesaReversalDto } from './dto/request-mpesa-reversal.dto';
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
  @ApiOperation({ summary: 'Initiate payment for a booking or invoice (PRD Section 15 / 16)' })
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

  @Get('booking/:bookingId')
  @ApiOperation({ summary: 'Get all payments for a booking (PRD Section 15)' })
  getBookingPayments(@Param('bookingId', ParseUUIDPipe) bookingId: string) {
    return this.paymentsService.getBookingPayments(bookingId);
  }

  @Get('invoice/:invoiceId')
  @ApiOperation({
    summary: 'Get all payments linked directly to an invoice (PRD Section 16 / 18)',
  })
  getInvoicePayments(@Param('invoiceId', ParseUUIDPipe) invoiceId: string) {
    return this.paymentsService.getInvoicePayments(invoiceId);
  }

  @Get('escrow/:bookingId')
  @ApiOperation({ summary: 'Get escrow status for a booking (PRD Section 15)' })
  getEscrow(@Param('bookingId', ParseUUIDPipe) bookingId: string) {
    return this.paymentsService.getEscrow(bookingId);
  }

  @Get('wallet/me')
  @ApiOperation({ summary: 'Get own wallet balance (PRD Section 15)' })
  getWallet(@Req() req: any) {
    return this.paymentsService.getWallet(req.user.id);
  }

  @Get('wallet/me/transactions')
  @ApiOperation({ summary: 'Get wallet transaction history (PRD Section 15)' })
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

  @Get('disbursements')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.AGENCY_STAFF)
  @ApiOperation({
    summary: 'Admin: list payout and settlement disbursements across Kenya finance rails',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: DisbursementStatus })
  @ApiQuery({ name: 'rail', required: false, enum: DisbursementRail })
  getAllDisbursements(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: DisbursementStatus,
    @Query('rail') rail?: DisbursementRail,
  ) {
    return this.paymentsService.getAllDisbursements(Number(page), Number(limit), status, rail);
  }

  @Post('disbursements')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.AGENCY_STAFF)
  @ApiOperation({
    summary: 'Admin: create an outbound payout or B2B settlement disbursement',
  })
  createDisbursement(@Body() dto: CreateDisbursementDto, @Req() req: any) {
    return this.paymentsService.createDisbursement(dto, req.user.id);
  }

  @Post('disbursements/:id/mpesa/sync')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.AGENCY_STAFF)
  @ApiOperation({
    summary:
      'Admin: sync the provider state of an M-Pesa B2C/B2B disbursement using transaction-status flow',
  })
  syncMpesaDisbursement(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentsService.syncMpesaDisbursementStatus(id);
  }

  @Post('disbursements/:id/mpesa/reversal')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Admin: request an M-Pesa reversal for a previously successful outbound disbursement',
  })
  requestMpesaDisbursementReversal(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RequestMpesaReversalDto,
  ) {
    return this.paymentsService.requestMpesaDisbursementReversal(id, body.reason);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.AGENCY_STAFF)
  @ApiOperation({ summary: 'Admin: list all payments (PRD Section 42)' })
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

  @Get(':id')
  @ApiOperation({ summary: 'Get payment by ID (PRD Section 15)' })
  getPayment(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentsService.getPayment(id);
  }

  @Post(':id/retry')
  @ApiOperation({ summary: 'Retry a failed payment - max 3 attempts (PRD Section 15)' })
  retryPayment(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentsService.retryPayment(id);
  }

  @Patch(':id/confirm')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.AGENCY_STAFF)
  @ApiOperation({ summary: 'Admin: confirm a payment (PRD Section 15)' })
  confirmPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { mpesaRef?: string },
  ) {
    return this.paymentsService.confirmPayment(id, body.mpesaRef);
  }

  @Post(':id/mpesa/sync')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.AGENCY_STAFF)
  @ApiOperation({
    summary:
      'Admin: sync the provider state of an M-Pesa payment using STK query or transaction-status flow',
  })
  syncMpesaPayment(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentsService.syncMpesaPaymentStatus(id);
  }

  @Post(':id/mpesa/reversal')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Admin: request an M-Pesa reversal for a settled payment when finance control approves a recovery action',
  })
  requestMpesaReversal(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RequestMpesaReversalDto,
  ) {
    return this.paymentsService.requestMpesaReversal(id, body.reason);
  }

  @Patch(':id/refund')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.AGENCY_STAFF)
  @ApiOperation({ summary: 'Admin: refund a payment (PRD Section 15)' })
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
