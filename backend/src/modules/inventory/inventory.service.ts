import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InventoryStatus, Prisma, ScanCheckpoint } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const STATUS_SCAN_REQUIREMENTS: Partial<
  Record<InventoryStatus, ScanCheckpoint[]>
> = {
  [InventoryStatus.RECEIVED]: [ScanCheckpoint.PICKUP],
  [InventoryStatus.STORED]: [
    ScanCheckpoint.WAREHOUSE_ENTRY,
    ScanCheckpoint.STORAGE,
    ScanCheckpoint.VEHICLE_UNLOAD,
  ],
  [InventoryStatus.SORTED]: [ScanCheckpoint.STORAGE],
  [InventoryStatus.DISPATCHED]: [
    ScanCheckpoint.VEHICLE_LOAD,
    ScanCheckpoint.DISPATCH,
  ],
  [InventoryStatus.DELIVERED]: [ScanCheckpoint.DELIVERY],
};

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly itemInclude = {
    booking: {
      select: {
        id: true,
        reference: true,
        customerId: true,
        deliveryOtp: true,
        deliveryProofUrl: true,
        status: true,
      },
    },
    warehouse: true,
    bin: {
      include: {
        rack: {
          include: {
            zone: {
              include: {
                warehouse: true,
              },
            },
          },
        },
      },
    },
    movements: {
      orderBy: {
        createdAt: 'desc' as const,
      },
    },
    scanEvents: {
      orderBy: {
        createdAt: 'desc' as const,
      },
      take: 20,
    },
  };

  private async resolveStoragePlacement(
    tx: Prisma.TransactionClient,
    warehouseId?: string | null,
    binId?: string | null,
  ) {
    if (binId) {
      const bin = await tx.warehouseBin.findUnique({
        where: { id: binId },
        include: {
          rack: {
            include: {
              zone: {
                include: {
                  warehouse: true,
                },
              },
            },
          },
        },
      });

      if (!bin) {
        throw new NotFoundException('Warehouse bin not found');
      }

      const resolvedWarehouseId = bin.rack.zone.warehouseId;
      if (warehouseId && warehouseId !== resolvedWarehouseId) {
        throw new BadRequestException(
          'Selected bin does not belong to the supplied warehouse',
        );
      }

      return {
        warehouseId: resolvedWarehouseId,
        binId: bin.id,
        locationDescription: `${bin.rack.zone.warehouse.name} / ${bin.rack.zone.code} / ${bin.rack.label} / ${bin.label}`,
      };
    }

    if (warehouseId) {
      const warehouse = await tx.warehouse.findUnique({
        where: { id: warehouseId },
      });

      if (!warehouse) {
        throw new NotFoundException('Warehouse not found');
      }

      return {
        warehouseId: warehouse.id,
        binId: null,
        locationDescription: warehouse.name,
      };
    }

    return {
      warehouseId: null,
      binId: null,
      locationDescription: '',
    };
  }

  private async composeLocationDescription(
    tx: Prisma.TransactionClient,
    warehouseId: string | null,
    binId: string | null,
    currentVehicleId: string | null,
    fallback?: string,
  ) {
    if (currentVehicleId) {
      return `Vehicle ${currentVehicleId}`;
    }

    if (binId || warehouseId) {
      const placement = await this.resolveStoragePlacement(
        tx,
        warehouseId,
        binId,
      );
      return placement.locationDescription || fallback || 'Warehouse';
    }

    return fallback || 'In transit';
  }

  private async syncBinOccupancy(
    tx: Prisma.TransactionClient,
    binIds: Array<string | null | undefined>,
  ) {
    const uniqueBinIds = [...new Set(binIds.filter(Boolean))] as string[];
    if (uniqueBinIds.length === 0) {
      return;
    }

    await Promise.all(
      uniqueBinIds.map(async binId => {
        const itemCount = await tx.inventoryItem.count({
          where: { binId },
        });

        await tx.warehouseBin.update({
          where: { id: binId },
          data: { isOccupied: itemCount > 0 },
        });
      }),
    );
  }

  private async addMovementInTransaction(
    itemId: string,
    status: InventoryStatus,
    locationDescription: string,
    performedBy: string,
    remarks: string | undefined,
    tx: Prisma.TransactionClient,
  ) {
    return tx.inventoryMovement.create({
      data: {
        itemId,
        status,
        locationDescription,
        remarks,
        performedBy,
      },
    });
  }

  private async assertRequiredScan(
    itemId: string,
    status: InventoryStatus,
    tx: Prisma.TransactionClient,
  ) {
    const requiredCheckpoints = STATUS_SCAN_REQUIREMENTS[status];
    if (!requiredCheckpoints || requiredCheckpoints.length === 0) {
      return;
    }

    const latestScan = await tx.scanEvent.findFirst({
      where: { itemId },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestScan || !requiredCheckpoints.includes(latestScan.checkpoint)) {
      throw new BadRequestException(
        `Cannot move item to ${status} without a matching scan checkpoint`,
      );
    }
  }

  private async createItemInTransaction(
    data: any,
    performedBy: string,
    tx: Prisma.TransactionClient,
  ) {
    const booking = await tx.booking.findUnique({
      where: { id: data.bookingId },
      select: {
        id: true,
        customerId: true,
        reference: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const placement = await this.resolveStoragePlacement(
      tx,
      data.warehouseId,
      data.binId,
    );

    const item = await tx.inventoryItem.create({
      data: {
        parcelId: data.parcelId,
        bookingId: booking.id,
        ownerId: data.ownerId || booking.customerId,
        weight: data.weight,
        isFragile: data.isFragile || false,
        isHazmat: data.isHazmat || false,
        dimensions: data.dimensions,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
        warehouseId: placement.warehouseId,
        binId: placement.binId,
        status: InventoryStatus.RECEIVED,
      },
    });

    await this.syncBinOccupancy(tx, [placement.binId]);

    await this.addMovementInTransaction(
      item.id,
      InventoryStatus.RECEIVED,
      placement.locationDescription || `Booking ${booking.reference}`,
      performedBy,
      data.remarks,
      tx,
    );

    return tx.inventoryItem.findUnique({
      where: { id: item.id },
      include: this.itemInclude,
    });
  }

  async createItem(
    data: any,
    performedBy: string,
    tx?: Prisma.TransactionClient,
  ) {
    if (tx) {
      return this.createItemInTransaction(data, performedBy, tx);
    }

    return this.prisma.$transaction(innerTx =>
      this.createItemInTransaction(data, performedBy, innerTx),
    );
  }

  async listItems(filters: any = {}) {
    const where: Prisma.InventoryItemWhereInput = {};

    if (filters.ownerId) {
      where.ownerId = filters.ownerId;
    }

    if (filters.warehouseId) {
      where.warehouseId = filters.warehouseId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.bookingId) {
      where.bookingId = filters.bookingId;
    }

    if (filters.binId) {
      where.binId = filters.binId;
    }

    if (filters.parcelId) {
      where.parcelId = filters.parcelId;
    }

    return this.prisma.inventoryItem.findMany({
      where,
      include: this.itemInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getItemById(id: string) {
    const item = await this.prisma.inventoryItem.findUnique({
      where: { id },
      include: this.itemInclude,
    });

    if (!item) {
      throw new NotFoundException('Inventory item not found');
    }

    return item;
  }

  async filterByOwner(ownerId: string) {
    return this.listItems({ ownerId });
  }

  async getDispatchOrder(warehouseId: string) {
    const items = await this.prisma.inventoryItem.findMany({
      where: {
        warehouseId,
        status: {
          in: [InventoryStatus.STORED, InventoryStatus.SORTED],
        },
      },
      include: this.itemInclude,
    });

    return items.sort((left, right) => {
      if (left.expiryDate && right.expiryDate) {
        return left.expiryDate.getTime() - right.expiryDate.getTime();
      }

      if (left.expiryDate && !right.expiryDate) {
        return -1;
      }

      if (!left.expiryDate && right.expiryDate) {
        return 1;
      }

      return left.createdAt.getTime() - right.createdAt.getTime();
    });
  }

  private async updateItemStatusInTransaction(
    id: string,
    status: InventoryStatus,
    updateData: any,
    performedBy: string,
    tx: Prisma.TransactionClient,
  ) {
    const item = await tx.inventoryItem.findUnique({
      where: { id },
    });

    if (!item) {
      throw new NotFoundException('Inventory item not found');
    }

    const hasWarehouseId = Object.prototype.hasOwnProperty.call(
      updateData,
      'warehouseId',
    );
    const hasBinId = Object.prototype.hasOwnProperty.call(updateData, 'binId');
    const hasVehicleId = Object.prototype.hasOwnProperty.call(
      updateData,
      'currentVehicleId',
    );

    let nextWarehouseId = hasWarehouseId
      ? updateData.warehouseId ?? null
      : item.warehouseId;
    let nextBinId = hasBinId ? updateData.binId ?? null : item.binId;
    let nextVehicleId = hasVehicleId
      ? updateData.currentVehicleId ?? null
      : item.currentVehicleId;

    if (nextVehicleId && nextBinId) {
      throw new BadRequestException(
        'Item cannot be assigned to a bin and a vehicle at the same time',
      );
    }

    if (nextVehicleId) {
      nextBinId = null;
    }

    if (hasWarehouseId || hasBinId) {
      const placement = await this.resolveStoragePlacement(
        tx,
        nextWarehouseId,
        nextBinId,
      );
      nextWarehouseId = placement.warehouseId;
      nextBinId = placement.binId;
    }

    if (status !== item.status) {
      await this.assertRequiredScan(item.id, status, tx);
    }

    const updated = await tx.inventoryItem.update({
      where: { id: item.id },
      data: {
        status,
        warehouseId: nextWarehouseId,
        binId: nextBinId,
        currentVehicleId: nextVehicleId,
      },
    });

    await this.syncBinOccupancy(tx, [item.binId, nextBinId]);

    const locationDescription =
      updateData.locationDescription ||
      (await this.composeLocationDescription(
        tx,
        nextWarehouseId,
        nextBinId,
        nextVehicleId,
      ));

    await this.addMovementInTransaction(
      updated.id,
      status,
      locationDescription,
      performedBy,
      updateData.remarks,
      tx,
    );

    return tx.inventoryItem.findUnique({
      where: { id: updated.id },
      include: this.itemInclude,
    });
  }

  async updateItemStatus(
    id: string,
    status: InventoryStatus,
    updateData: any,
    performedBy: string,
    tx?: Prisma.TransactionClient,
  ) {
    if (tx) {
      return this.updateItemStatusInTransaction(
        id,
        status,
        updateData,
        performedBy,
        tx,
      );
    }

    return this.prisma.$transaction(innerTx =>
      this.updateItemStatusInTransaction(
        id,
        status,
        updateData,
        performedBy,
        innerTx,
      ),
    );
  }
}

