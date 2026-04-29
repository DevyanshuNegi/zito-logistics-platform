'use client';

import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { Table } from '@/components/ui/Table';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { ApiError, api } from '@/lib/api';
import { formatDateTime, formatMoney, formatStatus } from '@/lib/format';

type EarningsSummary = {
  totalEarned: number;
  pendingAmount: number;
  recentPayrolls: Array<{
    id: string;
    status: string;
    netPayout: number;
    periodStart?: string;
    periodEnd?: string;
  }>;
  recentIncentives: Array<{
    id: string;
    type: string;
    amount: number;
    reason?: string | null;
  }>;
  recentPenalties: Array<{
    id: string;
    type: string;
    amount: number;
    reason?: string | null;
  }>;
};

type PayrollList = {
  payrolls: Array<{
    id: string;
    status: string;
    netPayout: number;
    periodStart?: string;
    periodEnd?: string;
  }>;
};

export default function DriverEarningsPage() {
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [payrolls, setPayrolls] = useState<PayrollList['payrolls']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadEarnings() {
    setLoading(true);
    setError(null);

    try {
      const [summaryResponse, payrollResponse] = await Promise.all([
        api.get<EarningsSummary>('/driver/payroll/summary'),
        api.get<PayrollList>('/driver/payroll'),
      ]);

      setSummary(summaryResponse);
      setPayrolls(payrollResponse.payrolls);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load earnings.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadEarnings();
  }, []);

  if (loading) {
    return <Spinner />;
  }

  return (
    <div className="space-y-6">
      {error ? (
        <Alert title="Earnings error" variant="danger">
          {error}
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Paid out" value={formatMoney(summary?.totalEarned)} helper="Total amount already paid." tone="success" />
        <StatCard label="Pending" value={formatMoney(summary?.pendingAmount)} helper="Payroll still awaiting settlement." tone="warning" />
        <StatCard label="Incentives" value={String(summary?.recentIncentives.length ?? 0)} helper="Recent incentive records." tone="info" />
        <StatCard label="Penalties" value={String(summary?.recentPenalties.length ?? 0)} helper="Recent penalty records." />
      </div>

      <SurfaceCard title="Payroll history" description="Recent payroll batches and their payout status.">
        <Table
          rows={payrolls}
          columns={[
            {
              key: 'period',
              header: 'Period',
              render: (payroll) => `${formatDateTime(payroll.periodStart)} → ${formatDateTime(payroll.periodEnd)}`,
            },
            {
              key: 'amount',
              header: 'Net payout',
              render: (payroll) => formatMoney(payroll.netPayout),
            },
            {
              key: 'status',
              header: 'Status',
              render: (payroll) => formatStatus(payroll.status),
            },
          ]}
        />
      </SurfaceCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <SurfaceCard title="Recent incentives" description="Latest driver incentive records.">
          <Table
            rows={summary?.recentIncentives ?? []}
            columns={[
              { key: 'type', header: 'Type', render: (item) => item.type },
              { key: 'amount', header: 'Amount', render: (item) => formatMoney(item.amount) },
              { key: 'reason', header: 'Reason', render: (item) => item.reason ?? 'No reason' },
            ]}
          />
        </SurfaceCard>

        <SurfaceCard title="Recent penalties" description="Latest driver penalty records.">
          <Table
            rows={summary?.recentPenalties ?? []}
            columns={[
              { key: 'type', header: 'Type', render: (item) => item.type },
              { key: 'amount', header: 'Amount', render: (item) => formatMoney(item.amount) },
              { key: 'reason', header: 'Reason', render: (item) => item.reason ?? 'No reason' },
            ]}
          />
        </SurfaceCard>
      </div>
    </div>
  );
}
