import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../controllers/prisma.service';

@Injectable()
export class ComplianceService {
  private readonly logger = new Logger(ComplianceService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Checks a specific driver's documents for expiry.
   * PRD §14, §18.1
   */
  async checkDriverExpiry(userId: string): Promise<string | null> {
    try {
      const driver = await this.prisma.driver.findUnique({ where: { userId } });
      if (!driver) return null;

      const comp = await this.prisma.driverCompliance.findUnique({ where: { driverId: driver.id } });
      if (!comp) return null;

      const now = new Date();
      const expiredFields: string[] = [];
      if (comp.licenseExpiry && new Date(comp.licenseExpiry) < now) expiredFields.push('licenseExpiry');
      if (comp.policeClearanceExpiry && new Date(comp.policeClearanceExpiry) < now) expiredFields.push('policeClearanceExpiry');
      if (comp.medicalExpiry && new Date(comp.medicalExpiry) < now) expiredFields.push('medicalExpiry');

      if (expiredFields.length > 0) {
        const comment = `Document expired: ${expiredFields.join(', ')}`;

        await this.prisma.$transaction([
          this.prisma.driver.update({
            where: { id: driver.id },
            data: { canReceiveAssignments: false, isAvailable: false }
          }),
          this.prisma.driverCompliance.update({
            where: { driverId: driver.id },
            data: {
              complianceStatus: 'resubmission_required',
              resubmissionComment: comment,
            }
          }),
          this.prisma.user.update({
            where: { id: userId },
            data: { complianceStatus: 'resubmission_required' }
          }),
        ]);

        return 'resubmission_required';
      }
    } catch (err: any) { // Type assertion for err
      this.logger.error(`checkDriverExpiry error for user ${userId}: ${err.message}`);
    }

    return null;
  }

  /**
   * Scans all currently 'approved' drivers and flags those with expired documents.
   * PRD §5.4
   */
  async runSystemWideExpiryCheck(): Promise<{ totalChecked: number; flagged: number }> {
    const drivers = await this.prisma.driver.findMany({
      where: {
        user: {
          complianceStatus: 'approved',
          isActive: true,
          deletedAt: null
        }
      },
      select: { userId: true }
    });

    let flaggedCount = 0;
    for (const d of drivers) {
      const wasUpdated = await this.checkDriverExpiry(d.userId);
      if (wasUpdated) flaggedCount++;
    }

    return { totalChecked: drivers.length, flagged: flaggedCount };
  }
}