import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InventoryStatus, Prisma, ScanCheckpoint } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';

type ScanPayload = {
  itemId: string;
  checkpoint: ScanCheckpoint;
  vehicleId?: string;
  driverId?: string;
  warehouseId?: string;
  binId?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  clientReference?: string;
  occurredAt?: string;
  syncMode?: 'ONLINE' | 'OFFLINE';
};

type ScanAccessContext = {
  viewerRole?: string;
  viewerUserId?: string;
  viewerAgencyId?: string | null;
  viewerDriverId?: string | null;
};

type ScanSyncResolution = 'CREATED' | 'MERGED_DUPLICATE' | 'REJECTED_STALE';

type StoredScanResolution = {
  accepted: boolean;
  syncResolution: ScanSyncResolution;
  reason: string;
  occurredAt: string;
  scanId: string | null;
  latestScanId: string | null;
  latestCheckpoint: ScanCheckpoint | null;
  latestCreatedAt: string | null;
};

@Injectable()
export class ScanService {
  private readonly duplicateWindowMs = 5 * 60 * 1000;
  private readonly staleScanGraceMs = 90 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  private normalizeRole(role?: string) {
    return String(role ?? '').trim().toUpperCase();
  }

  private isPrivilegedRole(role: string) {
    return ['SUPER_ADMIN', 'ADMIN', 'TRANSPORTER'].includes(role);
  }

