import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RtoStatus } from '@prisma/client';

// Lifecycle based on PRD, but using Prisma enum

const ALLOWED_TRANSITIONS: Record<RtoStatus, RtoStatus[]> = {
  INITIATED: [RtoStatus.IN_TRANSIT],
  IN_TRANSIT: [RtoStatus.WAREHOUSE_RECEIVED],
  WAREHOUSE_RECEIVED: [RtoStatus.CLOSED],
  CLOSED: [],
};

@Injectable()
export class RtoService {
  constructor(private readonly prisma: PrismaService) {}

  async initiate(bookingId: string, reason: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) throw new NotFoundException('Booking not found');

    return this.prisma.rtoReturn.create({
      data: {
        bookingId,
        reason,
        status: RtoStatus.INITIATED,
      },
    });
  }

  async updateStatus(id: string, status: RtoStatus) {
    const rto = await this.prisma.rtoReturn.findUnique({
      where: { id },
    });

    if (!rto) throw new NotFoundException('RTO record not found');

    const allowed = ALLOWED_TRANSITIONS[rto.status];

    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Invalid transition from ${rto.status} to ${status}`,
      );
    }

    return this.prisma.rtoReturn.update({
      where: { id },
      data: {
        status: status, // ✅ correct type now
      },
    });
  }

  async receiveAtWarehouse(id: string, warehouseId: string) {
    const rto = await this.prisma.rtoReturn.findUnique({
      where: { id },
    });

    if (!rto) throw new NotFoundException('RTO record not found');

    if (rto.status !== RtoStatus.IN_TRANSIT) {
      throw new BadRequestException(
        'RTO must be IN_TRANSIT before warehouse receive',
      );
    }

    return this.prisma.rtoReturn.update({
      where: { id },
      data: {
        status: RtoStatus.WAREHOUSE_RECEIVED,
        warehouseId,
      },
    });
  }
}