import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InternalAlert } from '@prisma/client';

/**
 * ZITO · Internal Alert Service
 * PRD §39: Centralised system for operational alerts and escalations.
 */
@Injectable()
export class AlertsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Creates an internal alert record.
   * Used by Loss Detection, Dispatch, and Fraud engines.
   */
  async createAlert(data: {
    type: string;
    severity?: string;
    message: string;
    agencyId?: string | null;
    entityType: string;
    entityId: string;
    metadata?: any;
  }): Promise<InternalAlert> {
    return this.prisma.internalAlert.create({
      data: {
        type: data.type,
        severity: data.severity || 'medium',
        message: data.message,
        agencyId: data.agencyId,
        entityType: data.entityType,
        entityId: data.entityId,
        metadata: data.metadata || {},
      },
    });
  }

  async processEscalations(alertId: string): Promise<void> {
    console.log(`[ALERT SYSTEM] Processing escalation for alert: ${alertId}`);
  }
}