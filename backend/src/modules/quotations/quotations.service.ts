import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BookingStatus } from '@prisma/client';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';

@Injectable()
export class QuotationsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a new quotation for a booking (FTL/PTL/Container/Rail)
   * Transitions booking from SEARCHING → QUOTE_PENDING
   */
  async createQuotation(
    bookingId: string,
    dto: CreateQuotationDto,
    adminUserId: string,
  ) {
    // Verify booking exists and is in SEARCHING status
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException(`Booking ${bookingId} not found`);
    }

    if (booking.status !== BookingStatus.SEARCHING) {
      throw new ConflictException(
        `Booking must be in SEARCHING status to create quotation. Current: ${booking.status}`,
      );
    }

    // Check if quotation already exists
    const existingQuote = await this.prisma.bookingQuote.findUnique({
      where: { bookingId },
    });

    if (existingQuote) {
      throw new ConflictException(`Quotation already exists for booking ${bookingId}`);
    }

    // Calculate validity expiry time
    const validityExpiresAt = new Date(Date.now() + (dto.validityDays || 2) * 24 * 60 * 60 * 1000);

    // Create quotation
    const quotation = await this.prisma.bookingQuote.create({
      data: {
        bookingId,
        quotedPrice: dto.quotedPrice,
        currency: dto.currency || 'KES',
        quotedBy: adminUserId,
        validityExpiresAt,
        terms: dto.terms,
        paymentTerms: dto.paymentTerms,
        specialConditions: dto.specialConditions,
      },
    });

    // Update booking status to QUOTE_PENDING
    await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.QUOTE_PENDING,
        totalPrice: dto.quotedPrice, // Set final quoted price
      },
    });

    return quotation;
  }

  /**
   * Update an existing quotation (extend validity, change price, add conditions)
   */
  async updateQuotation(
    bookingId: string,
    dto: UpdateQuotationDto,
    adminUserId: string,
  ) {
    const quotation = await this.prisma.bookingQuote.findUnique({
      where: { bookingId },
    });

    if (!quotation) {
      throw new NotFoundException(`Quotation not found for booking ${bookingId}`);
    }

    // Only allow updates if quote is still pending (not accepted/rejected)
    if (quotation.acceptedAt || quotation.rejectedAt) {
      throw new ConflictException('Cannot update an accepted or rejected quotation');
    }

    const updateData: any = {};

    if (dto.quotedPrice !== undefined) {
      updateData.quotedPrice = dto.quotedPrice;
    }

    if (dto.extendValidityDays) {
      updateData.validityExpiresAt = new Date(
        Date.now() + dto.extendValidityDays * 24 * 60 * 60 * 1000,
      );
    }

    if (dto.terms !== undefined) {
      updateData.terms = dto.terms;
    }

    if (dto.paymentTerms !== undefined) {
      updateData.paymentTerms = dto.paymentTerms;
    }

    if (dto.specialConditions !== undefined) {
      updateData.specialConditions = dto.specialConditions;
    }

    // Store revision request if present
    if (dto.revisionNote) {
      updateData.revisionRequestedAt = new Date();
      updateData.revisionNote = dto.revisionNote;

      // Transition booking back to SEARCHING for revision
      await this.prisma.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.SEARCHING },
      });
    }

    updateData.quotedAt = new Date();

    const updated = await this.prisma.bookingQuote.update({
      where: { bookingId },
      data: updateData,
    });

    return updated;
  }

  /**
   * Customer accepts the quotation
   * Transitions booking from QUOTE_PENDING → ASSIGNED
   */
  async acceptQuotation(bookingId: string, customerId: string) {
    const quotation = await this.prisma.bookingQuote.findUnique({
      where: { bookingId },
    });

    if (!quotation) {
      throw new NotFoundException(`Quotation not found for booking ${bookingId}`);
    }

    // Verify customer owns the booking
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (booking.customerId !== customerId) {
      throw new BadRequestException('Unauthorized to accept this quotation');
    }

    // Check if quote has expired
    if (new Date() > quotation.validityExpiresAt) {
      throw new ConflictException('Quotation has expired');
    }

    // Check if already accepted/rejected
    if (quotation.acceptedAt || quotation.rejectedAt) {
      throw new ConflictException('Quotation has already been accepted or rejected');
    }

    // Update quotation
    const updated = await this.prisma.bookingQuote.update({
      where: { bookingId },
      data: {
        acceptedAt: new Date(),
        acceptedBy: customerId,
      },
    });

    // Update booking to ASSIGNED status (ready for transporter assignment)
    await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.ASSIGNED },
    });

    return updated;
  }

  /**
   * Customer rejects the quotation
   * Transitions booking from QUOTE_PENDING → CANCELLED
   */
  async rejectQuotation(bookingId: string, customerId: string, reason?: string) {
    const quotation = await this.prisma.bookingQuote.findUnique({
      where: { bookingId },
    });

    if (!quotation) {
      throw new NotFoundException(`Quotation not found for booking ${bookingId}`);
    }

    // Verify customer owns the booking
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (booking.customerId !== customerId) {
      throw new BadRequestException('Unauthorized to reject this quotation');
    }

    // Check if already accepted/rejected
    if (quotation.acceptedAt || quotation.rejectedAt) {
      throw new ConflictException('Quotation has already been accepted or rejected');
    }

    // Update quotation
    const updated = await this.prisma.bookingQuote.update({
      where: { bookingId },
      data: {
        rejectedAt: new Date(),
        rejectionReason: reason,
      },
    });

    // Update booking to CANCELLED status
    await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CANCELLED },
    });

    return updated;
  }

  /**
   * Request revision on a quotation
   * Admin can then modify and update the quote
   */
  async requestRevision(bookingId: string, customerId: string, notes: string) {
    const quotation = await this.prisma.bookingQuote.findUnique({
      where: { bookingId },
    });

    if (!quotation) {
      throw new NotFoundException(`Quotation not found for booking ${bookingId}`);
    }

    // Verify customer owns the booking
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (booking.customerId !== customerId) {
      throw new BadRequestException('Unauthorized to request revision');
    }

    if (quotation.acceptedAt || quotation.rejectedAt) {
      throw new ConflictException('Cannot request revision on accepted or rejected quotation');
    }

    // Mark as revision requested
    const updated = await this.prisma.bookingQuote.update({
      where: { bookingId },
      data: {
        revisionRequestedAt: new Date(),
        revisionNote: notes,
      },
    });

    // Return booking to SEARCHING for admin review
    await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.SEARCHING },
    });

    return updated;
  }

  /**
   * Get quotation for a booking
   */
  async getQuotation(bookingId: string) {
    const quotation = await this.prisma.bookingQuote.findUnique({
      where: { bookingId },
    });

    if (!quotation) {
      throw new NotFoundException(`Quotation not found for booking ${bookingId}`);
    }

    return quotation;
  }

  /**
   * List pending quotations (awaiting customer decision)
   */
  async listPendingQuotations(limit = 50, offset = 0) {
    return this.prisma.bookingQuote.findMany({
      where: {
        acceptedAt: null,
        rejectedAt: null,
      },
      include: {
        booking: {
          select: {
            id: true,
            customerId: true,
            serviceType: true,
            totalPrice: true,
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: { validityExpiresAt: 'asc' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Automated job: expire quotations with passed validity date
   * Transitions booking from QUOTE_PENDING → EXPIRED
   */
  async expireOutdatedQuotations() {
    const now = new Date();

    const expired = await this.prisma.bookingQuote.findMany({
      where: {
        validityExpiresAt: { lt: now },
        acceptedAt: null,
        rejectedAt: null,
      },
      select: { bookingId: true },
    });

    if (expired.length === 0) {
      return { expiredCount: 0 };
    }

    // Update all expired bookings to EXPIRED status
    await this.prisma.booking.updateMany({
      where: {
        id: { in: expired.map(q => q.bookingId) },
      },
      data: { status: BookingStatus.EXPIRED },
    });

    return { expiredCount: expired.length };
  }

  /**
   * List quotations by booking status or customer
   */
  async listQuotationsByCustomer(customerId: string, limit = 50, offset = 0) {
    return this.prisma.bookingQuote.findMany({
      where: {
        booking: { customerId },
      },
      include: {
        booking: {
          select: {
            id: true,
            serviceType: true,
            totalPrice: true,
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: { quotedAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }
}
