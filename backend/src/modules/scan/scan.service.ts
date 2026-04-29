import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryStatus, ScanCheckpoint } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';

@Injectable()
export class ScanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  private async validateCheckpointRules(item: any, data: any, tx: any) {
    if (data.binId) {
      const bin = await tx.warehouseBin.findUnique({
        where: { id: data.binId },
        include: {
          rack: {
            include: {
              zone: true,
            },
          },
        },
      });

      if (!bin) {
        throw new NotFoundException('Warehouse bin not found');
      }

      if (data.warehouseId && bin.rack.zone.warehouseId !== data.warehouseId) {
        throw new BadRequestException(
          'Selected bin does not belong to the supplied warehouse',
        );
      }
    }

    switch (data.checkpoint) {
      case ScanCheckpoint.WAREHOUSE_ENTRY:
        if (!data.warehouseId && !item.warehouseId) {
          throw new BadRequestException(
            'warehouseId is required for a warehouse-entry scan',
          );
        }
        break;
      case ScanCheckpoint.STORAGE:
        if (!data.binId) {
          throw new BadRequestException('binId is required for a storage scan');
        }
        break;
      case ScanCheckpoint.VEHICLE_LOAD:
        if (!data.vehicleId) {
          throw new BadRequestException(
            'vehicleId is required for a vehicle-load scan',
          );
        }
        break;
      case ScanCheckpoint.DISPATCH:
        if (!data.vehicleId) {
          throw new BadRequestException(
            'vehicleId is required for a dispatch scan',
          );
        }
        if (item.currentVehicleId && item.currentVehicleId !== data.vehicleId) {
          throw new BadRequestException(
            'Item is currently linked to a different vehicle',
          );
        }
        break;
      case ScanCheckpoint.VEHICLE_UNLOAD:
        if (!data.vehicleId) {
          throw new BadRequestException(
            'vehicleId is required for a vehicle-unload scan',
          );
        }
        if (item.currentVehicleId && item.currentVehicleId !== data.vehicleId) {
          throw new BadRequestException(
            'Vehicle-unload scan must match the current linked vehicle',
          );
        }
        if (!data.warehouseId && !data.binId) {
          throw new BadRequestException(
            'warehouseId or binId is required for a vehicle-unload scan',
          );
        }
        break;
      case ScanCheckpoint.DELIVERY:
        if (item.status === InventoryStatus.DELIVERED) {
          throw new BadRequestException('Item has already been marked delivered');
        }
        break;
      default:
        break;
    }
  }

  private buildStatusTransition(item: any, data: any) {
    switch (data.checkpoint) {
      case ScanCheckpoint.PICKUP:
        return {
          status: InventoryStatus.RECEIVED,
          remarks: data.notes || 'Pickup checkpoint scan recorded',
          locationDescription: 'Pickup checkpoint',
        };
      case ScanCheckpoint.WAREHOUSE_ENTRY:
        return {
          status: InventoryStatus.STORED,
          warehouseId: data.warehouseId ?? item.warehouseId ?? null,
          binId: null,
          currentVehicleId: null,
          remarks: data.notes || 'Warehouse-entry scan recorded',
        };
      case ScanCheckpoint.STORAGE:
        return {
          status: InventoryStatus.STORED,
          warehouseId: data.warehouseId ?? item.warehouseId ?? null,
          binId: data.binId,
          currentVehicleId: null,
          remarks: data.notes || 'Storage scan recorded',
        };
      case ScanCheckpoint.VEHICLE_LOAD:
        return {
          status: InventoryStatus.DISPATCHED,
          currentVehicleId: data.vehicleId,
          remarks: data.notes || 'Vehicle-load scan recorded',
        };
      case ScanCheckpoint.DISPATCH:
        return {
          status: InventoryStatus.DISPATCHED,
          currentVehicleId: data.vehicleId ?? item.currentVehicleId ?? null,
          remarks: data.notes || 'Dispatch scan recorded',
        };
      case ScanCheckpoint.VEHICLE_UNLOAD:
        return {
          status: InventoryStatus.STORED,
          warehouseId: data.warehouseId ?? item.warehouseId ?? null,
          binId: data.binId ?? null,
          currentVehicleId: null,
          remarks: data.notes || 'Vehicle-unload scan recorded',
        };
      case ScanCheckpoint.DELIVERY:
        return {
          status: InventoryStatus.DELIVERED,
          warehouseId: null,
          binId: null,
          currentVehicleId: null,
          locationDescription: 'Delivered to customer',
          remarks: data.notes || 'Delivery scan recorded',
        };
      default:
        return null;
    }
  }

  async validateMovement(data: any) {
    const item = await this.prisma.inventoryItem.findUnique({
      where: { id: data.itemId },
    });

    if (!item) {
      throw new NotFoundException('Item not found');
    }

    const latestScan = await this.prisma.scanEvent.findFirst({
      where: { itemId: data.itemId },
      orderBy: { createdAt: 'desc' },
    });

    try {
      await this.validateCheckpointRules(item, data, this.prisma);
      return {
        allowed: true,
        latestCheckpoint: latestScan?.checkpoint ?? null,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        return {
          allowed: false,
          reason: error.message,
          latestCheckpoint: latestScan?.checkpoint ?? null,
        };
      }

      throw error;
    }
  }

  async recordScan(data: any, performedBy: string) {
    return this.prisma.$transaction(async tx => {
      const item = await tx.inventoryItem.findUnique({
        where: { id: data.itemId },
        include: {
          booking: true,
        },
      });

      if (!item) {
        throw new NotFoundException('Item not found');
      }

      await this.validateCheckpointRules(item, data, tx);

      const scan = await tx.scanEvent.create({
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
          notes: data.notes,
        },
      });

      const transition = this.buildStatusTransition(item, data);
      if (transition) {
        await this.inventoryService.updateItemStatus(
          item.id,
          transition.status,
          transition,
          performedBy,
          tx,
        );
      }

      return tx.scanEvent.findUnique({
        where: { id: scan.id },
        include: {
          item: true,
          booking: true,
          waybill: true,
        },
      });
    });
  }

  async loadToVehicle(data: any, performedBy: string) {
    return this.recordScan(
      {
        ...data,
        checkpoint: ScanCheckpoint.VEHICLE_LOAD,
      },
      performedBy,
    );
  }

  async unloadFromVehicle(data: any, performedBy: string) {
    return this.recordScan(
      {
        ...data,
        checkpoint: ScanCheckpoint.VEHICLE_UNLOAD,
      },
      performedBy,
    );
  }

  async confirmDelivery(data: any, performedBy: string) {
    const item = await this.prisma.inventoryItem.findUnique({
      where: { id: data.itemId },
      include: {
        booking: {
          select: {
            id: true,
            deliveryOtp: true,
            deliveryProofUrl: true,
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Item not found');
    }

    if (!item.booking) {
      throw new NotFoundException('Booking not found for this item');
    }

    if (!item.booking.deliveryOtp) {
      throw new BadRequestException('Delivery OTP is not available for booking');
    }

    if (item.booking.deliveryOtp !== data.deliveryOtp) {
      throw new BadRequestException('Invalid delivery OTP');
    }

    const scan = await this.recordScan(
      {
        itemId: data.itemId,
        checkpoint: ScanCheckpoint.DELIVERY,
        vehicleId: data.vehicleId,
        latitude: data.latitude,
        longitude: data.longitude,
        notes: data.notes,
      },
      performedBy,
    );

    await this.prisma.booking.update({
      where: { id: item.booking.id },
      data: {
        deliveryProofUrl: data.deliveryProofUrl,
      },
    });

    return {
      otpVerified: true,
      proofCaptured: true,
      scan,
    };
  }
}

