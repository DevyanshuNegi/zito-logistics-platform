import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type WarehouseAccessContext = {
  viewerRole?: string;
  viewerAgencyId?: string | null;
  viewerUserId?: string;
  agencyId?: string;
};

@Injectable()
export class WarehouseService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly warehouseInclude = {
    manager: {
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
      },
    },
    zones: {
      include: {
        racks: {
          include: {
            bins: {
              include: {
                _count: {
                  select: {
                    items: true,
                  },
                },
              },
            },
          },
        },
      },
    },
    _count: {
      select: {
        items: true,
      },
    },
  };

  private buildAccessWhere(
    context: WarehouseAccessContext = {},
  ): Prisma.WarehouseWhereInput {
    const where: Prisma.WarehouseWhereInput = {};

    if (context.viewerRole === 'AGENCY_STAFF') {
      if (!context.viewerAgencyId) {
        throw new BadRequestException(
          'Agency staff account is not linked to an agency',
        );
      }
      where.agencyId = context.viewerAgencyId;
      return where;
    }

    if (context.viewerRole === 'WAREHOUSE_PARTNER') {
      where.managerId = context.viewerUserId;
      return where;
    }

    if (context.agencyId) {
      where.agencyId = context.agencyId;
    }

    return where;
  }

  private async ensureAgencyExists(agencyId: string) {
    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
      select: { id: true },
    });

    if (!agency) {
      throw new NotFoundException('Agency not found');
    }
  }

  private async ensureManagerIsValid(managerId: string, agencyId: string) {
    const manager = await this.prisma.user.findUnique({
      where: { id: managerId },
      select: {
        id: true,
        agencyId: true,
      },
    });

    if (!manager) {
      throw new NotFoundException('Warehouse manager not found');
    }

    if (manager.agencyId && manager.agencyId !== agencyId) {
      throw new BadRequestException(
        'Warehouse manager must belong to the same agency',
      );
    }
  }

  async createWarehouse(data: any) {
    await this.ensureAgencyExists(data.agencyId);

    if (data.managerId) {
      await this.ensureManagerIsValid(data.managerId, data.agencyId);
    }

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
      include: this.warehouseInclude,
    });
  }

  async findAll(context: WarehouseAccessContext = {}) {
    return this.prisma.warehouse.findMany({
      where: this.buildAccessWhere(context),
      include: this.warehouseInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, context: WarehouseAccessContext = {}) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: {
        id,
        ...this.buildAccessWhere(context),
      },
      include: this.warehouseInclude,
    });

    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }

    return warehouse;
  }

  async updateWarehouse(
    id: string,
    data: any,
    context: WarehouseAccessContext = {},
  ) {
    const warehouse = await this.findOne(id, context);
    const agencyId = data.agencyId ?? warehouse.agencyId;

    if (data.agencyId && data.agencyId !== warehouse.agencyId) {
      await this.ensureAgencyExists(data.agencyId);
    }

    if (data.managerId) {
      await this.ensureManagerIsValid(data.managerId, agencyId);
    }

    return this.prisma.warehouse.update({
      where: { id: warehouse.id },
      data: {
        name: data.name,
        code: data.code,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
        status: data.status,
        agencyId: data.agencyId,
        managerId: data.managerId,
      },
      include: this.warehouseInclude,
    });
  }

  async createZone(
    warehouseId: string,
    data: any,
    context: WarehouseAccessContext = {},
  ) {
    const warehouse = await this.findOne(warehouseId, context);

    return this.prisma.warehouseZone.create({
      data: {
        name: data.name,
        code: data.code,
        type: data.type || 'DRY',
        capacity: data.capacity,
        warehouseId: warehouse.id,
      },
    });
  }

  async createRack(
    zoneId: string,
    data: any,
    context: WarehouseAccessContext = {},
  ) {
    const zone = await this.prisma.warehouseZone.findUnique({
      where: { id: zoneId },
      include: {
        warehouse: true,
      },
    });

    if (!zone) {
      throw new NotFoundException('Warehouse zone not found');
    }

    await this.findOne(zone.warehouseId, context);

    return this.prisma.warehouseRack.create({
      data: {
        label: data.label,
        zoneId,
      },
    });
  }

  async createBin(
    rackId: string,
    data: any,
    context: WarehouseAccessContext = {},
  ) {
    const rack = await this.prisma.warehouseRack.findUnique({
      where: { id: rackId },
      include: {
        zone: {
          include: {
            warehouse: true,
          },
        },
      },
    });

    if (!rack) {
      throw new NotFoundException('Warehouse rack not found');
    }

    await this.findOne(rack.zone.warehouseId, context);

    return this.prisma.warehouseBin.create({
      data: {
        label: data.label,
        rackId,
        isOccupied: false,
      },
    });
  }

  async getCapacity(id: string, context: WarehouseAccessContext = {}) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: {
        id,
        ...this.buildAccessWhere(context),
      },
      select: {
        id: true,
        name: true,
        code: true,
        zones: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
            capacity: true,
            racks: {
              select: {
                id: true,
                label: true,
                bins: {
                  select: {
                    id: true,
                    label: true,
                    isOccupied: true,
                    _count: {
                      select: {
                        items: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }

    let totalCapacity = 0;
    let totalOccupiedBins = 0;
    let totalBins = 0;

    const zones = warehouse.zones.map(zone => {
      const totalZoneBins = zone.racks.reduce(
        (sum, rack) => sum + rack.bins.length,
        0,
      );
      const occupiedZoneBins = zone.racks.reduce(
        (sum, rack) =>
          sum +
          rack.bins.filter(
            bin => bin.isOccupied || bin._count.items > 0,
          ).length,
        0,
      );

      totalCapacity += zone.capacity || 0;
      totalBins += totalZoneBins;
      totalOccupiedBins += occupiedZoneBins;

      return {
        id: zone.id,
        name: zone.name,
        code: zone.code,
        type: zone.type,
        configuredCapacity: zone.capacity,
        totalBins: totalZoneBins,
        occupiedBins: occupiedZoneBins,
        availableBins: Math.max(totalZoneBins - occupiedZoneBins, 0),
        occupancyPercentage: totalZoneBins
          ? Number(((occupiedZoneBins / totalZoneBins) * 100).toFixed(2))
          : 0,
      };
    });

    return {
      warehouseId: warehouse.id,
      warehouseName: warehouse.name,
      warehouseCode: warehouse.code,
      totalCapacity,
      totalBins,
      totalOccupiedBins,
      totalAvailableBins: Math.max(totalBins - totalOccupiedBins, 0),
      occupancyPercentage: totalBins
        ? Number(((totalOccupiedBins / totalBins) * 100).toFixed(2))
        : 0,
      zones,
    };
  }
}

