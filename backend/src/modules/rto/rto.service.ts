import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, Prisma, RtoStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const ALLOWED_TRANSITIONS: Record<RtoStatus, RtoStatus[]> = {
  INITIATED: [RtoStatus.IN_TRANSIT],
  IN_TRANSIT: [RtoStatus.WAREHOUSE_RECEIVED],
  WAREHOUSE_RECEIVED: [RtoStatus.CLOSED],
  CLOSED: [],
};

@Injectable()
export class RtoService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly rtoInclude = {
    booking: {
      select: {
        id: true,
        reference: true,
        status: true,
        customerId: true,
      },
    },
    warehouse: {
      select: {
        id: true,
        name: true,
        code: true,
      },
    },
  };

  async list(filters: any = {}) {
    const where: Prisma.RtoReturnWhereInput = {
      ...(filters.status && { status: filters.status }),
      ...(filters.bookingId && { bookingId: filters.bookingId }),
      ...(filters.warehouseId && { warehouseId: filters.warehouseId }),
    };

    return this.prisma.rtoReturn.findMany({
      where,
      include: this.rtoInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const rto = await this.prisma.rtoReturn.findUnique({
      where: { id },
      include: this.rtoInclude,
    });

    if (!rto) {
      throw new NotFoundException('RTO record not found');
    }

    return rto;
  }

  async initiate(bookingId: string, reason: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (
      booking.status === BookingStatus.DELIVERED ||
      booking.status === BookingStatus.COMPLETED
    ) {
      throw new BadRequestException(
        'RTO cannot be initiated for a delivered or completed booking',
      );
    }

    const existing = await this.prisma.rtoReturn.findUnique({
      where: { bookingId },
    });
    if (existing) {
      throw new ConflictException('RTO has already been initiated for this booking');
    }

    return this.prisma.rtoReturn.create({
      data: {
        bookingId,
        reason,
        status: RtoStatus.INITIATED,
      },
      include: this.rtoInclude,
    });
  }

  async updateStatus(id: string, status: RtoStatus) {
    const rto = await this.findOne(id);

    const allowed = ALLOWED_TRANSITIONS[rto.status];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Invalid transition from ${rto.status} to ${status}`,
      );
    }

    return this.prisma.rtoReturn.update({
      where: { id },
      data: {
        status,
        closedAt: status === RtoStatus.CLOSED ? new Date() : undefined,
      },
      include: this.rtoInclude,
    });
  }

  async receiveAtWarehouse(id: string, warehouseId: string) {
    const [rto, warehouse] = await Promise.all([
      this.findOne(id),
      this.prisma.warehouse.findUnique({
        where: { id: warehouseId },
        select: { id: true },
      }),
    ]);

    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }

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
      include: this.rtoInclude,
    });
  }
}
