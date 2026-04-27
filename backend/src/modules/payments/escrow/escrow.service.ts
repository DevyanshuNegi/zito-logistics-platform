import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export type EscrowStatus = 'HELD' | 'RELEASED' | 'REFUNDED' | 'DISPUTED';

@Injectable()
export class EscrowService {
  constructor(private readonly prisma: PrismaService) {}

  async holdPayment(bookingId: string, amount: number, userId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Booking not found');

    const existing = await this.prisma.escrow.findUnique({ where: { bookingId } });
    if (existing) throw new ConflictException('Escrow already exists for this booking');

    const escrow = await this.prisma.escrow.create({
      data: {
        bookingId,
        amount,
        status: 'HELD',
        heldAt: new Date(),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'PAYMENT_INITIATED',
        entityType: 'ESCROW',
        entityId: escrow.id,
        details: { bookingId, amount, status: 'HELD' },
      },
    });

    return escrow;
  }

  async releaseOnDelivery(bookingId: string, releasedByAdminId: string) {
    const escrow = await this.getEscrowOrThrow(bookingId);

    if (escrow.status === 'DISPUTED') {
      throw new BadRequestException('Escrow is on dispute hold. Resolve the dispute before releasing.');
    }
    if (escrow.status === 'RELEASED') {
      throw new ConflictException('Escrow already released');
    }
    if (escrow.status === 'REFUNDED') {
      throw new ConflictException('Escrow already refunded');
    }

    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!['DELIVERED', 'COMPLETED'].includes(booking.status)) {
      throw new BadRequestException(
        `Cannot release escrow — booking status is ${booking.status}. Must be DELIVERED or COMPLETED.`,
      );
    }

    const updated = await this.prisma.escrow.update({
      where: { bookingId },
      data: {
        status: 'RELEASED',
        releasedAt: new Date(),
        releaseNote: `Released by ${releasedByAdminId}`,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: releasedByAdminId,
        action: 'PAYMENT_COMPLETED',
        entityType: 'ESCROW',
        entityId: escrow.id,
        details: { bookingId, amount: escrow.amount },
      },
    });

    return updated;
  }

  async refundFull(bookingId: string, reason: string, adminId: string) {
    const escrow = await this.getEscrowOrThrow(bookingId);
    if (['RELEASED', 'REFUNDED'].includes(escrow.status)) {
      throw new ConflictException(`Cannot refund — escrow status is ${escrow.status}`);
    }

    const updated = await this.prisma.escrow.update({
      where: { bookingId },
      data: {
        status: 'REFUNDED',
        refundedAt: new Date(),
        releaseNote: `Full refund: ${reason}`,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'REFUND_ISSUED',
        entityType: 'ESCROW',
        entityId: escrow.id,
        details: { bookingId, refundAmount: escrow.amount, reason },
      },
    });

    return updated;
  }

  async refundPartial(bookingId: string, refundAmount: number, reason: string, adminId: string) {
    const escrow = await this.getEscrowOrThrow(bookingId);
    if (refundAmount > escrow.amount) {
      throw new BadRequestException('Refund amount exceeds held amount');
    }

    const updated = await this.prisma.escrow.update({
      where: { bookingId },
      data: {
        status: 'REFUNDED',
        refundedAt: new Date(),
        releaseNote: `Partial refund (${refundAmount}): ${reason}`,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'REFUND_ISSUED',
        entityType: 'ESCROW',
        entityId: escrow.id,
        details: { bookingId, refundAmount, totalHeld: escrow.amount, reason },
      },
    });

    return updated;
  }

  async holdForDispute(bookingId: string, disputeId: string, adminId: string) {
    const escrow = await this.getEscrowOrThrow(bookingId);
    if (escrow.status === 'RELEASED') {
      throw new BadRequestException('Cannot dispute — payment already released');
    }

    const updated = await this.prisma.escrow.update({
      where: { bookingId },
      data: { 
        status: 'DISPUTED',
        releaseNote: `Dispute hold linked to ${disputeId}`
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'DISPUTE_HOLD',
        entityType: 'ESCROW',
        entityId: escrow.id,
        details: { bookingId, disputeId },
      },
    });

    return updated;
  }

  async resolveDisputeHold(bookingId: string, outcome: 'RELEASE' | 'REFUND', adminId: string, refundAmount?: number) {
    const escrow = await this.getEscrowOrThrow(bookingId);
    if (escrow.status !== 'DISPUTED') {
      throw new BadRequestException('Escrow is not in dispute hold');
    }

    if (outcome === 'RELEASE') {
      return this.releaseOnDelivery(bookingId, adminId);
    } else {
      return this.refundPartial(bookingId, refundAmount ?? escrow.amount, 'Dispute resolved — refund', adminId);
    }
  }

  async getStatus(bookingId: string) {
    return this.getEscrowOrThrow(bookingId);
  }

  private async getEscrowOrThrow(bookingId: string) {
    const escrow = await this.prisma.escrow.findUnique({ where: { bookingId } });
    if (!escrow) throw new NotFoundException(`No escrow found for booking ${bookingId}`);
    return escrow;
  }
}
