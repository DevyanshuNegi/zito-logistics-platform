import { Injectable } from '@nestjs/common';

type RequestMetric = {
  timestamp: number;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  failed: boolean;
  correlationId?: string;
  requestId?: string;
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
      correlationId: metric.correlationId ?? null,
      requestId: metric.requestId ?? null,
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

  getPrometheusMetrics(windowMinutes = 60) {
    const snapshot = this.getSnapshot(windowMinutes);
    const lines = [
      '# HELP zito_api_requests_total Total API requests recorded in memory for the selected window.',
      '# TYPE zito_api_requests_total gauge',
      `zito_api_requests_total{window_minutes="${snapshot.windowMinutes}"} ${snapshot.totalRequests}`,
      '# HELP zito_api_failed_requests_total Failed API requests recorded in memory for the selected window.',
      '# TYPE zito_api_failed_requests_total gauge',
      `zito_api_failed_requests_total{window_minutes="${snapshot.windowMinutes}"} ${snapshot.failedRequests}`,
      '# HELP zito_api_failure_rate_percentage API failure percentage for the selected window.',
      '# TYPE zito_api_failure_rate_percentage gauge',
      `zito_api_failure_rate_percentage{window_minutes="${snapshot.windowMinutes}"} ${snapshot.failureRatePercentage}`,
      '# HELP zito_api_average_latency_ms Average API latency in milliseconds for the selected window.',
      '# TYPE zito_api_average_latency_ms gauge',
      `zito_api_average_latency_ms{window_minutes="${snapshot.windowMinutes}"} ${snapshot.averageLatencyMs}`,
      '# HELP zito_process_uptime_seconds Node.js process uptime in seconds.',
      '# TYPE zito_process_uptime_seconds gauge',
      `zito_process_uptime_seconds ${Math.floor(process.uptime())}`,
    ];

    snapshot.topEndpoints.forEach((endpoint, index) => {
      const labels = `endpoint="${this.escapeLabel(endpoint.endpoint)}",rank="${index + 1}"`;
      lines.push(
        `zito_api_endpoint_requests_total{${labels}} ${endpoint.count}`,
        `zito_api_endpoint_failures_total{${labels}} ${endpoint.failures}`,
        `zito_api_endpoint_average_latency_ms{${labels}} ${endpoint.averageDurationMs}`,
      );
    });

    return `${lines.join('\n')}\n`;
  }

  private escapeLabel(value: string) {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  }
}
