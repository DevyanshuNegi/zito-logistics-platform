import { Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

type SlowQueryRecord = {
  query: string;
  durationMs: number;
  target: string;
  timestamp: string;
};

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly slowQueryThresholdMs = Number(
    process.env.PRISMA_SLOW_QUERY_MS ?? 500,
  );
  private totalQueries = 0;
  private totalQueryDurationMs = 0;
  private readonly recentSlowQueries: SlowQueryRecord[] = [];

  constructor() {
    super({
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
  }

  async onModuleInit() {
    await this.$connect();
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
}
