'use client';

import { FormEvent, useEffect, useState } from 'react';
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
  provider?: string | null;
  providerMode?: string | null;
  providerStatus?: string | null;
  providerReceiptNumber?: string | null;
  merchantRequestId?: string | null;
  checkoutRequestId?: string | null;
  confirmedAt?: string | null;
  reversedAt?: string | null;
  failureReason?: string | null;
  createdAt?: string;
  retryCount?: number;
  booking?: {
    reference?: string | null;
  } | null;
};

type Disbursement = {
  id: string;
  reference: string;
  rail: string;
  status: string;
  amount: number;
  currency?: string | null;
  purpose: string;
  beneficiaryName: string;
  beneficiaryPhone?: string | null;
  beneficiaryPartyNumber?: string | null;
  accountReference?: string | null;
  provider?: string | null;
  providerMode?: string | null;
  providerStatus?: string | null;
  providerReceiptNumber?: string | null;
  failureReason?: string | null;
  createdAt?: string | null;
  initiatedAt?: string | null;
  processedAt?: string | null;
  reversedAt?: string | null;
  sourcePayment?: {
    reference?: string | null;
  } | null;
  sourceInvoice?: {
    number?: string | null;
  } | null;
};

type PaymentsResponse = {
  payments: Payment[];
  total: number;
};

type DisbursementsResponse = {
  disbursements: Disbursement[];
  total: number;
};

type DisbursementRail = 'MPESA_B2C' | 'MPESA_B2B' | 'BANK_TRANSFER';

