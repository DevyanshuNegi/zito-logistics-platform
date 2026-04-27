import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ScanService {
  constructor(private readonly prisma: PrismaService) {}

  async recordScan(data: any, performedBy: string) {
    // Basic validation
    const item = await this.prisma.inventoryItem.findUnique({
      where: { id: data.itemId },
    });
    if (!item) throw new NotFoundException('Item not found');

    const scan = await this.prisma.scanEvent.create({
      data: {
        itemId: data.itemId,
        bookingId: item.bookingId,
        waybillId: item.waybillId,
        vehicleId: data.vehicleId,
        driverId: data.driverId,
        checkpoint: data.checkpoint,
        latitude: data.latitude,
        longitude: data.longitude,
        performedBy,
      },
    });

    // Update item status based on checkpoint
    const statusMap: Record<string, any> = {
      'PICKUP': 'RECEIVED',
      'WAREHOUSE_ENTRY': 'STORED',
      'STORAGE': 'STORED',
      'DISPATCH': 'DISPATCHED',
      'DELIVERY': 'DELIVERED',
    };

    if (statusMap[data.checkpoint]) {
      await this.prisma.inventoryItem.update({
        where: { id: data.itemId },
        data: { status: statusMap[data.checkpoint] },
      });
    }

    return scan;
  }
}

