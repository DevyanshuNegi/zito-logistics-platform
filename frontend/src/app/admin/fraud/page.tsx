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

type FraudFlag = {
  id: string;
  entityType: string;
  entityId: string;
  type: string;
  description: string;
  severity: string;
  status: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  subjectLabel: string;
  subjectStatus: string | null;
  reviewerLabel: string | null;
};

type FraudDashboard = {
  generatedAt: string;
  summary: {
    totalFlags: number;
    openFlags: number;
    confirmedFlags: number;
    suspendedFlags: number;
    criticalFlags: number;
    gpsSpoofCount: number;
    ghostTripCount: number;
    duplicateBookingCount: number;
    routeAnomalyCount: number;
  };
  flags: FraudFlag[];
  notes: string[];
};

type DetectorResult = {
  detector?: string;
  flaggedCount?: number;
};

export default function AdminFraudPage() {
  const [dashboard, setDashboard] = useState<FraudDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadDashboard(nextStatus = statusFilter) {
    setLoading(true);
    setError(null);

    try {
      const query = nextStatus ? `?status=${encodeURIComponent(nextStatus)}` : '';
      const response = await api.get<FraudDashboard>(`/fraud/dashboard${query}`);
      setDashboard(response);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load fraud dashboard.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function runDetector(path: string, successPrefix: string) {
    setRunningAction(path);
    setError(null);
    setSuccess(null);

    try {
      const response = await api.post<DetectorResult & { flaggedCount?: number }>(path);
      const count = response.flaggedCount ?? 0;
      setSuccess(`${successPrefix} ${count} flag${count === 1 ? '' : 's'} raised or refreshed.`);
      await loadDashboard();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Fraud detection action failed.');
    } finally {
      setRunningAction(null);
    }
  }

  async function reviewFlag(flagId: string, status: 'CONFIRMED' | 'FALSE_POSITIVE') {
    setRunningAction(flagId);
    setError(null);
    setSuccess(null);

    try {
      await api.patch(`/fraud/${flagId}/review`, { status });
      setSuccess(`Flag marked as ${formatStatus(status)}.`);
      await loadDashboard();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to review fraud flag.');
    } finally {
      setRunningAction(null);
    }
  }

  async function suspendAccount(flagId: string) {
    setRunningAction(`suspend:${flagId}`);
    setError(null);
    setSuccess(null);

    try {
      await api.patch(`/fraud/${flagId}/suspend`);
      setSuccess('Associated account suspended from fraud dashboard.');
      await loadDashboard();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to suspend account.');
    } finally {
      setRunningAction(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Open flags" value={String(dashboard?.summary.openFlags ?? 0)} helper="Flags still waiting for admin action." tone="warning" />
        <StatCard label="Critical flags" value={String(dashboard?.summary.criticalFlags ?? 0)} helper="Highest-severity fraud signals." tone="warning" />
        <StatCard label="Confirmed" value={String(dashboard?.summary.confirmedFlags ?? 0)} helper="Flags reviewed and confirmed by admin." tone="info" />
        <StatCard label="Suspended" value={String(dashboard?.summary.suspendedFlags ?? 0)} helper="Flags that already led to account suspension." tone="success" />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="GPS spoof" value={String(dashboard?.summary.gpsSpoofCount ?? 0)} helper="Driver-vs-vehicle GPS divergence signals." />
        <StatCard label="Ghost trips" value={String(dashboard?.summary.ghostTripCount ?? 0)} helper="Trips with no supporting scan activity." />
        <StatCard label="Duplicates" value={String(dashboard?.summary.duplicateBookingCount ?? 0)} helper="Idempotency-aware duplicate booking clusters." />
        <StatCard label="Route anomalies" value={String(dashboard?.summary.routeAnomalyCount ?? 0)} helper="Drivers deviating from the stop corridor." />
      </div>

      {error ? (
        <Alert title="Fraud workflow error" variant="danger">
          {error}
        </Alert>
      ) : null}
      {success ? (
        <Alert title="Fraud workflow updated" variant="success">
          {success}
        </Alert>
      ) : null}

      <SurfaceCard
        title="Fraud controls"
        description="Run the PRD detectors for GPS spoofing, ghost trips, duplicate bookings, and route deviation, then review or suspend directly from this queue."
        actions={
          <div className="text-xs text-slate-400">
            Generated: {dashboard ? formatDateTime(dashboard.generatedAt) : 'Loading...'}
          </div>
        }
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,220px)_1fr]">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-200">Flag status</span>
            <select
              className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">All statuses</option>
              <option value="OPEN">Open</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="FALSE_POSITIVE">False positive</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </label>

          <div className="flex flex-wrap items-end gap-3">
            <Button disabled={loading} onClick={() => void loadDashboard()}>
              Refresh queue
            </Button>
            <Button
              disabled={Boolean(runningAction)}
              variant="secondary"
              onClick={() => void runDetector('/fraud/detect/all', 'All detectors completed.')}
            >
              {runningAction === '/fraud/detect/all' ? 'Running all detectors...' : 'Run all detectors'}
            </Button>
            <Button
              disabled={Boolean(runningAction)}
              variant="ghost"
              onClick={() => void runDetector('/fraud/detect/gps-spoof', 'GPS spoof detector completed.')}
            >
              GPS spoof
            </Button>
            <Button
              disabled={Boolean(runningAction)}
              variant="ghost"
              onClick={() => void runDetector('/fraud/detect/ghost-trip', 'Ghost-trip detector completed.')}
            >
              Ghost trips
            </Button>
            <Button
              disabled={Boolean(runningAction)}
              variant="ghost"
              onClick={() => void runDetector('/fraud/detect/duplicate', 'Duplicate-booking detector completed.')}
            >
              Duplicates
            </Button>
            <Button
              disabled={Boolean(runningAction)}
              variant="ghost"
              onClick={() => void runDetector('/fraud/detect/route-anomaly', 'Route-anomaly detector completed.')}
            >
              Route anomalies
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

      <SurfaceCard title="Fraud review queue" description="Review flagged entities, confirm or dismiss them, and suspend high-risk accounts when needed.">
        {loading ? (
          <Spinner />
        ) : (
          <Table
            emptyMessage="No fraud flags match the current filter."
            rows={dashboard?.flags ?? []}
            columns={[
              {
                key: 'entity',
                header: 'Subject',
                render: (flag) => (
                  <div>
                    <p className="font-semibold text-white">{flag.subjectLabel}</p>
                    <p className="text-xs text-slate-400">
                      {formatStatus(flag.entityType)} • {compactId(flag.entityId)}
                    </p>
                  </div>
                ),
              },
              {
                key: 'signal',
                header: 'Signal',
                render: (flag) => (
                  <div className="text-xs text-slate-300">
                    <p>{formatStatus(flag.type)}</p>
                    <p>{formatStatus(flag.severity)}</p>
                    <p>{formatStatus(flag.status)}</p>
                  </div>
                ),
              },
              {
                key: 'description',
                header: 'Details',
                render: (flag) => (
                  <div className="max-w-xl text-xs text-slate-300">
                    <p>{flag.description}</p>
                    <p className="mt-2 text-slate-400">
                      Raised {formatDateTime(flag.createdAt)}
                    </p>
                    {flag.reviewerLabel ? (
                      <p className="text-slate-400">
                        Reviewed by {flag.reviewerLabel} {flag.reviewedAt ? `on ${formatDateTime(flag.reviewedAt)}` : ''}
                      </p>
                    ) : null}
                  </div>
                ),
              },
              {
                key: 'subjectStatus',
                header: 'Account',
                render: (flag) => (
                  <div className="text-xs text-slate-300">
                    <p>{flag.subjectStatus ? formatStatus(flag.subjectStatus) : 'Unknown'}</p>
                    <p>{formatStatus(flag.entityType)}</p>
                  </div>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                render: (flag) => (
                  <div className="flex flex-col gap-2">
                    <Button
                      disabled={Boolean(runningAction)}
                      variant="secondary"
                      onClick={() => void reviewFlag(flag.id, 'CONFIRMED')}
                    >
                      {runningAction === flag.id ? 'Saving...' : 'Confirm'}
                    </Button>
                    <Button
                      disabled={Boolean(runningAction)}
                      variant="ghost"
                      onClick={() => void reviewFlag(flag.id, 'FALSE_POSITIVE')}
                    >
                      False positive
                    </Button>
                    <Button
                      disabled={Boolean(runningAction) || flag.status === 'SUSPENDED'}
                      onClick={() => void suspendAccount(flag.id)}
                    >
                      {runningAction === `suspend:${flag.id}` ? 'Suspending...' : 'Suspend account'}
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
