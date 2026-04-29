import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BullmqMonitorService implements OnModuleInit {
  private readonly logger = new Logger(BullmqMonitorService.name);
  private packageAvailable = false;
  private listenerAttached = false;
  private lastError: string | null = null;
  private lastFailureAt: string | null = null;
  private queueName = process.env.BULLMQ_QUEUE_NAME ?? 'zito-jobs';
  private deadLetterQueue =
    process.env.BULLMQ_DEAD_LETTER_QUEUE ?? 'zito-dead-letter';

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const enabled = this.isEnabled();
    if (!enabled) {
      return;
    }

    try {
      const requireFn = new Function('return require')() as NodeRequire;
      const bullmq = requireFn('bullmq');
      this.packageAvailable = true;

      const redisUrl = process.env.REDIS_URL;
      if (!redisUrl) {
        this.lastError = 'BULLMQ_ENABLED is true but REDIS_URL is not configured.';
        return;
      }

      const parsed = new URL(redisUrl);
      const queueEvents = new bullmq.QueueEvents(this.queueName, {
        connection: {
          host: parsed.hostname,
          port: Number(parsed.port || 6379),
          password: parsed.password || undefined,
        },
      });

      queueEvents.on('failed', async (event: any) => {
        this.lastFailureAt = new Date().toISOString();
        await this.raiseQueueAlert('failed', event);
      });

      queueEvents.on('stalled', async (event: any) => {
        this.lastFailureAt = new Date().toISOString();
        await this.raiseQueueAlert('stalled', event);
      });

      queueEvents.on('error', (error: Error) => {
        this.lastError = error.message;
        this.logger.warn(`BullMQ listener error: ${error.message}`);
      });

      await queueEvents.waitUntilReady();
      this.listenerAttached = true;
      this.lastError = null;
    } catch (error) {
      this.packageAvailable = false;
      this.listenerAttached = false;
      this.lastError =
        error instanceof Error ? error.message : 'BullMQ monitor failed to initialize.';
      this.logger.warn(`BullMQ monitoring unavailable: ${this.lastError}`);
    }
  }

  getSnapshot(redisStatus: string) {
    if (!this.isEnabled()) {
      return {
        status: 'NOT_CONFIGURED',
        enabled: false,
        packageAvailable: this.packageAvailable,
        listenerAttached: this.listenerAttached,
        queueName: this.queueName,
        deadLetterQueue: this.deadLetterQueue,
        lastFailureAt: this.lastFailureAt,
        lastError: this.lastError,
      };
    }

    const status = this.listenerAttached && redisStatus === 'UP' ? 'READY' : 'DEGRADED';
    return {
      status,
      enabled: true,
      packageAvailable: this.packageAvailable,
      listenerAttached: this.listenerAttached,
      queueName: this.queueName,
      deadLetterQueue: this.deadLetterQueue,
      lastFailureAt: this.lastFailureAt,
      lastError: this.lastError,
    };
  }

  private isEnabled() {
    return /^(1|true|yes)$/i.test(process.env.BULLMQ_ENABLED ?? '');
  }

  private async raiseQueueAlert(eventType: string, event: any) {
    const existing = await this.prisma.internalAlert.findFirst({
      where: {
        type: 'QUEUE_FAILURE',
        entityType: 'SYSTEM',
        entityId: this.queueName,
        status: { not: 'RESOLVED' },
      },
      orderBy: { createdAt: 'desc' },
    });

    const metadata = {
      queueName: this.queueName,
      deadLetterQueue: this.deadLetterQueue,
      eventType,
      event,
      detectedAt: new Date().toISOString(),
    } as Prisma.InputJsonValue;

    if (existing) {
      await this.prisma.internalAlert.update({
        where: { id: existing.id },
        data: {
          severity: 'HIGH',
          message: `BullMQ queue ${this.queueName} reported a ${eventType} event.`,
          metadata,
        },
      });
      return;
    }

    await this.prisma.internalAlert.create({
      data: {
        type: 'QUEUE_FAILURE',
        severity: 'HIGH',
        message: `BullMQ queue ${this.queueName} reported a ${eventType} event.`,
        status: 'PENDING',
        entityType: 'SYSTEM',
        entityId: this.queueName,
        metadata,
      },
    });
  }
}
