import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ServiceType, WaybillStatus } from '@prisma/client';
import { BRAND } from '../../config/brand.config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WaybillService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly waybillInclude = {
    booking: {
      include: {
        stops: {
          orderBy: {
            sequence: 'asc' as const,
          },
        },
        driver: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                phone: true,
              },
            },
          },
        },
        vehicle: {
          select: {
            id: true,
            plateNumber: true,
            type: true,
            model: true,
          },
        },
      },
    },
    items: {
      include: {
        warehouse: true,
        bin: true,
      },
    },
    scanEvents: {
      orderBy: {
        createdAt: 'desc' as const,
      },
      take: 25,
    },
  };

  private assignType(serviceType: ServiceType) {
    return serviceType === ServiceType.FTL ? 'LR' : 'WAYBILL';
  }

  private generateNumber(type: string) {
    const prefix = type === 'LR' ? 'LR' : 'WB';
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }

  async listWaybills(filters: any = {}) {
    return this.prisma.waybill.findMany({
      where: {
        ...(filters.bookingId && { bookingId: filters.bookingId }),
        ...(filters.status && { status: filters.status }),
        ...(filters.type && { type: filters.type }),
      },
      include: this.waybillInclude,
      orderBy: { issuedAt: 'desc' },
    });
  }

  async createWaybill(data: any) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: data.bookingId },
      include: {
        parcels: {
          select: {
            id: true,
            bookingId: true,
            parcelId: true,
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const itemIds =
      data.itemIds && data.itemIds.length > 0
        ? [...new Set(data.itemIds)]
        : booking.parcels.map(item => item.id);

    if (itemIds.length === 0) {
      throw new BadRequestException(
        'At least one parcel must be linked to the waybill',
      );
    }

    const invalidItemIds = itemIds.filter(
      itemId => !booking.parcels.some(parcel => parcel.id === itemId),
    );
    if (invalidItemIds.length > 0) {
      throw new BadRequestException(
        'All selected parcels must belong to the booking',
      );
    }

    const type = this.assignType(booking.serviceType);
    const number = this.generateNumber(type);

    return this.prisma.waybill.create({
      data: {
        number,
        bookingId: data.bookingId,
        type,
        status: WaybillStatus.CREATED,
        items: {
          connect: itemIds.map((id: string) => ({ id })),
        },
      },
      include: this.waybillInclude,
    });
  }

  async findOne(id: string) {
    const waybill = await this.prisma.waybill.findUnique({
      where: { id },
      include: this.waybillInclude,
    });
    if (!waybill) throw new NotFoundException('Waybill not found');
    return waybill;
  }

  async lockWaybill(id: string) {
    const waybill = await this.findOne(id);

    if (waybill.isLocked) {
      return waybill;
    }

    return this.prisma.waybill.update({
      where: { id },
      data: { isLocked: true },
      include: this.waybillInclude,
    });
  }

  async updateStatus(id: string, status: WaybillStatus) {
    const waybill = await this.findOne(id);
    if (waybill.isLocked || waybill.status === WaybillStatus.CLOSED) {
      throw new BadRequestException('Waybill is locked and cannot be edited');
    }

    return this.prisma.waybill.update({
      where: { id },
      data: {
        status,
        deliveredAt:
          status === WaybillStatus.DELIVERED ? new Date() : undefined,
        isLocked: status === WaybillStatus.CLOSED,
      },
      include: this.waybillInclude,
    });
  }

  async generatePdf(id: string) {
    const waybill = await this.findOne(id);
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 40 });
    const chunks: Buffer[] = [];

    return new Promise<{ buffer: Buffer; fileName: string }>((resolve, reject) => {
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () =>
        resolve({
          buffer: Buffer.concat(chunks),
          fileName: `${waybill.number}.pdf`,
        }),
      );
      doc.on('error', reject);

      doc.fontSize(18).text(`${BRAND.appName} Driver Manifest`, { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Document No: ${waybill.number}`);
      doc.text(`Document Type: ${waybill.type}`);
      doc.text(`Status: ${waybill.status}`);
      doc.text(`Issued At: ${waybill.issuedAt.toISOString()}`);
      doc.moveDown();

      doc.text(`Booking Reference: ${waybill.booking.reference}`);
      doc.text(`Service Type: ${waybill.booking.serviceType}`);
      doc.text(
        `Driver: ${waybill.booking.driver?.user?.fullName ?? 'Unassigned'}`,
      );
      doc.text(
        `Vehicle: ${waybill.booking.vehicle?.plateNumber ?? 'Unassigned'}`,
      );
      doc.moveDown();

      doc.fontSize(14).text('Stops');
      doc.moveDown(0.5);
      for (const stop of waybill.booking.stops) {
        doc
          .fontSize(11)
          .text(
            `${stop.sequence}. ${stop.stopType} - ${stop.address} (${stop.contactName}, ${stop.contactPhone})`,
          );
      }

      doc.moveDown();
      doc.fontSize(14).text('Parcels');
      doc.moveDown(0.5);
      for (const item of waybill.items) {
        doc
          .fontSize(11)
          .text(
            `${item.parcelId} | ${item.weight}kg | Fragile: ${
              item.isFragile ? 'Yes' : 'No'
            } | Status: ${item.status}`,
          );
      }

      doc.end();
    });
  }
}
