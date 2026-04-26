import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ComplianceWorker } from './compliance.worker';
import { JobsService } from './jobs.service';
import { ComplianceService } from '../services/compliance.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'compliance-queue',
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    }),
  ],
  providers: [ComplianceWorker, JobsService, ComplianceService],
})
export class JobsModule {}