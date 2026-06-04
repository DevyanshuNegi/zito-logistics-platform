import {
  ConflictException,
  BadRequestException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Prisma, PrismaClient, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { BookingsService } from '../bookings/bookings.service';
import { PayrollService } from '../drivers/payroll/payroll.service';
import {
  ApprovalActionType,
  RequestBookingCancelApprovalDto,
  RequestPayoutOverrideApprovalDto,
} from './dto/approval.dto';

type DbClient = PrismaService | PrismaClient | Prisma.TransactionClient;

type ApprovalMetadata = {
  actionType: ApprovalActionType;
  requestedBy: string;
  requestedAt: string;
  reason: string;
  payload: Record<string, any>;
  requiredApprovals: number;
  approvals: Array<{
    approverId: string;
    approvedAt: string;
    note?: string | null;
  }>;
  entitySummary?: Record<string, any>;
  rejectedBy?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  executedBy?: string | null;
  executedAt?: string | null;
  executionResult?: Record<string, any> | null;
};

const ACTION_CONFIG: Record<
  ApprovalActionType,
  { label: string; requiredApprovals: number; severity: string }
> = {
  PAYMENT_REFUND: {
    label: 'Payment refund approval',
    requiredApprovals: 2,
    severity: 'HIGH',
  },
  PAYOUT_OVERRIDE: {
    label: 'Payroll payout override approval',
    requiredApprovals: 2,
    severity: 'HIGH',
  },
  BOOKING_CANCEL: {
    label: 'Booking cancellation approval',
    requiredApprovals: 1,
    severity: 'MEDIUM',
  },
};

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService: PaymentsService,
    @Inject(forwardRef(() => BookingsService))
    private readonly bookingsService: BookingsService,
    private readonly payrollService: PayrollService,
  ) {}

  async requestRefundApproval(
    paymentId: string,
    requesterId: string,
    reason: string,
  ) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        booking: {
          select: {
            id: true,
            reference: true,
            customerId: true,
            status: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new BadRequestException('Only completed payments can enter refund approval');
    }

    return this.requireApproval(
      'PAYMENT_REFUND',
      paymentId,
      requesterId,
      reason,
      {
        paymentId,
      },
      {
        paymentReference: payment.reference,
        bookingReference: payment.booking?.reference ?? null,
        amount: payment.amount,
        status: payment.status,
      },
    );
  }

  async requestBookingCancelApproval(
    dto: RequestBookingCancelApprovalDto,
    requesterId: string,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
      select: {
        id: true,
        reference: true,
        status: true,
        totalPrice: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    if (booking.status === 'COMPLETED' || booking.status === 'CANCELLED') {
      throw new BadRequestException(`Booking cannot be cancelled from status ${booking.status}`);
    }

    return this.requireApproval(
      'BOOKING_CANCEL',
      dto.bookingId,
      requesterId,
      dto.reason,
      {
        bookingId: dto.bookingId,
        penaltyOverrideNote: dto.penaltyOverrideNote ?? null,
      },
      {
        bookingReference: booking.reference,
        bookingStatus: booking.status,
        totalPrice: booking.totalPrice,
      },
    );
  }

  async requestPayoutOverrideApproval(
    dto: RequestPayoutOverrideApprovalDto,
    requesterId: string,
  ) {
    const payroll = await this.prisma.driverPayroll.findUnique({
      where: { id: dto.payrollId },
      include: {
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
      },
    });

    if (!payroll) {
      throw new NotFoundException('Payroll not found');
    }
    if (payroll.status === 'PAID') {
      throw new BadRequestException('Paid payroll cannot be overridden');
    }

    return this.requireApproval(
      'PAYOUT_OVERRIDE',
      dto.payrollId,
      requesterId,
      dto.reason,
      {
        payrollId: dto.payrollId,
        overrideAmount: dto.overrideAmount,
      },
      {
        currentNetPayout: payroll.netPayout,
        targetNetPayout: dto.overrideAmount,
        payrollStatus: payroll.status,
        driverName: payroll.driver.user?.fullName ?? payroll.driver.user?.phone ?? payroll.driverId,
      },
    );
  }

  async listApprovalRequests(filters: {
    actionType?: ApprovalActionType;
    status?: string;
  }) {
    const approvals = await this.prisma.internalAlert.findMany({
      where: {
        type: 'APPROVAL_REQUEST',
        ...(filters.actionType && { entityType: filters.actionType }),
        ...(filters.status && { status: filters.status }),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const items = await Promise.all(approvals.map((approval) => this.hydrateApproval(approval)));

    return {
      items,
      total: items.length,
      summary: {
        pending: items.filter((item) =>
          ['PENDING', 'PARTIALLY_APPROVED'].includes(item.status),
        ).length,
        executed: items.filter((item) => item.status === 'EXECUTED').length,
        rejected: items.filter((item) => item.status === 'REJECTED').length,
        failed: items.filter((item) => item.status === 'FAILED').length,
      },
    };
  }

  async getApprovalRequest(id: string) {
    const approval = await this.findApprovalOrThrow(id);
    return this.hydrateApproval(approval);
  }

  async dualApprove(id: string, approverId: string, note?: string) {
    const approval = await this.findApprovalOrThrow(id);
    const metadata = this.getMetadata(approval);

    if (metadata.requestedBy === approverId) {
      throw new BadRequestException('Requester cannot approve their own high-risk action');
    }
    if (approval.status === 'REJECTED') {
      throw new BadRequestException('Rejected approval request cannot be approved');
    }
    if (approval.status === 'EXECUTED') {
      return this.hydrateApproval(approval);
    }
    if (approval.status === 'FAILED') {
      throw new BadRequestException('Failed approval request must be recreated');
    }
    if (metadata.approvals.some((entry) => entry.approverId === approverId)) {
      throw new ConflictException('This approver has already approved the request');
    }

    metadata.approvals.push({
      approverId,
      approvedAt: new Date().toISOString(),
      note: note ?? null,
    });

    const approvalsReceived = metadata.approvals.length;
    const required = metadata.requiredApprovals;

    if (approvalsReceived < required) {
      const updated = await this.prisma.internalAlert.update({
        where: { id },
        data: {
          status: 'PARTIALLY_APPROVED',
          metadata: metadata as Prisma.InputJsonValue,
        },
      });

      await this.writeAudit(approverId, 'APPROVAL_REVIEWED', 'APPROVAL_REQUEST', id, {
        actionType: metadata.actionType,
        approvalsReceived,
        requiredApprovals: required,
      });

      return this.hydrateApproval(updated);
    }

    try {
      const executionResult = await this.executeApproval(metadata, approverId);
      metadata.executedBy = approverId;
      metadata.executedAt = new Date().toISOString();
      metadata.executionResult = this.toPlainObject(executionResult);

      const updated = await this.prisma.internalAlert.update({
        where: { id },
        data: {
          status: 'EXECUTED',
          metadata: metadata as Prisma.InputJsonValue,
        },
      });

      await this.writeAudit(approverId, 'APPROVAL_EXECUTED', 'APPROVAL_REQUEST', id, {
        actionType: metadata.actionType,
        approvalsReceived,
        requiredApprovals: required,
      });

      return this.hydrateApproval(updated);
    } catch (error: any) {
      metadata.executionResult = {
        message: error?.message ?? 'Execution failed',
      };

      const failed = await this.prisma.internalAlert.update({
        where: { id },
        data: {
          status: 'FAILED',
          metadata: metadata as Prisma.InputJsonValue,
        },
      });

      await this.writeAudit(approverId, 'APPROVAL_FAILED', 'APPROVAL_REQUEST', id, {
        actionType: metadata.actionType,
        error: error?.message ?? 'Execution failed',
      });

      return this.hydrateApproval(failed);
    }
  }

  async rejectApprovalRequest(id: string, approverId: string, reason?: string) {
    const approval = await this.findApprovalOrThrow(id);
    const metadata = this.getMetadata(approval);

    if (metadata.requestedBy === approverId) {
      throw new BadRequestException('Requester cannot reject their own request');
    }
    if (approval.status === 'EXECUTED') {
      throw new BadRequestException('Executed approval request cannot be rejected');
    }

    metadata.rejectedBy = approverId;
    metadata.rejectedAt = new Date().toISOString();
    metadata.rejectionReason = reason ?? 'Rejected from admin control dashboard';

    const updated = await this.prisma.internalAlert.update({
      where: { id },
      data: {
        status: 'REJECTED',
        metadata: metadata as Prisma.InputJsonValue,
      },
    });

    await this.writeAudit(approverId, 'APPROVAL_REJECTED', 'APPROVAL_REQUEST', id, {
      actionType: metadata.actionType,
      reason: metadata.rejectionReason,
    });

    return this.hydrateApproval(updated);
  }

  async requireApproval(
    actionType: ApprovalActionType,
    entityId: string,
    requesterId: string,
    reason: string,
    payload: Record<string, any>,
    entitySummary?: Record<string, any>,
  ) {
    const existing = await this.prisma.internalAlert.findFirst({
      where: {
        type: 'APPROVAL_REQUEST',
        entityType: actionType,
        entityId,
        status: { in: ['PENDING', 'PARTIALLY_APPROVED'] },
      },
    });

    if (existing) {
      throw new ConflictException('An active approval request already exists for this action');
    }

    const config = ACTION_CONFIG[actionType];
    const metadata: ApprovalMetadata = {
      actionType,
      requestedBy: requesterId,
      requestedAt: new Date().toISOString(),
      reason,
      payload,
      requiredApprovals: config.requiredApprovals,
      approvals: [],
      entitySummary,
    };

    const request = await this.prisma.internalAlert.create({
      data: {
        type: 'APPROVAL_REQUEST',
        entityType: actionType,
        entityId,
        severity: config.severity,
        status: 'PENDING',
        message: `${config.label} requested`,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });

    await this.writeAudit(requesterId, 'APPROVAL_REQUESTED', 'APPROVAL_REQUEST', request.id, {
      actionType,
      entityId,
      requiredApprovals: config.requiredApprovals,
    });

    return {
      message: `${config.label} created and sent for approval`,
      request: await this.hydrateApproval(request),
    };
  }

  private async executeApproval(metadata: ApprovalMetadata, approverId: string) {
    if (metadata.actionType === 'PAYMENT_REFUND') {
      return this.paymentsService.refundPayment(
        String(metadata.payload.paymentId),
        metadata.reason,
      );
    }

    if (metadata.actionType === 'BOOKING_CANCEL') {
      return this.bookingsService.cancelByAdmin(
        String(metadata.payload.bookingId),
        approverId,
        {
          reason: metadata.reason,
          penaltyOverrideNote: metadata.payload.penaltyOverrideNote ?? null,
        },
      );
    }

    if (metadata.actionType === 'PAYOUT_OVERRIDE') {
      return this.payrollService.overridePayout(
        String(metadata.payload.payrollId),
        Number(metadata.payload.overrideAmount),
        approverId,
        metadata.reason,
      );
    }

    throw new BadRequestException('Unsupported approval action');
  }

  private async hydrateApproval(approval: any) {
    const metadata = this.getMetadata(approval);
    const userIds = [
      metadata.requestedBy,
      ...metadata.approvals.map((entry) => entry.approverId),
      metadata.rejectedBy ?? null,
      metadata.executedBy ?? null,
    ].filter(Boolean) as string[];

    const users =
      userIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: [...new Set(userIds)] } },
            select: { id: true, fullName: true, email: true, phone: true, role: true },
          })
        : [];

    const usersById = new Map(
      users.map((user) => [user.id, user]),
    );

    return {
      id: approval.id,
      actionType: metadata.actionType,
      targetEntityId: approval.entityId,
      status: approval.status,
      severity: approval.severity,
      message: approval.message,
      requestedAt: metadata.requestedAt,
      reason: metadata.reason,
      requiredApprovals: metadata.requiredApprovals,
      approvalsReceived: metadata.approvals.length,
      requester: usersById.get(metadata.requestedBy) ?? null,
      approvals: metadata.approvals.map((entry) => ({
        ...entry,
        approver: usersById.get(entry.approverId) ?? null,
      })),
      entitySummary: metadata.entitySummary ?? null,
      rejectedAt: metadata.rejectedAt ?? null,
      rejectionReason: metadata.rejectionReason ?? null,
      rejectedBy: metadata.rejectedBy ? usersById.get(metadata.rejectedBy) ?? null : null,
      executedAt: metadata.executedAt ?? null,
      executedBy: metadata.executedBy ? usersById.get(metadata.executedBy) ?? null : null,
      executionResult: metadata.executionResult ?? null,
      createdAt: approval.createdAt,
    };
  }

  private async findApprovalOrThrow(id: string) {
    const approval = await this.prisma.internalAlert.findFirst({
      where: {
        id,
        type: 'APPROVAL_REQUEST',
      },
    });

    if (!approval) {
      throw new NotFoundException('Approval request not found');
    }

    return approval;
  }

  private getMetadata(approval: { metadata: Prisma.JsonValue | null; entityType: string }) {
    const base = this.asRecord(approval.metadata);
    return {
      actionType: approval.entityType as ApprovalActionType,
      requestedBy: String(base?.requestedBy ?? ''),
      requestedAt: String(base?.requestedAt ?? new Date().toISOString()),
      reason: String(base?.reason ?? ''),
      payload: this.asRecord(base?.payload) ?? {},
      requiredApprovals: Number(base?.requiredApprovals ?? 1),
      approvals: Array.isArray(base?.approvals)
        ? (base?.approvals as Array<any>).map((entry) => ({
            approverId: String(entry?.approverId ?? ''),
            approvedAt: String(entry?.approvedAt ?? new Date().toISOString()),
            note: entry?.note ? String(entry.note) : null,
          }))
        : [],
      entitySummary: this.asRecord(base?.entitySummary) ?? undefined,
      rejectedBy: base?.rejectedBy ? String(base.rejectedBy) : null,
      rejectedAt: base?.rejectedAt ? String(base.rejectedAt) : null,
      rejectionReason: base?.rejectionReason ? String(base.rejectionReason) : null,
      executedBy: base?.executedBy ? String(base.executedBy) : null,
      executedAt: base?.executedAt ? String(base.executedAt) : null,
      executionResult: this.asRecord(base?.executionResult) ?? null,
    } satisfies ApprovalMetadata;
  }

  private asRecord(value: Prisma.JsonValue | Record<string, any> | null | undefined) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, any>;
  }

  private toPlainObject(value: any) {
    if (value == null) {
      return null;
    }

    return JSON.parse(JSON.stringify(value));
  }

  private async writeAudit(
    userId: string,
    action: string,
    entityType: string,
    entityId: string,
    details?: Record<string, unknown>,
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
          entityType,
          entityId,
          details: (details ?? {}) as Prisma.InputJsonValue,
        },
      });
    } catch {
      // Approval workflow should not fail because an audit log write failed.
    }
  }
}
