import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as net from 'net';
import { TelemetryService } from '../../common/monitoring/telemetry.service';
import { RequestMetricsService } from '../../common/monitoring/request-metrics.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BullmqMonitorService } from './bullmq-monitor.service';

@Injectable()
export class SystemHealthService {
  private readonly apiFailureThreshold = Number(
    process.env.SYSTEM_HEALTH_API_FAILURE_RATE ?? 5,
  );
  private readonly slowQueryAlertThreshold = Number(
    process.env.SYSTEM_HEALTH_SLOW_QUERY_COUNT ?? 5,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly requestMetricsService: RequestMetricsService,
    private readonly telemetryService: TelemetryService,
    private readonly bullmqMonitorService: BullmqMonitorService,
  ) {}

  async health() {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    return {
      status:
        database.status === 'UP' && redis.status !== 'DOWN' ? 'OK' : 'DEGRADED',
      checkedAt: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      database,
      redis,
    };
  }

  async dashboard() {
    const [database, redis, openHealthAlerts] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.prisma.internalAlert.count({
        where: {
          type: {
            in: [
              'API_FAILURE_RATE',
              'DATABASE_DOWN',
              'DATABASE_SLOW_QUERY',
              'REDIS_DOWN',
              'QUEUE_FAILURE',
            ],
          },
          status: { not: 'RESOLVED' },
        },
      }),
    ]);

    const api = this.requestMetricsService.getSnapshot(60);
    const query = this.prisma.getQueryHealthSnapshot();
    const telemetry = this.getTelemetryStatus();
    const queue = this.bullmqMonitorService.getSnapshot(redis.status);

    return {
      generatedAt: new Date().toISOString(),
      summary: {
        uptimeSeconds: Math.floor(process.uptime()),
        apiFailureRatePercentage: api.failureRatePercentage,
        averageApiLatencyMs: api.averageLatencyMs,
        slowQueryCount: query.slowQueryCount,
        databaseStatus: database.status,
        redisStatus: redis.status,
        queueStatus: queue.status,
        openHealthAlerts,
      },
      api,
      database: {
        ...database,
        ...query,
      },
      redis,
      queue,
      telemetry,
      observability: this.getObservabilityStatus(),
      notes: [
        'API failure-rate monitoring is live from in-process request metrics and raises internal alerts when the hourly failure percentage breaches the configured threshold.',
        'Database performance monitoring is live through Prisma query-event logging and recent slow-query capture.',
        'Prometheus-compatible metrics are available to authorized admins from the system-health metrics endpoint.',
        queue.enabled
          ? queue.listenerAttached
            ? 'BullMQ dead-letter monitoring is active through queue event listeners and internal-alert creation.'
            : 'BullMQ monitoring is enabled but the listener is not attached yet; check queue package availability and Redis connectivity.'
          : 'BullMQ monitoring is disabled until BULLMQ_ENABLED is set in the environment.',
        telemetry.status === 'NOT_CONFIGURED'
          ? 'Sentry and Datadog forwarding are disabled until SENTRY_DSN or DATADOG_API_KEY is configured.'
          : 'Vendor telemetry forwarding is active for runtime exceptions and system-health escalation events.',
      ],
    };
  }

  metrics() {
    return this.requestMetricsService.getPrometheusMetrics(60);
  }

  async runChecks() {
    const dashboard = await this.dashboard();
    const alerts = [];

    if (dashboard.api.failureRatePercentage >= this.apiFailureThreshold) {
      alerts.push(
        await this.upsertAlert({
          type: 'API_FAILURE_RATE',
          severity:
            dashboard.api.failureRatePercentage >= this.apiFailureThreshold * 2
              ? 'CRITICAL'
              : 'HIGH',
          message: `API failure rate is ${dashboard.api.failureRatePercentage}% in the last ${dashboard.api.windowMinutes} minute(s).`,
          entityId: 'api',
          metadata: {
            failureRatePercentage: dashboard.api.failureRatePercentage,
            failedRequests: dashboard.api.failedRequests,
            totalRequests: dashboard.api.totalRequests,
            threshold: this.apiFailureThreshold,
          },
        }),
      );
    }

    if (dashboard.database.status === 'DOWN') {
      alerts.push(
        await this.upsertAlert({
          type: 'DATABASE_DOWN',
          severity: 'CRITICAL',
          message: 'Primary database health check failed.',
          entityId: 'database',
          metadata: {
            latencyMs: dashboard.database.latencyMs,
            error: dashboard.database.error ?? null,
          },
        }),
      );
    }

    if (dashboard.database.slowQueryCount >= this.slowQueryAlertThreshold) {
      alerts.push(
        await this.upsertAlert({
          type: 'DATABASE_SLOW_QUERY',
          severity:
            dashboard.database.slowQueryCount >= this.slowQueryAlertThreshold * 2
              ? 'CRITICAL'
              : 'HIGH',
          message: `${dashboard.database.slowQueryCount} slow queries were recorded at or above ${dashboard.database.slowQueryThresholdMs}ms.`,
          entityId: 'database',
          metadata: {
            slowQueryCount: dashboard.database.slowQueryCount,
            slowQueryThresholdMs: dashboard.database.slowQueryThresholdMs,
            recentSlowQueries: dashboard.database.recentSlowQueries,
          },
        }),
      );
    }

    if (dashboard.redis.status === 'DOWN') {
      alerts.push(
        await this.upsertAlert({
          type: 'REDIS_DOWN',
          severity: 'CRITICAL',
          message: 'Redis health check failed.',
          entityId: 'redis',
          metadata: {
            error: dashboard.redis.error ?? null,
            host: dashboard.redis.host ?? null,
            port: dashboard.redis.port ?? null,
          },
        }),
      );
    }

    if (dashboard.queue.enabled && dashboard.queue.status !== 'READY') {
      alerts.push(
        await this.upsertAlert({
          type: 'QUEUE_FAILURE',
          severity: 'HIGH',
          message: 'Queue health is degraded; BullMQ listeners are not fully ready.',
          entityId: dashboard.queue.queueName,
          metadata: {
            queueStatus: dashboard.queue.status,
            packageAvailable: dashboard.queue.packageAvailable,
            listenerAttached: dashboard.queue.listenerAttached,
            deadLetterQueue: dashboard.queue.deadLetterQueue,
            lastError: dashboard.queue.lastError,
          },
        }),
      );
    }

    if (alerts.length > 0) {
      await this.telemetryService.captureEvent({
        title: 'System health alerts raised',
        message: `${alerts.length} system-health alert(s) were raised or refreshed.`,
        level: alerts.some((alert) => alert.severity === 'CRITICAL') ? 'error' : 'warning',
        source: 'system-health-service',
        tags: ['system-health', 'internal-alert'],
        payload: {
          alertTypes: alerts.map((alert) => alert.type),
          checkedAt: dashboard.generatedAt,
        },
      });
    }

    return {
      checkedAt: dashboard.generatedAt,
      raised: alerts.length,
      alerts,
    };
  }

  private async checkDatabase() {
    const startedAt = Date.now();

    try {
      await this.prisma.$queryRaw(Prisma.sql`SELECT 1`);
      return {
        status: 'UP',
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      return {
        status: 'DOWN',
        latencyMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : 'Unknown database error',
      };
    }
  }

  private async checkRedis() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      return {
        status: 'NOT_CONFIGURED',
        latencyMs: null,
        host: null,
        port: null,
      };
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(redisUrl);
    } catch {
      return {
        status: 'DOWN',
        latencyMs: null,
        host: null,
        port: null,
        error: 'REDIS_URL is not a valid URL.',
      };
    }

    const host = parsedUrl.hostname;
    const port = Number(parsedUrl.port || 6379);
    const startedAt = Date.now();

    return new Promise<{
      status: string;
      latencyMs: number | null;
      host: string | null;
      port: number | null;
      error?: string;
    }>((resolve) => {
      const socket = net.createConnection({ host, port });
      const finish = (payload: {
        status: string;
        latencyMs: number | null;
        host: string | null;
        port: number | null;
        error?: string;
      }) => {
        socket.destroy();
        resolve(payload);
      };

      socket.setTimeout(1500);
      socket.once('connect', () =>
        finish({
          status: 'UP',
          latencyMs: Date.now() - startedAt,
          host,
          port,
        }),
      );
      socket.once('timeout', () =>
        finish({
          status: 'DOWN',
          latencyMs: Date.now() - startedAt,
          host,
          port,
          error: 'Redis connection timed out.',
        }),
      );
      socket.once('error', (error) =>
        finish({
          status: 'DOWN',
          latencyMs: Date.now() - startedAt,
          host,
          port,
          error: error.message,
        }),
      );
    });
  }

  private getTelemetryStatus() {
    const sentryConfigured = Boolean(process.env.SENTRY_DSN);
    const datadogConfigured = Boolean(
      process.env.DATADOG_API_KEY || process.env.DD_API_KEY,
    );

    return {
      status:
        sentryConfigured || datadogConfigured ? 'READY' : 'NOT_CONFIGURED',
      sentryConfigured,
      datadogConfigured,
    };
  }

  private getObservabilityStatus() {
    return {
      correlationHeaders: ['X-Correlation-Id', 'X-Request-Id', 'X-Tenant-Id'],
      prometheusMetrics: 'READY',
      errorTracking:
        process.env.SENTRY_DSN || process.env.DATADOG_API_KEY || process.env.DD_API_KEY
          ? 'READY'
          : 'NOT_CONFIGURED',
      distributedTracing: process.env.OTEL_EXPORTER_OTLP_ENDPOINT
        ? 'READY'
        : 'NOT_CONFIGURED',
      logAggregation: process.env.LOG_AGGREGATION_ENABLED === 'true'
        ? 'READY'
        : 'NOT_CONFIGURED',
    };
  }

  private async upsertAlert(input: {
    type: string;
    severity: string;
    message: string;
    entityId: string;
    metadata: Record<string, unknown>;
  }) {
    const existing = await this.prisma.internalAlert.findFirst({
      where: {
        type: input.type,
        entityType: 'SYSTEM',
        entityId: input.entityId,
        status: { not: 'RESOLVED' },
      },
      orderBy: { createdAt: 'desc' },
    });

    const existingMetadata =
      existing?.metadata &&
      typeof existing.metadata === 'object' &&
      !Array.isArray(existing.metadata)
        ? (existing.metadata as Record<string, unknown>)
        : {};

    if (existing) {
      return this.prisma.internalAlert.update({
        where: { id: existing.id },
        data: {
          severity: input.severity,
          message: input.message,
          metadata: {
            ...existingMetadata,
            ...input.metadata,
            checkedAt: new Date().toISOString(),
            detector: 'system-health-service',
          } as Prisma.InputJsonValue,
        },
      });
    }

    return this.prisma.internalAlert.create({
      data: {
        type: input.type,
        severity: input.severity,
        message: input.message,
        status: 'PENDING',
        entityType: 'SYSTEM',
        entityId: input.entityId,
        metadata: {
          ...input.metadata,
          checkedAt: new Date().toISOString(),
          detector: 'system-health-service',
        } as Prisma.InputJsonValue,
      },
    });
  }
}
