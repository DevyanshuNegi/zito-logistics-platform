'use client';

import { useEffect, useState } from 'react';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { Table } from '@/components/ui/Table';
import { ApiError, api } from '@/lib/api';
import { compactId, formatDateTime, formatMoney, formatPercent, formatStatus } from '@/lib/format';

type RetentionOverview = {
  generatedAt: string;
  summary: {
    registeredCustomers: number;
    activeCustomers: number;
    repeatCustomers: number;
    repeatRate: number;
    averageClv: number;
    totalLifetimeValue: number;
    npsScore: number;
    atRiskCustomers: number;
  };
  segments: Array<{
    segment: string;
    label: string;
    count: number;
    description: string;
  }>;
  topCustomers: Array<{
    customerId: string;
    label: string;
    role: string;
    bookingCount: number;
    completedBookings: number;
    lifetimeValue: number;
    paidValue: number;
    lastBookingAt: string | null;
    repeatCustomer: boolean;
  }>;
  notes: string[];
};

type PromosSnapshot = {
  readiness: string;
  promoCodes: {
    totalCodes: number;
    redemptions: number;
    note: string;
  };
  loyaltyPoints: {
    totalAccounts: number;
    totalPoints: number;
    note: string;
  };
  referrals: {
    totalReferrals: number;
    convertedReferrals: number;
    note: string;
  };
  supportingSignals: {
    walletAccounts: number;
    walletTransactions: number;
  };
};

type DriverReferralSnapshot = {
  summary: {
    totalReferrals: number;
    registered: number;
    converted: number;
    totalReferralBonusAmount: number;
    totalJoiningBonusAmount: number;
  };
  referrals: Array<{
    referralId: string;
    status: string;
    referrerBonusAmount: number;
    joiningBonusAmount: number;
    createdAt: string;
    convertedAt: string | null;
    referrer?: {
      user?: {
        fullName?: string | null;
        phone?: string | null;
      } | null;
    } | null;
    referredUser?: {
      fullName?: string | null;
      phone?: string | null;
      status?: string | null;
    } | null;
    convertedDriver?: {
      user?: {
        fullName?: string | null;
      } | null;
    } | null;
  }>;
};

