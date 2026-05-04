import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

type SlowQueryRecord = {
  query: string;
  durationMs: number;
  target: string;
  timestamp: string;
};

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly pool?: Pool;
  private readonly slowQueryThresholdMs = Number(
    process.env.PRISMA_SLOW_QUERY_MS ?? 500,
  );
  private readonly connectRetryAttempts = Number(
    process.env.PRISMA_CONNECT_RETRIES ?? 5,
  );
  private readonly connectRetryDelayMs = Number(
    process.env.PRISMA_CONNECT_RETRY_DELAY_MS ?? 2000,
  );
  private totalQueries = 0;
  private totalQueryDurationMs = 0;
  private readonly recentSlowQueries: SlowQueryRecord[] = [];

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    const pool = connectionString
      ? new Pool({ connectionString })
      : undefined;
    const adapter = pool ? new PrismaPg(pool) : undefined;

    super({
      adapter,
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
    });

    this.$on('query' as never, (event: Prisma.QueryEvent) => {
      this.totalQueries += 1;
      this.totalQueryDurationMs += event.duration;

      if (event.duration >= this.slowQueryThresholdMs) {
        this.recentSlowQueries.unshift({
          query: event.query.replace(/\s+/g, ' ').trim().slice(0, 240),
          durationMs: event.duration,
          target: event.target,
          timestamp: new Date().toISOString(),
        });

        if (this.recentSlowQueries.length > 25) {
          this.recentSlowQueries.length = 25;
        }
        }
      });

    this.pool = pool;
  }

  async onModuleInit() {
    await this.connectWithRetry();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool?.end();
  }

  getQueryHealthSnapshot() {
    return {
      totalQueries: this.totalQueries,
      averageDurationMs:
        this.totalQueries > 0
          ? Number((this.totalQueryDurationMs / this.totalQueries).toFixed(2))
          : 0,
      slowQueryThresholdMs: this.slowQueryThresholdMs,
      slowQueryCount: this.recentSlowQueries.length,
      recentSlowQueries: [...this.recentSlowQueries],
    };
  }

  private async connectWithRetry() {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.connectRetryAttempts; attempt += 1) {
      try {
        await this.$connect();

        if (attempt > 1) {
          this.logger.log(
            `Prisma connection recovered on attempt ${attempt}/${this.connectRetryAttempts}.`,
          );
        } else {
          this.logger.log('Prisma connection established.');
        }

        return;
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);

        this.logger.warn(
          `Prisma connect attempt ${attempt}/${this.connectRetryAttempts} failed: ${message}`,
        );

        if (attempt < this.connectRetryAttempts) {
          await this.delay(this.connectRetryDelayMs);
        }
      }
    }

    throw lastError;
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
