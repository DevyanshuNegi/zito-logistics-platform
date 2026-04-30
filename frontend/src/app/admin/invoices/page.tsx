'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Table } from '@/components/ui/Table';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { ApiError, api } from '@/lib/api';
import { downloadBase64File } from '@/lib/download';
import { compactId, formatDateTime, formatMoney, formatStatus } from '@/lib/format';

type Invoice = {
  id: string;
  number: string;
  type: string;
  status: string;
  isLocked: boolean;
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
  booking?: {
    reference?: string | null;
  } | null;
};

type AdminInvoicesResponse = {
  invoices: Invoice[];
  total: number;
};

const INVOICE_STATUSES = ['DRAFT', 'ISSUED', 'PAID', 'OVERDUE', 'CANCELLED'] as const;

export default function AdminInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [approvalOnly, setApprovalOnly] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [bookingInvoiceForm, setBookingInvoiceForm] = useState({
    bookingId: '',
    dueDate: '',
    taxRate: '0',
  });
  const [warehouseInvoiceForm, setWarehouseInvoiceForm] = useState({
    warehouseId: '',
    customerId: '',
    dateFrom: '',
    dateTo: '',
    ratePerUnitPerDay: '',
    dueDate: '',
    taxRate: '0',
    issueImmediately: true,
  });
  const [combinedInvoiceForm, setCombinedInvoiceForm] = useState({
    customerId: '',
    bookingIds: '',
    dateFrom: '',
    dateTo: '',
    dueDate: '',
    taxRate: '0',
    issueImmediately: true,
  });
  const [platformInvoiceForm, setPlatformInvoiceForm] = useState({
    customerId: '',
    dateFrom: '',
    dateTo: '',
    billingMode: 'PER_VEHICLE',
    feeAmount: '',
    dueDate: '',
    taxRate: '0',
    issueImmediately: true,
  });

  const outstandingTotal = useMemo(
    () =>
      invoices.reduce(
        (sum, invoice) => sum + Math.max(0, invoice.totalAmount - invoice.paidAmount),
        0,
      ),
    [invoices],
  );

  async function loadInvoices() {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (approvalOnly) params.set('approvalRequired', 'true');
      const path = params.size > 0 ? `/admin/invoices?${params.toString()}` : '/admin/invoices';
      const response = await api.get<AdminInvoicesResponse>(path);
      setInvoices(response.invoices);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load invoices.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadInvoices();
  }, [approvalOnly, status]);

  async function refreshAfter(message: string, action: () => Promise<unknown>) {
    setError(null);
    setSuccess(null);

    try {
      await action();
      setSuccess(message);
      await loadInvoices();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Invoice action failed.');
    }
  }

  async function handleDownload(invoiceId: string) {
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

  async function handleGenerateBookingInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await refreshAfter('Booking invoice generated.', () =>
      api.post('/admin/invoices/generate', {
        bookingId: bookingInvoiceForm.bookingId,
        dueDate: bookingInvoiceForm.dueDate || undefined,
        taxRate: Number(bookingInvoiceForm.taxRate || '0'),
      }),
    );
    setBookingInvoiceForm({ bookingId: '', dueDate: '', taxRate: '0' });
  }

  async function handleGenerateWarehouseInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await refreshAfter('Warehouse invoice generated.', () =>
      api.post('/admin/billing/warehouse-invoice', {
        warehouseId: warehouseInvoiceForm.warehouseId,
        customerId: warehouseInvoiceForm.customerId,
        dateFrom: warehouseInvoiceForm.dateFrom,
        dateTo: warehouseInvoiceForm.dateTo,
        ratePerUnitPerDay: Number(warehouseInvoiceForm.ratePerUnitPerDay),
        dueDate: warehouseInvoiceForm.dueDate || undefined,
        taxRate: Number(warehouseInvoiceForm.taxRate || '0'),
        issueImmediately: warehouseInvoiceForm.issueImmediately,
      }),
    );
  }

  async function handleConsolidateInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await refreshAfter('Combined invoice generated.', () =>
      api.post('/admin/billing/consolidate', {
        customerId: combinedInvoiceForm.customerId,
        bookingIds: combinedInvoiceForm.bookingIds
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        dateFrom: combinedInvoiceForm.dateFrom || undefined,
        dateTo: combinedInvoiceForm.dateTo || undefined,
        dueDate: combinedInvoiceForm.dueDate || undefined,
        taxRate: Number(combinedInvoiceForm.taxRate || '0'),
        issueImmediately: combinedInvoiceForm.issueImmediately,
      }),
    );
  }

  async function handleGeneratePlatformFeeInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await refreshAfter('Platform-fee invoice generated.', () =>
      api.post('/admin/billing/platform-fee', {
        customerId: platformInvoiceForm.customerId,
        dateFrom: platformInvoiceForm.dateFrom,
        dateTo: platformInvoiceForm.dateTo,
        billingMode: platformInvoiceForm.billingMode,
        feeAmount: platformInvoiceForm.feeAmount
          ? Number(platformInvoiceForm.feeAmount)
          : undefined,
        dueDate: platformInvoiceForm.dueDate || undefined,
        taxRate: Number(platformInvoiceForm.taxRate || '0'),
        issueImmediately: platformInvoiceForm.issueImmediately,
      }),
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Invoice records" value={String(invoices.length)} helper="Invoices returned by the active admin filters." />
        <StatCard label="Awaiting approval" value={String(invoices.filter((invoice) => invoice.isApprovalRequired && !invoice.approvedAt).length)} helper="High-value drafts needing approval." tone="info" />
        <StatCard label="Outstanding value" value={formatMoney(outstandingTotal)} helper="Balance still open across the current set." tone="success" />
      </div>

      {error ? (
        <Alert title="Invoice workflow error" variant="danger">
          {error}
        </Alert>
      ) : null}
      {success ? (
        <Alert title="Finance action completed" variant="success">
          {success}
        </Alert>
      ) : null}

      <SurfaceCard title="Filters" description="Review drafts, approval-required invoices, and issued commercial documents.">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-200">Status</span>
            <select
              className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">All statuses</option>
              {INVOICE_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {formatStatus(option)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-slate-700/60 bg-slate-950/50 px-4 py-3 text-sm text-slate-200">
            <input
              checked={approvalOnly}
              className="h-4 w-4 accent-amber-400"
              type="checkbox"
              onChange={(event) => setApprovalOnly(event.target.checked)}
            />
            Show approval-required invoices only
          </label>
        </div>
      </SurfaceCard>

      <div className="grid gap-6 xl:grid-cols-4">
        <SurfaceCard title="Generate trip invoice" description="Manual entry point for completed bookings that need a finance document now.">
          <form className="space-y-4" onSubmit={handleGenerateBookingInvoice}>
            <Input
              label="Booking ID"
              required
              value={bookingInvoiceForm.bookingId}
              onChange={(event) =>
                setBookingInvoiceForm((current) => ({ ...current, bookingId: event.target.value }))
              }
            />
            <Input
              label="Due date"
              type="date"
              value={bookingInvoiceForm.dueDate}
              onChange={(event) =>
                setBookingInvoiceForm((current) => ({ ...current, dueDate: event.target.value }))
              }
            />
            <Input
              label="Tax rate"
              help="Use decimal format, e.g. 0.16 for 16% VAT."
              type="number"
              min="0"
              step="0.01"
              value={bookingInvoiceForm.taxRate}
              onChange={(event) =>
                setBookingInvoiceForm((current) => ({ ...current, taxRate: event.target.value }))
              }
            />
            <Button type="submit">Generate booking invoice</Button>
          </form>
        </SurfaceCard>

        <SurfaceCard title="Warehouse billing" description="Space-days formula based on stored parcel occupancy within the selected window.">
          <form className="space-y-4" onSubmit={handleGenerateWarehouseInvoice}>
            <Input label="Warehouse ID" required value={warehouseInvoiceForm.warehouseId} onChange={(event) => setWarehouseInvoiceForm((current) => ({ ...current, warehouseId: event.target.value }))} />
            <Input label="Customer ID" required value={warehouseInvoiceForm.customerId} onChange={(event) => setWarehouseInvoiceForm((current) => ({ ...current, customerId: event.target.value }))} />
            <Input label="Date from" type="date" required value={warehouseInvoiceForm.dateFrom} onChange={(event) => setWarehouseInvoiceForm((current) => ({ ...current, dateFrom: event.target.value }))} />
            <Input label="Date to" type="date" required value={warehouseInvoiceForm.dateTo} onChange={(event) => setWarehouseInvoiceForm((current) => ({ ...current, dateTo: event.target.value }))} />
            <Input label="Rate per unit-day" type="number" min="0" step="0.01" required value={warehouseInvoiceForm.ratePerUnitPerDay} onChange={(event) => setWarehouseInvoiceForm((current) => ({ ...current, ratePerUnitPerDay: event.target.value }))} />
            <Input label="Due date" type="date" value={warehouseInvoiceForm.dueDate} onChange={(event) => setWarehouseInvoiceForm((current) => ({ ...current, dueDate: event.target.value }))} />
            <Input label="Tax rate" type="number" min="0" step="0.01" value={warehouseInvoiceForm.taxRate} onChange={(event) => setWarehouseInvoiceForm((current) => ({ ...current, taxRate: event.target.value }))} />
            <label className="flex items-center gap-3 text-sm text-slate-200">
              <input
                checked={warehouseInvoiceForm.issueImmediately}
                className="h-4 w-4 accent-amber-400"
                type="checkbox"
                onChange={(event) =>
                  setWarehouseInvoiceForm((current) => ({
                    ...current,
                    issueImmediately: event.target.checked,
                  }))
                }
              />
              Issue immediately when below approval threshold
            </label>
            <Button type="submit">Generate warehouse invoice</Button>
          </form>
        </SurfaceCard>

        <SurfaceCard title="Combined corporate invoice" description="Bundle multiple completed bookings into a single commercial document for corporate billing.">
          <form className="space-y-4" onSubmit={handleConsolidateInvoice}>
            <Input label="Customer ID" required value={combinedInvoiceForm.customerId} onChange={(event) => setCombinedInvoiceForm((current) => ({ ...current, customerId: event.target.value }))} />
            <Input label="Booking IDs" help="Comma-separated booking IDs. Leave empty to use the date window." value={combinedInvoiceForm.bookingIds} onChange={(event) => setCombinedInvoiceForm((current) => ({ ...current, bookingIds: event.target.value }))} />
            <Input label="Date from" type="date" value={combinedInvoiceForm.dateFrom} onChange={(event) => setCombinedInvoiceForm((current) => ({ ...current, dateFrom: event.target.value }))} />
            <Input label="Date to" type="date" value={combinedInvoiceForm.dateTo} onChange={(event) => setCombinedInvoiceForm((current) => ({ ...current, dateTo: event.target.value }))} />
            <Input label="Due date" type="date" value={combinedInvoiceForm.dueDate} onChange={(event) => setCombinedInvoiceForm((current) => ({ ...current, dueDate: event.target.value }))} />
            <Input label="Tax rate" type="number" min="0" step="0.01" value={combinedInvoiceForm.taxRate} onChange={(event) => setCombinedInvoiceForm((current) => ({ ...current, taxRate: event.target.value }))} />
            <label className="flex items-center gap-3 text-sm text-slate-200">
              <input
                checked={combinedInvoiceForm.issueImmediately}
                className="h-4 w-4 accent-amber-400"
                type="checkbox"
                onChange={(event) =>
                  setCombinedInvoiceForm((current) => ({
                    ...current,
                    issueImmediately: event.target.checked,
                  }))
                }
              />
              Issue immediately when below approval threshold
            </label>
            <Button type="submit">Generate combined invoice</Button>
          </form>
        </SurfaceCard>

        <SurfaceCard title="Owned-fleet platform fee" description="Generate recurring platform-fee invoices for customer, corporate, courier-company, or transporter fleets.">
          <form className="space-y-4" onSubmit={handleGeneratePlatformFeeInvoice}>
            <Input label="Account ID" required value={platformInvoiceForm.customerId} onChange={(event) => setPlatformInvoiceForm((current) => ({ ...current, customerId: event.target.value }))} />
            <Input label="Date from" type="date" required value={platformInvoiceForm.dateFrom} onChange={(event) => setPlatformInvoiceForm((current) => ({ ...current, dateFrom: event.target.value }))} />
            <Input label="Date to" type="date" required value={platformInvoiceForm.dateTo} onChange={(event) => setPlatformInvoiceForm((current) => ({ ...current, dateTo: event.target.value }))} />
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">Billing mode</span>
              <select
                className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                value={platformInvoiceForm.billingMode}
                onChange={(event) =>
                  setPlatformInvoiceForm((current) => ({
                    ...current,
                    billingMode: event.target.value,
                  }))
                }
              >
                <option value="PER_VEHICLE">Per vehicle</option>
                <option value="PER_FLEET">Per fleet</option>
              </select>
            </label>
            <Input label="Fee override" help="Leave blank to use the default fee configured for the selected account role." type="number" min="0" step="0.01" value={platformInvoiceForm.feeAmount} onChange={(event) => setPlatformInvoiceForm((current) => ({ ...current, feeAmount: event.target.value }))} />
            <Input label="Due date" type="date" value={platformInvoiceForm.dueDate} onChange={(event) => setPlatformInvoiceForm((current) => ({ ...current, dueDate: event.target.value }))} />
            <Input label="Tax rate" type="number" min="0" step="0.01" value={platformInvoiceForm.taxRate} onChange={(event) => setPlatformInvoiceForm((current) => ({ ...current, taxRate: event.target.value }))} />
            <label className="flex items-center gap-3 text-sm text-slate-200">
              <input
                checked={platformInvoiceForm.issueImmediately}
                className="h-4 w-4 accent-amber-400"
                type="checkbox"
                onChange={(event) =>
                  setPlatformInvoiceForm((current) => ({
                    ...current,
                    issueImmediately: event.target.checked,
                  }))
                }
              />
              Issue immediately when below approval threshold
            </label>
            <Button type="submit">Generate platform-fee invoice</Button>
          </form>
        </SurfaceCard>
      </div>

      <SurfaceCard title="Admin invoice approval dashboard" description="Issue drafts, request approval for high-value changes, approve them, and export PDF copies.">
        {loading ? (
          <Spinner />
        ) : (
          <Table
            emptyMessage="No invoices matched the current admin filters."
            rows={invoices}
            columns={[
              {
                key: 'invoice',
                header: 'Invoice',
                render: (invoice) => (
                  <div>
                    <p className="font-semibold text-white">{invoice.number}</p>
                    <p className="text-xs text-slate-400">
                      {invoice.booking?.reference ?? compactId(invoice.id)}
                    </p>
                  </div>
                ),
              },
              {
                key: 'customer',
                header: 'Customer',
                render: (invoice) => (
                  <div className="text-xs text-slate-300">
                    <p>{invoice.customer?.fullName ?? invoice.customer?.email ?? compactId(invoice.customerId)}</p>
                    <p>{formatStatus(invoice.customer?.role ?? 'UNKNOWN')}</p>
                  </div>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (invoice) => (
                  <div className="text-xs text-slate-300">
                    <p>{formatStatus(invoice.status)}</p>
                    <p>{invoice.isLocked ? 'Locked' : 'Editable draft'}</p>
                    <p>{invoice.isApprovalRequired ? 'Approval required' : 'No approval gate'}</p>
                  </div>
                ),
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
                    <p>Approved: {formatDateTime(invoice.approvedAt)}</p>
                  </div>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                render: (invoice) => (
                  <div className="space-y-2">
                    <Button
                      className="w-full"
                      disabled={busyId === invoice.id}
                      onClick={() => void handleDownload(invoice.id)}
                    >
                      {busyId === invoice.id ? 'Preparing...' : 'Download PDF'}
                    </Button>
                    {!invoice.isLocked ? (
                      <Button
                        className="w-full"
                        variant="secondary"
                        onClick={() =>
                          void refreshAfter('Approval requested.', () =>
                            api.patch(`/admin/invoices/${invoice.id}/request-approval`, {
                              reason: 'Finance review requested from admin dashboard.',
                            }),
                          )
                        }
                      >
                        Request approval
                      </Button>
                    ) : null}
                    {invoice.isApprovalRequired && !invoice.approvedAt ? (
                      <Button
                        className="w-full"
                        variant="secondary"
                        onClick={() =>
                          void refreshAfter('Invoice approved.', () =>
                            api.patch(`/admin/invoices/${invoice.id}/approve`),
                          )
                        }
                      >
                        Approve
                      </Button>
                    ) : null}
                    {!invoice.isLocked ? (
                      <Button
                        className="w-full"
                        variant="ghost"
                        onClick={() =>
                          void refreshAfter('Invoice issued and locked.', () =>
                            api.patch(`/admin/invoices/${invoice.id}/issue`, {}),
                          )
                        }
                      >
                        Issue invoice
                      </Button>
                    ) : null}
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
