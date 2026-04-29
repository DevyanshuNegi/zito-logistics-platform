'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Table } from '@/components/ui/Table';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { useAuth } from '@/hooks/useAuth';
import { ApiError, api } from '@/lib/api';
import { compactId, formatMoney, formatStatus } from '@/lib/format';
import { hasAnyRole } from '@/lib/roles';

type LossReport = {
  id: string;
  bookingId: string;
  type: string;
  description: string;
  estimatedValue: number;
  status: string;
  isHighValue: boolean;
  requiresDualApproval: boolean;
  resolutionNotes?: string | null;
  booking?: {
    reference?: string | null;
  } | null;
  item?: {
    parcelId?: string | null;
  } | null;
};

type LossReportResponse = {
  items: LossReport[];
  total: number;
  page: number;
  limit: number;
};

type LossDetectionWorkspaceProps = {
  title: string;
  description: string;
};

const CHECKPOINT_OPTIONS = [
  'PICKUP',
  'WAREHOUSE_ENTRY',
  'STORAGE',
  'DISPATCH',
  'DELIVERY',
  'VEHICLE_LOAD',
  'VEHICLE_UNLOAD',
];

export function LossDetectionWorkspace({
  title,
  description,
}: LossDetectionWorkspaceProps) {
  const { user } = useAuth();
  const [reports, setReports] = useState<LossReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState('');
  const [itemId, setItemId] = useState('');
  const [type, setType] = useState('LOSS');
  const [descriptionValue, setDescriptionValue] = useState('');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [evidenceUrls, setEvidenceUrls] = useState('');
  const [mismatchBookingId, setMismatchBookingId] = useState('');
  const [expectedCount, setExpectedCount] = useState('');
  const [scannedCount, setScannedCount] = useState('');
  const [checkpoint, setCheckpoint] = useState('WAREHOUSE_ENTRY');
  const [slaHours, setSlaHours] = useState('48');
  const [approvalNotes, setApprovalNotes] = useState<Record<string, string>>({});

  const canApprove = hasAnyRole(user?.role, ['ADMIN', 'SUPER_ADMIN']);

  async function loadReports() {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get<LossReportResponse>('/loss-detection');
      setReports(response.items);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Unable to load loss reports.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReports();
  }, []);

  async function handleCreateReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await api.post('/loss-detection', {
        bookingId,
        itemId: itemId || undefined,
        type,
        description: descriptionValue,
        estimatedValue: Number(estimatedValue),
        evidenceUrls: evidenceUrls
          .split('\n')
          .map((value) => value.trim())
          .filter(Boolean),
      });

      setBookingId('');
      setItemId('');
      setType('LOSS');
      setDescriptionValue('');
      setEstimatedValue('');
      setEvidenceUrls('');
      setSuccess('Loss report created.');
      await loadReports();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Unable to create loss report.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleMismatchCheck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await api.post<{ matched?: boolean; id?: string }>(
        '/loss-detection/mismatch',
        {
          bookingId: mismatchBookingId,
          expectedCount: expectedCount ? Number(expectedCount) : undefined,
          scannedCount: scannedCount ? Number(scannedCount) : undefined,
          checkpoint,
        },
      );

      if (response && 'matched' in response && response.matched) {
        setSuccess('Mismatch check passed with no loss report raised.');
      } else {
        setSuccess('Mismatch detected and loss report raised.');
      }

      await loadReports();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Unable to run mismatch check.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleStaleCheck() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await api.post<{ staleCount: number; alertsCreated: number }>(
        '/loss-detection/stale-check',
        {
          slaHours: Number(slaHours),
        },
      );
      setSuccess(
        `Stale check completed. ${response.staleCount} stale items found and ${response.alertsCreated} alerts created.`,
      );
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Unable to run stale-item detection.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove(reportId: string) {
    const notes = approvalNotes[reportId]?.trim();
    if (!notes) {
      setError('Approval notes are required before approving a high-value claim.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await api.patch(`/loss-detection/${reportId}/approve`, {
        notes,
      });
      setApprovalNotes((current) => ({ ...current, [reportId]: '' }));
      setSuccess('Loss claim approval recorded.');
      await loadReports();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Unable to approve loss claim.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total reports" value={String(reports.length)} helper="Open and closed loss records." />
        <StatCard label="Escalated" value={String(reports.filter((report) => report.status === 'ESCALATED').length)} helper="Requires senior review." tone="warning" />
        <StatCard label="Claimed" value={String(reports.filter((report) => report.status === 'CLAIMED').length)} helper="Dual approval complete." tone="success" />
        <StatCard label="High value" value={String(reports.filter((report) => report.isHighValue).length)} helper="Reports above the high-value threshold." tone="info" />
      </div>

      {error ? (
        <Alert title="Loss detection error" variant="danger">
          {error}
        </Alert>
      ) : null}

      {success ? (
        <Alert title="Loss detection update" variant="success">
          {success}
        </Alert>
      ) : null}

      <SurfaceCard title={title} description={description}>
        <div className="grid gap-6 xl:grid-cols-2">
          <form className="space-y-4" onSubmit={handleCreateReport}>
            <h3 className="text-lg font-semibold text-white">Create loss report</h3>
            <Input label="Booking id" value={bookingId} onChange={(event) => setBookingId(event.target.value)} required />
            <Input label="Item id" value={itemId} onChange={(event) => setItemId(event.target.value)} help="Optional inventory item UUID when the report points to a single parcel." />
            <Input label="Report type" value={type} onChange={(event) => setType(event.target.value)} required />
            <Input label="Estimated value" type="number" min="0" step="0.01" value={estimatedValue} onChange={(event) => setEstimatedValue(event.target.value)} required />
            <Input label="Description" value={descriptionValue} onChange={(event) => setDescriptionValue(event.target.value)} textarea required />
            <Input
              label="Evidence URLs"
              value={evidenceUrls}
              onChange={(event) => setEvidenceUrls(event.target.value)}
              textarea
              help="Paste one URL per line."
            />
            <Button disabled={saving} type="submit">
              {saving ? 'Saving report...' : 'Create loss report'}
            </Button>
          </form>

          <div className="space-y-6">
            <form className="space-y-4" onSubmit={handleMismatchCheck}>
              <h3 className="text-lg font-semibold text-white">Batch mismatch check</h3>
              <Input label="Booking id" value={mismatchBookingId} onChange={(event) => setMismatchBookingId(event.target.value)} required />
              <div className="grid gap-4 md:grid-cols-2">
                <Input label="Expected count" type="number" min="0" value={expectedCount} onChange={(event) => setExpectedCount(event.target.value)} />
                <Input label="Scanned count" type="number" min="0" value={scannedCount} onChange={(event) => setScannedCount(event.target.value)} />
              </div>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-200">Checkpoint</span>
                <select
                  className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                  value={checkpoint}
                  onChange={(event) => setCheckpoint(event.target.value)}
                >
                  {CHECKPOINT_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {formatStatus(option)}
                    </option>
                  ))}
                </select>
              </label>
              <Button disabled={saving} type="submit">
                Run mismatch check
              </Button>
            </form>

            <div className="rounded-3xl border border-slate-700/40 bg-slate-950/55 p-5">
              <h3 className="text-lg font-semibold text-white">Stale-item detection</h3>
              <p className="mt-1 text-sm text-slate-400">
                Check for inventory with no movement inside the selected SLA window.
              </p>
              <div className="mt-4 flex flex-col gap-3 md:flex-row">
                <Input
                  label="SLA hours"
                  type="number"
                  min="1"
                  value={slaHours}
                  onChange={(event) => setSlaHours(event.target.value)}
                />
                <div className="md:self-end">
                  <Button disabled={saving} onClick={() => void handleStaleCheck()}>
                    Run stale check
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard title="Loss report board" description="Current loss investigations and claim handling state.">
        {loading ? (
          <Spinner />
        ) : (
          <Table
            rows={reports}
            emptyMessage="No loss reports recorded yet."
            columns={[
              {
                key: 'report',
                header: 'Report',
                render: (report) => (
                  <div>
                    <p className="font-semibold text-white">{report.booking?.reference ?? compactId(report.bookingId)}</p>
                    <p className="text-xs text-slate-400">{report.type}</p>
                  </div>
                ),
              },
              {
                key: 'parcel',
                header: 'Parcel',
                render: (report) => report.item?.parcelId ?? 'Booking-level report',
              },
              {
                key: 'value',
                header: 'Estimated value',
                render: (report) => formatMoney(report.estimatedValue),
              },
              {
                key: 'status',
                header: 'Status',
                render: (report) => formatStatus(report.status),
              },
              {
                key: 'summary',
                header: 'Summary',
                render: (report) => (
                  <div className="space-y-1 text-xs text-slate-300">
                    <p>{report.description}</p>
                    <p>{report.requiresDualApproval ? 'Dual approval required' : 'Single review flow'}</p>
                  </div>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                render: (report) =>
                  canApprove && (report.status === 'ESCALATED' || report.status === 'INVESTIGATING') ? (
                    <div className="space-y-2">
                      <Input
                        label="Approval notes"
                        value={approvalNotes[report.id] ?? ''}
                        onChange={(event) =>
                          setApprovalNotes((current) => ({
                            ...current,
                            [report.id]: event.target.value,
                          }))
                        }
                      />
                      <Button onClick={() => void handleApprove(report.id)}>Approve</Button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">No action</span>
                  ),
              },
            ]}
          />
        )}
      </SurfaceCard>
    </div>
  );
}
