import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ComplianceService } from '../services/compliance.service';

@Processor('compliance-queue')
@Injectable()
export class ComplianceWorker extends WorkerHost {
  private readonly logger = new Logger(ComplianceWorker.name);

  constructor(private readonly complianceService: ComplianceService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    switch (job.name) {
      case 'daily-expiry-check':
        this.logger.log('Starting daily document expiry check...');
        const result = await this.complianceService.runSystemWideExpiryCheck();
        this.logger.log(`Expiry check complete. Flagged ${result.flagged} drivers.`);
        return result;

      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
        return null;
    }
  }
}