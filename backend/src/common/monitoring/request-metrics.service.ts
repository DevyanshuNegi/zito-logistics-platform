import { Injectable } from '@nestjs/common';

type RequestMetric = {
  timestamp: number;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  failed: boolean;
};

@Injectable()
export class RequestMetricsService {
  private readonly maxRecords = 1000;
  private readonly metrics: RequestMetric[] = [];

  record(metric: Omit<RequestMetric, 'timestamp'>) {
    this.metrics.unshift({
      ...metric,
      timestamp: Date.now(),
    });

    if (this.metrics.length > this.maxRecords) {
      this.metrics.length = this.maxRecords;
    }
  }

  getSnapshot(windowMinutes = 60) {
    const cutoff = Date.now() - windowMinutes * 60 * 1000;
    const records = this.metrics.filter((metric) => metric.timestamp >= cutoff);
    const failed = records.filter((metric) => metric.failed);

    const averageLatencyMs =
      records.length > 0
        ? Number(
            (
              records.reduce((sum, metric) => sum + metric.durationMs, 0) /
              records.length
            ).toFixed(2),
          )
        : 0;

    const endpointMap = new Map<
      string,
      { count: number; failures: number; totalDurationMs: number }
    >();

    for (const record of records) {
      const key = `${record.method} ${record.path}`;
      const current = endpointMap.get(key) ?? {
        count: 0,
        failures: 0,
        totalDurationMs: 0,
      };

      current.count += 1;
      current.failures += record.failed ? 1 : 0;
      current.totalDurationMs += record.durationMs;
      endpointMap.set(key, current);
    }

    const topEndpoints = [...endpointMap.entries()]
      .map(([endpoint, value]) => ({
        endpoint,
        count: value.count,
        failures: value.failures,
        averageDurationMs: Number((value.totalDurationMs / value.count).toFixed(2)),
      }))
      .sort((left, right) => right.failures - left.failures || right.count - left.count)
      .slice(0, 8);

    const recentFailures = failed.slice(0, 10).map((metric) => ({
      method: metric.method,
      path: metric.path,
      statusCode: metric.statusCode,
      durationMs: metric.durationMs,
      timestamp: new Date(metric.timestamp).toISOString(),
    }));

    return {
      windowMinutes,
      totalRequests: records.length,
      failedRequests: failed.length,
      failureRatePercentage:
        records.length > 0
          ? Number(((failed.length / records.length) * 100).toFixed(2))
          : 0,
      averageLatencyMs,
      topEndpoints,
      recentFailures,
    };
  }
}
