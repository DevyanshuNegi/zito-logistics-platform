import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InventoryStatus, InvoiceType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
import {
  ConsolidateInvoiceDto,
  GenerateWarehouseInvoiceDto,
} from './dto/billing.dto';

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoicesService: InvoicesService,
  ) {}

  async generateWarehouseInvoice(dto: GenerateWarehouseInvoiceDto, actorId: string) {
    const [warehouse, customer] = await Promise.all([
      this.prisma.warehouse.findUnique({
        where: { id: dto.warehouseId },
        include: { agency: { select: { id: true, name: true } } },
      }),
      this.prisma.user.findUnique({
        where: { id: dto.customerId },
        select: { id: true, fullName: true, role: true },
      }),
    ]);

    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const dateFrom = new Date(dto.dateFrom);
    const dateTo = new Date(dto.dateTo);
    if (Number.isNaN(dateFrom.getTime()) || Number.isNaN(dateTo.getTime()) || dateFrom > dateTo) {
      throw new BadRequestException('Invalid warehouse billing date range');
    }

    const items = await this.prisma.inventoryItem.findMany({
      where: {
        warehouseId: dto.warehouseId,
        ownerId: dto.customerId,
        createdAt: { lte: dateTo },
      },
      include: {
        warehouse: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const lineItems = items
      .map((item) => {
        const billableDays = this.calculateBillableDays(item, dateFrom, dateTo);
        if (billableDays <= 0) {
          return null;
        }

        return {
          description: `Warehouse storage for parcel ${item.parcelId} at ${warehouse.code}`,
          quantity: billableDays,
          unitPrice: dto.ratePerUnitPerDay,
        };
      })
      .filter(Boolean) as Array<{
      description: string;
      quantity: number;
      unitPrice: number;
    }>;

    if (lineItems.length === 0) {
      throw new BadRequestException('No warehouse storage records found for that billing window');
    }

    return this.invoicesService.createStandaloneInvoice({
      type: InvoiceType.WAREHOUSE,
      customerId: dto.customerId,
      agencyId: warehouse.agencyId,
      lineItems,
      taxRate: dto.taxRate,
      dueDate: dto.dueDate,
      issueImmediately: dto.issueImmediately,
      actorId,
    });
  }

  async consolidate(dto: ConsolidateInvoiceDto, actorId: string) {
    const customer = await this.prisma.user.findUnique({
      where: { id: dto.customerId },
      select: { id: true, fullName: true, role: true, agencyId: true },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const bookingWhere: Prisma.BookingWhereInput = {
      customerId: dto.customerId,
      status: {
        in: ['DELIVERED', 'COMPLETED'],
      },
      ...(dto.bookingIds && dto.bookingIds.length > 0
        ? { id: { in: dto.bookingIds } }
        : {}),
      ...(dto.dateFrom || dto.dateTo
        ? {
            createdAt: {
              ...(dto.dateFrom ? { gte: new Date(dto.dateFrom) } : {}),
              ...(dto.dateTo ? { lte: new Date(dto.dateTo) } : {}),
            },
          }
        : {}),
    };

    const bookings = await this.prisma.booking.findMany({
      where: bookingWhere,
      include: {
        invoice: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (bookings.length === 0) {
      throw new BadRequestException('No completed bookings matched for consolidation');
    }

    const lineItems = bookings.map((booking) => ({
      description: `${booking.reference} (${booking.serviceType})`,
      quantity: 1,
      unitPrice: booking.invoice?.totalAmount ?? booking.totalPrice,
    }));

    return this.invoicesService.createStandaloneInvoice({
      type: InvoiceType.COMBINED,
      customerId: dto.customerId,
      agencyId: customer.agencyId,
      lineItems,
      taxRate: dto.taxRate,
      dueDate: dto.dueDate,
      issueImmediately: dto.issueImmediately,
      actorId,
    });
  }

  private calculateBillableDays(
    item: {
      createdAt: Date;
      updatedAt: Date;
      status: InventoryStatus;
    },
    dateFrom: Date,
    dateTo: Date,
  ) {
    const start = item.createdAt > dateFrom ? item.createdAt : dateFrom;
    const terminalStatuses: InventoryStatus[] = [
      InventoryStatus.DISPATCHED,
      InventoryStatus.DELIVERED,
      InventoryStatus.MISSING,
      InventoryStatus.DAMAGED,
    ];
    const inferredEnd = terminalStatuses.includes(item.status) ? item.updatedAt : dateTo;
    const end = inferredEnd < dateTo ? inferredEnd : dateTo;

    if (end <= start) {
      return 0;
    }

    const msPerDay = 1000 * 60 * 60 * 24;
    return Number(Math.max(1, (end.getTime() - start.getTime()) / msPerDay).toFixed(2));
  }
}
