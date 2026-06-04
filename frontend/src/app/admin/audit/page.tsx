'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Table } from '@/components/ui/Table';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { ApiError, api } from '@/lib/api';
import { compactId, formatDateTime, formatMoney, formatStatus } from '@/lib/format';

type ApprovalRequest = {
  id: string;
  actionType: string;
  targetEntityId: string;
  status: string;
  severity: string;
  message: string;
  requestedAt: string;
  reason: string;
  requiredApprovals: number;
  approvalsReceived: number;
  requester?: {
    fullName?: string | null;
    email?: string | null;
    phone?: string | null;
    role?: string | null;
  } | null;
  approvals: Array<{
    approver?: {
      fullName?: string | null;
      email?: string | null;
      phone?: string | null;
      role?: string | null;
    } | null;
    approvedAt: string;
    note?: string | null;
  }>;
  entitySummary?: Record<string, unknown> | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  executedAt?: string | null;
};

type ApprovalResponse = {
  items: ApprovalRequest[];
  total: number;
  summary: {
    pending: number;
    executed: number;
    rejected: number;
    failed: number;
  };
};

const ACTION_TYPES = ['', 'PAYMENT_REFUND', 'PAYOUT_OVERRIDE', 'BOOKING_CANCEL'] as const;

export default function AdminAuditPage() {
  const [items, setItems] = useState<ApprovalRequest[]>([]);
  const [summary, setSummary] = useState<ApprovalResponse['summary']>({
    pending: 0,
    executed: 0,
    rejected: 0,
    failed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [actionTypeFilter, setActionTypeFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [refundForm, setRefundForm] = useState({ paymentId: '', reason: '' });
  const [cancelForm, setCancelForm] = useState({
    bookingId: '',
    reason: '',
    penaltyOverrideNote: '',
  });
  const [payoutForm, setPayoutForm] = useState({
    payrollId: '',
    overrideAmount: '',
    reason: '',
  });

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (actionTypeFilter) params.set('actionType', actionTypeFilter);
      const path = params.size > 0 ? `/audit/approvals?${params.toString()}` : '/audit/approvals';
      const response = await api.get<ApprovalResponse>(path);
      setItems(response.items);
      setSummary(response.summary);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load approval requests.');
    } finally {
      setLoading(false);
    }
  }, [actionTypeFilter, statusFilter]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  async function submitRequest(message: string, action: () => Promise<unknown>) {
    setError(null);
    setSuccess(null);

    try {
      await action();
      setSuccess(message);
      await loadRequests();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to submit approval request.');
    }
  }

  async function handleApprove(requestId: string) {
    setBusyId(requestId);
    setError(null);
    setSuccess(null);

    try {
      await api.post(`/audit/approvals/${requestId}/approve`, {
        note: 'Approved from admin control dashboard',
      });
      setSuccess('Approval review recorded.');
      await loadRequests();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to approve request.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(requestId: string) {
    const reason = window.prompt('Reason for rejection');
    if (!reason) return;

    setBusyId(requestId);
    setError(null);
    setSuccess(null);

    try {
      await api.post(`/audit/approvals/${requestId}/reject`, { reason });
      setSuccess('Approval request rejected.');
      await loadRequests();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to reject request.');
    } finally {
      setBusyId(null);
    }
  }

  function renderEntitySummary(summaryValue?: Record<string, unknown> | null) {
    if (!summaryValue) return 'No target summary';

    const bookingReference = typeof summaryValue.bookingReference === 'string' ? summaryValue.bookingReference : null;
    const paymentReference = typeof summaryValue.paymentReference === 'string' ? summaryValue.paymentReference : null;
    const driverName = typeof summaryValue.driverName === 'string' ? summaryValue.driverName : null;
    const amount = typeof summaryValue.amount === 'number' ? summaryValue.amount : null;
    const currentNetPayout = typeof summaryValue.currentNetPayout === 'number' ? summaryValue.currentNetPayout : null;
    const targetNetPayout = typeof summaryValue.targetNetPayout === 'number' ? summaryValue.targetNetPayout : null;

    if (paymentReference || bookingReference || driverName) {
      return [paymentReference, bookingReference, driverName].filter(Boolean).join(' · ');
    }
    if (amount != null) {
      return formatMoney(amount);
    }
    if (currentNetPayout != null || targetNetPayout != null) {
      return `${formatMoney(currentNetPayout ?? 0)} → ${formatMoney(targetNetPayout ?? 0)}`;
    }

    return compactId(JSON.stringify(summaryValue));
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Pending reviews" value={String(summary.pending)} helper="Approval requests still waiting for one or more reviewers." tone="warning" />
        <StatCard label="Executed" value={String(summary.executed)} helper="High-risk actions completed after the required approvals." tone="success" />
        <StatCard label="Rejected" value={String(summary.rejected)} helper="Requests declined by finance or ops control." />
        <StatCard label="Failed" value={String(summary.failed)} helper="Approval requests whose execution failed after approval." tone="info" />
      </div>

      {error ? (
        <Alert title="Admin control error" variant="danger">
          {error}
        </Alert>
      ) : null}
      {success ? (
        <Alert title="Admin control updated" variant="success">
          {success}
        </Alert>
      ) : null}

      <SurfaceCard title="Approval queue filters" description="Strict control point for refunds, payout overrides, and admin booking cancellations.">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-200">Status</span>
            <select
              className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">All statuses</option>
              {['PENDING', 'PARTIALLY_APPROVED', 'EXECUTED', 'REJECTED', 'FAILED'].map((status) => (
                <option key={status} value={status}>
                  {formatStatus(status)}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-200">Action type</span>
            <select
              className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
              value={actionTypeFilter}
              onChange={(event) => setActionTypeFilter(event.target.value)}
            >
              {ACTION_TYPES.map((actionType) => (
                <option key={actionType || 'ALL'} value={actionType}>
                  {actionType ? formatStatus(actionType) : 'All action types'}
                </option>
              ))}
            </select>
          </label>
        </div>
      </SurfaceCard>

      <div className="grid gap-6 xl:grid-cols-3">
        <SurfaceCard title="Refund approval" description="Financial reversals require dual approval before execution.">
          <form
            className="space-y-4"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              void submitRequest('Refund approval request submitted.', () =>
                api.post('/audit/approvals/refund-request', refundForm),
              );
            }}
          >
            <Input
              label="Payment ID"
              required
              value={refundForm.paymentId}
              onChange={(event) =>
                setRefundForm((current) => ({ ...current, paymentId: event.target.value }))
              }
            />
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">Reason</span>
              <textarea
                className="min-h-28 w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                required
                value={refundForm.reason}
                onChange={(event) =>
                  setRefundForm((current) => ({ ...current, reason: event.target.value }))
                }
              />
            </label>
            <Button type="submit">Request refund approval</Button>
          </form>
        </SurfaceCard>

        <SurfaceCard title="Booking cancel approval" description="Admin booking cancellations now create an audited approval request before execution.">
          <form
            className="space-y-4"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              void submitRequest('Booking cancellation approval request submitted.', () =>
                api.post('/audit/approvals/booking-cancel-request', cancelForm),
              );
            }}
          >
            <Input
              label="Booking ID"
              required
              value={cancelForm.bookingId}
              onChange={(event) =>
                setCancelForm((current) => ({ ...current, bookingId: event.target.value }))
              }
            />
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">Reason</span>
              <textarea
                className="min-h-28 w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                required
                value={cancelForm.reason}
                onChange={(event) =>
                  setCancelForm((current) => ({ ...current, reason: event.target.value }))
                }
              />
            </label>
            <Input
              label="Penalty override note"
              value={cancelForm.penaltyOverrideNote}
              onChange={(event) =>
                setCancelForm((current) => ({
                  ...current,
                  penaltyOverrideNote: event.target.value,
                }))
              }
            />
            <Button type="submit">Request cancellation approval</Button>
          </form>
        </SurfaceCard>

        <SurfaceCard title="Payout override approval" description="Payroll payout changes require dual authorization before the override is written.">
          <form
            className="space-y-4"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              void submitRequest('Payout override approval request submitted.', () =>
                api.post('/audit/approvals/payout-override-request', {
                  ...payoutForm,
                  overrideAmount: Number(payoutForm.overrideAmount),
                }),
              );
            }}
          >
            <Input
              label="Payroll ID"
              required
              value={payoutForm.payrollId}
              onChange={(event) =>
                setPayoutForm((current) => ({ ...current, payrollId: event.target.value }))
              }
            />
            <Input
              label="Override amount"
              min="0"
              required
              step="0.01"
              type="number"
              value={payoutForm.overrideAmount}
              onChange={(event) =>
                setPayoutForm((current) => ({ ...current, overrideAmount: event.target.value }))
              }
            />
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">Reason</span>
              <textarea
                className="min-h-28 w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                required
                value={payoutForm.reason}
                onChange={(event) =>
                  setPayoutForm((current) => ({ ...current, reason: event.target.value }))
                }
              />
            </label>
            <Button type="submit">Request payout override</Button>
          </form>
        </SurfaceCard>
      </div>

      <SurfaceCard title="Approval queue" description="Approve, reject, and monitor dual-authorization progress for high-risk operations.">
        {loading ? (
          <Spinner />
        ) : (
          <Table
            emptyMessage="No approval requests matched the current filters."
            rows={items}
            columns={[
              {
                key: 'request',
                header: 'Request',
                render: (item) => (
                  <div>
                    <p className="font-semibold text-white">{formatStatus(item.actionType)}</p>
                    <p className="text-xs text-slate-400">{compactId(item.id)}</p>
                  </div>
                ),
              },
              {
                key: 'requester',
                header: 'Requester',
                render: (item) => (
                  <div className="text-xs text-slate-300">
                    <p>{item.requester?.fullName ?? item.requester?.email ?? 'Unknown'}</p>
                    <p>{formatStatus(item.requester?.role ?? 'UNKNOWN')}</p>
                    <p>{formatDateTime(item.requestedAt)}</p>
                  </div>
                ),
              },
              {
                key: 'target',
                header: 'Target',
                render: (item) => (
                  <div className="text-xs text-slate-300">
                    <p>{renderEntitySummary(item.entitySummary)}</p>
                    <p>{compactId(item.targetEntityId)}</p>
                    <p>{item.reason}</p>
                  </div>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (item) => (
                  <div className="text-xs text-slate-300">
                    <p>{formatStatus(item.status)}</p>
                    <p>{item.approvalsReceived} / {item.requiredApprovals} approvals</p>
                    <p>{formatStatus(item.severity)}</p>
                  </div>
                ),
              },
              {
                key: 'reviewers',
                header: 'Reviewers',
                render: (item) => (
                  <div className="text-xs text-slate-300">
                    {item.approvals.length > 0 ? (
                      item.approvals.map((approval) => (
                        <p key={`${item.id}-${approval.approvedAt}`}>
                          {(approval.approver?.fullName ?? approval.approver?.email ?? 'Reviewer')} · {formatDateTime(approval.approvedAt)}
                        </p>
                      ))
                    ) : (
                      <p>No approvals yet</p>
                    )}
                    {item.rejectionReason ? <p>Rejected: {item.rejectionReason}</p> : null}
                    {item.executedAt ? <p>Executed: {formatDateTime(item.executedAt)}</p> : null}
                  </div>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                render: (item) => (
                  <div className="space-y-2">
                    <Button
                      className="w-full"
                      disabled={busyId === item.id || ['EXECUTED', 'REJECTED'].includes(item.status)}
                      onClick={() => void handleApprove(item.id)}
                    >
                      Approve
                    </Button>
                    <Button
                      className="w-full"
                      disabled={busyId === item.id || ['EXECUTED', 'REJECTED'].includes(item.status)}
                      variant="danger"
                      onClick={() => void handleReject(item.id)}
                    >
                      Reject
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
