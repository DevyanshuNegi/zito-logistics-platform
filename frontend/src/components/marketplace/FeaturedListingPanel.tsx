'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Star } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ApiError, api } from '@/lib/api';
import { formatDateTime, formatMoney, formatStatus } from '@/lib/format';

export type FeaturedListingOpportunity = {
  bookingId: string;
  bookingReference: string;
  status: string;
  routeSummary?: { summary: string } | null;
  serviceAreaHints?: string[];
};

type FeaturedTier = {
  tier: string;
  pricePerDay: number;
  minDays: number;
  maxDays: number;
  description: string;
};

type FeaturedListing = {
  id: string;
  tier: string;
  expiryDate: string;
  totalCost: number;
};

type FeaturedListingPanelProps = {
  opportunities: FeaturedListingOpportunity[];
  onPurchased?: () => Promise<void> | void;
};

function centsToKes(value: number) {
  return value / 100;
}

export function FeaturedListingPanel({
  opportunities,
  onPurchased,
}: FeaturedListingPanelProps) {
  const [tiers, setTiers] = useState<FeaturedTier[]>([]);
  const [bookingId, setBookingId] = useState('');
  const [tier, setTier] = useState('FEATURED');
  const [durationDays, setDurationDays] = useState('1');
  const [saving, setSaving] = useState(false);
  const [loadingPricing, setLoadingPricing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function loadPricing() {
      setLoadingPricing(true);
      setError(null);
      try {
        const response = await api.get<FeaturedTier[]>('/marketplace/featured/pricing');
        setTiers(response);
        const firstTier = response[0];
        if (firstTier) {
          setTier(firstTier.tier);
          setDurationDays(String(firstTier.minDays));
        }
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : 'Unable to load featured pricing.');
      } finally {
        setLoadingPricing(false);
      }
    }

    void loadPricing();
  }, []);

  const selectedTier = useMemo(
    () => tiers.find((item) => item.tier === tier) ?? null,
    [tier, tiers],
  );
  const selectedOpportunity = useMemo(
    () => opportunities.find((item) => item.bookingId === bookingId) ?? null,
    [bookingId, opportunities],
  );
  const duration = Number(durationDays);
  const totalCost =
    selectedTier && Number.isFinite(duration)
      ? centsToKes(selectedTier.pricePerDay) * duration
      : 0;
  const durationInvalid =
    !selectedTier ||
    !Number.isFinite(duration) ||
    duration < selectedTier.minDays ||
    duration > selectedTier.maxDays;

  function handleTierChange(nextTier: string) {
    const next = tiers.find((item) => item.tier === nextTier);
    setTier(nextTier);
    if (next) {
      setDurationDays(String(next.minDays));
    }
    setError(null);
    setSuccess(null);
  }

  async function handlePurchase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOpportunity || !selectedTier || durationInvalid || saving) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await api.post<FeaturedListing>('/marketplace/featured', {
        bookingId: selectedOpportunity.bookingId,
        tier: selectedTier.tier,
        durationDays: duration,
      });
      setSuccess(
        `${selectedOpportunity.bookingReference} is featured until ${formatDateTime(response.expiryDate)}.`,
      );
      setBookingId('');
      if (onPurchased) {
        await onPurchased();
      }
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Unable to purchase featured placement.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-3xl border border-slate-700/40 bg-slate-900/55 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
            Featured listing
          </p>
          <h3 className="mt-2 text-lg font-semibold text-white">
            Boost a marketplace opportunity
          </h3>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-200">
          <Star className="h-5 w-5" />
        </div>
      </div>

      <p className="mt-2 text-sm leading-6 text-slate-300">
        Feature an eligible booking so it appears with priority visibility in marketplace search.
      </p>

      {error ? (
        <div className="mt-4">
          <Alert title="Featured listing issue" variant="danger">
            {error}
          </Alert>
        </div>
      ) : null}
      {success ? (
        <div className="mt-4">
          <Alert title="Featured listing active" variant="success">
            {success}
          </Alert>
        </div>
      ) : null}

      <form className="mt-4 grid gap-4" onSubmit={handlePurchase}>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-200">Booking</span>
          <select
            className="w-full rounded-lg border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
            value={bookingId}
            onChange={(event) => {
              setBookingId(event.target.value);
              setError(null);
              setSuccess(null);
            }}
            disabled={saving}
            required
          >
            <option value="">Select booking</option>
            {opportunities.map((opportunity) => (
              <option key={opportunity.bookingId} value={opportunity.bookingId}>
                {opportunity.bookingReference} - {formatStatus(opportunity.status)}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-200">Tier</span>
          <select
            className="w-full rounded-lg border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
            value={tier}
            onChange={(event) => handleTierChange(event.target.value)}
            disabled={saving || loadingPricing}
          >
            {tiers.map((item) => (
              <option key={item.tier} value={item.tier}>
                {formatStatus(item.tier)} - {formatMoney(centsToKes(item.pricePerDay))}/day
              </option>
            ))}
          </select>
        </label>

        <Input
          label="Duration days"
          type="number"
          min={selectedTier?.minDays ?? 1}
          max={selectedTier?.maxDays ?? 30}
          value={durationDays}
          onChange={(event) => {
            setDurationDays(event.target.value);
            setError(null);
            setSuccess(null);
          }}
          disabled={saving}
          required
        />

        {selectedTier ? (
          <div className="rounded-2xl border border-slate-700/40 bg-slate-950/55 px-4 py-3 text-sm text-slate-200">
            <p className="font-semibold">{selectedTier.description}</p>
            <p className="mt-1 text-slate-400">
              Allowed duration: {selectedTier.minDays}-{selectedTier.maxDays} days.
            </p>
            <p className="mt-2 font-semibold text-white">
              Estimated wallet charge: {formatMoney(totalCost)}
            </p>
          </div>
        ) : null}

        <Button
          type="submit"
          disabled={saving || loadingPricing || !bookingId || durationInvalid}
        >
          {saving ? 'Purchasing...' : 'Purchase featured listing'}
        </Button>
      </form>
    </div>
  );
}
