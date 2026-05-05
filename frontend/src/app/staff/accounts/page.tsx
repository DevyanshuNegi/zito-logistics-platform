'use client';

import { useEffect, useMemo, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Table } from '@/components/ui/Table';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { ApiError, api } from '@/lib/api';
import { downloadBase64File } from '@/lib/download';
import { compactId, formatDateTime, formatMoney, formatStatus } from '@/lib/format';

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

type Invoice = {
  id: string;
  number: string;
  type: string;
  status: string;
  totalAmount: number;
  paidAmount: number;
  dueDate?: string | null;
  issuedAt?: string | null;
  isApprovalRequired: boolean;
  approvedAt?: string | null;
  customerId: string;
  customer?: {
    fullName?: string | null;
    email?: string | null;
    role?: string | null;
  } | null;
};

type InvoicesResponse = {
  invoices: Invoice[];
  total: number;
};

export default function StaffAccountsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadData() {
    setPaymentsLoading(true);
    setInvoicesLoading(true);
    setError(null);

    try {
      const [paymentsResponse, invoicesResponse] = await Promise.all([
        api.get<PaymentsResponse>('/payments'),
        api.get<InvoicesResponse>('/admin/invoices'),
      ]);

      setPayments(paymentsResponse.payments);
      setInvoices(invoicesResponse.invoices);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load accounts workflow.');
    } finally {
      setPaymentsLoading(false);
      setInvoicesLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function withPaymentRefresh(id: string, successMessage: string, action: () => Promise<unknown>) {
    setBusyId(id);
    setError(null);
    setSuccess(null);

    try {
      await action();
      setSuccess(successMessage);
      await loadData();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Accounts action failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function downloadInvoice(invoiceId: string) {
    setBusyId(invoiceId);
    setError(null);

    try {
      const payload = await api.get<{ fileName: string; contentBase64: string }>(
        `/admin/invoices/${invoiceId}/pdf`,
      );
      downloadBase64File(payload.fileName, payload.contentBase64, 'application/pdf');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to download invoice.');
    } finally {
      setBusyId(null);
    }
  }

  const outstandingTotal = useMemo(
    () => invoices.reduce((sum, invoice) => sum + Math.max(0, invoice.totalAmount - invoice.paidAmount), 0),
    [invoices],
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Payments" value={String(payments.length)} helper="Payment records visible to accounts." />
        <StatCard label="Invoices awaiting approval" value={String(invoices.filter((invoice) => invoice.isApprovalRequired && !invoice.approvedAt).length)} helper="Finance documents still waiting for control sign-off." tone="warning" />
        <StatCard label="Outstanding value" value={formatMoney(outstandingTotal)} helper="Open receivables across the visible invoice queue." tone="success" />
      </div>

      {error ? (
        <Alert title="Accounts workflow error" variant="danger">
          {error}
        </Alert>
      ) : null}
      {success ? (
        <Alert title="Accounts workflow updated" variant="success">
          {success}
        </Alert>
      ) : null}

      <SurfaceCard title="Payments queue" description="Review payment status, confirm receipts, retry failed collections, and raise audited refund requests.">
        {paymentsLoading ? (
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
                      {payment.booking?.reference ?? payment.bookingId}
                    </p>
                  </div>
                ),
              },
              {
                key: 'amount',
                header: 'Amount',
                render: (payment) => formatMoney(payment.amount),
              },
              {
                key: 'status',
                header: 'Status',
                render: (payment) => (
                  <div>
                    <p>{formatStatus(payment.status)}</p>
                    <p className="text-xs text-slate-400">
                      {payment.method} · Retries {payment.retryCount ?? 0}
                    </p>
                  </div>
                ),
              },
              {
                key: 'time',
                header: 'Created',
                render: (payment) => formatDateTime(payment.createdAt),
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
                        void withPaymentRefresh(payment.id, 'Payment confirmed.', () =>
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
                        void withPaymentRefresh(payment.id, 'Payment retry submitted.', () =>
                          api.post(`/payments/${payment.id}/retry`),
                        )
                      }
                    >
                      Retry
                    </Button>
                    <Button
                      className="w-full"
                      disabled={busyId === payment.id}
                      variant="danger"
                      onClick={() =>
                        void withPaymentRefresh(payment.id, 'Refund request submitted.', () =>
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

      <SurfaceCard title="Invoice control queue" description="Download, approve, and issue invoices across transport, warehouse, and platform-fee billing.">
        {invoicesLoading ? (
          <Spinner />
        ) : (
          <Table
            rows={invoices}
            columns={[
              {
                key: 'invoice',
                header: 'Invoice',
                render: (invoice) => (
                  <div>
                    <p className="font-semibold text-white">{invoice.number}</p>
                    <p className="text-xs text-slate-400">
                      {invoice.customer?.fullName ?? compactId(invoice.customerId)} · {formatStatus(invoice.type)}
                    </p>
                  </div>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (invoice) => (
                  <div>
                    <p>{formatStatus(invoice.status)}</p>
                    <p className="text-xs text-slate-400">
                      {invoice.isApprovalRequired && !invoice.approvedAt ? 'Approval required' : 'Ready for issue'}
                    </p>
                  </div>
                ),
              },
              {
                key: 'amounts',
                header: 'Amounts',
                render: (invoice) => (
                  <div>
                    <p>{formatMoney(invoice.totalAmount)}</p>
                    <p className="text-xs text-slate-400">
                      Outstanding {formatMoney(Math.max(0, invoice.totalAmount - invoice.paidAmount))}
                    </p>
                  </div>
                ),
              },
              {
                key: 'dates',
                header: 'Dates',
                render: (invoice) => (
                  <div className="text-xs text-slate-300">
                    <p>Issued {formatDateTime(invoice.issuedAt)}</p>
                    <p>Due {formatDateTime(invoice.dueDate)}</p>
                  </div>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                render: (invoice) => (
                  <div className="space-y-2">
                    <Button className="w-full" disabled={busyId === invoice.id} variant="secondary" onClick={() => void downloadInvoice(invoice.id)}>
                      Download PDF
                    </Button>
                    <Button
                      className="w-full"
                      disabled={busyId === invoice.id}
                      onClick={() =>
                        void withPaymentRefresh(invoice.id, 'Invoice approval recorded.', () =>
                          api.patch(`/admin/invoices/${invoice.id}/approve`, {}),
                        )
                      }
                    >
                      Approve
                    </Button>
                    <Button
                      className="w-full"
                      disabled={busyId === invoice.id}
                      variant="secondary"
                      onClick={() =>
                        void withPaymentRefresh(invoice.id, 'Invoice issued successfully.', () =>
                          api.patch(`/admin/invoices/${invoice.id}/issue`, {}),
                        )
                      }
                    >
                      Issue invoice
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