export default function AdminRetentionPage() {
  const [overview, setOverview] = useState<RetentionOverview | null>(null);
  const [promos, setPromos] = useState<PromosSnapshot | null>(null);
  const [referrals, setReferrals] = useState<DriverReferralSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadRetention() {
    setLoading(true);
    setError(null);

    const responses = await Promise.allSettled([
      api.get<RetentionOverview>('/retention'),
      api.get<PromosSnapshot>('/retention/promos'),
      api.get<DriverReferralSnapshot>('/retention/driver-referrals'),
    ]);

    const [overviewResult, promosResult, referralsResult] = responses;
    if (
      overviewResult.status !== 'fulfilled' ||
      promosResult.status !== 'fulfilled' ||
      referralsResult.status !== 'fulfilled'
    ) {
      const reason =
        overviewResult.status === 'rejected'
          ? overviewResult.reason
          : promosResult.status === 'rejected'
            ? promosResult.reason
            : referralsResult.status === 'rejected'
              ? referralsResult.reason
              : null;
      setError(reason instanceof ApiError ? reason.message : 'Unable to load retention desk.');
      setLoading(false);
      return;
    }

    setOverview(overviewResult.value);
    setPromos(promosResult.value);
    setReferrals(referralsResult.value);
    setLoading(false);
  }

  useEffect(() => {
    void loadRetention();
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Repeat rate"
          value={formatPercent(overview?.summary.repeatRate ?? 0)}
          helper="Share of active customers who have returned for multiple bookings."
          tone="info"
        />
        <StatCard
          label="Average CLV"
          value={formatMoney(overview?.summary.averageClv ?? 0)}
          helper="Average lifetime billed value per active customer."
          tone="success"
        />
        <StatCard
          label="At-risk customers"
          value={String(overview?.summary.atRiskCustomers ?? 0)}
          helper="Customers whose recent booking activity has cooled down."
          tone="warning"
        />
        <StatCard
          label="Referral conversions"
          value={String(referrals?.summary.converted ?? 0)}
          helper="Referred drivers already converted into active supply."
          tone="danger"
        />
      </div>

      {error ? (
        <Alert title="Retention desk error" variant="danger">
          {error}
        </Alert>
      ) : null}

      <SurfaceCard title="Retention signals" description={`Overview generated ${overview ? formatDateTime(overview.generatedAt) : 'just now'}.`}>
        {loading && !overview ? (
          <div className="flex min-h-[20vh] items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-4">
            {(overview?.segments ?? []).map((segment) => (
              <StatCard
                key={segment.segment}
                label={segment.label}
                value={String(segment.count)}
                helper={segment.description}
              />
            ))}
          </div>
        )}
      </SurfaceCard>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SurfaceCard title="Top customer value" description="Highest-value customer and corporate accounts in the current billing history.">
          {loading && !overview ? (
            <div className="flex min-h-[20vh] items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <Table
              rows={overview?.topCustomers ?? []}
              emptyMessage="No customer activity has been recorded yet."
              columns={[
                {
                  key: 'customer',
                  header: 'Customer',
                  render: (customer) => (
                    <div>
                      <p className="font-semibold text-white">{customer.label}</p>
                      <p className="text-xs text-slate-400">
                        {formatStatus(customer.role)} / {compactId(customer.customerId)}
                      </p>
                    </div>
                  ),
                },
                {
                  key: 'engagement',
                  header: 'Engagement',
                  render: (customer) => (
                    <div className="text-xs text-slate-300">
                      <p>Bookings: {customer.bookingCount}</p>
                      <p>Completed: {customer.completedBookings}</p>
                      <p>{customer.repeatCustomer ? 'Repeat customer' : 'Single-booking customer'}</p>
                    </div>
                  ),
                },
                {
                  key: 'value',
                  header: 'Value',
                  render: (customer) => (
                    <div className="text-xs text-slate-300">
                      <p>Billed: {formatMoney(customer.lifetimeValue)}</p>
                      <p>Paid: {formatMoney(customer.paidValue)}</p>
                    </div>
                  ),
                },
                {
                  key: 'last',
                  header: 'Last booking',
                  render: (customer) =>
                    customer.lastBookingAt ? formatDateTime(customer.lastBookingAt) : 'No booking date',
                },
              ]}
            />
          )}
        </SurfaceCard>

        <SurfaceCard title="Promo and loyalty readiness" description="Current state of promo-code, loyalty-point, and referral data using the live wallet substrate.">
          {loading && !promos ? (
            <div className="flex min-h-[20vh] items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <div className="space-y-4">
              <Alert title={`Program state: ${formatStatus(promos?.readiness ?? 'unknown')}`} variant="info">
                Promo, loyalty, and referral readiness is being derived from wallet and audit signals in the current schema.
              </Alert>
              <div className="grid gap-4 md:grid-cols-3">
                <StatCard
                  label="Promo codes"
                  value={String(promos?.promoCodes.totalCodes ?? 0)}
                  helper={`Redemptions: ${promos?.promoCodes.redemptions ?? 0}`}
                />
                <StatCard
                  label="Loyalty accounts"
                  value={String(promos?.loyaltyPoints.totalAccounts ?? 0)}
                  helper={`Points: ${promos?.loyaltyPoints.totalPoints ?? 0}`}
                />
                <StatCard
                  label="Referrals"
                  value={String(promos?.referrals.totalReferrals ?? 0)}
                  helper={`Converted: ${promos?.referrals.convertedReferrals ?? 0}`}
                />
              </div>
              <div className="rounded-2xl border border-slate-700/40 bg-slate-950/60 px-4 py-4 text-sm text-slate-300">
                <p>Wallet accounts: {promos?.supportingSignals.walletAccounts ?? 0}</p>
                <p>Wallet transactions: {promos?.supportingSignals.walletTransactions ?? 0}</p>
              </div>
            </div>
          )}
        </SurfaceCard>
      </div>

      <SurfaceCard title="Driver referral pipeline" description="Referral invitations, conversion timing, and incentive exposure for supply growth.">
        {loading && !referrals ? (
          <div className="flex min-h-[20vh] items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <Table
            rows={referrals?.referrals ?? []}
            emptyMessage="No driver referrals are tracked yet."
            columns={[
              {
                key: 'referral',
                header: 'Referral',
                render: (referral) => (
                  <div>
                    <p className="font-semibold text-white">
                      {referral.referredUser?.fullName ?? compactId(referral.referralId)}
                    </p>
                    <p className="text-xs text-slate-400">
                      Referrer: {referral.referrer?.user?.fullName ?? 'Unknown'}
                    </p>
                  </div>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (referral) => (
                  <div className="text-xs text-slate-300">
                    <p>{formatStatus(referral.status)}</p>
                    <p>User status: {formatStatus(referral.referredUser?.status ?? 'unknown')}</p>
                  </div>
                ),
              },
              {
                key: 'bonus',
                header: 'Bonus exposure',
                render: (referral) => (
                  <div className="text-xs text-slate-300">
                    <p>Referrer: {formatMoney(referral.referrerBonusAmount)}</p>
                    <p>Joining: {formatMoney(referral.joiningBonusAmount)}</p>
                  </div>
                ),
              },
              {
                key: 'timing',
                header: 'Timing',
                render: (referral) => (
                    <div className="text-xs text-slate-300">
                      <p>Registered: {formatDateTime(referral.createdAt)}</p>
                      <p>Converted: {referral.convertedAt ? formatDateTime(referral.convertedAt) : 'Pending'}</p>
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
