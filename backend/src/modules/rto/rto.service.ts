import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RtoService {
  constructor(private readonly prisma: PrismaService) {}

  async initiate(bookingId: string, reason: string) {
    return this.prisma.rtoReturn.create({
      data: {
        bookingId,
        reason,
        status: 'INITIATED',
      },
    });
  }

  async updateStatus(id: string, status: any) {
    return this.prisma.rtoReturn.update({
      where: { id },
      data: { status },
    });
  }

  async receiveAtWarehouse(id: string, warehouseId: string) {
    return this.prisma.rtoReturn.update({
      where: { id },
      data: {
        status: 'WAREHOUSE_RECEIVED',
        warehouseId,
      },
    });
  }
}

