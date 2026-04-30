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

type InvoicesResponse = {
  invoices: Invoice[];
  total: number;
};

type SelfInvoicesWorkspaceProps = {
  title: string;
  description: string;
  listPath: string;
  pdfPathPrefix: string;
  emptyMessage: string;
};

export function SelfInvoicesWorkspace({
  title,
  description,
  listPath,
  pdfPathPrefix,
  emptyMessage,
}: SelfInvoicesWorkspaceProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const outstandingTotal = useMemo(
    () =>
      invoices.reduce(
        (sum, invoice) => sum + Math.max(0, invoice.totalAmount - invoice.paidAmount),
        0,
      ),
    [invoices],
  );

  const paidTotal = useMemo(
    () => invoices.reduce((sum, invoice) => sum + invoice.paidAmount, 0),
    [invoices],
  );

  async function loadInvoices() {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get<InvoicesResponse>(listPath);
      setInvoices(response.invoices);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load invoices.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadInvoices();
  }, [listPath]);

  async function handleDownload(invoiceId: string) {
    setDownloadingId(invoiceId);
    setError(null);

    try {
      const payload = await api.get<{ fileName: string; contentBase64: string }>(
        `${pdfPathPrefix}/${invoiceId}/pdf`,
      );
      downloadBase64File(payload.fileName, payload.contentBase64, 'application/pdf');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to download invoice.');
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Invoices" value={String(invoices.length)} helper="All invoices available to this account." />
        <StatCard label="Outstanding" value={formatMoney(outstandingTotal)} helper="Remaining balance across unpaid invoices." tone="info" />
        <StatCard label="Paid to date" value={formatMoney(paidTotal)} helper="Amount already settled across invoice history." tone="success" />
      </div>

      {error ? (
        <Alert title="Invoice workflow error" variant="danger">
          {error}
        </Alert>
      ) : null}

      <SurfaceCard title={title} description={description}>
        {loading ? (
          <Spinner />
        ) : (
          <Table
            emptyMessage={emptyMessage}
            rows={invoices}
            columns={[
              {
                key: 'number',
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
                key: 'amount',
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
