'use client';

import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Table } from '@/components/ui/Table';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { ApiError, api } from '@/lib/api';
import { compactId, formatDateTime, formatMoney, formatStatus } from '@/lib/format';

type ReconciliationRecord = {
  key: string;
  bookingId: string | null;
  bookingReference: string | null;
  customerId: string | null;
  customerLabel: string | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
  invoiceType: string | null;
  invoiceStatus: string | null;
  invoiceTotal: number;
  paymentIds: string[];
  paymentReferenceIds: string[];
  paymentStatuses: string[];
  paymentMethods: string[];
  paymentTotal: number;
  outstandingAmount: number;
  matchStatus: string;
  matchedBy: string;
  mismatchReasons: string[];
  lastActivityAt: string;
};

type ReconciliationDashboard = {
  date: string;
  generatedAt: string;
  summary: {
    totalRecords: number;
    totalInvoiceValue: number;
    totalPaymentValue: number;
    totalOutstanding: number;
    matchedCount: number;
    mismatchCount: number;
    duplicateCount: number;
    missingInvoiceCount: number;
    missingPaymentCount: number;
  };
  mismatches: ReconciliationRecord[];
  matched: ReconciliationRecord[];
  notes: string[];
};

export default function AdminReconciliationPage() {
  const [dashboard, setDashboard] = useState<ReconciliationDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadDashboard(nextDate = date) {
    setLoading(true);
    setError(null);

    try {
      const query = nextDate ? `?date=${nextDate}` : '';
      const response = await api.get<ReconciliationDashboard>(`/reconciliation/dashboard${query}`);
      setDashboard(response);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load reconciliation data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function runAction(path: string, message: string) {
    setRunningAction(path);
    setError(null);
    setSuccess(null);

    try {
      await api.post(path, {
        date: date || undefined,
        limit: 200,
      });
      setSuccess(message);
      await loadDashboard();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Reconciliation action failed.');
    } finally {
      setRunningAction(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Matched records"
          value={dashboard ? String(dashboard.summary.matchedCount) : '0'}
          helper="Invoices whose settled payment totals now reconcile cleanly."
          tone="success"
        />
        <StatCard
          label="Mismatch records"
          value={dashboard ? String(dashboard.summary.mismatchCount) : '0'}
          helper="Entries needing finance review for missing, duplicate, or mismatched values."
          tone="warning"
        />
        <StatCard
          label="Invoice value"
          value={dashboard ? formatMoney(dashboard.summary.totalInvoiceValue) : formatMoney(0)}
          helper="Total invoice face value in the current reconciliation scope."
        />
        <StatCard
          label="Outstanding"
          value={dashboard ? formatMoney(dashboard.summary.totalOutstanding) : formatMoney(0)}
          helper="Unsettled value still open after successful payment matching."
          tone="info"
        />
      </div>

      {error ? (
        <Alert title="Reconciliation error" variant="danger">
          {error}
        </Alert>
      ) : null}
      {success ? (
        <Alert title="Reconciliation action completed" variant="success">
          {success}
        </Alert>
      ) : null}

      <SurfaceCard
        title="Daily reconciliation controls"
        description="Run live auto-match and mismatch detection against invoice and payment references, or scope the view to a specific day."
        actions={
          <div className="text-xs text-slate-400">
            Generated: {dashboard ? formatDateTime(dashboard.generatedAt) : 'Loading...'}
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-[minmax(0,260px)_1fr]">
          <Input
            label="Report date"
            help="Leave blank for the latest overall finance snapshot."
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
          <div className="flex flex-wrap items-end gap-3">
            <Button disabled={loading} onClick={() => void loadDashboard()}>
              Refresh dashboard
            </Button>
            <Button
              disabled={Boolean(runningAction)}
              variant="secondary"
              onClick={() => void runAction('/reconciliation/auto-match', 'Auto-match run completed.')}
            >
              {runningAction === '/reconciliation/auto-match' ? 'Running auto-match...' : 'Run auto-match'}
            </Button>
            <Button
              disabled={Boolean(runningAction)}
              variant="ghost"
              onClick={() =>
                void runAction('/reconciliation/detect-mismatch', 'Mismatch detection run completed.')
              }
            >
              {runningAction === '/reconciliation/detect-mismatch'
                ? 'Detecting mismatches...'
                : 'Detect mismatches'}
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

      <div className="grid gap-6 xl:grid-cols-3">
        <SurfaceCard title="Mismatch summary" description="Quick counts for the highest-risk reconciliation issues.">
          {dashboard ? (
            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-1">
              <StatCard label="Missing payments" value={String(dashboard.summary.missingPaymentCount)} helper="Invoices with no settled payment reference in scope." tone="warning" />
              <StatCard label="Missing invoices" value={String(dashboard.summary.missingInvoiceCount)} helper="Settled payments that do not map back to a tracked invoice." tone="warning" />
              <StatCard label="Duplicate patterns" value={String(dashboard.summary.duplicateCount)} helper="Records showing overpayment or repeated payment references." tone="info" />
            </div>
          ) : (
            <Spinner />
          )}
        </SurfaceCard>

        <SurfaceCard title="Scope" description="Finance records currently being reconciled.">
          <div className="space-y-3 text-sm text-slate-300">
            <p>Report scope: <span className="font-medium text-white">{dashboard?.date ?? 'Loading...'}</span></p>
            <p>Total records: <span className="font-medium text-white">{dashboard ? dashboard.summary.totalRecords : 0}</span></p>
            <p>Total payments: <span className="font-medium text-white">{dashboard ? formatMoney(dashboard.summary.totalPaymentValue) : formatMoney(0)}</span></p>
          </div>
        </SurfaceCard>

        <SurfaceCard title="Recent matched records" description="A quick confidence sample of cleanly reconciled records.">
          {loading && !dashboard ? (
            <Spinner />
          ) : (
            <div className="space-y-3 text-sm text-slate-300">
              {dashboard?.matched.slice(0, 4).map((record) => (
                <div key={record.key} className="rounded-2xl border border-slate-800/70 bg-slate-950/40 p-4">
                  <p className="font-semibold text-white">{record.invoiceNumber ?? compactId(record.key)}</p>
                  <p>{record.bookingReference ?? 'Manual invoice reference'}</p>
                  <p>{formatMoney(record.invoiceTotal)} matched by {formatStatus(record.matchedBy)}</p>
                </div>
              ))}
              {dashboard?.matched.length === 0 ? (
                <p className="text-sm text-slate-400">No fully matched records in the current scope yet.</p>
              ) : null}
            </div>
          )}
        </SurfaceCard>
      </div>

      <SurfaceCard title="Mismatch worklist" description="Use this table to triage amount mismatches, missing payments, duplicate references, and manual-review invoices.">
        {loading ? (
          <Spinner />
        ) : (
          <Table
            emptyMessage="No mismatches found in the current reconciliation scope."
            rows={dashboard?.mismatches ?? []}
            columns={[
              {
                key: 'invoice',
                header: 'Invoice',
                render: (record) => (
                  <div>
                    <p className="font-semibold text-white">
                      {record.invoiceNumber ?? 'No invoice linked'}
                    </p>
                    <p className="text-xs text-slate-400">
                      {record.bookingReference ?? compactId(record.bookingId ?? record.key)}
                    </p>
                  </div>
                ),
              },
              {
                key: 'customer',
                header: 'Customer',
                render: (record) => (
                  <div className="text-xs text-slate-300">
                    <p>{record.customerLabel ?? 'Unassigned'}</p>
                    <p>{record.customerId ? compactId(record.customerId) : 'No customer reference'}</p>
                  </div>
                ),
              },
              {
                key: 'value',
                header: 'Amounts',
                render: (record) => (
                  <div className="text-xs text-slate-300">
                    <p>Invoice: {formatMoney(record.invoiceTotal)}</p>
                    <p>Paid: {formatMoney(record.paymentTotal)}</p>
                    <p>Outstanding: {formatMoney(record.outstandingAmount)}</p>
                  </div>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (record) => (
                  <div className="text-xs text-slate-300">
                    <p>{formatStatus(record.matchStatus)}</p>
                    <p>{record.invoiceStatus ? formatStatus(record.invoiceStatus) : 'Payment only'}</p>
                    <p>{formatStatus(record.matchedBy)}</p>
                  </div>
                ),
              },
              {
                key: 'reasons',
                header: 'Reasons',
                render: (record) => (
                  <div className="text-xs text-slate-300">
                    <p>{record.mismatchReasons.map((reason) => formatStatus(reason)).join(', ')}</p>
                    <p>{record.paymentReferenceIds.length > 0 ? record.paymentReferenceIds.join(', ') : 'No payment refs'}</p>
                  </div>
                ),
              },
              {
                key: 'activity',
                header: 'Last activity',
                render: (record) => formatDateTime(record.lastActivityAt),
              },
            ]}
          />
        )}
      </SurfaceCard>
    </div>
  );
}
