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
import { formatDateTime, formatMoney, formatStatus } from '@/lib/format';

type ContractSummary = {
  businessName?: string | null;
  creditLimit: number;
  creditUsed: number;
  paymentTermDays: number;
  billingCycle: string;
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
  booking?: {
    reference?: string | null;
  } | null;
};

type CorporateInvoicesResponse = {
  invoices: Invoice[];
  total: number;
  contract: ContractSummary | null;
  creditAvailable: number;
};

export default function CorporateInvoicesPage() {
  const [payload, setPayload] = useState<CorporateInvoicesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const outstandingTotal = useMemo(
    () =>
      (payload?.invoices ?? []).reduce(
        (sum, invoice) => sum + Math.max(0, invoice.totalAmount - invoice.paidAmount),
        0,
      ),
    [payload],
  );

  async function loadInvoices() {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get<CorporateInvoicesResponse>('/corporate/invoices');
      setPayload(response);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load corporate invoices.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadInvoices();
  }, []);

  async function handleDownload(invoiceId: string) {
    setDownloadingId(invoiceId);
    setError(null);

    try {
      const file = await api.get<{ fileName: string; contentBase64: string }>(
        `/corporate/invoices/${invoiceId}/pdf`,
      );
      downloadBase64File(file.fileName, file.contentBase64, 'application/pdf');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to download invoice.');
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Outstanding invoices" value={String(payload?.total ?? 0)} helper="Corporate invoices that still need settlement." />
        <StatCard label="Outstanding value" value={formatMoney(outstandingTotal)} helper="Current unpaid invoice balance." tone="info" />
        <StatCard label="Credit used" value={formatMoney(payload?.contract?.creditUsed ?? 0)} helper="Credit already consumed by this account." />
        <StatCard label="Credit available" value={formatMoney(payload?.creditAvailable ?? 0)} helper="Remaining contract headroom." tone="success" />
      </div>

      {error ? (
        <Alert title="Corporate billing error" variant="danger">
          {error}
        </Alert>
      ) : null}

      <SurfaceCard title="Contract snapshot" description="Commercial terms attached to this corporate account.">
        {loading ? (
          <Spinner />
        ) : payload?.contract ? (
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard label="Business" value={payload.contract.businessName ?? 'Corporate account'} helper="Registered contract owner." />
            <StatCard label="Billing cycle" value={formatStatus(payload.contract.billingCycle)} helper="Expected consolidation cadence." tone="info" />
            <StatCard label="Payment terms" value={`${payload.contract.paymentTermDays} days`} helper="Credit settlement window." />
            <StatCard label="Credit limit" value={formatMoney(payload.contract.creditLimit)} helper="Approved commercial ceiling." tone="success" />
          </div>
        ) : (
          <Alert title="No active contract" variant="info">
            No active B2B contract is linked yet. Invoice visibility is still available while contract setup remains pending.
          </Alert>
        )}
      </SurfaceCard>

      <SurfaceCard title="Outstanding corporate invoices" description="Finance-ready view of issued or draft invoices still affecting credit and collections.">
        {loading ? (
          <Spinner />
        ) : (
          <Table
            emptyMessage="No outstanding corporate invoices were found."
            rows={payload?.invoices ?? []}
            columns={[
              {
                key: 'invoice',
                header: 'Invoice',
                render: (invoice) => (
                  <div>
                    <p className="font-semibold text-white">{invoice.number}</p>
                    <p className="text-xs text-slate-400">
                      {invoice.booking?.reference ?? formatStatus(invoice.type)}
                    </p>
                  </div>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (invoice) => formatStatus(invoice.status),
              },
              {
                key: 'amounts',
                header: 'Amounts',
                render: (invoice) => (
                  <div className="text-xs text-slate-300">
                    <p>Total: {formatMoney(invoice.totalAmount)}</p>
                    <p>Paid: {formatMoney(invoice.paidAmount)}</p>
                    <p>Due: {formatMoney(invoice.totalAmount - invoice.paidAmount)}</p>
                  </div>
                ),
              },
              {
                key: 'dates',
                header: 'Dates',
                render: (invoice) => (
                  <div className="text-xs text-slate-300">
                    <p>Issued: {formatDateTime(invoice.issuedAt)}</p>
                    <p>Due: {formatDateTime(invoice.dueDate)}</p>
                  </div>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                render: (invoice) => (
                  <Button
                    disabled={downloadingId === invoice.id}
                    onClick={() => void handleDownload(invoice.id)}
                  >
                    {downloadingId === invoice.id ? 'Preparing PDF...' : 'Download PDF'}
                  </Button>
                ),
              },
            ]}
          />
        )}
      </SurfaceCard>
    </div>
  );
}
