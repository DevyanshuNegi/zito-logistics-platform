import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  InvoiceStatus,
  PaymentStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateContractDto, UpdateContractDto } from './dto/contract.dto';

type ContractRecord = Prisma.ContractGetPayload<Record<string, never>>;

@Injectable()
export class ContractsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForAdmin(filters: {
    customerId?: string;
    status?: string;
    agencyId?: string;
  }) {
    const contracts = await this.prisma.contract.findMany({
      where: {
        ...(filters.customerId && { customerId: filters.customerId }),
        ...(filters.status && { status: filters.status }),
        ...(filters.agencyId && { agencyId: filters.agencyId }),
      },
      orderBy: { createdAt: 'desc' },
    });

    const hydrated = await this.hydrateContracts(
      await Promise.all(contracts.map((contract) => this.decorateContract(contract))),
    );

    return {
      contracts: hydrated,
      total: hydrated.length,
    };
  }

  async getById(id: string) {
    const contract = await this.findOrThrow(id);
    return this.hydrateContract(await this.decorateContract(contract));
  }

  async create(dto: CreateContractDto, actorId: string) {
    await this.ensureCorporateCustomer(dto.customerId);

    const created = await this.prisma.contract.create({
      data: {
        customerId: dto.customerId,
        agencyId: dto.agencyId ?? null,
        businessName: dto.businessName,
        creditLimit: dto.creditLimit,
        creditUsed: 0,
        billingCycle: dto.billingCycle,
        paymentTermDays: dto.paymentTermDays,
        status: dto.status ?? 'DRAFT',
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });

    if (created.status === 'ACTIVE') {
      await this.supersedeOtherContracts(created.customerId, created.id);
    }

    await this.writeAudit(actorId, 'CONTRACT_CREATED', created.id, {
      customerId: created.customerId,
      businessName: created.businessName,
      creditLimit: created.creditLimit,
      status: created.status,
    });

    return this.hydrateContract(await this.decorateContract(created));
  }

  async update(id: string, dto: UpdateContractDto, actorId: string) {
    const existing = await this.findOrThrow(id);

    const nextCustomerId = dto.customerId ?? existing.customerId;
    await this.ensureCorporateCustomer(nextCustomerId);

    const updated = await this.prisma.contract.update({
      where: { id },
      data: {
        ...(dto.customerId && { customerId: dto.customerId }),
        ...(dto.agencyId !== undefined && { agencyId: dto.agencyId || null }),
        ...(dto.businessName && { businessName: dto.businessName }),
        ...(dto.creditLimit != null && { creditLimit: dto.creditLimit }),
        ...(dto.billingCycle && { billingCycle: dto.billingCycle }),
        ...(dto.paymentTermDays != null && { paymentTermDays: dto.paymentTermDays }),
        ...(dto.status && { status: dto.status }),
        ...(dto.expiresAt !== undefined && {
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        }),
      },
    });

    if (updated.status === 'ACTIVE') {
      await this.supersedeOtherContracts(updated.customerId, updated.id);
    }

    await this.writeAudit(actorId, 'CONTRACT_UPDATED', updated.id, {
      previous: existing,
      next: updated,
    });

    return this.hydrateContract(await this.decorateContract(updated));
  }

  async getCorporatePortalData(customerId: string) {
    const recentContracts = await this.prisma.contract.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const activeContract = await this.findActiveContract(customerId);
    const refreshedActiveContract = activeContract
      ? await this.syncCreditUsage(customerId, activeContract)
      : null;

    return {
      contract: refreshedActiveContract
        ? await this.hydrateContract(await this.decorateContract(refreshedActiveContract))
        : null,
      recentContracts: await this.hydrateContracts(
        await Promise.all(recentContracts.map((contract) => this.decorateContract(contract))),
      ),
      creditSummary: await this.calculateCreditExposure(customerId),
    };
  }

  async getCorporateContractSummary(customerId: string) {
    const activeContract = await this.findActiveContract(customerId);
    if (!activeContract) {
      return {
        contract: null,
        creditAvailable: 0,
        ...await this.calculateCreditExposure(customerId),
      };
    }

    const updated = await this.syncCreditUsage(customerId, activeContract);
    const decorated = await this.decorateContract(updated);
    const exposure = await this.calculateCreditExposure(customerId);

    return {
      contract: await this.hydrateContract(decorated),
      creditAvailable: Number((updated.creditLimit - updated.creditUsed).toFixed(2)),
      ...exposure,
    };
  }

  async checkCredit(customerId: string, requestedAmount: number) {
    const activeContract = await this.findActiveContract(customerId);
    if (!activeContract) {
      throw new BadRequestException(
        'An active corporate contract is required before creating bookings',
      );
    }

    const exposure = await this.calculateCreditExposure(customerId);
    const projectedExposure = Number(
      (exposure.totalExposure + requestedAmount).toFixed(2),
    );

    await this.syncCreditUsage(customerId, activeContract, exposure.totalExposure);

    if (projectedExposure > activeContract.creditLimit) {
      throw new BadRequestException(
        `Corporate credit limit exceeded. Limit ${activeContract.creditLimit.toFixed(2)}, current exposure ${exposure.totalExposure.toFixed(2)}, requested ${requestedAmount.toFixed(2)}.`,
      );
    }

    return {
      contractId: activeContract.id,
      currentExposure: exposure.totalExposure,
      projectedExposure,
      creditLimit: activeContract.creditLimit,
    };
  }

  async syncCreditUsage(customerId: string, contract?: ContractRecord, explicitExposure?: number) {
    const activeContract = contract ?? await this.findActiveContract(customerId);
    if (!activeContract) {
      return null;
    }

    const exposure =
      explicitExposure ?? (await this.calculateCreditExposure(customerId)).totalExposure;

    return this.prisma.contract.update({
      where: { id: activeContract.id },
      data: { creditUsed: exposure },
    });
  }

  private async calculateCreditExposure(customerId: string) {
    const [outstandingInvoices, openBookings] = await Promise.all([
      this.prisma.invoice.findMany({
        where: {
          customerId,
          status: {
            in: [InvoiceStatus.DRAFT, InvoiceStatus.ISSUED, InvoiceStatus.OVERDUE],
          },
        },
        select: {
          totalAmount: true,
          paidAmount: true,
        },
      }),
      this.prisma.booking.findMany({
        where: {
          customerId,
          status: {
            notIn: [
              BookingStatus.CANCELLED,
              BookingStatus.REJECTED,
              BookingStatus.COMPLETED,
            ],
          },
          invoice: {
            is: null,
          },
        },
        select: {
          totalPrice: true,
          payments: {
            where: { status: PaymentStatus.COMPLETED },
            select: { amount: true },
          },
        },
      }),
    ]);

    const invoiceExposure = Number(
      outstandingInvoices
        .reduce(
          (sum, invoice) => sum + Math.max(0, invoice.totalAmount - invoice.paidAmount),
          0,
        )
        .toFixed(2),
    );

    const bookingExposure = Number(
      openBookings
        .reduce((sum, booking) => {
          const paidTotal = booking.payments.reduce(
            (paymentSum, payment) => paymentSum + payment.amount,
            0,
          );
          return sum + Math.max(0, booking.totalPrice - paidTotal);
        }, 0)
        .toFixed(2),
    );

    return {
      invoiceExposure,
      bookingExposure,
      totalExposure: Number((invoiceExposure + bookingExposure).toFixed(2)),
    };
  }

  private async findOrThrow(id: string) {
    const contract = await this.prisma.contract.findUnique({ where: { id } });
    if (!contract) {
      throw new NotFoundException('Contract not found');
    }
    return contract;
  }

  private async findActiveContract(customerId: string) {
    return this.prisma.contract.findFirst({
      where: {
        customerId,
        status: 'ACTIVE',
        OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  private async ensureCorporateCustomer(customerId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: customerId },
      select: { id: true, role: true, status: true },
    });

    if (!user) {
      throw new NotFoundException('Corporate customer not found');
    }

    if (user.role !== UserRole.CORPORATE) {
      throw new BadRequestException('Contracts can only be assigned to CORPORATE users');
    }

    return user;
  }

  private async supersedeOtherContracts(customerId: string, activeContractId: string) {
    await this.prisma.contract.updateMany({
      where: {
        customerId,
        id: { not: activeContractId },
        status: 'ACTIVE',
      },
      data: {
        status: 'SUPERSEDED',
      },
    });
  }

  private async decorateContract(contract: ContractRecord) {
    if (contract.expiresAt && contract.expiresAt < new Date() && contract.status === 'ACTIVE') {
      return this.prisma.contract.update({
        where: { id: contract.id },
        data: { status: 'EXPIRED' },
      });
    }
    return contract;
  }

  private async hydrateContract(contract: ContractRecord) {
    const [customer, agency] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: contract.customerId },
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          role: true,
          status: true,
        },
      }),
      contract.agencyId
        ? this.prisma.agency.findUnique({
            where: { id: contract.agencyId },
            select: {
              id: true,
              name: true,
            },
          })
        : Promise.resolve(null),
    ]);

    return {
      ...contract,
      creditAvailable: Number((contract.creditLimit - contract.creditUsed).toFixed(2)),
      customer,
      agency,
    };
  }

  private async hydrateContracts(contracts: ContractRecord[]) {
    const customerIds = [...new Set(contracts.map((contract) => contract.customerId))];
    const agencyIds = [...new Set(contracts.map((contract) => contract.agencyId).filter(Boolean))] as string[];

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
              status: true,
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

    const customerMap = new Map(customers.map((customer) => [customer.id, customer]));
    const agencyMap = new Map(agencies.map((agency) => [agency.id, agency]));

    return contracts.map((contract) => ({
      ...contract,
      creditAvailable: Number((contract.creditLimit - contract.creditUsed).toFixed(2)),
      customer: customerMap.get(contract.customerId) ?? null,
      agency: contract.agencyId ? agencyMap.get(contract.agencyId) ?? null : null,
    }));
  }

  private async writeAudit(
    userId: string,
    action: string,
    entityId: string,
    details: Record<string, unknown>,
  ) {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return;
      }

      await this.prisma.auditLog.create({
        data: {
          userId,
          action,
          entityType: 'CONTRACT',
          entityId,
          details: details as Prisma.InputJsonValue,
        },
      });
    } catch {
      // Contract management should not fail because audit logging failed.
    }
  }
}
