import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LossDetectionService {
  constructor(private readonly prisma: PrismaService) {}

  async detectMismatch(expectedCount: number, scannedCount: number, bookingId: string, reportedBy: string) {
    if (scannedCount < expectedCount) {
      // Possible loss
      return this.createReport({
        bookingId,
        type: 'MISMATCH',
        description: 'Expected ' + expectedCount + ' items, but only scanned ' + scannedCount,
        estimatedValue: 0,
        reportedBy: reportedBy,
      });
    }
  }

  async detectStale() {
    // Cron logic conceptually
  }

  async createReport(data: any) {
    const isHighValue = data.estimatedValue > 10000;
    return this.prisma.lossReport.create({
      data: {
        bookingId: data.bookingId,
        itemId: data.itemId,
        type: data.type,
        description: data.description,
        estimatedValue: data.estimatedValue,
        isHighValue,
        status: isHighValue ? 'ESCALATED' : 'PENDING',
        evidenceUrls: data.evidenceUrls || [],
        reportedBy: data.reportedBy,
      },
    });
  }

  async requireApproval(id: string, reviewerId: string, notes: string) {
    return this.prisma.lossReport.update({
      where: { id },
      data: { status: 'INVESTIGATING', reviewerId: reviewerId, resolutionNotes: notes },
    });
  }
}

