import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BRAND, resolveBrandAsset } from '../../config/brand.config';
import {
  InvoiceStatus,
  InvoiceType,
  PaymentStatus,
  Prisma,
  ServiceType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ContractsService } from '../contracts/contracts.service';

type InvoiceWithRelations = Prisma.InvoiceGetPayload<{
  include: {
    booking: {
      select: {
        id: true;
        reference: true;
        serviceType: true;
        status: true;
        totalPrice: true;
      };
    };
    lineItems: true;
  };
}>;

type CreateStandaloneInvoiceInput = {
  type: InvoiceType;
  customerId: string;
  agencyId?: string | null;
  bookingId?: string | null;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
  taxRate?: number;
  dueDate?: string | Date | null;
  issueImmediately?: boolean;
  actorId?: string | null;
};

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contractsService: ContractsService,
  ) {}

  private readonly approvalThreshold = 100000;

  private readonly invoiceInclude = {
    booking: {
      select: {
        id: true,
        reference: true,
        serviceType: true,
        status: true,
        totalPrice: true,
      },
    },
    lineItems: true,
  } satisfies Prisma.InvoiceInclude;

  async listForCustomer(customerId: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: { customerId },
      include: this.invoiceInclude,
      orderBy: { createdAt: 'desc' },
    });

    const synced = await Promise.all(invoices.map((invoice) => this.syncInvoiceState(invoice)));
    return {
      invoices: await this.hydrateInvoices(synced),
      total: invoices.length,
    };
  }

  async listForCorporate(customerId: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        customerId,
        status: {
          in: [InvoiceStatus.DRAFT, InvoiceStatus.ISSUED, InvoiceStatus.OVERDUE],
        },
      },
      include: this.invoiceInclude,
      orderBy: { createdAt: 'desc' },
    });

    const synced = await Promise.all(invoices.map((invoice) => this.syncInvoiceState(invoice)));
    const contractSummary = await this.contractsService.getCorporateContractSummary(customerId);

    return {
      invoices: await this.hydrateInvoices(synced),
      total: invoices.length,
      contract: contractSummary.contract,
      creditAvailable: contractSummary.creditAvailable,
    };
  }

  async listForAdmin(filters: {
    status?: InvoiceStatus;
    type?: InvoiceType;
    customerId?: string;
    approvalRequired?: boolean;
  }) {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        ...(filters.status && { status: filters.status }),
        ...(filters.type && { type: filters.type }),
        ...(filters.customerId && { customerId: filters.customerId }),
        ...(typeof filters.approvalRequired === 'boolean' && {
          isApprovalRequired: filters.approvalRequired,
        }),
      },
      include: this.invoiceInclude,
      orderBy: { createdAt: 'desc' },
    });

    const synced = await Promise.all(invoices.map((invoice) => this.syncInvoiceState(invoice)));
    return {
      invoices: await this.hydrateInvoices(synced),
      total: invoices.length,
    };
  }

  async getForCustomer(invoiceId: string, customerId: string) {
    const invoice = await this.findOrThrow(invoiceId);
    if (invoice.customerId !== customerId) {
      throw new NotFoundException('Invoice not found');
    }
    return this.hydrateInvoice(await this.syncInvoiceState(invoice));
  }

  async getForCorporate(invoiceId: string, customerId: string) {
    return this.getForCustomer(invoiceId, customerId);
  }

  async getForAdmin(invoiceId: string) {
    return this.hydrateInvoice(await this.syncInvoiceState(await this.findOrThrow(invoiceId)));
  }

  async generateForBooking(
    bookingId: string,
    options: {
      taxRate?: number;
      dueDate?: string;
      issueImmediately?: boolean;
      actorId?: string | null;
    } = {},
  ) {
    const existing = await this.prisma.invoice.findFirst({
      where: { bookingId },
      include: this.invoiceInclude,
    });

    if (existing) {
      return this.hydrateInvoice(await this.syncInvoiceState(existing));
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        payments: {
          where: { status: PaymentStatus.COMPLETED },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking ${bookingId} not found`);
    }

    const type = this.assignType(booking.serviceType);
    const paidAmount = this.sumPayments(booking.payments);

    const invoice = await this.createInvoiceRecord({
      type,
      customerId: booking.customerId,
      agencyId: booking.agencyId,
      bookingId: booking.id,
      lineItems: [
        {
          description: `Trip ${booking.reference} (${booking.serviceType})`,
          quantity: 1,
          unitPrice: booking.totalPrice,
        },
      ],
      taxRate: options.taxRate,
      dueDate: options.dueDate,
      issueImmediately: options.issueImmediately ?? true,
      paidAmount,
      paidAt: paidAmount > 0 ? booking.payments[0]?.createdAt ?? null : null,
    });

    await this.writeAudit(options.actorId ?? null, 'INVOICE_GENERATED', invoice.id, {
      source: 'BOOKING_COMPLETION',
      bookingId,
      invoiceType: type,
    });

    return this.hydrateInvoice(invoice);
  }

  async createStandaloneInvoice(input: CreateStandaloneInvoiceInput) {
    const invoice = await this.createInvoiceRecord({
      ...input,
      paidAmount: 0,
      paidAt: null,
    });

    await this.writeAudit(input.actorId ?? null, 'INVOICE_GENERATED', invoice.id, {
      source: input.type,
      bookingId: input.bookingId ?? null,
      lineItems: input.lineItems.length,
    });

    return this.hydrateInvoice(invoice);
  }

  async requestApproval(invoiceId: string, actorId: string, reason: string) {
    const invoice = await this.findOrThrow(invoiceId);
    if (invoice.isLocked) {
      throw new BadRequestException('Locked invoices cannot request approval');
    }

    const updated = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        isApprovalRequired: true,
        approvedBy: null,
        approvedAt: null,
        status: InvoiceStatus.DRAFT,
      },
      include: this.invoiceInclude,
    });

    await this.writeAudit(actorId, 'INVOICE_APPROVAL_REQUESTED', invoiceId, {
      reason,
      totalAmount: invoice.totalAmount,
    });

    return this.hydrateInvoice(updated);
  }

  async approveInvoice(invoiceId: string, approverId: string) {
    const invoice = await this.findOrThrow(invoiceId);
    if (!invoice.isApprovalRequired) {
      throw new BadRequestException('Invoice does not require approval');
    }
    if (invoice.isLocked) {
      throw new BadRequestException('Locked invoices cannot be approved');
    }

    const updated = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        approvedBy: approverId,
        approvedAt: new Date(),
      },
      include: this.invoiceInclude,
    });

    await this.writeAudit(approverId, 'INVOICE_APPROVED', invoiceId, {
      totalAmount: invoice.totalAmount,
    });

    return this.hydrateInvoice(updated);
  }

  async issueInvoice(invoiceId: string, actorId: string, dueDate?: string) {
    const invoice = await this.findOrThrow(invoiceId);

    if (invoice.isLocked) {
      return this.hydrateInvoice(await this.syncInvoiceState(invoice));
    }

    if (invoice.isApprovalRequired && !invoice.approvedAt) {
      throw new BadRequestException(
        'Invoice approval is required before issuing this invoice',
      );
    }

    const parsedDueDate = this.resolveDueDate(dueDate ?? invoice.dueDate ?? undefined);
    const nextStatus =
      invoice.paidAmount >= invoice.totalAmount
        ? InvoiceStatus.PAID
        : parsedDueDate < new Date()
          ? InvoiceStatus.OVERDUE
          : InvoiceStatus.ISSUED;

    const updated = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: nextStatus,
        dueDate: parsedDueDate,
        issuedAt: invoice.issuedAt ?? new Date(),
        isLocked: true,
      },
      include: this.invoiceInclude,
    });

    await this.writeAudit(actorId, 'INVOICE_ISSUED', invoiceId, {
      status: nextStatus,
      dueDate: parsedDueDate.toISOString(),
    });

    return this.hydrateInvoice(updated);
  }

  async generatePdfForCustomer(invoiceId: string, customerId: string) {
    const invoice = await this.getForCustomer(invoiceId, customerId);
    return this.buildPdf(invoice as Awaited<ReturnType<typeof this.hydrateInvoice>>);
  }

  async generatePdfForCorporate(invoiceId: string, customerId: string) {
    const invoice = await this.getForCorporate(invoiceId, customerId);
    return this.buildPdf(invoice as Awaited<ReturnType<typeof this.hydrateInvoice>>);
  }

  async generatePdfForAdmin(invoiceId: string) {
    const invoice = await this.getForAdmin(invoiceId);
    return this.buildPdf(invoice as Awaited<ReturnType<typeof this.hydrateInvoice>>);
  }

  private async createInvoiceRecord(input: {
    type: InvoiceType;
    customerId: string;
    agencyId?: string | null;
    bookingId?: string | null;
    lineItems: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
    }>;
    taxRate?: number;
    dueDate?: string | Date | null;
    issueImmediately?: boolean;
    paidAmount: number;
    paidAt: Date | null;
  }) {
    const normalizedItems = input.lineItems.map((lineItem) => ({
      description: lineItem.description,
      quantity: Number(lineItem.quantity.toFixed(2)),
      unitPrice: Number(lineItem.unitPrice.toFixed(2)),
      totalPrice: Number((lineItem.quantity * lineItem.unitPrice).toFixed(2)),
    }));

    const subtotal = Number(
      normalizedItems.reduce((sum, lineItem) => sum + lineItem.totalPrice, 0).toFixed(2),
    );
    const taxRate = input.taxRate ?? 0;
    const taxAmount = Number((subtotal * taxRate).toFixed(2));
    const totalAmount = Number((subtotal + taxAmount).toFixed(2));
    const approvalRequired = totalAmount >= this.approvalThreshold;
    const parsedDueDate = this.resolveDueDate(input.dueDate ?? undefined);
    const shouldIssue = !approvalRequired && (input.issueImmediately ?? true);

    const invoice = await this.prisma.invoice.create({
      data: {
        number: this.generateInvoiceNumber(input.type),
        type: input.type,
        status: shouldIssue
          ? input.paidAmount >= totalAmount
            ? InvoiceStatus.PAID
            : parsedDueDate < new Date()
              ? InvoiceStatus.OVERDUE
              : InvoiceStatus.ISSUED
          : InvoiceStatus.DRAFT,
        isLocked: shouldIssue,
        bookingId: input.bookingId ?? null,
        customerId: input.customerId,
        agencyId: input.agencyId ?? null,
        subtotal,
        taxAmount,
        totalAmount,
        paidAmount: Number(input.paidAmount.toFixed(2)),
        dueDate: parsedDueDate,
        issuedAt: shouldIssue ? new Date() : null,
        paidAt: input.paidAmount >= totalAmount ? input.paidAt ?? new Date() : null,
        isApprovalRequired: approvalRequired,
        lineItems: {
          create: normalizedItems,
        },
      },
      include: this.invoiceInclude,
    });

    if (input.bookingId) {
      await this.prisma.payment.updateMany({
        where: {
          bookingId: input.bookingId,
          invoiceId: null,
        },
        data: {
          invoiceId: invoice.id,
        },
      });
    }

    return invoice;
  }

  private assignType(serviceType: ServiceType) {
    switch (serviceType) {
      case ServiceType.WAREHOUSE:
        return InvoiceType.WAREHOUSE;
      case ServiceType.COURIER:
        return InvoiceType.COURIER;
      default:
        return InvoiceType.TRANSPORT;
    }
  }

  private generateInvoiceNumber(type: InvoiceType) {
    const prefixMap: Record<InvoiceType, string> = {
      TRANSPORT: 'INV-TRN',
      WAREHOUSE: 'INV-WHS',
      COURIER: 'INV-CRR',
      COMBINED: 'INV-CMB',
      PLATFORM: 'INV-PLT',
    };

    return `${prefixMap[type]}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }

  private resolveDueDate(value?: string | Date | null) {
    if (!value) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);
      return dueDate;
    }

    const dueDate = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(dueDate.getTime())) {
      throw new BadRequestException('Invalid due date');
    }
    return dueDate;
  }

  private sumPayments(payments: Array<{ amount: number }>) {
    return Number(payments.reduce((sum, payment) => sum + payment.amount, 0).toFixed(2));
  }

  private async syncInvoiceState(invoice: InvoiceWithRelations) {
    if (invoice.status === InvoiceStatus.CANCELLED) {
      return invoice;
    }

    const payments = await this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.COMPLETED,
        OR: [
          { invoiceId: invoice.id },
          ...(invoice.bookingId
            ? [{ invoiceId: null, bookingId: invoice.bookingId }]
            : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        amount: true,
        createdAt: true,
        invoiceId: true,
      },
    });

    const legacyPaymentIds = payments
      .filter((payment) => payment.invoiceId == null)
      .map((payment) => payment.id);
    if (legacyPaymentIds.length > 0) {
      await this.prisma.payment.updateMany({
        where: { id: { in: legacyPaymentIds } },
        data: { invoiceId: invoice.id },
      });
    }

    const paidAmount = this.sumPayments(payments);
    const nextStatus = !invoice.issuedAt
      ? InvoiceStatus.DRAFT
      : paidAmount >= invoice.totalAmount
        ? InvoiceStatus.PAID
        : invoice.dueDate && invoice.dueDate < new Date()
          ? InvoiceStatus.OVERDUE
          : InvoiceStatus.ISSUED;
    const paidAt = paidAmount >= invoice.totalAmount ? payments[0]?.createdAt ?? new Date() : null;

    if (
      paidAmount === invoice.paidAmount &&
      nextStatus === invoice.status &&
      String(paidAt ?? '') === String(invoice.paidAt ?? '')
    ) {
      return invoice;
    }

    return this.prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        paidAmount,
        paidAt,
        status: nextStatus,
      },
      include: this.invoiceInclude,
    });
  }

  private async findOrThrow(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: this.invoiceInclude,
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }

  private async hydrateInvoice(invoice: InvoiceWithRelations) {
    const [customer, agency] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: invoice.customerId },
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          role: true,
        },
      }),
      invoice.agencyId
        ? this.prisma.agency.findUnique({
            where: { id: invoice.agencyId },
            select: {
              id: true,
              name: true,
            },
          })
        : Promise.resolve(null),
    ]);

    return {
      ...invoice,
      customer,
      agency,
    };
  }

  private async hydrateInvoices(invoices: InvoiceWithRelations[]) {
    const customerIds = [...new Set(invoices.map((invoice) => invoice.customerId))];
    const agencyIds = [...new Set(invoices.map((invoice) => invoice.agencyId).filter(Boolean))] as string[];

    const [customers, agencies] = await Promise.all([
      customerIds.length > 0
        ? this.prisma.user.findMany({
            where: { id: { in: customerIds } },
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
              role: true,
            },
          })
        : Promise.resolve([]),
      agencyIds.length > 0
        ? this.prisma.agency.findMany({
            where: { id: { in: agencyIds } },
            select: {
              id: true,
              name: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const customersById = new Map(customers.map((customer) => [customer.id, customer]));
    const agenciesById = new Map(agencies.map((agency) => [agency.id, agency]));

    return invoices.map((invoice) => ({
      ...invoice,
      customer: customersById.get(invoice.customerId) ?? null,
      agency: invoice.agencyId ? agenciesById.get(invoice.agencyId) ?? null : null,
    }));
  }

  private async buildPdf(
    invoice: Awaited<ReturnType<typeof this.hydrateInvoice>>,
  ) {
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 40 });
    const chunks: Buffer[] = [];

    return new Promise<{ buffer: Buffer; fileName: string }>((resolve, reject) => {
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () =>
        resolve({
          buffer: Buffer.concat(chunks),
          fileName: `${invoice.number}.pdf`,
        }),
      );
      doc.on('error', reject);

      const companyLogoPath = resolveBrandAsset('aurenza-limited.png');
      const zitoWordmarkPath = resolveBrandAsset('zito-wordmark.png');
      const zitoBoardPath = resolveBrandAsset('zito-logo.png');

      if (companyLogoPath) {
        doc.image(companyLogoPath, 40, 36, {
          fit: [220, 68],
          align: 'left',
          valign: 'top',
        });
      } else {
        doc.fillColor('#0a2258');
        doc.fontSize(24).text(BRAND.companyName, 40, 42);
        doc.fillColor('#b8872f');
        doc.fontSize(11).text(BRAND.companyTagline, 40, 72);
      }

      if (zitoWordmarkPath) {
        doc.roundedRect(386, 38, 139, 46, 14).fill('#ffffff');
        doc.image(zitoWordmarkPath, 400, 49, {
          fit: [111, 20],
          align: 'center',
          valign: 'center',
        });
      } else if (zitoBoardPath) {
        doc.image(zitoBoardPath, 360, 34, {
          fit: [165, 82],
          align: 'right',
          valign: 'top',
        });
      }

      const issuerLineY = companyLogoPath ? 112 : 92;
      const dividerY = companyLogoPath ? 136 : 122;
      const invoiceHeaderY = dividerY + 16;

      doc.fillColor('#475569');
      doc.fontSize(10).text(BRAND.issuerLine, 40, issuerLineY, { width: 280 });
      doc
        .moveTo(40, dividerY)
        .lineTo(555, dividerY)
        .strokeColor('#9333ea')
        .lineWidth(1)
        .stroke();

      doc.fillColor('#0f172a');
      doc.fontSize(18).text(`${BRAND.appName} Invoice`, 40, invoiceHeaderY);
      doc.moveDown(0.6);
      doc.fontSize(12).text(`Invoice No: ${invoice.number}`);
      doc.text(`Type: ${invoice.type}`);
      doc.text(`Status: ${invoice.status}`);
      doc.text(`Customer: ${invoice.customer?.fullName ?? invoice.customer?.email ?? invoice.customerId}`);
      doc.text(`Agency: ${invoice.agency?.name ?? 'N/A'}`);
      if (invoice.booking?.reference) {
        doc.text(`Booking Reference: ${invoice.booking.reference}`);
      }
      doc.text(`Issued At: ${invoice.issuedAt?.toISOString() ?? 'Draft'}`);
      doc.text(`Due Date: ${invoice.dueDate?.toISOString() ?? 'N/A'}`);
      doc.moveDown();

      doc.fontSize(14).fillColor('#0a2258').text('Line Items');
      doc.moveDown(0.5);
      for (const lineItem of invoice.lineItems) {
        doc
          .fontSize(11)
          .fillColor('#0f172a')
          .text(
            `${lineItem.description} | Qty: ${lineItem.quantity} | Unit: ${lineItem.unitPrice.toFixed(2)} | Total: ${lineItem.totalPrice.toFixed(2)}`,
          );
      }

      doc.moveDown();
      doc.fontSize(12).text(`Subtotal: ${invoice.subtotal.toFixed(2)}`);
      doc.text(`Tax: ${invoice.taxAmount.toFixed(2)}`);
      doc.text(`Paid: ${invoice.paidAmount.toFixed(2)}`);
      doc.text(`Balance Due: ${(invoice.totalAmount - invoice.paidAmount).toFixed(2)}`);
      doc.fontSize(14).fillColor('#0a2258').text(`Grand Total: ${invoice.totalAmount.toFixed(2)}`, {
        align: 'right',
      });

      doc.end();
    });
  }

  private async writeAudit(
    userId: string | null,
    action: string,
    entityId: string,
    details: Record<string, unknown>,
  ) {
    if (!userId) {
      return;
    }

    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return;
      }

      await this.prisma.auditLog.create({
        data: {
          userId,
          action,
          entityType: 'INVOICE',
          entityId,
          details: details as Prisma.InputJsonValue,
        },
      });
    } catch {
      // Invoice generation should continue even if audit persistence fails.
    }
  }
}
