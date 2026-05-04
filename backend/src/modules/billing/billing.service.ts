import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryStatus,
  InvoiceType,
  Prisma,
  UserRole,
  VehicleStatus,
} from '@prisma/client';
import {
  COUNTRY_CONFIGS,
  SUPPORTED_COUNTRY_CODES,
  type SupportedCountryCode,
} from '../../config/app.config';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
import {
  ConsolidateInvoiceDto,
  GeneratePlatformFeeInvoiceDto,
  GenerateWarehouseInvoiceDto,
  PlatformFeeBillingMode,
} from './dto/billing.dto';

type CrossBorderHandoffRecord = {
  handoffId: string;
  bookingId: string;
  bookingReference: string;
  fromAgencyId: string;
  toAgencyId: string;
  originCountryCode: string | null;
  destinationCountryCode: string | null;
  initiatedAt: string;
};

type InterAgencyBillRecord = {
  billId: string;
  bookingId: string;
  bookingReference: string;
  originAgencyId: string;
  destinationAgencyId: string;
  originCountryCode: SupportedCountryCode;
  destinationCountryCode: SupportedCountryCode;
  grossAmount: number;
  destinationSharePct: number;
  originSharePct: number;
  destinationShareAmount: number;
  originShareAmount: number;
  clearanceFeePct: number;
  clearanceFeeAmount: number;
  taxRate: number;
  taxAmount: number;
  settlementAmount: number;
  generatedBy: string;
  generatedAt: string;
};

type PlatformFeeRule = {
  mode: PlatformFeeBillingMode;
  amount: number;
  label: string;
};

