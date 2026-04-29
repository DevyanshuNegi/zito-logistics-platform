'use client';

import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Table } from '@/components/ui/Table';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { ApiError, api } from '@/lib/api';
import { formatDateTime, formatMoney, formatStatus } from '@/lib/format';
import { PAYMENT_STATUSES } from '@/lib/phase-one';

type Payment = {
  id: string;
  reference: string;
  bookingId: string;
  amount: number;
  method: string;
  status: string;
  createdAt?: string;
  retryCount?: number;
  booking?: {
    reference?: string | null;
  } | null;
};

type PaymentsResponse = {
  payments: Payment[];
  total: number;
};

export default function AdminPaymentsPage() {
  const [status, setStatus] = useState('');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadPayments() {
    setLoading(true);
    setError(null);

    try {
      const path = status ? `/payments?status=${encodeURIComponent(status)}` : '/payments';
      const response = await api.get<PaymentsResponse>(path);
      setPayments(response.payments);
      setTotal(response.total);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load payments.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPayments();
  }, [status]);

  async function withRefresh(paymentId: string, action: () => Promise<unknown>) {
    setBusyId(paymentId);
    setError(null);
    setSuccess(null);

    try {
      await action();
      setSuccess('Payment action completed.');
      await loadPayments();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Payment action failed.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Visible payments" value={String(payments.length)} helper="Current filtered payment records." />
        <StatCard label="Total records" value={String(total)} helper="Count returned by the admin endpoint." tone="info" />
        <StatCard label="Successful" value={String(payments.filter((payment) => payment.status === 'SUCCESS').length)} helper="Successes in the current list." tone="success" />
      </div>

      {error ? (
        <Alert title="Payments workflow error" variant="danger">
          {error}
        </Alert>
      ) : null}
      {success ? (
        <Alert title="Payments workflow updated" variant="success">
          {success}
        </Alert>
      ) : null}

      <SurfaceCard title="Filters" description="Monitor payment states, retry failures, confirm pending M-Pesa, or send refunds into the approval queue.">
        <label className="block max-w-sm space-y-2">
          <span className="text-sm font-medium text-slate-200">Status</span>
          <select
            className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">All statuses</option>
            {PAYMENT_STATUSES.map((option) => (
              <option key={option} value={option}>
                {formatStatus(option)}
              </option>
            ))}
          </select>
        </label>
      </SurfaceCard>

      <SurfaceCard title="Admin payments dashboard" description="Escrow-aware payment review with PRD v10 approval control for refunds.">
        {loading ? (
          <Spinner />
        ) : (
          <Table
            rows={payments}
            columns={[
              {
                key: 'payment',
                header: 'Payment',
                render: (payment) => (
                  <div>
                    <p className="font-semibold text-white">{payment.reference}</p>
                    <p className="text-xs text-slate-400">
                      Booking: {payment.booking?.reference ?? payment.bookingId}
                    </p>
                  </div>
                ),
              },
              {
                key: 'method',
                header: 'Method',
                render: (payment) => payment.method,
              },
              {
                key: 'status',
                header: 'Status',
                render: (payment) => formatStatus(payment.status),
              },
              {
                key: 'amount',
                header: 'Amount',
                render: (payment) => formatMoney(payment.amount),
              },
              {
                key: 'meta',
                header: 'Meta',
                render: (payment) => (
                  <div className="text-xs text-slate-300">
                    <p>{formatDateTime(payment.createdAt)}</p>
                    <p>Retries: {payment.retryCount ?? 0}</p>
                  </div>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                render: (payment) => (
                  <div className="space-y-2">
                    <Button
                      className="w-full"
                      disabled={busyId === payment.id}
                      onClick={() =>
                        void withRefresh(payment.id, () =>
                          api.patch(`/payments/${payment.id}/confirm`, {
                            mpesaRef: window.prompt('Optional M-Pesa reference') || undefined,
                          }),
                        )
                      }
                    >
                      Confirm
                    </Button>
                    <Button
                      className="w-full"
                      disabled={busyId === payment.id}
                      variant="secondary"
                      onClick={() =>
                        void withRefresh(payment.id, () => api.post(`/payments/${payment.id}/retry`))
                      }
                    >
                      Retry
                    </Button>
                    <Button
                      className="w-full"
                      disabled={busyId === payment.id}
                      variant="danger"
                      onClick={() =>
                        void withRefresh(payment.id, () =>
                          api.patch(`/payments/${payment.id}/refund`, {
                            reason: window.prompt('Refund reason') || undefined,
                          }),
                        )
                      }
                    >
                      Request refund
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
