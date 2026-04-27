import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WaybillService {
  constructor(private readonly prisma: PrismaService) {}

  async createWaybill(data: any) {
    const number = 'WB-' + Date.now() + Math.floor(Math.random() * 1000);
    return this.prisma.waybill.create({
      data: {
        number,
        bookingId: data.bookingId,
        type: data.type || 'WAYBILL',
        status: 'CREATED',
        items: data.itemIds && data.itemIds.length > 0 ? {
          connect: data.itemIds.map((id: string) => ({ id }))
        } : undefined
      },
      include: { items: true },
    });
  }

  async findOne(id: string) {
    const waybill = await this.prisma.waybill.findUnique({
      where: { id },
      include: { items: true, scanEvents: true },
    });
    if (!waybill) throw new NotFoundException('Waybill not found');
    return waybill;
  }

  async lockWaybill(id: string) {
    return this.prisma.waybill.update({
      where: { id },
      data: { isLocked: true },
    });
  }

  async updateStatus(id: string, status: any) {
    return this.prisma.waybill.update({
      where: { id },
      data: { 
        status,
        deliveredAt: status === 'DELIVERED' ? new Date() : undefined,
      },
    });
  }
}