const DISBURSEMENT_RAIL_OPTIONS: Array<{ value: '' | DisbursementRail; label: string }> = [
  { value: '', label: 'All payout rails' },
  { value: 'MPESA_B2C', label: 'M-Pesa B2C' },
  { value: 'MPESA_B2B', label: 'M-Pesa B2B' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
];

const DISBURSEMENT_STATUS_OPTIONS = [
  '',
  'CREATED',
  'INITIATED',
  'PROCESSING',
  'SUCCESS',
  'FAILED',
  'REVERSED',
] as const;

export default function AdminPaymentsPage() {
  const [status, setStatus] = useState('');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentsTotal, setPaymentsTotal] = useState(0);
  const [disbursements, setDisbursements] = useState<Disbursement[]>([]);
  const [disbursementsTotal, setDisbursementsTotal] = useState(0);
  const [disbursementRailFilter, setDisbursementRailFilter] = useState<'' | DisbursementRail>('');
  const [disbursementStatusFilter, setDisbursementStatusFilter] = useState('');
  const [createRail, setCreateRail] = useState<DisbursementRail>('MPESA_B2C');
  const [createAmount, setCreateAmount] = useState('1500');
  const [createPurpose, setCreatePurpose] = useState('Driver settlement');
  const [createBeneficiaryName, setCreateBeneficiaryName] = useState('');
  const [createBeneficiaryPhone, setCreateBeneficiaryPhone] = useState('');
  const [createBeneficiaryPartyNumber, setCreateBeneficiaryPartyNumber] = useState('');
  const [createAccountReference, setCreateAccountReference] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creatingDisbursement, setCreatingDisbursement] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      const paymentsPath = status ? `/payments?status=${encodeURIComponent(status)}` : '/payments';
      const disbursementParams = new URLSearchParams();
      if (disbursementRailFilter) {
        disbursementParams.set('rail', disbursementRailFilter);
      }
      if (disbursementStatusFilter) {
        disbursementParams.set('status', disbursementStatusFilter);
      }

      const disbursementPath = disbursementParams.size
        ? `/payments/disbursements?${disbursementParams.toString()}`
        : '/payments/disbursements';

      const [paymentsResponse, disbursementsResponse] = await Promise.all([
        api.get<PaymentsResponse>(paymentsPath),
        api.get<DisbursementsResponse>(disbursementPath),
      ]);

      setPayments(paymentsResponse.payments);
      setPaymentsTotal(paymentsResponse.total);
      setDisbursements(disbursementsResponse.disbursements);
      setDisbursementsTotal(disbursementsResponse.total);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load finance controls.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [status, disbursementRailFilter, disbursementStatusFilter]);

  async function withRefresh(entityId: string, action: () => Promise<unknown>) {
    setBusyId(entityId);
    setError(null);
    setSuccess(null);

    try {
      await action();
      setSuccess('Finance action completed.');
      await loadData();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Finance action failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function createDisbursement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatingDisbursement(true);
    setError(null);
    setSuccess(null);

    try {
      await api.post('/payments/disbursements', {
        rail: createRail,
        amount: Number(createAmount),
        purpose: createPurpose,
        beneficiaryName: createBeneficiaryName,
        beneficiaryPhone: createRail === 'MPESA_B2C' ? createBeneficiaryPhone || undefined : undefined,
        beneficiaryPartyNumber:
          createRail === 'MPESA_B2B' ? createBeneficiaryPartyNumber || undefined : undefined,
        accountReference: createAccountReference || undefined,
      });

      setSuccess('Disbursement created successfully.');
      setCreateBeneficiaryName('');
      setCreateBeneficiaryPhone('');
      setCreateBeneficiaryPartyNumber('');
      setCreateAccountReference('');
      await loadData();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to create disbursement.');
    } finally {
      setCreatingDisbursement(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Visible payments"
          value={String(payments.length)}
          helper="Current filtered collection records."
        />
        <StatCard
          label="Visible payouts"
          value={String(disbursements.length)}
          helper="B2C, B2B, and bank disbursement records in view."
          tone="info"
        />
        <StatCard
          label="Successful collections"
          value={String(payments.filter((payment) => payment.status === 'SUCCESS').length)}
          helper="Successful payment confirmations in this list."
          tone="success"
        />
        <StatCard
          label="Successful payouts"
          value={String(disbursements.filter((item) => item.status === 'SUCCESS').length)}
          helper="Completed disbursements across the visible payout rails."
          tone="warning"
        />
      </div>

      {error ? (
        <Alert title="Finance workflow error" variant="danger">
          {error}
        </Alert>
      ) : null}
      {success ? (
        <Alert title="Finance workflow updated" variant="success">
          {success}
        </Alert>
      ) : null}

      <SurfaceCard
        title="Filters"
        description="Monitor inbound collections and outbound Kenya payout rails from the same finance console."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Payment status</span>
            <select
              className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">All payment statuses</option>
              {PAYMENT_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {formatStatus(option)}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Disbursement rail</span>
            <select
              className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
              value={disbursementRailFilter}
              onChange={(event) =>
                setDisbursementRailFilter(event.target.value as '' | DisbursementRail)
              }
            >
              {DISBURSEMENT_RAIL_OPTIONS.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Disbursement status</span>
            <select
              className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
              value={disbursementStatusFilter}
              onChange={(event) => setDisbursementStatusFilter(event.target.value)}
            >
              {DISBURSEMENT_STATUS_OPTIONS.map((option) => (
                <option key={option || 'ALL'} value={option}>
                  {option ? formatStatus(option) : 'All payout statuses'}
                </option>
              ))}
            </select>
          </label>
        </div>
      </SurfaceCard>

      <SurfaceCard
        title="Create payout or settlement"
        description="Release M-Pesa B2C/B2B or bank-transfer disbursements from one finance control surface."
      >
        <form className="grid gap-4 lg:grid-cols-3" onSubmit={(event) => void createDisbursement(event)}>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Payout rail</span>
            <select
              className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
              value={createRail}
              onChange={(event) => setCreateRail(event.target.value as DisbursementRail)}
            >
              {DISBURSEMENT_RAIL_OPTIONS.filter((option) => option.value).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Amount (KES)</span>
            <input
              className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
              min="1"
              step="0.01"
              type="number"
              value={createAmount}
              onChange={(event) => setCreateAmount(event.target.value)}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Purpose</span>
            <input
              className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
              value={createPurpose}
              onChange={(event) => setCreatePurpose(event.target.value)}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Beneficiary name</span>
            <input
              className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
              value={createBeneficiaryName}
              onChange={(event) => setCreateBeneficiaryName(event.target.value)}
            />
          </label>

          {createRail === 'MPESA_B2C' ? (
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-200">Beneficiary phone</span>
              <input
                className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                placeholder="2547XXXXXXXX"
                value={createBeneficiaryPhone}
                onChange={(event) => setCreateBeneficiaryPhone(event.target.value)}
              />
            </label>
          ) : null}

          {createRail === 'MPESA_B2B' ? (
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-200">Receiving paybill / till</span>
              <input
                className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                placeholder="600123 / 123456"
                value={createBeneficiaryPartyNumber}
                onChange={(event) => setCreateBeneficiaryPartyNumber(event.target.value)}
              />
            </label>
          ) : null}

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Account reference</span>
            <input
              className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
              placeholder="Optional finance reference"
              value={createAccountReference}
              onChange={(event) => setCreateAccountReference(event.target.value)}
            />
          </label>

          <div className="lg:col-span-3">
            <Button disabled={creatingDisbursement} type="submit">
              {creatingDisbursement ? 'Creating payout...' : 'Create disbursement'}
            </Button>
          </div>
        </form>
      </SurfaceCard>

      <SurfaceCard
        title="Collections"
        description={`Inbound payment records. Total available records: ${paymentsTotal}.`}
      >
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
                    {payment.providerReceiptNumber ? (
                      <p className="text-xs text-emerald-300">Receipt: {payment.providerReceiptNumber}</p>
                    ) : null}
                  </div>
                ),
              },
              {
                key: 'method',
                header: 'Method',
                render: (payment) => (
                  <div className="text-xs text-slate-200">
                    <p>{payment.method}</p>
                    {payment.provider ? (
                      <p className="text-slate-400">
                        {payment.provider} · {payment.providerMode ?? 'UNKNOWN'}
                      </p>
                    ) : null}
                  </div>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (payment) => (
                  <div className="text-xs text-slate-200">
                    <p>{formatStatus(payment.status)}</p>
                    {payment.providerStatus ? (
                      <p className="text-slate-400">{formatStatus(payment.providerStatus)}</p>
                    ) : null}
                  </div>
                ),
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
                    {payment.confirmedAt ? <p>Confirmed: {formatDateTime(payment.confirmedAt)}</p> : null}
                    {payment.reversedAt ? <p>Reversed: {formatDateTime(payment.reversedAt)}</p> : null}
                    <p>Retries: {payment.retryCount ?? 0}</p>
                    {payment.checkoutRequestId ? <p>Checkout: {payment.checkoutRequestId}</p> : null}
                    {payment.merchantRequestId ? <p>Merchant: {payment.merchantRequestId}</p> : null}
                    {payment.failureReason ? <p className="text-rose-300">{payment.failureReason}</p> : null}
                  </div>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                render: (payment) => (
                  <div className="space-y-2">
                    {payment.method === 'MPESA' ? (
                      <Button
                        className="w-full"
                        disabled={busyId === payment.id}
                        variant="secondary"
                        onClick={() =>
                          void withRefresh(payment.id, () => api.post(`/payments/${payment.id}/mpesa/sync`))
                        }
                      >
                        Sync M-Pesa
                      </Button>
                    ) : null}
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
                    {payment.method === 'MPESA' && payment.status === 'SUCCESS' ? (
                      <Button
                        className="w-full"
                        disabled={busyId === payment.id}
                        variant="danger"
                        onClick={() =>
                          void withRefresh(payment.id, async () => {
                            const reason = window.prompt('Reversal reason');
                            if (!reason) {
                              return null;
                            }
                            await api.post(`/payments/${payment.id}/mpesa/reversal`, { reason });
                          })
                        }
                      >
                        Reverse M-Pesa
                      </Button>
                    ) : null}
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

      <SurfaceCard
        title="Outbound payouts and settlements"
        description={`Outbound finance ledger. Total available records: ${disbursementsTotal}.`}
      >
        {loading ? (
          <Spinner />
        ) : (
          <Table
            rows={disbursements}
            columns={[
              {
                key: 'beneficiary',
                header: 'Beneficiary',
                render: (item) => (
                  <div>
                    <p className="font-semibold text-white">{item.beneficiaryName}</p>
                    <p className="text-xs text-slate-400">{item.reference}</p>
                    <p className="text-xs text-slate-400">
                      {item.beneficiaryPhone || item.beneficiaryPartyNumber || 'Routing pending'}
                    </p>
                  </div>
                ),
              },
              {
                key: 'rail',
                header: 'Rail',
                render: (item) => (
                  <div className="text-xs text-slate-200">
                    <p>{formatStatus(item.rail)}</p>
                    <p className="text-slate-400">{formatStatus(item.status)}</p>
                    {item.providerStatus ? (
                      <p className="text-slate-500">{formatStatus(item.providerStatus)}</p>
                    ) : null}
                  </div>
                ),
              },
              {
                key: 'amount',
                header: 'Amount',
                render: (item) => (
                  <div className="text-xs text-slate-200">
                    <p>{formatMoney(item.amount)}</p>
                    <p className="text-slate-400">{item.purpose}</p>
                  </div>
                ),
              },
              {
                key: 'source',
                header: 'Source',
                render: (item) => (
                  <div className="text-xs text-slate-300">
                    <p>Payment: {item.sourcePayment?.reference ?? '—'}</p>
                    <p>Invoice: {item.sourceInvoice?.number ?? '—'}</p>
                    {item.accountReference ? <p>Account: {item.accountReference}</p> : null}
                  </div>
                ),
              },
              {
                key: 'meta',
                header: 'Meta',
                render: (item) => (
                  <div className="text-xs text-slate-300">
                    <p>{formatDateTime(item.createdAt)}</p>
                    {item.initiatedAt ? <p>Initiated: {formatDateTime(item.initiatedAt)}</p> : null}
                    {item.processedAt ? <p>Processed: {formatDateTime(item.processedAt)}</p> : null}
                    {item.reversedAt ? <p>Reversed: {formatDateTime(item.reversedAt)}</p> : null}
                    {item.providerReceiptNumber ? <p>Receipt: {item.providerReceiptNumber}</p> : null}
                    {item.failureReason ? <p className="text-rose-300">{item.failureReason}</p> : null}
                  </div>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                render: (item) => (
                  <div className="space-y-2">
                    {item.rail !== 'BANK_TRANSFER' ? (
                      <Button
                        className="w-full"
                        disabled={busyId === item.id}
                        variant="secondary"
                        onClick={() =>
                          void withRefresh(item.id, () =>
                            api.post(`/payments/disbursements/${item.id}/mpesa/sync`),
                          )
                        }
                      >
                        Sync payout
                      </Button>
                    ) : null}
                    {item.rail !== 'BANK_TRANSFER' && item.status === 'SUCCESS' ? (
                      <Button
                        className="w-full"
                        disabled={busyId === item.id}
                        variant="danger"
                        onClick={() =>
                          void withRefresh(item.id, async () => {
                            const reason = window.prompt('Disbursement reversal reason');
                            if (!reason) {
                              return null;
                            }
                            await api.post(`/payments/disbursements/${item.id}/mpesa/reversal`, {
                              reason,
                            });
                          })
                        }
                      >
                        Reverse payout
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
