'use client';

import { useEffect, useState } from 'react';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Table } from '@/components/ui/Table';
import { ApiError, api } from '@/lib/api';
import { formatDateTime, formatStatus } from '@/lib/format';

type SystemHealthDashboard = {
  generatedAt: string;
  summary: {
    uptimeSeconds: number;
    apiFailureRatePercentage: number;
    averageApiLatencyMs: number;
    slowQueryCount: number;
    databaseStatus: string;
    redisStatus: string;
    queueStatus: string;
    openHealthAlerts: number;
  };
  api: {
    windowMinutes: number;
    totalRequests: number;
    failedRequests: number;
    failureRatePercentage: number;
    averageLatencyMs: number;
    topEndpoints: Array<{
      endpoint: string;
      count: number;
      failures: number;
      averageDurationMs: number;
    }>;
    recentFailures: Array<{
      method: string;
      path: string;
      statusCode: number;
      durationMs: number;
      timestamp: string;
    }>;
  };
  database: {
    status: string;
    latencyMs: number | null;
    error?: string;
    totalQueries: number;
    averageDurationMs: number;
    slowQueryThresholdMs: number;
    slowQueryCount: number;
    recentSlowQueries: Array<{
      query: string;
      durationMs: number;
      target: string;
      timestamp: string;
    }>;
  };
  redis: {
    status: string;
    latencyMs: number | null;
    host: string | null;
    port: number | null;
    error?: string;
  };
  queue: {
    status: string;
    enabled: boolean;
    deadLetterQueue: string;
  };
  telemetry: {
    status: string;
    sentryConfigured: boolean;
    datadogConfigured: boolean;
  };
  notes: string[];
};

function formatUptime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

