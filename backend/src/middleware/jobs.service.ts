import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class JobsService implements OnModuleInit {
  constructor(
    @InjectQueue('compliance-queue') private readonly complianceQueue: Queue,
  ) {}

  async onModuleInit() {
    await this.scheduleDailyExpiryCheck();
  }

  async scheduleDailyExpiryCheck() {
    // PRD §5.4: Daily check (0 0 * * *)
    // We use a repeatable job to ensure it persists in Redis
    const jobName = 'daily-expiry-check';
    
    // Remove existing repeatable jobs with this name to avoid duplicates on restart
    const repeatableJobs = await this.complianceQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      if (job.name === jobName) {
        await this.complianceQueue.removeRepeatableByKey(job.key);
      }
    }

    await this.complianceQueue.add(jobName, {}, {
      repeat: { pattern: '0 0 * * *' }, // Midnight every day
    });
  }
}