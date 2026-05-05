'use client';

import { FormEvent, useEffect, useState } from 'react';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Table } from '@/components/ui/Table';
import { ApiError, api } from '@/lib/api';
import { formatDateTime, formatStatus } from '@/lib/format';

type SlaConfigRow = {
  serviceType: string;
  assignmentMinutes: number;
  acceptanceMinutes: number;
  pickupMinutes: number;
  deliveryMinutes: number;
  noShowGraceMinutes: number;
};

type SlaDashboard = {
  activeBookings: number;
  breachedBookings: number;
  activeAlerts: {
    total: number;
    byStatus: Record<string, number>;
  };
  bookings: Array<{
    bookingId: string;
    reference: string;
    serviceType: string;
    status: string;
    stage: string | null;
    thresholdMinutes: number;
    startedAt: string | null;
    deadline: string | null;
    active: boolean;
    isBreached: boolean;
    overdueMinutes: number;
    escalationRecommendation: string | null;
    activeAlert?: {
      status?: string | null;
      severity?: string | null;
    } | null;
  }>;
};

type ScanResponse = {
  totalChecked: number;
  breached: number;
  handledNoShows: number;
};

export default function AdminSlaPage() {
  const [config, setConfig] = useState<SlaConfigRow[]>([]);
  const [dashboard, setDashboard] = useState<SlaDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanForm, setScanForm] = useState({
    limit: '50',
    autoHandleNoShow: true,
  });

  async function loadSla() {
    setLoading(true);
    setError(null);

    const responses = await Promise.allSettled([
      api.get<SlaConfigRow[]>('/sla/config'),
      api.get<SlaDashboard>('/sla/dashboard?limit=50'),
    ]);

    const [configResult, dashboardResult] = responses;
    if (configResult.status !== 'fulfilled' || dashboardResult.status !== 'fulfilled') {
      const reason =
        configResult.status === 'rejected'
          ? configResult.reason
          : dashboardResult.status === 'rejected'
            ? dashboardResult.reason
            : null;
      setError(reason instanceof ApiError ? reason.message : 'Unable to load SLA controls.');
      setLoading(false);
      return;
    }

    setConfig(configResult.value);
    setDashboard(dashboardResult.value);
    setLoading(false);
  }

  useEffect(() => {
    void loadSla();
  }, []);

  async function handleScan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setScanLoading(true);
    setScanResult(null);
    setError(null);

    try {
      const result = await api.post<ScanResponse>('/sla/scan-active', {
        limit: Number(scanForm.limit),
        autoHandleNoShow: scanForm.autoHandleNoShow,
      });
      setScanResult(
        `Checked ${result.totalChecked} live bookings, found ${result.breached} breaches, and auto-handled ${result.handledNoShows} no-show cases.`,
      );
      await loadSla();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to scan SLA queue.');
    } finally {
      setScanLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Active SLA bookings"
          value={String(dashboard?.activeBookings ?? 0)}
          helper="Bookings currently running under SLA timers."
          tone="info"
        />
        <StatCard
          label="Breached"
          value={String(dashboard?.breachedBookings ?? 0)}
          helper="Bookings already outside their allowed SLA window."
          tone="warning"
        />
        <StatCard
          label="Open SLA alerts"
          value={String(dashboard?.activeAlerts.total ?? 0)}
          helper="Internal alerts linked to unresolved SLA pressure."
          tone="danger"
        />
        <StatCard
          label="Level 2+"
          value={String((dashboard?.activeAlerts.byStatus.LEVEL_2 ?? 0) + (dashboard?.activeAlerts.byStatus.MANAGER ?? 0) + (dashboard?.activeAlerts.byStatus.SUPER_ADMIN ?? 0))}
          helper="Escalations already above first-line response."
          tone="success"
        />
      </div>

      {error ? (
        <Alert title="SLA control error" variant="danger">
          {error}
        </Alert>
      ) : null}

      {scanResult ? (
        <Alert title="SLA scan complete" variant="success">
          {scanResult}
        </Alert>
      ) : null}

      <SurfaceCard
        title="Breach scan control"
        description="Run a queue-wide breach scan and optionally auto-handle driver no-show stages."
      >
        <form className="grid gap-4 md:grid-cols-3" onSubmit={handleScan}>
          <div>
            <label className="block text-sm font-medium text-slate-200">Scan limit</label>
            <input
              className="mt-2 w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
              type="number"
              min={1}
              max={200}
              value={scanForm.limit}
              onChange={(event) => setScanForm((current) => ({ ...current, limit: event.target.value }))}
            />
          </div>
          <label className="flex items-center gap-3 rounded-2xl border border-slate-700/70 bg-slate-950/50 px-4 py-3 text-sm text-slate-200">
            <input
              checked={scanForm.autoHandleNoShow}
              type="checkbox"
              onChange={(event) =>
                setScanForm((current) => ({ ...current, autoHandleNoShow: event.target.checked }))
              }
            />
            Auto-handle no-show eligible breaches
          </label>
          <div className="flex items-end">
            <Button disabled={scanLoading} type="submit">
              {scanLoading ? 'Scanning...' : 'Run scan'}
            </Button>
          </div>
        </form>
      </SurfaceCard>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SurfaceCard title="SLA config" description="Timer thresholds currently driving automated breach checks.">
          {loading && config.length === 0 ? (
            <div className="flex min-h-[20vh] items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <Table
              rows={config}
              emptyMessage="No SLA configuration is available."
              columns={[
                {
                  key: 'service',
                  header: 'Service',
                  render: (row) => formatStatus(row.serviceType),
                },
                {
                  key: 'windows',
                  header: 'Windows',
                  render: (row) => (
                    <div className="text-xs text-slate-300">
                      <p>Assign: {row.assignmentMinutes}m</p>
                      <p>Accept: {row.acceptanceMinutes}m</p>
                      <p>Pickup: {row.pickupMinutes}m</p>
                    </div>
                  ),
                },
                {
                  key: 'delivery',
                  header: 'Delivery',
                  render: (row) => (
                    <div className="text-xs text-slate-300">
                      <p>Complete: {row.deliveryMinutes}m</p>
                      <p>No-show grace: {row.noShowGraceMinutes}m</p>
                    </div>
                  ),
                },
              ]}
            />
          )}
        </SurfaceCard>

        <SurfaceCard title="Live SLA queue" description="Bookings currently tracked by the SLA engine, ordered for operational review.">
          {loading && !dashboard ? (
            <div className="flex min-h-[20vh] items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <Table
              rows={dashboard?.bookings ?? []}
              emptyMessage="No live SLA bookings are active right now."
              columns={[
                {
                  key: 'booking',
                  header: 'Booking',
                  render: (row) => (
                    <div>
                      <p className="font-semibold text-white">{row.reference}</p>
                      <p className="text-xs text-slate-400">
                        {formatStatus(row.serviceType)} / {formatStatus(row.status)}
                      </p>
                    </div>
                  ),
                },
                {
                  key: 'stage',
                  header: 'Stage',
                  render: (row) => (
                    <div className="text-xs text-slate-300">
                      <p>{row.stage ? formatStatus(row.stage) : 'Inactive'}</p>
                      <p>{row.thresholdMinutes} min threshold</p>
                    </div>
                  ),
                },
                {
                  key: 'timing',
                  header: 'Timing',
                  render: (row) => (
                    <div className="text-xs text-slate-300">
                      <p>Started: {row.startedAt ? formatDateTime(row.startedAt) : 'N/A'}</p>
                      <p>Deadline: {row.deadline ? formatDateTime(row.deadline) : 'N/A'}</p>
                    </div>
                  ),
                },
                {
                  key: 'escalation',
                  header: 'Escalation',
                  render: (row) => (
                    <div className="text-xs text-slate-300">
                      <p>{row.isBreached ? `${row.overdueMinutes} min overdue` : 'Within window'}</p>
                      <p>
                        {row.escalationRecommendation
                          ? formatStatus(row.escalationRecommendation)
                          : 'No escalation'}
                      </p>
                      <p>
                        Alert: {row.activeAlert?.status ? formatStatus(row.activeAlert.status) : 'None'}
                      </p>
                    </div>
                  ),
                },
              ]}
            />
          )}
        </SurfaceCard>
      </div>
    </div>
  );
}