export default function AdminSystemHealthPage() {
  const [dashboard, setDashboard] = useState<SystemHealthDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningChecks, setRunningChecks] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadDashboard() {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get<SystemHealthDashboard>('/system-health/dashboard');
      setDashboard(response);
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Unable to load system health.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function runChecks() {
    setRunningChecks(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await api.post<{ raised: number }>('/system-health/run-checks');
      setSuccess(
        `System health checks completed. ${response.raised} alert${response.raised === 1 ? '' : 's'} raised or refreshed.`,
      );
      await loadDashboard();
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Unable to run system health checks.',
      );
    } finally {
      setRunningChecks(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Uptime"
          value={dashboard ? formatUptime(dashboard.summary.uptimeSeconds) : '0h 0m'}
          helper="Current backend runtime uptime."
        />
        <StatCard
          label="API failure rate"
          value={`${dashboard?.summary.apiFailureRatePercentage ?? 0}%`}
          helper="Rolling 60-minute failure percentage."
          tone={(dashboard?.summary.apiFailureRatePercentage ?? 0) > 0 ? 'warning' : 'success'}
        />
        <StatCard
          label="DB slow queries"
          value={String(dashboard?.summary.slowQueryCount ?? 0)}
          helper="Recent queries over the configured slow-query threshold."
          tone={(dashboard?.summary.slowQueryCount ?? 0) > 0 ? 'warning' : 'success'}
        />
        <StatCard
          label="Open health alerts"
          value={String(dashboard?.summary.openHealthAlerts ?? 0)}
          helper="Outstanding system-health internal alerts."
          tone={(dashboard?.summary.openHealthAlerts ?? 0) > 0 ? 'warning' : 'info'}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Database"
          value={formatStatus(dashboard?.summary.databaseStatus ?? 'unknown')}
          helper="Primary database reachability check."
        />
        <StatCard
          label="Redis"
          value={formatStatus(dashboard?.summary.redisStatus ?? 'unknown')}
          helper="Redis connectivity and latency check."
        />
        <StatCard
          label="Queue"
          value={formatStatus(dashboard?.summary.queueStatus ?? 'unknown')}
          helper="BullMQ readiness and dead-letter posture."
        />
        <StatCard
          label="Latency"
          value={`${dashboard?.summary.averageApiLatencyMs ?? 0} ms`}
          helper="Average latency for tracked API requests."
        />
      </div>

      {error ? (
        <Alert title="System health error" variant="danger">
          {error}
        </Alert>
      ) : null}
      {success ? (
        <Alert title="System health updated" variant="success">
          {success}
        </Alert>
      ) : null}

      <SurfaceCard
        title="System monitoring controls"
        description="Review API failure rates, database query performance, Redis availability, queue readiness, and vendor telemetry configuration."
        actions={
          <div className="flex gap-3">
            <Button disabled={loading} onClick={() => void loadDashboard()}>
              Refresh dashboard
            </Button>
            <Button disabled={runningChecks} variant="secondary" onClick={() => void runChecks()}>
              {runningChecks ? 'Running checks...' : 'Run health checks'}
            </Button>
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-800/70 bg-slate-950/50 p-4 text-sm text-slate-300">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Database</p>
            <p className="mt-3 text-white">
              {formatStatus(dashboard?.database.status ?? 'unknown')}
            </p>
            <p className="mt-1 text-slate-400">
              Latency: {dashboard?.database.latencyMs ?? 'N/A'} ms
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800/70 bg-slate-950/50 p-4 text-sm text-slate-300">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Redis</p>
            <p className="mt-3 text-white">
              {formatStatus(dashboard?.redis.status ?? 'unknown')}
            </p>
            <p className="mt-1 text-slate-400">
              Host: {dashboard?.redis.host ?? 'Not configured'}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800/70 bg-slate-950/50 p-4 text-sm text-slate-300">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Queue</p>
            <p className="mt-3 text-white">
              {formatStatus(dashboard?.queue.status ?? 'unknown')}
            </p>
            <p className="mt-1 text-slate-400">
              DLQ: {dashboard?.queue.deadLetterQueue ?? 'N/A'}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800/70 bg-slate-950/50 p-4 text-sm text-slate-300">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Telemetry</p>
            <p className="mt-3 text-white">
              {formatStatus(dashboard?.telemetry.status ?? 'unknown')}
            </p>
            <p className="mt-1 text-slate-400">
              Sentry {dashboard?.telemetry.sentryConfigured ? 'ready' : 'off'} | Datadog{' '}
              {dashboard?.telemetry.datadogConfigured ? 'ready' : 'off'}
            </p>
          </div>
        </div>

        {dashboard?.notes?.length ? (
          <div className="mt-4 space-y-3">
            {dashboard.notes.map((note) => (
              <Alert key={note} title="Implementation note" variant="info">
                {note}
              </Alert>
            ))}
          </div>
        ) : null}
      </SurfaceCard>

      <SurfaceCard
        title="API failure hot spots"
        description="Recent failure events and endpoints with the highest failure counts."
      >
        {loading ? (
          <Spinner />
        ) : (
          <div className="grid gap-6 xl:grid-cols-2">
            <Table
              emptyMessage="No recent API failures recorded."
              rows={dashboard?.api.recentFailures ?? []}
              columns={[
                {
                  key: 'endpoint',
                  header: 'Request',
                  render: (item) => (
                    <div className="text-xs text-slate-300">
                      <p className="font-semibold text-white">
                        {item.method} {item.path}
                      </p>
                      <p>Status {item.statusCode}</p>
                    </div>
                  ),
                },
                {
                  key: 'duration',
                  header: 'Latency',
                  render: (item) => `${item.durationMs} ms`,
                },
                {
                  key: 'time',
                  header: 'Raised',
                  render: (item) => formatDateTime(item.timestamp),
                },
              ]}
            />

            <Table
              emptyMessage="No endpoint metrics recorded yet."
              rows={dashboard?.api.topEndpoints ?? []}
              columns={[
                {
                  key: 'endpoint',
                  header: 'Endpoint',
                  render: (item) => item.endpoint,
                },
                {
                  key: 'count',
                  header: 'Requests',
                  render: (item) => String(item.count),
                },
                {
                  key: 'failures',
                  header: 'Failures',
                  render: (item) => String(item.failures),
                },
                {
                  key: 'latency',
                  header: 'Avg latency',
                  render: (item) => `${item.averageDurationMs} ms`,
                },
              ]}
            />
          </div>
        )}
      </SurfaceCard>

      <SurfaceCard
        title="Database query watch"
        description="Recent slow queries captured by Prisma event logging."
      >
        {loading ? (
          <Spinner />
        ) : (
          <Table
            emptyMessage="No slow queries have crossed the current threshold."
            rows={dashboard?.database.recentSlowQueries ?? []}
            columns={[
              {
                key: 'query',
                header: 'Query',
                render: (item) => (
                  <div className="max-w-2xl whitespace-pre-wrap break-words text-xs text-slate-300">
                    {item.query}
                  </div>
                ),
              },
              {
                key: 'duration',
                header: 'Duration',
                render: (item) => `${item.durationMs} ms`,
              },
              {
                key: 'target',
                header: 'Target',
                render: (item) => item.target || 'default',
              },
              {
                key: 'timestamp',
                header: 'Observed',
                render: (item) => formatDateTime(item.timestamp),
              },
            ]}
          />
        )}
      </SurfaceCard>
    </div>
  );
}
