import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WarehouseService {
  constructor(private readonly prisma: PrismaService) {}

  async createWarehouse(data: any) {
    return this.prisma.warehouse.create({
      data: {
        name: data.name,
        code: data.code,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
        status: data.status || 'ACTIVE',
        agencyId: data.agencyId,
        managerId: data.managerId,
      },
    });
  }

  async findAll(agencyId?: string) {
    const where = agencyId ? { agencyId } : {};
    return this.prisma.warehouse.findMany({
      where,
      include: { zones: { include: { racks: { include: { bins: true } } } } },
    });
  }

  async findOne(id: string) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id },
      include: { zones: { include: { racks: { include: { bins: true } } } } },
    });
    if (!warehouse) throw new NotFoundException('Warehouse not found');
    return warehouse;
  }

  async createZone(warehouseId: string, data: any) {
    return this.prisma.warehouseZone.create({
      data: { ...data, warehouseId },
    });
  }

  async createRack(zoneId: string, data: any) {
    return this.prisma.warehouseRack.create({
      data: { ...data, zoneId },
    });
  }

  async createBin(rackId: string, data: any) {
    return this.prisma.warehouseBin.create({
      data: { ...data, rackId, isOccupied: false },
    });
  }

  async getCapacity(id: string) {
    const warehouse = await this.findOne(id);
    let totalCapacity = 0;
    let totalOccupiedBins = 0;
    let totalBins = 0;

    for (const zone of warehouse.zones) {
      totalCapacity += (zone.capacity || 0);
      for (const rack of zone.racks) {
        totalBins += rack.bins.length;
        totalOccupiedBins += rack.bins.filter(b => b.isOccupied).length;
      }
    }

    return {
      warehouseId: id,
      totalCapacity,
      totalBins,
      totalOccupiedBins,
      occupancyPercentage: totalBins ? (totalOccupiedBins / totalBins) * 100 : 0
    };
  }
}

