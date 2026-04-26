import { Injectable, NotFoundException, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AlertsService } from '../alerts/alerts.service';
import { LossReport, LossReportStatus, InventoryStatus } from '@prisma/client';

@Injectable()
export class LossDetectionService {
  private readonly logger = new Logger(LossDetectionService.name);

  // PRD §44.14: High-value threshold for mandatory Super Admin approval
  private readonly HIGH_VALUE_THRESHOLD = 50000;

  constructor(
    private prisma: PrismaService,
    private alertsService: AlertsService
  ) {}

  async createReport(data: any, userId: string): Promise<LossReport> {
    const estimatedValue = Number(data.estimatedValue || 0);
    const isHighValue = estimatedValue >= this.HIGH_VALUE_THRESHOLD;

    const report = await this.prisma.lossReport.create({
      data: {
        bookingId: data.bookingId,
        itemId: data.itemId,
        type: data.type,
        description: data.description,
        estimatedValue,
        reportedBy: userId,
        status: LossReportStatus.PENDING,
        isHighValue,
      },
    });

    // PRD §11 & §13: Synchronize Inventory Item status via Relational Update
    if (data.itemId) {
      await this.prisma.inventoryItem.update({
        where: { id: data.itemId },
        data: {
          status: data.type === 'DAMAGE' ? InventoryStatus.DAMAGED : InventoryStatus.MISSING,
          movements: {
            create: {
              status: 'LOSS_REPORTED',
              performedBy: userId,
              locationDescription: `Reported as ${data.type}: ${data.description}`,
            },
          },
        },
      });
    }

    // PRD §18: Trigger internal alerts
    try {
      const booking = await this.prisma.booking.findUnique({
        where: { id: report.bookingId },
        select: { id: true, agencyId: true }
      });

      await this.alertsService.createAlert({
        type: `LOSS_REPORT_${report.type.toUpperCase()}`,
        severity: report.estimatedValue > 1000 ? 'high' : 'medium',
        message: `New ${report.type} loss report for booking ${report.bookingId}. Value: ${report.estimatedValue}.`,
        agencyId: booking?.agencyId || null,
        entityType: 'LossReport',
        entityId: report.id,
        metadata: {
          lossType: report.type,
          reportedBy: report.reportedBy,
          estimatedValue: report.estimatedValue,
        },
      });
    } catch (alertError: any) {
      this.logger.error(`Failed to trigger alert: ${alertError.message}`);
    }

    await this.logAuditEvent(userId, 'LOSS_REPORT_CREATED', report.id, { type: report.type });
    return report;
  }

  private async logAuditEvent(userId: string, action: string, entityId: string, details: any = {}) {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action,
          entityType: 'LossReport',
          entityId,
          details: details as any,
        },
      });
    } catch (err: any) {
      this.logger.error(`Audit log failed: ${err.message}`);
    }
  }

  async getReportsByBooking(bookingId: string): Promise<LossReport[]> {
    return await this.prisma.lossReport.findMany({ where: { bookingId }, orderBy: { createdAt: 'desc' } });
  }

  async getReportById(id: string): Promise<LossReport> {
    const report = await this.prisma.lossReport.findUnique({ where: { id } });
    if (!report) throw new NotFoundException(`Loss report ${id} not found`);
    return report;
  }

  async updateStatus(id: string, status: LossReportStatus, notes?: string, userId?: string): Promise<LossReport> {
    const report = await this.getReportById(id);
    if (status === LossReportStatus.RESOLVED && report.itemId && report.type === 'MISPLACEMENT') {
      await this.prisma.inventoryItem.update({
        where: { id: report.itemId },
        data: {
          status: InventoryStatus.STORED,
          movements: {
            create: {
              status: 'FOUND_AND_RESOLVED',
              performedBy: userId || 'SYSTEM',
              locationDescription: 'Item recovered after investigation.',
            },
          },
        },
      });
    }

    return await this.prisma.lossReport.update({
      where: { id },
      data: { status, resolutionNotes: notes },
    });
  }

  async investigateReport(id: string, userId: string): Promise<LossReport> {
    return await this.updateStatus(id, LossReportStatus.INVESTIGATING, 'Investigation started.', userId);
  }

  async addPhotoProof(id: string, photoUrl: string, userId: string): Promise<LossReport> {
    const report = await this.prisma.lossReport.update({
      where: { id },
      data: { evidence: { push: photoUrl } },
    });
    await this.logAuditEvent(userId, 'LOSS_REPORT_EVIDENCE_ADDED', id, { photoUrl });
    return report;
  }

  async escalate(id: string, userId: string): Promise<LossReport> {
    const report = await this.updateStatus(id, LossReportStatus.ESCALATED, 'Escalated for higher-level review.', userId);
    try {
      const alert = await (this.prisma as any).internalAlert.findFirst({
        where: { entityType: 'LossReport', entityId: id, status: 'pending' }
      });
      if (alert) {
        await this.alertsService.processEscalations(alert.id);
        await this.logAuditEvent(userId, 'ESCALATION_TRIGGERED', id, { alertId: alert.id });
      }
    } catch (error: any) {
      this.logger.error(`Escalation error: ${error.message}`);
    }
    return report;
  }

  async approveClaim(id: string, reviewerId: string, reviewerRole: string): Promise<LossReport> {
    const report = await this.prisma.lossReport.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');

    if (report.type === 'DAMAGE' && (!report.evidence || report.evidence.length === 0)) {
      throw new ForbiddenException('Mandatory photo proof is missing for damage claim.');
    }

    const isHighValue = report.estimatedValue >= this.HIGH_VALUE_THRESHOLD;
    if (isHighValue && reviewerRole !== 'SUPER_ADMIN') {
      throw new ForbiddenException(`High-value claim requires Super Admin approval.`);
    }

    return await this.prisma.lossReport.update({
      where: { id },
      data: {
        status: LossReportStatus.CLAIMED,
        resolutionNotes: `Approved by ${reviewerRole} (${reviewerId})`,
      },
    });
  }

  async checkBatchMismatch(bookingId: string, scanned: number, expected: number, userId: string) {
    if (scanned < expected) {
      return await this.createReport({
        bookingId, type: 'SHORTAGE',
        description: `Mismatch: Expected ${expected}, got ${scanned}.`,
      }, userId);
    }
    return { status: 'MATCHED' };
  }

  async getNoMovementAlerts() {
    const slaLimit = new Date();
    slaLimit.setHours(slaLimit.getHours() - 48);
    return await this.prisma.inventoryItem.findMany({
      where: {
        status: { notIn: ['DELIVERED', 'MISSING', 'DAMAGED'] },
        updatedAt: { lt: slaLimit }
      }
    });
  }
}