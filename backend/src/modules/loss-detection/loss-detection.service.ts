import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryStatus,
  LossReportStatus,
  Prisma,
  ScanCheckpoint,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LossDetectionService {
  private readonly highValueThreshold = Number(
    process.env.LOSS_HIGH_VALUE_THRESHOLD ?? 10000,
  );
  private readonly defaultStaleHours = Number(
    process.env.LOSS_STALE_SLA_HOURS ?? 48,
  );

  constructor(private readonly prisma: PrismaService) {}

  private buildApprovalEntry(reviewerId: string, notes: string) {
    return `[APPROVED_BY:${reviewerId}|AT:${new Date().toISOString()}] ${notes}`;
  }

  private extractApprovalIds(notes?: string | null) {
    if (!notes) {
      return [];
    }

    return [...notes.matchAll(/\[APPROVED_BY:([^|]+)\|AT:/g)].map(
      match => match[1],
    );
  }

  async listReports(filters: any = {}) {
    const page = Math.max(Number(filters.page ?? 1), 1);
    const limit = Math.max(Number(filters.limit ?? 20), 1);
    const skip = (page - 1) * limit;

    const where: Prisma.LossReportWhereInput = {
      ...(filters.status && { status: filters.status }),
      ...(filters.bookingId && { bookingId: filters.bookingId }),
      ...(filters.itemId && { itemId: filters.itemId }),
      ...(filters.type && { type: filters.type }),
    };

    const [items, total] = await Promise.all([
      this.prisma.lossReport.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          booking: {
            select: {
              id: true,
              reference: true,
              status: true,
            },
          },
          item: {
            select: {
              id: true,
              parcelId: true,
              status: true,
            },
          },
          reporter: {
            select: {
              id: true,
              fullName: true,
              phone: true,
            },
          },
          reviewer: {
            select: {
              id: true,
              fullName: true,
              phone: true,
            },
          },
        },
      }),
      this.prisma.lossReport.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
    };
  }

  async getReport(id: string) {
    const report = await this.prisma.lossReport.findUnique({
      where: { id },
      include: {
        booking: {
          select: {
            id: true,
            reference: true,
            status: true,
          },
        },
        item: {
          select: {
            id: true,
            parcelId: true,
            status: true,
          },
        },
        reporter: {
          select: {
            id: true,
            fullName: true,
            phone: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            fullName: true,
            phone: true,
          },
        },
      },
    });

    if (!report) {
      throw new NotFoundException('Loss report not found');
    }

    return {
      ...report,
      approvalCount: this.extractApprovalIds(report.resolutionNotes).length,
    };
  }

  async detectMismatch(
    bookingId: string,
    reportedBy: string,
    expectedCount?: number,
    scannedCount?: number,
    checkpoint?: ScanCheckpoint,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        parcels: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const computedExpectedCount = expectedCount ?? booking.parcels.length;
    const scans = await this.prisma.scanEvent.findMany({
      where: {
        bookingId,
        ...(checkpoint && { checkpoint }),
      },
      select: {
        itemId: true,
      },
    });

    const computedScannedCount =
      scannedCount ?? new Set(scans.map(scan => scan.itemId)).size;

    if (computedScannedCount < computedExpectedCount) {
      return this.createReport({
        bookingId,
        type: 'MISMATCH',
        description:
          'Expected ' +
          computedExpectedCount +
          ' items, but only scanned ' +
          computedScannedCount,
        estimatedValue: 0,
        evidenceUrls: [],
        reportedBy,
      });
    }

    return {
      bookingId,
      expectedCount: computedExpectedCount,
      scannedCount: computedScannedCount,
      matched: true,
    };
  }

  async detectStale(slaHours = this.defaultStaleHours) {
    const cutoff = new Date(Date.now() - slaHours * 60 * 60 * 1000);
    const items = await this.prisma.inventoryItem.findMany({
      where: {
        status: {
          notIn: [InventoryStatus.DELIVERED],
        },
      },
      include: {
        booking: {
          select: {
            id: true,
            reference: true,
          },
        },
        movements: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
    });

    const staleItems = items.filter(item => {
      const lastMovement = item.movements[0]?.createdAt ?? item.createdAt;
      return lastMovement <= cutoff;
    });

    const alerts = [];
    for (const item of staleItems) {
      const existingAlert = await this.prisma.internalAlert.findFirst({
        where: {
          type: 'STALE_ITEM',
          entityType: 'INVENTORY_ITEM',
          entityId: item.id,
          status: 'PENDING',
        },
      });

      if (existingAlert) {
        alerts.push(existingAlert);
        continue;
      }

      const lastMovement = item.movements[0]?.createdAt ?? item.createdAt;
      const alert = await this.prisma.internalAlert.create({
        data: {
          type: 'STALE_ITEM',
          severity: 'MEDIUM',
          message: `Parcel ${item.parcelId} has had no movement since ${lastMovement.toISOString()}`,
          status: 'PENDING',
          entityType: 'INVENTORY_ITEM',
          entityId: item.id,
          metadata: {
            bookingId: item.bookingId,
            bookingReference: item.booking.reference,
            lastMovementAt: lastMovement.toISOString(),
            slaHours,
          },
        },
      });
      alerts.push(alert);
    }

    return {
      staleCount: staleItems.length,
      alertsCreated: alerts.length,
      items: staleItems.map(item => ({
        itemId: item.id,
        parcelId: item.parcelId,
        bookingId: item.bookingId,
        bookingReference: item.booking.reference,
        status: item.status,
        lastMovementAt: item.movements[0]?.createdAt ?? item.createdAt,
      })),
    };
  }

  async createReport(data: any) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: data.bookingId },
      include: {
        parcels: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (data.itemId && !booking.parcels.some(item => item.id === data.itemId)) {
      throw new BadRequestException(
        'Loss report item must belong to the selected booking',
      );
    }

    const isHighValue = data.estimatedValue >= this.highValueThreshold;
    return this.prisma.lossReport.create({
      data: {
        bookingId: data.bookingId,
        itemId: data.itemId,
        type: data.type,
        description: data.description,
        estimatedValue: data.estimatedValue,
        isHighValue,
        requiresDualApproval: isHighValue,
        status: isHighValue
          ? LossReportStatus.ESCALATED
          : LossReportStatus.PENDING,
        evidenceUrls: data.evidenceUrls || [],
        reportedBy: data.reportedBy,
      },
      include: {
        booking: {
          select: {
            id: true,
            reference: true,
          },
        },
        item: {
          select: {
            id: true,
            parcelId: true,
          },
        },
      },
    });
  }

  async requireApproval(id: string, reviewerId: string, notes: string) {
    const report = await this.prisma.lossReport.findUnique({
      where: { id },
    });

    if (!report) {
      throw new NotFoundException('Loss report not found');
    }

    const existingApprovals = this.extractApprovalIds(report.resolutionNotes);
    if (existingApprovals.includes(reviewerId)) {
      throw new BadRequestException(
        'The same reviewer cannot approve this claim twice',
      );
    }

    const newNotes = [report.resolutionNotes, this.buildApprovalEntry(reviewerId, notes)]
      .filter(Boolean)
      .join('\n');
    const approvalCount = [...new Set([...existingApprovals, reviewerId])].length;

    const nextStatus = report.requiresDualApproval
      ? approvalCount >= 2
        ? LossReportStatus.CLAIMED
        : LossReportStatus.INVESTIGATING
      : LossReportStatus.RESOLVED;

    const updated = await this.prisma.lossReport.update({
      where: { id },
      data: {
        status: nextStatus,
        reviewerId,
        resolutionNotes: newNotes,
      },
    });

    return {
      ...updated,
      approvalCount,
      approvalsRemaining: report.requiresDualApproval
        ? Math.max(2 - approvalCount, 0)
        : 0,
    };
  }
}
