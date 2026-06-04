import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { QuotationsService } from './quotations.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';

/**
 * Admin Quotation Controller
 * Endpoints for admin/super-admin to manage quotations
 * POST /admin/bookings/:id/quotation - Create quotation
 * PATCH /admin/bookings/:id/quotation - Update quotation
 * GET /admin/bookings/quotations/pending - List pending
 * GET /admin/bookings/:id/quotation - Get quotation details
 */
@Controller('admin/bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminQuotationController {
  constructor(private readonly quotationsService: QuotationsService) {}

  /**
   * Create a new quotation for a booking (FTL/PTL/Container/Rail)
   * Transitions booking from SEARCHING → QUOTE_PENDING
   */
  @Post(':bookingId/quotation')
  async createQuotation(
    @Param('bookingId') bookingId: string,
    @Body() dto: CreateQuotationDto,
    @Request() req,
  ) {
    const quotation = await this.quotationsService.createQuotation(
      bookingId,
      dto,
      req.user.id,
    );

    return {
      success: true,
      quotation,
      message: `Quotation created for booking ${bookingId}. Customer notified.`,
    };
  }

  /**
   * Update an existing quotation (extend validity, change price, add conditions)
   */
  @Patch(':bookingId/quotation')
  async updateQuotation(
    @Param('bookingId') bookingId: string,
    @Body() dto: UpdateQuotationDto,
    @Request() req,
  ) {
    const quotation = await this.quotationsService.updateQuotation(
      bookingId,
      dto,
      req.user.id,
    );

    return {
      success: true,
      quotation,
      message: 'Quotation updated. Customer notified.',
    };
  }

  /**
   * Get quotation details for a booking
   */
  @Get(':bookingId/quotation')
  async getQuotation(@Param('bookingId') bookingId: string) {
    const quotation = await this.quotationsService.getQuotation(bookingId);

    return {
      success: true,
      quotation,
    };
  }

  /**
   * List pending quotations (awaiting customer decision)
   */
  @Get('quotations/pending')
  async listPendingQuotations(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    const quotations = await this.quotationsService.listPendingQuotations(
      limit ? parseInt(limit) : 50,
      offset ? parseInt(offset) : 0,
    );

    return {
      success: true,
      count: quotations.length,
      quotations,
      message: `${quotations.length} quotations awaiting customer decision`,
    };
  }
}

/**
 * Customer Quotation Controller
 * Endpoints for customers to accept/reject/view quotations
 * GET /customer/bookings/:id/quotation - View quotation
 * POST /customer/bookings/:id/quotation/accept - Accept quotation
 * POST /customer/bookings/:id/quotation/reject - Reject quotation
 * POST /customer/bookings/:id/quotation/request-revision - Request revision
 */
@Controller('customer/bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CUSTOMER', 'CORPORATE')
export class CustomerQuotationController {
  constructor(private readonly quotationsService: QuotationsService) {}

  /**
   * View quotation for a booking
   */
  @Get(':bookingId/quotation')
  async getQuotation(@Param('bookingId') bookingId: string) {
    const quotation = await this.quotationsService.getQuotation(bookingId);

    // Calculate time remaining
    const now = new Date();
    const msRemaining = quotation.validityExpiresAt.getTime() - now.getTime();
    const hoursRemaining = Math.ceil(msRemaining / (1000 * 60 * 60));

    return {
      success: true,
      quotation,
      validityStatus: {
        hoursRemaining,
        isExpired: msRemaining <= 0,
        expiresAt: quotation.validityExpiresAt,
      },
    };
  }

  /**
   * Accept a quotation
   * Transitions booking from QUOTE_PENDING → ASSIGNED
   */
  @Post(':bookingId/quotation/accept')
  async acceptQuotation(@Param('bookingId') bookingId: string, @Request() req) {
    const quotation = await this.quotationsService.acceptQuotation(bookingId, req.user.id);

    return {
      success: true,
      quotation,
      message: `Quotation accepted. Booking confirmed at KES ${quotation.quotedPrice}. Transporter will be assigned shortly.`,
    };
  }

  /**
   * Reject a quotation
   * Transitions booking from QUOTE_PENDING → CANCELLED
   */
  @Post(':bookingId/quotation/reject')
  async rejectQuotation(
    @Param('bookingId') bookingId: string,
    @Body() body: { reason?: string },
    @Request() req,
  ) {
    const quotation = await this.quotationsService.rejectQuotation(
      bookingId,
      req.user.id,
      body.reason,
    );

    return {
      success: true,
      quotation,
      message: 'Quotation rejected. Booking cancelled. You can submit a new booking request anytime.',
    };
  }

  /**
   * Request revision on a quotation
   */
  @Post(':bookingId/quotation/request-revision')
  async requestRevision(
    @Param('bookingId') bookingId: string,
    @Body() body: { notes: string },
    @Request() req,
  ) {
    const quotation = await this.quotationsService.requestRevision(
      bookingId,
      req.user.id,
      body.notes,
    );

    return {
      success: true,
      quotation,
      message: `Revision requested. Admin will review your feedback and create a new quote within 2 hours.`,
    };
  }

  /**
   * List my quotations (for customer to track)
   */
  @Get()
  async listMyQuotations(
    @Request() req,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const quotations = await this.quotationsService.listQuotationsByCustomer(
      req.user.id,
      limit ? parseInt(limit) : 50,
      offset ? parseInt(offset) : 0,
    );

    return {
      success: true,
      count: quotations.length,
      quotations,
    };
  }
}