@Injectable()
export class BillingService {
  private readonly crossBorderHandoffPrefix = 'cross-border-handoff:';
  private readonly interAgencyBillPrefix = 'inter-agency-bill:';
  private readonly platformFeeInvoicePrefix = 'platform-fee-invoice:';
  private readonly defaultDestinationSharePct = Number(
    process.env.INTER_AGENCY_DESTINATION_SHARE_PCT ?? 35,
  );

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
    if (
      Number.isNaN(dateFrom.getTime()) ||
      Number.isNaN(dateTo.getTime()) ||
      dateFrom > dateTo
    ) {
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
      throw new BadRequestException(
        'No warehouse storage records found for that billing window',
      );
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
      throw new BadRequestException(
        'No completed bookings matched for consolidation',
      );
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

  async generatePlatformFeeInvoice(
    dto: GeneratePlatformFeeInvoiceDto,
    actorId: string,
  ) {
    const dateFrom = new Date(dto.dateFrom);
    const dateTo = new Date(dto.dateTo);
    if (
      Number.isNaN(dateFrom.getTime()) ||
      Number.isNaN(dateTo.getTime()) ||
      dateFrom > dateTo
    ) {
      throw new BadRequestException('Invalid platform-fee billing date range');
    }

    const customer = await this.prisma.user.findUnique({
      where: { id: dto.customerId },
      select: {
        id: true,
        fullName: true,
        role: true,
        agencyId: true,
      },
    });
    if (!customer) {
      throw new NotFoundException('Owned-fleet account not found');
    }
    if (!this.isPlatformFeeEligibleRole(customer.role)) {
      throw new BadRequestException(
        'Platform-fee billing is only available for customer, corporate, courier-company, or transporter owned-fleet accounts.',
      );
    }

    const rule = this.resolvePlatformFeeRule(
      customer.role,
      dto.billingMode,
      dto.feeAmount,
    );
    const idempotencyKey = this.platformFeeInvoiceKey(
      customer.id,
      rule.mode,
      dateFrom,
      dateTo,
    );

    const existingRecord = await this.prisma.idempotencyRecord.findUnique({
      where: { key: idempotencyKey },
      select: { response: true },
    });
    const existingInvoiceId = this.readPlatformFeeInvoiceId(existingRecord?.response);
    if (existingInvoiceId) {
      return {
        invoice: await this.invoicesService.getForAdmin(existingInvoiceId),
        platformFee: {
          billingMode: rule.mode,
          feeAmount: rule.amount,
        },
        idempotent: true,
      };
    }

    const vehicles = await this.prisma.vehicle.findMany({
      where: {
        ownerUserId: customer.id,
        createdAt: { lte: dateTo },
      },
      select: {
        id: true,
        plateNumber: true,
        type: true,
        status: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    if (vehicles.length === 0) {
      throw new BadRequestException(
        'No owned vehicles were found for that account in the selected billing window.',
      );
    }

    const activeVehicles = vehicles.filter(
      (vehicle) => vehicle.status === VehicleStatus.ACTIVE,
    );
    const billableVehicles = activeVehicles.length > 0 ? activeVehicles : vehicles;
    const lineItems =
      rule.mode === PlatformFeeBillingMode.PER_VEHICLE
        ? billableVehicles.map((vehicle) => ({
            description: `Platform fee for owned vehicle ${vehicle.plateNumber} (${vehicle.type}) covering ${dto.dateFrom} to ${dto.dateTo}`,
            quantity: 1,
            unitPrice: rule.amount,
          }))
        : [
            {
              description: `Platform fee for ${this.describeRole(customer.role)} fleet access covering ${dto.dateFrom} to ${dto.dateTo} (${billableVehicles.length} managed vehicle(s))`,
              quantity: 1,
              unitPrice: rule.amount,
            },
          ];

    const invoice = await this.invoicesService.createStandaloneInvoice({
      type: InvoiceType.PLATFORM,
      customerId: customer.id,
      agencyId: customer.agencyId,
      lineItems,
      taxRate: dto.taxRate,
      dueDate: dto.dueDate,
      issueImmediately: dto.issueImmediately,
      actorId,
    });

    await this.prisma.idempotencyRecord.upsert({
      where: { key: idempotencyKey },
      create: {
        key: idempotencyKey,
        status: 'GENERATED',
        requestHash: idempotencyKey,
        response: {
          invoiceId: invoice.id,
          customerId: customer.id,
          billingMode: rule.mode,
          feeAmount: rule.amount,
          vehicleCount: billableVehicles.length,
          billedWindow: {
            dateFrom: dto.dateFrom,
            dateTo: dto.dateTo,
          },
        } as Prisma.InputJsonValue,
      },
      update: {
        status: 'GENERATED',
        requestHash: idempotencyKey,
        response: {
          invoiceId: invoice.id,
          customerId: customer.id,
          billingMode: rule.mode,
          feeAmount: rule.amount,
          vehicleCount: billableVehicles.length,
          billedWindow: {
            dateFrom: dto.dateFrom,
            dateTo: dto.dateTo,
          },
        } as Prisma.InputJsonValue,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'PLATFORM_FEE_INVOICE_GENERATED',
        entityType: 'INVOICE',
        entityId: invoice.id,
        details: {
          customerId: customer.id,
          customerRole: customer.role,
          billingMode: rule.mode,
          feeAmount: rule.amount,
          billableVehicles: billableVehicles.map((vehicle) => vehicle.id),
          dateFrom: dto.dateFrom,
          dateTo: dto.dateTo,
        } as Prisma.InputJsonValue,
      },
    });

    return {
      invoice,
      platformFee: {
        billingMode: rule.mode,
        feeAmount: rule.amount,
        billedVehicleCount: billableVehicles.length,
        usedActiveVehicleSnapshot: activeVehicles.length > 0,
      },
      notes: [
        'Platform-fee billing is idempotent per account, billing mode, and date window to avoid duplicate recurring invoices.',
        'Per-vehicle charging prefers currently ACTIVE owned vehicles because the current schema does not yet store a dedicated retired-at history for exact historical fleet snapshots.',
      ],
      idempotent: false,
    };
  }

  async interAgencyBill(
    dto: {
      bookingId: string;
      originAgencyId?: string;
      destinationAgencyId?: string;
      originCountryCode?: string;
      destinationCountryCode?: string;
      destinationSharePct?: number;
      taxRate?: number;
    },
    actorId: string,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
      select: {
        id: true,
        reference: true,
        agencyId: true,
        totalPrice: true,
      },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const latestHandoff = await this.getLatestCrossBorderHandoff(booking.id);
    const originAgencyId =
      dto.originAgencyId ?? latestHandoff?.fromAgencyId ?? booking.agencyId;
    const destinationAgencyId =
      dto.destinationAgencyId ?? latestHandoff?.toAgencyId ?? null;

    if (!originAgencyId || !destinationAgencyId) {
      throw new BadRequestException(
        'Origin and destination agencies are required for inter-agency billing.',
      );
    }
    if (originAgencyId === destinationAgencyId) {
      throw new BadRequestException(
        'Inter-agency billing requires different origin and destination agencies.',
      );
    }

    const [originAgency, destinationAgency] = await Promise.all([
      this.prisma.agency.findUnique({
        where: { id: originAgencyId },
        select: { id: true, name: true },
      }),
      this.prisma.agency.findUnique({
        where: { id: destinationAgencyId },
        select: { id: true, name: true },
      }),
    ]);
    if (!originAgency || !destinationAgency) {
      throw new NotFoundException('Origin or destination agency not found');
    }

    const originCountryCode = this.normalizeCountry(
      dto.originCountryCode ?? latestHandoff?.originCountryCode ?? 'KE',
    );
    const destinationCountryCode = this.normalizeCountry(
      dto.destinationCountryCode ?? latestHandoff?.destinationCountryCode ?? 'KE',
    );
    const destinationSharePct = this.round(
      dto.destinationSharePct ?? this.defaultDestinationSharePct,
    );
    if (destinationSharePct < 0 || destinationSharePct > 100) {
      throw new BadRequestException(
        'destinationSharePct must be between 0 and 100.',
      );
    }

    const originSharePct = this.round(100 - destinationSharePct);
    const clearanceFeePct = this.round(
      Math.max(
        COUNTRY_CONFIGS[originCountryCode].crossBorderClearanceFeePct,
        COUNTRY_CONFIGS[destinationCountryCode].crossBorderClearanceFeePct,
      ),
    );
    const clearanceFeeAmount = this.round(
      (booking.totalPrice * clearanceFeePct) / 100,
    );
    const distributableBase = this.round(booking.totalPrice - clearanceFeeAmount);
    const destinationShareAmount = this.round(
      (distributableBase * destinationSharePct) / 100,
    );
    const originShareAmount = this.round(
      distributableBase - destinationShareAmount,
    );
    const taxRate = this.round(
      dto.taxRate ?? COUNTRY_CONFIGS[destinationCountryCode].vatRate,
    );
    const taxAmount = this.round((destinationShareAmount * taxRate) / 100);
    const settlementAmount = this.round(destinationShareAmount - taxAmount);

    const bill: InterAgencyBillRecord = {
      billId: `iab_${Date.now()}`,
      bookingId: booking.id,
      bookingReference: booking.reference,
      originAgencyId,
      destinationAgencyId,
      originCountryCode,
      destinationCountryCode,
      grossAmount: this.round(booking.totalPrice),
      destinationSharePct,
      originSharePct,
      destinationShareAmount,
      originShareAmount,
      clearanceFeePct,
      clearanceFeeAmount,
      taxRate,
      taxAmount,
      settlementAmount,
      generatedBy: actorId,
      generatedAt: new Date().toISOString(),
    };

    await this.prisma.idempotencyRecord.upsert({
      where: {
        key: this.interAgencyBillKey(booking.id, destinationAgencyId),
      },
      create: {
        key: this.interAgencyBillKey(booking.id, destinationAgencyId),
        status: 'GENERATED',
        requestHash: booking.id,
        response: bill as Prisma.InputJsonValue,
      },
      update: {
        status: 'GENERATED',
        requestHash: booking.id,
        response: bill as Prisma.InputJsonValue,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'INTER_AGENCY_BILL_GENERATED',
        entityType: 'BOOKING',
        entityId: booking.id,
        details: {
          originAgencyId,
          destinationAgencyId,
          destinationSharePct,
          originSharePct,
          taxRate,
          settlementAmount,
        } as Prisma.InputJsonValue,
      },
    });

    return {
      bill,
      originAgency,
      destinationAgency,
      notes: [
        'Inter-agency settlement uses the latest recorded cross-border handoff when available and falls back to the request payload when the booking was not yet handed off through the tracking module.',
        'Settlement records are stored through IdempotencyRecord because the Phase 0 schema has no dedicated inter-agency ledger table.',
      ],
    };
  }

  async listInterAgencyBills() {
    const rows = await this.prisma.idempotencyRecord.findMany({
      where: {
        key: { startsWith: this.interAgencyBillPrefix },
      },
      select: {
        response: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    const bills = rows
      .map((row) => this.asInterAgencyBillRecord(row.response))
      .filter((row): row is InterAgencyBillRecord => Boolean(row));

    return {
      total: bills.length,
      bills,
    };
  }

  private isPlatformFeeEligibleRole(role: UserRole) {
    const eligibleRoles: UserRole[] = [
      UserRole.CUSTOMER,
      UserRole.CORPORATE,
      UserRole.COURIER_COMPANY,
      UserRole.AGENT,
      UserRole.TRANSPORTER,
    ];
    return eligibleRoles.includes(role);
  }

  private resolvePlatformFeeRule(
    role: UserRole,
    billingMode?: PlatformFeeBillingMode,
    feeAmount?: number,
  ): PlatformFeeRule {
    const defaults: Record<UserRole, PlatformFeeRule> = {
      [UserRole.CUSTOMER]: {
        mode: PlatformFeeBillingMode.PER_VEHICLE,
        amount: Number(process.env.PLATFORM_FEE_CUSTOMER_PER_VEHICLE ?? 750),
        label: 'customer-owned vehicle platform access',
      },
      [UserRole.CORPORATE]: {
        mode: PlatformFeeBillingMode.PER_FLEET,
        amount: Number(process.env.PLATFORM_FEE_CORPORATE_PER_FLEET ?? 4500),
        label: 'corporate-owned fleet platform subscription',
      },
      [UserRole.COURIER_COMPANY]: {
        mode: PlatformFeeBillingMode.PER_FLEET,
        amount: Number(process.env.PLATFORM_FEE_COURIER_COMPANY_PER_FLEET ?? 6500),
        label: 'courier-company supply-chain platform subscription',
      },
      [UserRole.AGENT]: {
        mode: PlatformFeeBillingMode.PER_FLEET,
        amount: Number(process.env.PLATFORM_FEE_AGENT_PER_FLEET ?? 3000),
        label: 'agent supply-network platform subscription',
      },
      [UserRole.TRANSPORTER]: {
        mode: PlatformFeeBillingMode.PER_FLEET,
        amount: Number(process.env.PLATFORM_FEE_TRANSPORTER_PER_FLEET ?? 4000),
        label: 'transporter-owned fleet platform subscription',
      },
      [UserRole.DRIVER]: {
        mode: PlatformFeeBillingMode.PER_VEHICLE,
        amount: 0,
        label: 'ineligible',
      },
      [UserRole.WAREHOUSE_PARTNER]: {
        mode: PlatformFeeBillingMode.PER_FLEET,
        amount: 0,
        label: 'ineligible',
      },
      [UserRole.AGENCY_STAFF]: {
        mode: PlatformFeeBillingMode.PER_FLEET,
        amount: 0,
        label: 'ineligible',
      },
      [UserRole.ADMIN]: {
        mode: PlatformFeeBillingMode.PER_FLEET,
        amount: 0,
        label: 'ineligible',
      },
      [UserRole.SUPER_ADMIN]: {
        mode: PlatformFeeBillingMode.PER_FLEET,
        amount: 0,
        label: 'ineligible',
      },
    };

    const rule = defaults[role];
    const resolved: PlatformFeeRule = {
      ...rule,
      mode: billingMode ?? rule.mode,
      amount: feeAmount ?? rule.amount,
    };

    if (resolved.amount <= 0) {
      throw new BadRequestException(
        `Platform-fee amount must be greater than 0 for ${this.describeRole(role)} accounts.`,
      );
    }

    return resolved;
  }

  private describeRole(role: UserRole) {
    return role.toLowerCase().replace(/_/g, '-');
  }

  private platformFeeInvoiceKey(
    customerId: string,
    mode: PlatformFeeBillingMode,
    dateFrom: Date,
    dateTo: Date,
  ) {
    return `${this.platformFeeInvoicePrefix}${customerId}:${mode}:${dateFrom.toISOString().slice(0, 10)}:${dateTo.toISOString().slice(0, 10)}`;
  }

  private readPlatformFeeInvoiceId(value: Prisma.JsonValue | null | undefined) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const record = value as Record<string, Prisma.JsonValue>;
    return typeof record.invoiceId === 'string' ? record.invoiceId : null;
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
    const inferredEnd = terminalStatuses.includes(item.status)
      ? item.updatedAt
      : dateTo;
    const end = inferredEnd < dateTo ? inferredEnd : dateTo;

    if (end <= start) {
      return 0;
    }

    const msPerDay = 1000 * 60 * 60 * 24;
    return Number(
      Math.max(1, (end.getTime() - start.getTime()) / msPerDay).toFixed(2),
    );
  }

  private interAgencyBillKey(bookingId: string, destinationAgencyId: string) {
    return `${this.interAgencyBillPrefix}${bookingId}:${destinationAgencyId}`;
  }

  private async getLatestCrossBorderHandoff(bookingId: string) {
    const row = await this.prisma.idempotencyRecord.findFirst({
      where: {
        key: { startsWith: `${this.crossBorderHandoffPrefix}${bookingId}:` },
      },
      select: {
        response: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return this.asCrossBorderHandoffRecord(row?.response);
  }

  private normalizeCountry(value: string): SupportedCountryCode {
    const normalized = value.trim().toUpperCase() as SupportedCountryCode;
    if (!SUPPORTED_COUNTRY_CODES.includes(normalized)) {
      throw new BadRequestException(`Unsupported country code ${value}`);
    }
    return normalized;
  }

  private round(value: number) {
    return Number(value.toFixed(2));
  }

  private asCrossBorderHandoffRecord(value: Prisma.JsonValue | null | undefined) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const record = value as Record<string, Prisma.JsonValue>;
    if (
      typeof record.bookingId !== 'string' ||
      typeof record.bookingReference !== 'string' ||
      typeof record.fromAgencyId !== 'string' ||
      typeof record.toAgencyId !== 'string'
    ) {
      return null;
    }

    return {
      handoffId:
        typeof record.handoffId === 'string' ? record.handoffId : 'unknown',
      bookingId: record.bookingId,
      bookingReference: record.bookingReference,
      fromAgencyId: record.fromAgencyId,
      toAgencyId: record.toAgencyId,
      originCountryCode:
        typeof record.originCountryCode === 'string'
          ? record.originCountryCode
          : null,
      destinationCountryCode:
        typeof record.destinationCountryCode === 'string'
          ? record.destinationCountryCode
          : null,
      initiatedAt:
        typeof record.initiatedAt === 'string'
          ? record.initiatedAt
          : new Date().toISOString(),
    } satisfies CrossBorderHandoffRecord;
  }

  private asInterAgencyBillRecord(value: Prisma.JsonValue | null | undefined) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const record = value as Record<string, Prisma.JsonValue>;
    if (
      typeof record.billId !== 'string' ||
      typeof record.bookingId !== 'string' ||
      typeof record.bookingReference !== 'string'
    ) {
      return null;
    }

    return {
      billId: record.billId,
      bookingId: record.bookingId,
      bookingReference: record.bookingReference,
      originAgencyId:
        typeof record.originAgencyId === 'string' ? record.originAgencyId : '',
      destinationAgencyId:
        typeof record.destinationAgencyId === 'string'
          ? record.destinationAgencyId
          : '',
      originCountryCode: this.normalizeCountry(
        typeof record.originCountryCode === 'string'
          ? record.originCountryCode
          : 'KE',
      ),
      destinationCountryCode: this.normalizeCountry(
        typeof record.destinationCountryCode === 'string'
          ? record.destinationCountryCode
          : 'KE',
      ),
      grossAmount:
        typeof record.grossAmount === 'number' ? record.grossAmount : 0,
      destinationSharePct:
        typeof record.destinationSharePct === 'number'
          ? record.destinationSharePct
          : 0,
      originSharePct:
        typeof record.originSharePct === 'number' ? record.originSharePct : 0,
      destinationShareAmount:
        typeof record.destinationShareAmount === 'number'
          ? record.destinationShareAmount
          : 0,
      originShareAmount:
        typeof record.originShareAmount === 'number'
          ? record.originShareAmount
          : 0,
      clearanceFeePct:
        typeof record.clearanceFeePct === 'number'
          ? record.clearanceFeePct
          : 0,
      clearanceFeeAmount:
        typeof record.clearanceFeeAmount === 'number'
          ? record.clearanceFeeAmount
          : 0,
      taxRate: typeof record.taxRate === 'number' ? record.taxRate : 0,
      taxAmount: typeof record.taxAmount === 'number' ? record.taxAmount : 0,
      settlementAmount:
        typeof record.settlementAmount === 'number'
          ? record.settlementAmount
          : 0,
      generatedBy:
        typeof record.generatedBy === 'string' ? record.generatedBy : 'system',
      generatedAt:
        typeof record.generatedAt === 'string'
          ? record.generatedAt
          : new Date().toISOString(),
    } satisfies InterAgencyBillRecord;
  }
}