  private async assertItemAccess(
    item: {
      bookingId: string;
      currentVehicleId?: string | null;
      booking?: {
        customerId?: string;
        agencyId?: string | null;
        driverId?: string | null;
        vehicleId?: string | null;
      } | null;
    },
    data: Pick<ScanPayload, 'vehicleId'>,
    context: ScanAccessContext,
    tx: Prisma.TransactionClient | PrismaService,
  ) {
    const role = this.normalizeRole(context.viewerRole);

    if (this.isPrivilegedRole(role)) {
      return;
    }

    if (role === 'AGENCY_STAFF') {
      if (!context.viewerAgencyId || item.booking?.agencyId !== context.viewerAgencyId) {
        throw new ForbiddenException('You can only scan items linked to your agency.');
      }
      return;
    }

    if (role === 'DRIVER') {
      if (!context.viewerDriverId || item.booking?.driverId !== context.viewerDriverId) {
        throw new ForbiddenException('You can only scan items linked to your assigned booking.');
      }
      return;
    }

    if (!['CUSTOMER', 'CORPORATE', 'COURIER_COMPANY'].includes(role)) {
      throw new ForbiddenException('You do not have permission to record this scan.');
    }

    if (!context.viewerUserId || item.booking?.customerId !== context.viewerUserId) {
      throw new ForbiddenException('You can only scan items that belong to your own bookings.');
    }

    if (!data.vehicleId) {
      return;
    }

    const vehicle = await tx.vehicle.findUnique({
      where: { id: data.vehicleId },
      select: {
        id: true,
        ownerUserId: true,
      },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    const vehicleMatchesBooking =
      item.booking?.vehicleId === vehicle.id || item.currentVehicleId === vehicle.id;

    if (!vehicleMatchesBooking && vehicle.ownerUserId !== context.viewerUserId) {
      throw new ForbiddenException(
        'You can only scan against your own fleet or the vehicle assigned to this booking.',
      );
    }
  }

  private buildSyncKey(clientReference: string) {
    return `scan-sync:${clientReference}`;
  }

  private normalizeOccurredAt(value?: string) {
    if (!value) {
      return new Date();
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  private buildResponse(
    resolution: ScanSyncResolution,
    accepted: boolean,
    reason: string,
    occurredAt: Date,
    scan: any | null,
    latestScan?: { id: string; checkpoint: ScanCheckpoint; createdAt: Date } | null,
  ) {
    return {
      accepted,
      syncResolution: resolution,
      reason,
      occurredAt: occurredAt.toISOString(),
      latestScan: latestScan
        ? {
            id: latestScan.id,
            checkpoint: latestScan.checkpoint,
            createdAt: latestScan.createdAt.toISOString(),
          }
        : null,
      scan,
    };
  }

  private async getScanDetails(scanId: string, tx: any) {
    return tx.scanEvent.findUnique({
      where: { id: scanId },
      include: {
        item: true,
        booking: true,
        waybill: true,
      },
    });
  }

  private asStoredResolution(value: Prisma.JsonValue | null | undefined) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const record = value as Record<string, Prisma.JsonValue>;
    if (
      typeof record.accepted !== 'boolean' ||
      typeof record.syncResolution !== 'string' ||
      typeof record.reason !== 'string' ||
      typeof record.occurredAt !== 'string'
    ) {
      return null;
    }

    return {
      accepted: record.accepted,
      syncResolution: record.syncResolution as ScanSyncResolution,
      reason: record.reason,
      occurredAt: record.occurredAt,
      scanId: typeof record.scanId === 'string' ? record.scanId : null,
      latestScanId:
        typeof record.latestScanId === 'string' ? record.latestScanId : null,
      latestCheckpoint:
        typeof record.latestCheckpoint === 'string'
          ? (record.latestCheckpoint as ScanCheckpoint)
          : null,
      latestCreatedAt:
        typeof record.latestCreatedAt === 'string' ? record.latestCreatedAt : null,
    } satisfies StoredScanResolution;
  }

  private async storeResolution(
    clientReference: string | undefined,
    itemId: string,
    response: ReturnType<ScanService['buildResponse']>,
    tx: any,
  ) {
    if (!clientReference) {
      return;
    }

    const stored: StoredScanResolution = {
      accepted: response.accepted,
      syncResolution: response.syncResolution,
      reason: response.reason,
      occurredAt: response.occurredAt,
      scanId: response.scan?.id ?? null,
      latestScanId: response.latestScan?.id ?? null,
      latestCheckpoint: response.latestScan?.checkpoint ?? null,
      latestCreatedAt: response.latestScan?.createdAt ?? null,
    };

    await tx.idempotencyRecord.upsert({
      where: { key: this.buildSyncKey(clientReference) },
      create: {
        key: this.buildSyncKey(clientReference),
        status: response.accepted ? 'COMPLETED' : 'REJECTED',
        requestHash: itemId,
        response: stored as Prisma.InputJsonValue,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      update: {
        status: response.accepted ? 'COMPLETED' : 'REJECTED',
        requestHash: itemId,
        response: stored as Prisma.InputJsonValue,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
  }

  private async restoreStoredResolution(clientReference: string, tx: any) {
    const record = await tx.idempotencyRecord.findUnique({
      where: { key: this.buildSyncKey(clientReference) },
      select: {
        response: true,
      },
    });

    const stored = this.asStoredResolution(record?.response);
    if (!stored) {
      return null;
    }

    const scan = stored.scanId ? await this.getScanDetails(stored.scanId, tx) : null;
    const latestScan =
      stored.latestScanId && stored.latestCheckpoint && stored.latestCreatedAt
        ? {
            id: stored.latestScanId,
            checkpoint: stored.latestCheckpoint,
            createdAt: new Date(stored.latestCreatedAt),
          }
        : null;

    return this.buildResponse(
      stored.syncResolution,
      stored.accepted,
      stored.reason,
      new Date(stored.occurredAt),
      scan,
      latestScan,
    );
  }

  private async writeSyncAudit(
    tx: any,
    performedBy: string,
    itemId: string,
    action: string,
    details: Record<string, unknown>,
  ) {
    await tx.auditLog.create({
      data: {
        userId: performedBy,
        action,
        entityType: 'SCAN',
        entityId: itemId,
        details,
      },
    });
  }

  private async deduplicateScan(
    item: any,
    data: ScanPayload,
    performedBy: string,
    occurredAt: Date,
    tx: any,
  ) {
    if (data.clientReference) {
      const stored = await this.restoreStoredResolution(data.clientReference, tx);
      if (stored) {
        return stored;
      }
    }

    const recentWindowStart = new Date(Date.now() - this.duplicateWindowMs);
    const duplicate = await tx.scanEvent.findFirst({
      where: {
        itemId: item.id,
        checkpoint: data.checkpoint,
        vehicleId: data.vehicleId ?? null,
        driverId: data.driverId ?? null,
        performedBy,
        createdAt: { gte: recentWindowStart },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!duplicate) {
      return null;
    }

    const duplicateScan = await this.getScanDetails(duplicate.id, tx);
    const response = this.buildResponse(
      'MERGED_DUPLICATE',
      true,
      'Duplicate scan detected and merged into the most recent matching checkpoint.',
      occurredAt,
      duplicateScan,
      {
        id: duplicate.id,
        checkpoint: duplicate.checkpoint,
        createdAt: duplicate.createdAt,
      },
    );

    await this.storeResolution(data.clientReference, item.id, response, tx);
    await this.writeSyncAudit(tx, performedBy, item.id, 'SCAN_DUPLICATE_MERGED', {
      checkpoint: data.checkpoint,
      clientReference: data.clientReference ?? null,
      mergedIntoScanId: duplicate.id,
      syncMode: data.syncMode ?? 'ONLINE',
    });

    return response;
  }

  private async resolveConflict(
    item: any,
    data: ScanPayload,
    performedBy: string,
    occurredAt: Date,
    tx: any,
  ) {
    if (data.syncMode !== 'OFFLINE') {
      return null;
    }

    const latestScan = await tx.scanEvent.findFirst({
      where: { itemId: item.id },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestScan) {
      return null;
    }

    if (
      latestScan.createdAt.getTime() - occurredAt.getTime() <=
      this.staleScanGraceMs
    ) {
      return null;
    }

    const response = this.buildResponse(
      'REJECTED_STALE',
      false,
      'A newer valid scan already exists for this parcel, so the stale offline event was ignored.',
      occurredAt,
      null,
      {
        id: latestScan.id,
        checkpoint: latestScan.checkpoint,
        createdAt: latestScan.createdAt,
      },
    );

    await this.storeResolution(data.clientReference, item.id, response, tx);
    await this.writeSyncAudit(tx, performedBy, item.id, 'SCAN_CONFLICT_REJECTED', {
      checkpoint: data.checkpoint,
      clientReference: data.clientReference ?? null,
      incomingOccurredAt: occurredAt.toISOString(),
      latestScanId: latestScan.id,
      latestCheckpoint: latestScan.checkpoint,
      latestCreatedAt: latestScan.createdAt.toISOString(),
    });

    return response;
  }

  private buildDedupeSignature(data: ScanPayload) {
    return createHash('sha1')
      .update(
        JSON.stringify({
          itemId: data.itemId,
          checkpoint: data.checkpoint,
          vehicleId: data.vehicleId ?? null,
          driverId: data.driverId ?? null,
          warehouseId: data.warehouseId ?? null,
          binId: data.binId ?? null,
          notes: data.notes ?? null,
        }),
      )
      .digest('hex');
  }

  private async validateCheckpointRules(item: any, data: ScanPayload, tx: any) {
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

  private buildStatusTransition(item: any, data: ScanPayload) {
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

  async validateMovement(data: ScanPayload, context: ScanAccessContext = {}) {
    const item = await this.prisma.inventoryItem.findUnique({
      where: { id: data.itemId },
      include: {
        booking: {
          select: {
            customerId: true,
            agencyId: true,
            driverId: true,
            vehicleId: true,
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Item not found');
    }

    await this.assertItemAccess(item, data, context, this.prisma);

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

  async recordScan(
    data: ScanPayload,
    performedBy: string,
    context: ScanAccessContext = {},
  ) {
    return this.prisma.$transaction(async tx => {
      const occurredAt = this.normalizeOccurredAt(data.occurredAt);
      const item = await tx.inventoryItem.findUnique({
        where: { id: data.itemId },
        include: {
          booking: {
            select: {
              id: true,
              customerId: true,
              agencyId: true,
              driverId: true,
              vehicleId: true,
            },
          },
        },
      });

      if (!item) {
        throw new NotFoundException('Item not found');
      }

      await this.assertItemAccess(item, data, context, tx);

      const deduplicated = await this.deduplicateScan(
        item,
        data,
        performedBy,
        occurredAt,
        tx,
      );
      if (deduplicated) {
        return deduplicated;
      }

      const conflict = await this.resolveConflict(
        item,
        data,
        performedBy,
        occurredAt,
        tx,
      );
      if (conflict) {
        return conflict;
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

      const scanDetails = await this.getScanDetails(scan.id, tx);
      const response = this.buildResponse(
        'CREATED',
        true,
        data.syncMode === 'OFFLINE'
          ? 'Offline scan synced successfully.'
          : 'Scan checkpoint recorded successfully.',
        occurredAt,
        scanDetails,
      );

      await this.storeResolution(data.clientReference, item.id, response, tx);
      await this.writeSyncAudit(tx, performedBy, item.id, 'SCAN_RECORDED', {
        checkpoint: data.checkpoint,
        scanId: scan.id,
        clientReference: data.clientReference ?? null,
        syncMode: data.syncMode ?? 'ONLINE',
        occurredAt: occurredAt.toISOString(),
        dedupeSignature: this.buildDedupeSignature(data),
      });

      return response;
    });
  }

  async loadToVehicle(
    data: any,
    performedBy: string,
    context: ScanAccessContext = {},
  ) {
    return this.recordScan(
      {
        ...data,
        checkpoint: ScanCheckpoint.VEHICLE_LOAD,
      },
      performedBy,
      context,
    );
  }

  async unloadFromVehicle(
    data: any,
    performedBy: string,
    context: ScanAccessContext = {},
  ) {
    return this.recordScan(
      {
        ...data,
        checkpoint: ScanCheckpoint.VEHICLE_UNLOAD,
      },
      performedBy,
      context,
    );
  }

  async confirmDelivery(
    data: any,
    performedBy: string,
    context: ScanAccessContext = {},
  ) {
    const item = await this.prisma.inventoryItem.findUnique({
      where: { id: data.itemId },
      include: {
        booking: {
          select: {
            id: true,
            customerId: true,
            agencyId: true,
            driverId: true,
            vehicleId: true,
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

    await this.assertItemAccess(item, data, context, this.prisma);

    if (!item.booking.deliveryOtp) {
      throw new BadRequestException('Delivery OTP is not available for booking');
    }

    if (item.booking.deliveryOtp !== data.deliveryOtp) {
      throw new BadRequestException('Invalid delivery OTP');
    }

    const result = await this.recordScan(
      {
        itemId: data.itemId,
        checkpoint: ScanCheckpoint.DELIVERY,
        vehicleId: data.vehicleId,
        latitude: data.latitude,
        longitude: data.longitude,
        notes: data.notes,
        driverId: data.driverId,
        clientReference: data.clientReference,
        occurredAt: data.occurredAt,
        syncMode: data.syncMode,
      },
      performedBy,
      context,
    );

    if (result.accepted) {
      await this.prisma.booking.update({
        where: { id: item.booking.id },
        data: {
          deliveryProofUrl: data.deliveryProofUrl,
        },
      });
    }

    return {
      otpVerified: true,
      proofCaptured: result.accepted,
      ...result,
    };
  }
}

