'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Table } from '@/components/ui/Table';
import { ApiError, api } from '@/lib/api';
import { formatDateTime, formatMoney, formatStatus } from '@/lib/format';

type InvoiceListResponse = {
  invoices: Array<{
    id: string;
    number: string;
    type: string;
    status: string;
    totalAmount: number;
    paidAmount: number;
    dueDate?: string | null;
    customer?: {
      fullName?: string | null;
      email?: string | null;
      phone?: string | null;
      role?: string | null;
    } | null;
  }>;
  total: number;
};

type InterAgencyBillResponse = {
  total: number;
  bills: Array<{
    billId: string;
    bookingReference: string;
    originCountryCode: string;
    destinationCountryCode: string;
    settlementAmount: number;
    destinationSharePct: number;
    taxRate: number;
    generatedAt: string;
  }>;
};

function summarizeInvoices(items: InvoiceListResponse['invoices']) {
  return {
    count: items.length,
    total: items.reduce((sum, item) => sum + Number(item.totalAmount ?? 0), 0),
    paid: items.reduce((sum, item) => sum + Number(item.paidAmount ?? 0), 0),
  };
}

export default function AdminBillingPage() {
  const [platformInvoices, setPlatformInvoices] = useState<InvoiceListResponse | null>(null);
  const [warehouseInvoices, setWarehouseInvoices] = useState<InvoiceListResponse | null>(null);
  const [combinedInvoices, setCombinedInvoices] = useState<InvoiceListResponse | null>(null);
  const [interAgencyBills, setInterAgencyBills] = useState<InterAgencyBillResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyForm, setBusyForm] = useState<string | null>(null);
  const [platformForm, setPlatformForm] = useState({
    customerId: '',
    dateFrom: '',
    dateTo: '',
    billingMode: 'PER_FLEET',
    feeAmount: '',
    taxRate: '',
    dueDate: '',
    issueImmediately: true,
  });
  const [warehouseForm, setWarehouseForm] = useState({
    warehouseId: '',
    customerId: '',
    dateFrom: '',
    dateTo: '',
    ratePerUnitPerDay: '',
    taxRate: '',
    dueDate: '',
    issueImmediately: true,
  });
  const [consolidateForm, setConsolidateForm] = useState({
    customerId: '',
    dateFrom: '',
    dateTo: '',
    taxRate: '',
    dueDate: '',
    issueImmediately: true,
  });
  const [interAgencyForm, setInterAgencyForm] = useState({
    bookingId: '',
    originAgencyId: '',
    destinationAgencyId: '',
    originCountryCode: 'KE',
    destinationCountryCode: 'KE',
    destinationSharePct: '',
    taxRate: '',
  });

  async function loadBillingDesk() {
    setLoading(true);
    setError(null);

    const responses = await Promise.allSettled([
      api.get<InvoiceListResponse>('/admin/invoices?type=PLATFORM'),
      api.get<InvoiceListResponse>('/admin/invoices?type=WAREHOUSE'),
      api.get<InvoiceListResponse>('/admin/invoices?type=COMBINED'),
      api.get<InterAgencyBillResponse>('/admin/billing/inter-agency'),
    ]);

    const [platformResult, warehouseResult, combinedResult, interAgencyResult] = responses;
    if (
      platformResult.status !== 'fulfilled' ||
      warehouseResult.status !== 'fulfilled' ||
      combinedResult.status !== 'fulfilled' ||
      interAgencyResult.status !== 'fulfilled'
    ) {
      const reason =
        platformResult.status === 'rejected'
          ? platformResult.reason
          : warehouseResult.status === 'rejected'
            ? warehouseResult.reason
            : combinedResult.status === 'rejected'
              ? combinedResult.reason
              : interAgencyResult.status === 'rejected'
                ? interAgencyResult.reason
                : null;
      setError(reason instanceof ApiError ? reason.message : 'Unable to load billing desk.');
      setLoading(false);
      return;
    }

    setPlatformInvoices(platformResult.value);
    setWarehouseInvoices(warehouseResult.value);
    setCombinedInvoices(combinedResult.value);
    setInterAgencyBills(interAgencyResult.value);
    setLoading(false);
  }

  useEffect(() => {
    void loadBillingDesk();
  }, []);

  async function submitPlatformInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyForm('platform');
    setError(null);
    setMessage(null);

    try {
      const response = await api.post<{ invoice: { number: string } }>('/admin/billing/platform-fee', {
        customerId: platformForm.customerId,
        dateFrom: platformForm.dateFrom,
        dateTo: platformForm.dateTo,
        billingMode: platformForm.billingMode,
        feeAmount: platformForm.feeAmount ? Number(platformForm.feeAmount) : undefined,
        taxRate: platformForm.taxRate ? Number(platformForm.taxRate) : undefined,
        dueDate: platformForm.dueDate || undefined,
        issueImmediately: platformForm.issueImmediately,
      });
      setMessage(`Platform fee invoice ${response.invoice.number} generated.`);
      await loadBillingDesk();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to generate platform fee invoice.');
    } finally {
      setBusyForm(null);
    }
  }

  async function submitWarehouseInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyForm('warehouse');
    setError(null);
    setMessage(null);

    try {
      const response = await api.post<{ number: string }>('/admin/billing/warehouse-invoice', {
        warehouseId: warehouseForm.warehouseId,
        customerId: warehouseForm.customerId,
        dateFrom: warehouseForm.dateFrom,
        dateTo: warehouseForm.dateTo,
        ratePerUnitPerDay: Number(warehouseForm.ratePerUnitPerDay),
        taxRate: warehouseForm.taxRate ? Number(warehouseForm.taxRate) : undefined,
        dueDate: warehouseForm.dueDate || undefined,
        issueImmediately: warehouseForm.issueImmediately,
      });
      setMessage(`Warehouse invoice ${response.number} generated.`);
      await loadBillingDesk();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to generate warehouse invoice.');
    } finally {
      setBusyForm(null);
    }
  }

  async function submitConsolidation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyForm('consolidate');
    setError(null);
    setMessage(null);

    try {
      const response = await api.post<{ number: string }>('/admin/billing/consolidate', {
        customerId: consolidateForm.customerId,
        dateFrom: consolidateForm.dateFrom || undefined,
        dateTo: consolidateForm.dateTo || undefined,
        taxRate: consolidateForm.taxRate ? Number(consolidateForm.taxRate) : undefined,
        dueDate: consolidateForm.dueDate || undefined,
        issueImmediately: consolidateForm.issueImmediately,
      });
      setMessage(`Combined invoice ${response.number} generated.`);
      await loadBillingDesk();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to consolidate invoices.');
    } finally {
      setBusyForm(null);
    }
  }

  async function submitInterAgencyBill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyForm('inter-agency');
    setError(null);
    setMessage(null);

    try {
      const response = await api.post<{ bill: { billId: string } }>('/admin/billing/inter-agency', {
        bookingId: interAgencyForm.bookingId,
        originAgencyId: interAgencyForm.originAgencyId || undefined,
        destinationAgencyId: interAgencyForm.destinationAgencyId || undefined,
        originCountryCode: interAgencyForm.originCountryCode,
        destinationCountryCode: interAgencyForm.destinationCountryCode,
        destinationSharePct: interAgencyForm.destinationSharePct
          ? Number(interAgencyForm.destinationSharePct)
          : undefined,
        taxRate: interAgencyForm.taxRate ? Number(interAgencyForm.taxRate) : undefined,
      });
      setMessage(`Inter-agency settlement ${response.bill.billId} generated.`);
      await loadBillingDesk();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to generate inter-agency settlement.');
    } finally {
      setBusyForm(null);
    }
  }

  const platformSummary = useMemo(
    () => summarizeInvoices(platformInvoices?.invoices ?? []),
    [platformInvoices],
  );
  const warehouseSummary = useMemo(
    () => summarizeInvoices(warehouseInvoices?.invoices ?? []),
    [warehouseInvoices],
  );
  const combinedSummary = useMemo(
    () => summarizeInvoices(combinedInvoices?.invoices ?? []),
    [combinedInvoices],
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Platform invoices"
          value={String(platformSummary.count)}
          helper={`Billed ${formatMoney(platformSummary.total)} / Paid ${formatMoney(platformSummary.paid)}`}
          tone="info"
        />
        <StatCard
          label="Warehouse invoices"
          value={String(warehouseSummary.count)}
          helper={`Billed ${formatMoney(warehouseSummary.total)} / Paid ${formatMoney(warehouseSummary.paid)}`}
          tone="warning"
        />
        <StatCard
          label="Combined invoices"
          value={String(combinedSummary.count)}
          helper={`Billed ${formatMoney(combinedSummary.total)} / Paid ${formatMoney(combinedSummary.paid)}`}
          tone="success"
        />
        <StatCard
          label="Inter-agency bills"
          value={String(interAgencyBills?.total ?? 0)}
          helper="Cross-border and handoff settlement records."
          tone="neutral"
        />
      </div>

      {error ? (
        <Alert title="Billing desk error" variant="danger">
          {error}
        </Alert>
      ) : null}

      {message ? (
        <Alert title="Billing action complete" variant="success">
          {message}
        </Alert>
      ) : null}

      <Alert title="Finance scope" variant="info">
        This desk handles platform-fee billing, warehouse billing, corporate invoice consolidation, and inter-agency settlement.
        Booking-by-booking invoice issue and approval remain available in the main Invoices workspace.
      </Alert>

      <div className="grid gap-6 xl:grid-cols-2">
        <SurfaceCard title="Platform fee invoice" description="Generate owned-fleet platform subscription invoices for customer, corporate, courier-company, agent, or transporter accounts.">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={submitPlatformInvoice}>
            <Input label="Customer ID" value={platformForm.customerId} onChange={(event) => setPlatformForm((current) => ({ ...current, customerId: event.target.value }))} />
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">Billing mode</span>
              <select
                className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                value={platformForm.billingMode}
                onChange={(event) => setPlatformForm((current) => ({ ...current, billingMode: event.target.value }))}
              >
                <option value="PER_FLEET">Per fleet</option>
                <option value="PER_VEHICLE">Per vehicle</option>
              </select>
            </label>
            <Input label="Date from" type="date" value={platformForm.dateFrom} onChange={(event) => setPlatformForm((current) => ({ ...current, dateFrom: event.target.value }))} />
            <Input label="Date to" type="date" value={platformForm.dateTo} onChange={(event) => setPlatformForm((current) => ({ ...current, dateTo: event.target.value }))} />
            <Input label="Fee amount (optional)" type="number" value={platformForm.feeAmount} onChange={(event) => setPlatformForm((current) => ({ ...current, feeAmount: event.target.value }))} />
            <Input label="Tax rate %" type="number" value={platformForm.taxRate} onChange={(event) => setPlatformForm((current) => ({ ...current, taxRate: event.target.value }))} />
            <Input label="Due date" type="date" value={platformForm.dueDate} onChange={(event) => setPlatformForm((current) => ({ ...current, dueDate: event.target.value }))} />
            <label className="flex items-center gap-3 rounded-2xl border border-slate-700/70 bg-slate-950/50 px-4 py-3 text-sm text-slate-200">
              <input checked={platformForm.issueImmediately} type="checkbox" onChange={(event) => setPlatformForm((current) => ({ ...current, issueImmediately: event.target.checked }))} />
              Issue immediately
            </label>
            <div className="md:col-span-2">
              <Button disabled={busyForm === 'platform'} type="submit">
                {busyForm === 'platform' ? 'Generating...' : 'Generate platform invoice'}
              </Button>
            </div>
          </form>
        </SurfaceCard>

        <SurfaceCard title="Warehouse invoice" description="Generate storage and warehouse-service billing for a warehouse/customer date window.">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={submitWarehouseInvoice}>
            <Input label="Warehouse ID" value={warehouseForm.warehouseId} onChange={(event) => setWarehouseForm((current) => ({ ...current, warehouseId: event.target.value }))} />
            <Input label="Customer ID" value={warehouseForm.customerId} onChange={(event) => setWarehouseForm((current) => ({ ...current, customerId: event.target.value }))} />
            <Input label="Date from" type="date" value={warehouseForm.dateFrom} onChange={(event) => setWarehouseForm((current) => ({ ...current, dateFrom: event.target.value }))} />
            <Input label="Date to" type="date" value={warehouseForm.dateTo} onChange={(event) => setWarehouseForm((current) => ({ ...current, dateTo: event.target.value }))} />
            <Input label="Rate / unit / day" type="number" value={warehouseForm.ratePerUnitPerDay} onChange={(event) => setWarehouseForm((current) => ({ ...current, ratePerUnitPerDay: event.target.value }))} />
            <Input label="Tax rate %" type="number" value={warehouseForm.taxRate} onChange={(event) => setWarehouseForm((current) => ({ ...current, taxRate: event.target.value }))} />
            <Input label="Due date" type="date" value={warehouseForm.dueDate} onChange={(event) => setWarehouseForm((current) => ({ ...current, dueDate: event.target.value }))} />
            <label className="flex items-center gap-3 rounded-2xl border border-slate-700/70 bg-slate-950/50 px-4 py-3 text-sm text-slate-200">
              <input checked={warehouseForm.issueImmediately} type="checkbox" onChange={(event) => setWarehouseForm((current) => ({ ...current, issueImmediately: event.target.checked }))} />
              Issue immediately
            </label>
            <div className="md:col-span-2">
              <Button disabled={busyForm === 'warehouse'} type="submit">
                {busyForm === 'warehouse' ? 'Generating...' : 'Generate warehouse invoice'}
              </Button>
            </div>
          </form>
        </SurfaceCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SurfaceCard title="Corporate consolidation" description="Roll completed booking invoices into a combined finance document for a customer account.">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={submitConsolidation}>
            <Input label="Customer ID" value={consolidateForm.customerId} onChange={(event) => setConsolidateForm((current) => ({ ...current, customerId: event.target.value }))} />
            <Input label="Date from" type="date" value={consolidateForm.dateFrom} onChange={(event) => setConsolidateForm((current) => ({ ...current, dateFrom: event.target.value }))} />
            <Input label="Date to" type="date" value={consolidateForm.dateTo} onChange={(event) => setConsolidateForm((current) => ({ ...current, dateTo: event.target.value }))} />
            <Input label="Tax rate %" type="number" value={consolidateForm.taxRate} onChange={(event) => setConsolidateForm((current) => ({ ...current, taxRate: event.target.value }))} />
            <Input label="Due date" type="date" value={consolidateForm.dueDate} onChange={(event) => setConsolidateForm((current) => ({ ...current, dueDate: event.target.value }))} />
            <label className="flex items-center gap-3 rounded-2xl border border-slate-700/70 bg-slate-950/50 px-4 py-3 text-sm text-slate-200">
              <input checked={consolidateForm.issueImmediately} type="checkbox" onChange={(event) => setConsolidateForm((current) => ({ ...current, issueImmediately: event.target.checked }))} />
              Issue immediately
            </label>
            <div className="md:col-span-2">
              <Button disabled={busyForm === 'consolidate'} type="submit">
                {busyForm === 'consolidate' ? 'Generating...' : 'Generate combined invoice'}
              </Button>
            </div>
          </form>
        </SurfaceCard>

        <SurfaceCard title="Inter-agency settlement" description="Create a cross-agency financial settlement record from a booking handoff or border transfer.">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={submitInterAgencyBill}>
            <Input label="Booking ID" value={interAgencyForm.bookingId} onChange={(event) => setInterAgencyForm((current) => ({ ...current, bookingId: event.target.value }))} />
            <Input label="Origin agency ID" value={interAgencyForm.originAgencyId} onChange={(event) => setInterAgencyForm((current) => ({ ...current, originAgencyId: event.target.value }))} />
            <Input label="Destination agency ID" value={interAgencyForm.destinationAgencyId} onChange={(event) => setInterAgencyForm((current) => ({ ...current, destinationAgencyId: event.target.value }))} />
            <Input label="Destination share %" type="number" value={interAgencyForm.destinationSharePct} onChange={(event) => setInterAgencyForm((current) => ({ ...current, destinationSharePct: event.target.value }))} />
            <Input label="Origin country code" value={interAgencyForm.originCountryCode} onChange={(event) => setInterAgencyForm((current) => ({ ...current, originCountryCode: event.target.value.toUpperCase() }))} />
            <Input label="Destination country code" value={interAgencyForm.destinationCountryCode} onChange={(event) => setInterAgencyForm((current) => ({ ...current, destinationCountryCode: event.target.value.toUpperCase() }))} />
            <Input label="Tax rate %" type="number" value={interAgencyForm.taxRate} onChange={(event) => setInterAgencyForm((current) => ({ ...current, taxRate: event.target.value }))} />
            <div className="md:col-span-2">
              <Button disabled={busyForm === 'inter-agency'} type="submit">
                {busyForm === 'inter-agency' ? 'Generating...' : 'Generate settlement'}
              </Button>
            </div>
          </form>
        </SurfaceCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SurfaceCard title="Recent finance invoices" description="Latest platform, warehouse, and consolidated invoices generated through finance controls.">
          {loading && !platformInvoices && !warehouseInvoices && !combinedInvoices ? (
            <div className="flex min-h-[20vh] items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <Table
              rows={[
                ...(platformInvoices?.invoices ?? []),
                ...(warehouseInvoices?.invoices ?? []),
                ...(combinedInvoices?.invoices ?? []),
              ].slice(0, 12)}
              emptyMessage="No finance invoices have been generated yet."
              columns={[
                {
                  key: 'invoice',
                  header: 'Invoice',
                  render: (invoice) => (
                    <div>
                      <p className="font-semibold text-white">{invoice.number}</p>
                      <p className="text-xs text-slate-400">
                        {formatStatus(invoice.type)} / {formatStatus(invoice.status)}
                      </p>
                    </div>
                  ),
                },
                {
                  key: 'customer',
                  header: 'Customer',
                  render: (invoice) => (
                    <div className="text-xs text-slate-300">
                      <p>{invoice.customer?.fullName ?? invoice.customer?.email ?? 'Unknown account'}</p>
                      <p>{formatStatus(invoice.customer?.role ?? 'unknown')}</p>
                    </div>
                  ),
                },
                {
                  key: 'amount',
                  header: 'Amount',
                  render: (invoice) => (
                    <div className="text-xs text-slate-300">
                      <p>Total: {formatMoney(invoice.totalAmount)}</p>
                      <p>Paid: {formatMoney(invoice.paidAmount)}</p>
                    </div>
                  ),
                },
                {
                  key: 'due',
                  header: 'Due',
                  render: (invoice) => (invoice.dueDate ? formatDateTime(invoice.dueDate) : 'No due date'),
                },
              ]}
            />
          )}
        </SurfaceCard>

        <SurfaceCard title="Inter-agency billing ledger" description="Latest settlement records produced from handoffs and cross-border operations.">
          {loading && !interAgencyBills ? (
            <div className="flex min-h-[20vh] items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <Table
              rows={interAgencyBills?.bills ?? []}
              emptyMessage="No inter-agency settlement records exist yet."
              columns={[
                {
                  key: 'bill',
                  header: 'Settlement',
                  render: (bill) => (
                    <div>
                      <p className="font-semibold text-white">{bill.bookingReference}</p>
                      <p className="text-xs text-slate-400">
                        {bill.originCountryCode} {'->'} {bill.destinationCountryCode}
                      </p>
                    </div>
                  ),
                },
                {
                  key: 'share',
                  header: 'Share',
                  render: (bill) => (
                    <div className="text-xs text-slate-300">
                      <p>Destination share: {bill.destinationSharePct.toFixed(2)}%</p>
                      <p>Tax: {bill.taxRate.toFixed(2)}%</p>
                    </div>
                  ),
                },
                {
                  key: 'amount',
                  header: 'Settlement amount',
                  render: (bill) => formatMoney(bill.settlementAmount),
                },
                {
                  key: 'generated',
                  header: 'Generated',
                  render: (bill) => formatDateTime(bill.generatedAt),
                },
              ]}
            />
          )}
        </SurfaceCard>
      </div>
    </div>
  );
}
