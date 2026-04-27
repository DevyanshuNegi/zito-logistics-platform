import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async createItem(data: any) {
    return this.prisma.inventoryItem.create({
      data: {
        parcelId: data.parcelId,
        bookingId: data.bookingId,
        ownerId: data.ownerId,
        weight: data.weight,
        isFragile: data.isFragile || false,
        isHazmat: data.isHazmat || false,
        dimensions: data.dimensions,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
        warehouseId: data.warehouseId,
        status: 'RECEIVED'
      },
    });
  }

  async filterByOwner(ownerId: string) {
    return this.prisma.inventoryItem.findMany({
      where: { ownerId },
      include: { warehouse: true, bin: true },
    });
  }

  async getDispatchOrder(warehouseId: string) {
    // Assuming FEFO (First Expiring, First Out) for perishable
    // and FIFO (First In, First Out) as a fallback
    return this.prisma.inventoryItem.findMany({
      where: { warehouseId, status: 'STORED' },
      orderBy: [
        { expiryDate: 'asc' }, // FEFO first
        { id: 'asc' }, // FIFO fallback if no expiry date (using ID as chronological proxy or createdAt if existed)
      ],
      take: 100,
    });
  }

  async updateItemStatus(id: string, status: any, updateData?: any) {
    return this.prisma.inventoryItem.update({
      where: { id },
      data: { status, ...updateData },
    });
  }
}

