'use client';

import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { Table } from '@/components/ui/Table';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { ApiError, api } from '@/lib/api';
import { formatDateTime, formatMoney, formatStatus } from '@/lib/format';

type Contract = {
  id: string;
  businessName: string;
  creditLimit: number;
  creditUsed: number;
  creditAvailable: number;
  billingCycle: string;
  paymentTermDays: number;
  status: string;
  expiresAt?: string | null;
};

type CorporateContractsResponse = {
  contract: Contract | null;
  recentContracts: Contract[];
  creditSummary: {
    invoiceExposure: number;
    bookingExposure: number;
    totalExposure: number;
  };
};

export default function CorporateContractsPage() {
  const [payload, setPayload] = useState<CorporateContractsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadContractData() {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get<CorporateContractsResponse>('/corporate/contracts');
      setPayload(response);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load contract data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadContractData();
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Contract status" value={formatStatus(payload?.contract?.status ?? 'NONE')} helper="Current active contract state for booking on credit." />
        <StatCard label="Credit limit" value={formatMoney(payload?.contract?.creditLimit ?? 0)} helper="Approved commercial exposure ceiling." tone="success" />
        <StatCard label="Credit used" value={formatMoney(payload?.contract?.creditUsed ?? payload?.creditSummary.totalExposure ?? 0)} helper="Current exposure from invoices and open bookings." tone="info" />
        <StatCard label="Credit available" value={formatMoney(payload?.contract?.creditAvailable ?? 0)} helper="Remaining headroom before new bookings are blocked." />
      </div>

      {error ? (
        <Alert title="Corporate contract error" variant="danger">
          {error}
        </Alert>
      ) : null}

      <SurfaceCard title="Active contract" description="Commercial agreement currently governing billing cycle, payment terms, and credit access.">
        {loading ? (
          <Spinner />
        ) : payload?.contract ? (
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard label="Business" value={payload.contract.businessName} helper="Registered contract identity." />
            <StatCard label="Billing cycle" value={formatStatus(payload.contract.billingCycle)} helper="Expected invoice cadence." tone="info" />
            <StatCard label="Payment terms" value={`${payload.contract.paymentTermDays} days`} helper="Settlement window after issue." />
            <StatCard label="Expires" value={formatDateTime(payload.contract.expiresAt)} helper="Contract expiry if set." />
          </div>
        ) : (
          <Alert title="No active contract" variant="info">
            No active corporate contract is available yet. New credit-backed bookings stay blocked until your contract is activated.
          </Alert>
        )}
      </SurfaceCard>

      <SurfaceCard title="Credit exposure" description="How current invoices and open bookings are consuming contract credit.">
        {loading ? (
          <Spinner />
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="Invoice exposure" value={formatMoney(payload?.creditSummary.invoiceExposure ?? 0)} helper="Unsettled invoice value against the contract." />
            <StatCard label="Booking exposure" value={formatMoney(payload?.creditSummary.bookingExposure ?? 0)} helper="Open bookings not yet fully settled." tone="info" />
            <StatCard label="Total exposure" value={formatMoney(payload?.creditSummary.totalExposure ?? 0)} helper="Combined amount used for credit enforcement." tone="success" />
          </div>
        )}
      </SurfaceCard>

      <SurfaceCard title="Recent contracts" description="Latest contract records linked to your corporate account.">
        {loading ? (
          <Spinner />
        ) : (
          <Table
            emptyMessage="No contract records were found."
            rows={payload?.recentContracts ?? []}
            columns={[
              {
                key: 'business',
                header: 'Business',
                render: (contract) => contract.businessName,
              },
              {
                key: 'status',
                header: 'Status',
                render: (contract) => formatStatus(contract.status),
              },
              {
                key: 'credit',
                header: 'Credit',
                render: (contract) => (
                  <div className="text-xs text-slate-300">
                    <p>Limit: {formatMoney(contract.creditLimit)}</p>
                    <p>Used: {formatMoney(contract.creditUsed)}</p>
                  </div>
                ),
              },
              {
                key: 'terms',
                header: 'Terms',
                render: (contract) => (
                  <div className="text-xs text-slate-300">
                    <p>{formatStatus(contract.billingCycle)}</p>
                    <p>{contract.paymentTermDays} days</p>
                  </div>
                ),
              },
              {
                key: 'expiry',
                header: 'Expiry',
                render: (contract) => formatDateTime(contract.expiresAt),
              },
            ]}
          />
        )}
      </SurfaceCard>
    </div>
  );
}
