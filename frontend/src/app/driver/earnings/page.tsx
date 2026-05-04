'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Wallet } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
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

function getStatusClasses(status: string) {
  const normalized = status.toUpperCase();
  if (['PAID', 'COMPLETED', 'APPROVED'].includes(normalized)) {
    return 'bg-[#dcfce7] text-[#15803d]';
  }
  if (['PENDING', 'DRAFT'].includes(normalized)) {
    return 'bg-[#fef3c7] text-[#92400e]';
  }
  if (['FAILED', 'CANCELLED', 'REJECTED'].includes(normalized)) {
    return 'bg-[#fee2e2] text-[#b91c1c]';
  }
  return 'bg-[#dbeafe] text-[#1d4ed8]';
}

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

  const chartBars = useMemo(() => {
    const source = payrolls.slice(0, 7).reverse();
    const max = Math.max(...source.map((item) => item.netPayout), 1);
    const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

    return source.map((item, index) => ({
      id: item.id,
      label: labels[index] ?? `#${index + 1}`,
      height: `${Math.max(28, (item.netPayout / max) * 100)}%`,
      amount: item.netPayout,
    }));
  }, [payrolls]);

  if (loading) {
    return <Spinner />;
  }

  return (
    <div className="space-y-4">
      {error ? (
        <Alert title="Earnings issue" variant="danger">
          {error}
        </Alert>
      ) : null}

      <section className="overflow-hidden rounded-[24px] bg-[linear-gradient(180deg,#1b3f72_0%,#142f55_100%)] px-4 py-4 text-white shadow-[0_16px_38px_rgba(27,63,114,0.24)]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-100/78">
          Weekly earnings
        </p>
        <p className="mt-2 text-[2rem] font-extrabold">
          {formatMoney(summary?.totalEarned)}
        </p>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <div className="rounded-[18px] bg-white/10 px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/72">
              Payrolls
            </p>
            <p className="mt-1 text-base font-bold">{payrolls.length}</p>
          </div>
          <div className="rounded-[18px] bg-white/10 px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/72">
              Pending
            </p>
            <p className="mt-1 text-base font-bold">{formatMoney(summary?.pendingAmount)}</p>
          </div>
          <div className="rounded-[18px] bg-white/10 px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/72">
              Incentives
            </p>
            <p className="mt-1 text-base font-bold">{summary?.recentIncentives.length ?? 0}</p>
          </div>
        </div>
      </section>

      <section className="rounded-[22px] border border-[#d7e0ec] bg-white px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
              Daily breakdown
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[#1a1a2e]">
              Chart-first earnings view
            </h2>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eef4ff] text-[#1b3f72]">
            <Wallet className="h-4.5 w-4.5" />
          </div>
        </div>

        <div className="mt-4 rounded-[18px] bg-[#f8faff] px-3 py-4">
          <div className="flex h-32 items-end gap-3">
            {chartBars.length > 0 ? (
              chartBars.map((bar, index) => (
                <div key={bar.id} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex h-24 w-full items-end justify-center">
                    <div
                      className={`w-full rounded-t-[10px] ${
                        index === chartBars.length - 1
                          ? 'bg-[#e8a020]'
                          : 'bg-[#1b3f72]'
                      }`}
                      style={{ height: bar.height }}
                    />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">
                    {bar.label}
                  </span>
                </div>
              ))
            ) : (
              <div className="flex w-full items-center justify-center text-sm text-[#64748b]">
                Payroll bars will appear after the first payout batch is created.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-[22px] border border-[#d7e0ec] bg-white px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
              Payroll history
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[#1a1a2e]">
              Recent payout batches
            </h2>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {payrolls.length > 0 ? (
            payrolls.slice(0, 5).map((payroll) => (
              <div
                key={payroll.id}
                className="flex items-start gap-3 rounded-[16px] border border-[#edf2f8] bg-[#f8faff] px-3 py-3"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#eef4ff] text-[#1b3f72]">
                  <ArrowUpRight className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[#1a1a2e]">
                      {formatMoney(payroll.netPayout)}
                    </p>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${getStatusClasses(payroll.status)}`}>
                      {formatStatus(payroll.status)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[#64748b]">
                    {formatDateTime(payroll.periodStart)} {'->'} {formatDateTime(payroll.periodEnd)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[18px] border border-dashed border-[#d7e0ec] bg-[#f8faff] px-4 py-5 text-center">
              <p className="text-sm font-semibold text-[#1a1a2e]">No payroll history yet</p>
              <p className="mt-2 text-sm leading-6 text-[#64748b]">
                Your payout timeline will appear here after the first approved driver payroll batch.
              </p>
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-[22px] border border-[#d7e0ec] bg-white px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
            Incentives
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[#1a1a2e]">Latest bonus records</h2>

          <div className="mt-4 space-y-3">
            {(summary?.recentIncentives ?? []).length > 0 ? (
              summary?.recentIncentives.slice(0, 4).map((item) => (
                <div
                  key={item.id}
                  className="rounded-[16px] border border-[#edf2f8] bg-[#f8faff] px-3 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[#1a1a2e]">{item.type}</p>
                    <span className="rounded-full bg-[#dcfce7] px-2.5 py-1 text-[10px] font-bold text-[#15803d]">
                      {formatMoney(item.amount)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[#64748b]">{item.reason ?? 'No reason provided.'}</p>
                </div>
              ))
            ) : (
              <p className="rounded-[16px] bg-[#f8faff] px-3 py-4 text-sm text-[#64748b]">
                No incentives recorded yet.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-[22px] border border-[#d7e0ec] bg-white px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
            Penalties
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[#1a1a2e]">Latest deductions</h2>

          <div className="mt-4 space-y-3">
            {(summary?.recentPenalties ?? []).length > 0 ? (
              summary?.recentPenalties.slice(0, 4).map((item) => (
                <div
                  key={item.id}
                  className="rounded-[16px] border border-[#edf2f8] bg-[#f8faff] px-3 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[#1a1a2e]">{item.type}</p>
                    <span className="rounded-full bg-[#fee2e2] px-2.5 py-1 text-[10px] font-bold text-[#b91c1c]">
                      {formatMoney(item.amount)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[#64748b]">{item.reason ?? 'No reason provided.'}</p>
                </div>
              ))
            ) : (
              <p className="rounded-[16px] bg-[#f8faff] px-3 py-4 text-sm text-[#64748b]">
                No penalties recorded.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
