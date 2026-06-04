'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Crown, Loader2 } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { ApiError, api } from '@/lib/api';
import { formatDateTime, formatMoney, formatStatus } from '@/lib/format';

type SubscriptionTier = {
  tier: string;
  monthlyPrice: number;
  loadsPerDay: number;
  features: string[];
  supportLevel: string;
};

type CurrentSubscription = {
  id: string;
  tier: string;
  monthlyPrice: number;
  status: string;
  nextBillingDate?: string | null;
  autoRenew?: boolean;
};

const tierOrder = ['FREE', 'SILVER', 'GOLD', 'PLATINUM'];

function featureLabel(value: string) {
  return formatStatus(value.replace(/_/g, ' '));
}

export function DriverSubscriptionPanel() {
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [current, setCurrent] = useState<CurrentSubscription | null>(null);
  const [selectedTier, setSelectedTier] = useState('SILVER');
  const [loading, setLoading] = useState(true);
  const [savingTier, setSavingTier] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadSubscriptions() {
    setLoading(true);
    setError(null);

    try {
      const [tierResponse, currentResponse] = await Promise.all([
        api.get<SubscriptionTier[]>('/subscriptions/tiers'),
        api.get<CurrentSubscription | null>('/subscriptions/current'),
      ]);
      const sorted = [...tierResponse].sort(
        (a, b) => tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier),
      );
      setTiers(sorted);
      setCurrent(currentResponse);
      setSelectedTier(
        sorted.find((tier) => tier.tier !== 'FREE' && tier.tier !== currentResponse?.tier)?.tier ??
          'SILVER',
      );
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load subscription tiers.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSubscriptions();
  }, []);

  const selected = useMemo(
    () => tiers.find((tier) => tier.tier === selectedTier) ?? null,
    [selectedTier, tiers],
  );

  async function activateTier(tier: string) {
    if (tier === 'FREE' || savingTier) {
      return;
    }

    setSavingTier(tier);
    setError(null);
    setSuccess(null);

    try {
      const response = await api.post<CurrentSubscription>('/subscriptions', {
        tier,
        paymentMethod: 'WALLET',
      });
      if (response.status && response.status !== 'ACTIVE') {
        throw new ApiError(
          `Subscription is ${formatStatus(response.status)}. Add wallet balance and retry.`,
          402,
          response,
        );
      }
      setCurrent(response);
      setSuccess(`${formatStatus(tier)} subscription is active.`);
      await loadSubscriptions();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Unable to activate the selected subscription.',
      );
    } finally {
      setSavingTier(null);
    }
  }

  if (loading) {
    return (
      <section className="rounded-[22px] border border-[#d7e0ec] bg-white px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#64748b]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading subscription tiers
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[22px] border border-[#d7e0ec] bg-white px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
            Driver subscription
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[#1a1a2e]">
            Load visibility tier
          </h2>
        </div>
        <div className="rounded-full bg-[#eef4ff] px-3 py-1 text-xs font-bold text-[#1b3f72]">
          {current ? formatStatus(current.tier) : 'Free access'}
        </div>
      </div>

      {error ? (
        <div className="mt-4">
          <Alert title="Subscription issue" variant="danger">
            {error}
          </Alert>
        </div>
      ) : null}
      {success ? (
        <div className="mt-4">
          <Alert title="Subscription updated" variant="success">
            {success}
          </Alert>
        </div>
      ) : null}

      <div className="mt-4 rounded-[18px] bg-[#f8faff] px-3 py-3">
        <p className="text-sm font-semibold text-[#1a1a2e]">
          Current plan: {current ? formatStatus(current.tier) : 'Free'}
        </p>
        <p className="mt-1 text-xs leading-5 text-[#64748b]">
          {current?.nextBillingDate
            ? `Next billing: ${formatDateTime(current.nextBillingDate)}`
            : 'Upgrade when you need more visible loads and premium dispatch access.'}
        </p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {tiers.map((tier) => {
          const isCurrent = current?.tier === tier.tier;
          const isPaid = tier.tier !== 'FREE';
          return (
            <button
              key={tier.tier}
              type="button"
              onClick={() => setSelectedTier(tier.tier)}
              className={[
                'rounded-[18px] border px-3 py-3 text-left transition',
                selectedTier === tier.tier
                  ? 'border-[#1b3f72] bg-[#eef4ff]'
                  : 'border-[#d7e0ec] bg-white hover:border-[#9fb3cc]',
              ].join(' ')}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {tier.tier === 'PLATINUM' ? (
                    <Crown className="h-4 w-4 text-[#e8a020]" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-[#1b3f72]" />
                  )}
                  <span className="text-sm font-bold text-[#1a1a2e]">
                    {formatStatus(tier.tier)}
                  </span>
                </div>
                {isCurrent ? (
                  <span className="rounded-full bg-[#dcfce7] px-2 py-1 text-[10px] font-bold text-[#15803d]">
                    Active
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-lg font-extrabold text-[#1a1a2e]">
                {tier.monthlyPrice > 0 ? `${formatMoney(tier.monthlyPrice)}/mo` : 'Free'}
              </p>
              <p className="mt-1 text-xs text-[#64748b]">
                {tier.loadsPerDay >= 999 ? 'All visible loads' : `${tier.loadsPerDay} loads/day`}
                {' '}with {tier.supportLevel} support.
              </p>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#64748b]">
                {tier.features.slice(0, 3).map(featureLabel).join(', ')}
              </p>
              {!isPaid ? (
                <p className="mt-2 text-[11px] font-semibold text-[#64748b]">
                  Baseline access
                </p>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs leading-5 text-[#64748b]">
          {selected
            ? `${formatStatus(selected.tier)} unlocks ${selected.loadsPerDay >= 999 ? 'all loads' : `${selected.loadsPerDay} loads/day`}.`
            : 'Select a paid tier to continue.'}
        </p>
        <Button
          type="button"
          disabled={!selected || selected.tier === 'FREE' || current?.tier === selected.tier || Boolean(savingTier)}
          onClick={() => selected && void activateTier(selected.tier)}
          className="min-w-[180px]"
        >
          {savingTier ? 'Activating...' : 'Activate tier'}
        </Button>
      </div>
    </section>
  );
}
