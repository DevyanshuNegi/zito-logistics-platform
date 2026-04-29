'use client';

import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Table } from '@/components/ui/Table';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { ApiError, api } from '@/lib/api';
import { compactId, formatDateTime, formatStatus } from '@/lib/format';

type AlertRow = {
  id: string;
  type: string;
  severity: string;
  message: string;
  status: string;
  agencyId?: string | null;
  entityType: string;
  entityId: string;
  createdAt: string;
  subjectLabel: string;
  routeTargets?: string[];
  routedRecipients?: Array<{
    userId: string;
    label: string;
    route: string;
  }>;
  routedAt?: string | null;
  resolvedAt?: string | null;
  resolutionNote?: string | null;
};

type AlertsDashboard = {
  generatedAt: string;
  summary: {
    totalAlerts: number;
    pendingAlerts: number;
    routedAlerts: number;
    resolvedAlerts: number;
    criticalAlerts: number;
    highAlerts: number;
    unroutedAlerts: number;
  };
  alerts: AlertRow[];
  supportedTriggers: string[];
  notes: string[];
};

type TriggerResult = {
  trigger?: string;
  checked?: number;
  raised?: number;
  results?: Record<string, { raised?: number }>;
};

export default function AdminAlertsPage() {
  const [dashboard, setDashboard] = useState<AlertsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadDashboard(nextStatus = statusFilter, nextType = typeFilter) {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (nextStatus) {
        params.set('status', nextStatus);
      }
      if (nextType) {
        params.set('type', nextType);
      }
      const suffix = params.toString() ? `?${params.toString()}` : '';
      const response = await api.get<AlertsDashboard>(`/alerts/dashboard${suffix}`);
      setDashboard(response);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load internal alerts.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function runAction(actionKey: string, request: () => Promise<unknown>, message: string) {
    setRunningAction(actionKey);
    setError(null);
    setSuccess(null);

    try {
      await request();
      setSuccess(message);
      await loadDashboard();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Internal alert action failed.');
    } finally {
      setRunningAction(null);
    }
  }

  async function trigger(type?: string) {
    const actionKey = `trigger:${type ?? 'ALL'}`;
    await runAction(
      actionKey,
      () => api.post<TriggerResult>('/alerts/trigger', type ? { type } : {}),
      `${type ? formatStatus(type) : 'All'} alert triggers completed.`,
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total alerts" value={String(dashboard?.summary.totalAlerts ?? 0)} helper="Current internal alert queue." />
        <StatCard label="Pending" value={String(dashboard?.summary.pendingAlerts ?? 0)} helper="New alerts awaiting routing." tone="warning" />
        <StatCard label="Unrouted" value={String(dashboard?.summary.unroutedAlerts ?? 0)} helper="Alerts with no routed recipients yet." tone="warning" />
        <StatCard label="Routed" value={String(dashboard?.summary.routedAlerts ?? 0)} helper="Alerts already pushed to recipients." tone="info" />
        <StatCard label="Critical" value={String(dashboard?.summary.criticalAlerts ?? 0)} helper="Highest-risk operational alerts." tone="warning" />
        <StatCard label="Resolved" value={String(dashboard?.summary.resolvedAlerts ?? 0)} helper="Closed alert records." tone="success" />
      </div>

      {error ? (
        <Alert title="Alert workflow error" variant="danger">
          {error}
        </Alert>
      ) : null}
      {success ? (
        <Alert title="Alert workflow updated" variant="success">
          {success}
        </Alert>
      ) : null}

      <SurfaceCard
        title="Internal alert controls"
        description="Run the PRD trigger set for missing parcel, payment failure, delay, fraud, low warehouse capacity, and driver offline events."
        actions={
          <div className="text-xs text-slate-400">
            Generated: {dashboard ? formatDateTime(dashboard.generatedAt) : 'Loading...'}
          </div>
        }
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,220px)_minmax(0,220px)_1fr]">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-200">Status</span>
            <select
              className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="ROUTED">Routed</option>
              <option value="RESOLVED">Resolved</option>
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-200">Type</span>
            <input
              className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/70 focus:outline-none"
              placeholder="Filter by type"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
            />
          </label>

          <div className="flex flex-wrap items-end gap-3">
            <Button disabled={loading} onClick={() => void loadDashboard()}>
              Refresh queue
            </Button>
            <Button
              disabled={Boolean(runningAction)}
              variant="secondary"
              onClick={() => void trigger()}
            >
              {runningAction === 'trigger:ALL' ? 'Running all...' : 'Run all triggers'}
            </Button>
            <Button
              disabled={Boolean(runningAction)}
              variant="ghost"
              onClick={() => void trigger('MISSING_PARCEL')}
            >
              Missing parcel
            </Button>
            <Button
              disabled={Boolean(runningAction)}
              variant="ghost"
              onClick={() => void trigger('PAYMENT_FAILURE')}
            >
              Payment failure
            </Button>
            <Button
              disabled={Boolean(runningAction)}
              variant="ghost"
              onClick={() => void trigger('DELAY')}
            >
              Delay
            </Button>
            <Button
              disabled={Boolean(runningAction)}
              variant="ghost"
              onClick={() => void trigger('FRAUD_ALERT')}
            >
              Fraud
            </Button>
            <Button
              disabled={Boolean(runningAction)}
              variant="ghost"
              onClick={() =>
                void runAction(
                  'capacity-alert',
                  () => api.post('/alerts/capacity-alert'),
                  'Low warehouse capacity alerts completed.',
                )
              }
            >
              Capacity
            </Button>
            <Button
              disabled={Boolean(runningAction)}
              variant="ghost"
              onClick={() =>
                void runAction(
                  'driver-offline-alert',
                  () => api.post('/alerts/driver-offline-alert'),
                  'Driver offline alerts completed.',
                )
              }
            >
              Driver offline
            </Button>
            <Button
              disabled={Boolean(runningAction)}
              variant="secondary"
              onClick={() =>
                void runAction(
                  'route-pending',
                  () => api.post('/alerts/route-pending'),
                  'Pending alerts routed.',
                )
              }
            >
              Route pending
            </Button>
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
        title="Internal alerts dashboard"
        description="Review current alerts, inspect routing, and resolve operational incidents once handled."
      >
        {loading ? (
          <Spinner />
        ) : (
          <Table
            emptyMessage="No internal alerts match the current filter."
            rows={dashboard?.alerts ?? []}
            columns={[
              {
                key: 'subject',
                header: 'Subject',
                render: (alert) => (
                  <div>
                    <p className="font-semibold text-white">{alert.subjectLabel}</p>
                    <p className="text-xs text-slate-400">
                      {formatStatus(alert.entityType)} • {compactId(alert.entityId)}
                    </p>
                  </div>
                ),
              },
              {
                key: 'signal',
                header: 'Signal',
                render: (alert) => (
                  <div className="text-xs text-slate-300">
                    <p>{formatStatus(alert.type)}</p>
                    <p>{formatStatus(alert.severity)}</p>
                    <p>{formatStatus(alert.status)}</p>
                  </div>
                ),
              },
              {
                key: 'message',
                header: 'Details',
                render: (alert) => (
                  <div className="max-w-xl text-xs text-slate-300">
                    <p>{alert.message}</p>
                    <p className="mt-2 text-slate-400">
                      Raised {formatDateTime(alert.createdAt)}
                    </p>
                    {alert.resolvedAt ? (
                      <p className="text-slate-400">
                        Resolved {formatDateTime(alert.resolvedAt)}
                      </p>
                    ) : null}
                    {alert.resolutionNote ? (
                      <p className="text-slate-400">Note: {alert.resolutionNote}</p>
                    ) : null}
                  </div>
                ),
              },
              {
                key: 'routing',
                header: 'Routing',
                render: (alert) => (
                  <div className="text-xs text-slate-300">
                    <p>
                      {alert.routeTargets?.length
                        ? alert.routeTargets.join(', ')
                        : 'Not routed yet'}
                    </p>
                    <p>
                      {alert.routedRecipients?.length
                        ? `${alert.routedRecipients.length} recipient(s)`
                        : '0 recipients'}
                    </p>
                    <p>{alert.routedAt ? `Routed ${formatDateTime(alert.routedAt)}` : 'Pending route'}</p>
                  </div>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                render: (alert) => (
                  <div className="flex flex-col gap-2">
                    <Button
                      disabled={Boolean(runningAction)}
                      variant="secondary"
                      onClick={() =>
                        void runAction(
                          `route:${alert.id}`,
                          () => api.post(`/alerts/${alert.id}/route`),
                          'Alert routed successfully.',
                        )
                      }
                    >
                      {runningAction === `route:${alert.id}` ? 'Routing...' : 'Route'}
                    </Button>
                    <Button
                      disabled={Boolean(runningAction) || alert.status === 'RESOLVED'}
                      onClick={() =>
                        void runAction(
                          `resolve:${alert.id}`,
                          () =>
                            api.patch(`/alerts/${alert.id}/resolve`, {
                              note:
                                window.prompt('Optional resolution note') || undefined,
                            }),
                          'Alert resolved successfully.',
                        )
                      }
                    >
                      {runningAction === `resolve:${alert.id}` ? 'Resolving...' : 'Resolve'}
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        )}
      </SurfaceCard>
    </div>
  );
}
