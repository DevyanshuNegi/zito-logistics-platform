import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EscrowStatus } from '@prisma/client';

// Schema reality:
// Escrow fields: id, bookingId, amount, status(EscrowStatus), heldAt, releasedAt, refundedAt, releaseNote
// EscrowStatus enum: HELD | RELEASED | DISPUTED | REFUNDED
// NO: paymentId, releasedBy, refundAmount, disputeId, PARTIALLY_REFUNDED, DISPUTE_HOLD

@Injectable()
export class EscrowService {
  constructor(private readonly prisma: PrismaService) {}

  // Hold payment when booking is confirmed
  async hold(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, totalPrice: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const existing = await this.prisma.escrow.findUnique({ where: { bookingId } });
    if (existing) throw new ConflictException('Escrow already exists for this booking');

    return this.prisma.escrow.create({
      data: {
        bookingId,
        amount: booking.totalPrice,
        status: EscrowStatus.HELD,
        heldAt: new Date(),
      },
    });
  }

  // Release to driver on delivery — called after DELIVERED + payment confirmed
  async release(bookingId: string, note?: string) {
    const escrow = await this.getOrThrow(bookingId);

    if (escrow.status === EscrowStatus.DISPUTED) {
      throw new BadRequestException('Escrow is disputed. Resolve dispute before releasing.');
    }
    if (escrow.status === EscrowStatus.RELEASED) {
      throw new ConflictException('Escrow already released');
    }
    if (escrow.status === EscrowStatus.REFUNDED) {
      throw new ConflictException('Escrow already refunded');
    }

    // Verify booking is deliverable
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { status: true },
    });
    if (!['DELIVERED', 'COMPLETED'].includes(booking.status)) {
      throw new BadRequestException(
        `Cannot release escrow — booking is ${booking.status}. Must be DELIVERED or COMPLETED.`,
      );
    }

    return this.prisma.escrow.update({
      where: { bookingId },
      data: {
        status: EscrowStatus.RELEASED,
        releasedAt: new Date(),
        releaseNote: note ?? 'Released on delivery confirmation',
      },
    });
  }

  // Full refund — for cancellations before trip starts
  async refund(bookingId: string, note: string) {
    const escrow = await this.getOrThrow(bookingId);

    if (escrow.status === EscrowStatus.RELEASED) {
      throw new ConflictException('Cannot refund — payment already released to driver');
    }
    if (escrow.status === EscrowStatus.REFUNDED) {
      throw new ConflictException('Already refunded');
    }

    return this.prisma.escrow.update({
      where: { bookingId },
      data: {
        status: EscrowStatus.REFUNDED,
        refundedAt: new Date(),
        releaseNote: note,
      },
    });
  }

  // Mark as disputed — freezes release until admin resolves
  async dispute(bookingId: string, reason: string) {
    const escrow = await this.getOrThrow(bookingId);

    if (escrow.status === EscrowStatus.RELEASED) {
      throw new BadRequestException('Cannot dispute — payment already released');
    }
    if (escrow.status === EscrowStatus.REFUNDED) {
      throw new BadRequestException('Cannot dispute — payment already refunded');
    }

    return this.prisma.escrow.update({
      where: { bookingId },
      data: {
        status: EscrowStatus.DISPUTED,
        releaseNote: `Disputed: ${reason}`,
      },
    });
  }

  // Resolve dispute — admin decides: release or refund
  async resolveDispute(bookingId: string, outcome: 'RELEASE' | 'REFUND', adminNote: string) {
    const escrow = await this.getOrThrow(bookingId);

    if (escrow.status !== EscrowStatus.DISPUTED) {
      throw new BadRequestException('Escrow is not in disputed state');
    }

    return outcome === 'RELEASE'
      ? this.release(bookingId, `Dispute resolved — ${adminNote}`)
      : this.refund(bookingId, `Dispute resolved — refunded — ${adminNote}`);
  }

  async getStatus(bookingId: string) {
    return this.getOrThrow(bookingId);
  }

  private async getOrThrow(bookingId: string) {
    const escrow = await this.prisma.escrow.findUnique({ where: { bookingId } });
    if (!escrow) throw new NotFoundException(`No escrow found for booking ${bookingId}`);
    return escrow;
  }
}
