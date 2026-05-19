'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { ApiError, api } from '@/lib/api';
import { formatPercent, formatStatus } from '@/lib/format';

type Vehicle = {
  id: string;
  plateNumber: string;
  status: string;
};

type MarketplaceProfile = {
  verificationStatus: string;
  linkedVehicles: Vehicle[];
  performance?: {
    awardedTransactions: number;
    completionRate: number;
    performanceScore: number;
  } | null;
};

type MarketplaceOpportunity = {
  bookingId: string;
  bookingReference: string;
  pricingModel: string;
  status: string;
  matchedPartnerIds: string[];
  booking?: {
    customerLabel: string;
    serviceType: string;
  } | null;
};

type OpportunityResponse = {
  opportunities: MarketplaceOpportunity[];
};

export default function AgentDashboardPage() {
  const [profile, setProfile] = useState<MarketplaceProfile | null>(null);
  const [opportunities, setOpportunities] = useState<MarketplaceOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      setError(null);
      setNotice(null);

      try {
        try {
          const profileResponse = await api.get<MarketplaceProfile>(
            '/marketplace/partner/profile',
          );
          setProfile(profileResponse);
        } catch (caught) {
          if (caught instanceof ApiError && caught.status === 404) {
            setProfile(null);
            setNotice(
              'Complete your marketplace onboarding to expose sourced capacity and trip opportunities through the agent network.',
            );
          } else {
            throw caught;
          }
        }

        try {
          const opportunityResponse = await api.get<OpportunityResponse>(
            '/marketplace/partner/opportunities',
          );
          setOpportunities(opportunityResponse.opportunities);
        } catch (caught) {
          if (caught instanceof ApiError && (caught.status === 400 || caught.status === 404)) {
            setOpportunities([]);
            setNotice(
              'Marketplace opportunities unlock after the agent partner profile is submitted and approved.',
            );
          } else {
            throw caught;
          }
        }
      } catch (caught) {
        setError(
          caught instanceof ApiError ? caught.message : 'Unable to load the agent dashboard.',
        );
      } finally {
        setLoading(false);
      }
    }

    void loadDashboard();
  }, []);

  if (loading) {
    return <Spinner />;
  }

  const activeOpportunities = opportunities.filter(
    (opportunity) => opportunity.status === 'OPEN',
  ).length;
  const sourcedCapacity = profile?.linkedVehicles.length ?? 0;

  return (
    <div className="space-y-6">
      {error ? (
        <Alert title="Agent dashboard error" variant="danger">
          {error}
        </Alert>
      ) : null}
      {notice ? <Alert title="Next setup step">{notice}</Alert> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Sourced capacity"
          value={String(sourcedCapacity)}
          helper="Capacity references visible through the marketplace profile."
        />
        <StatCard
          label="Agent rule"
          value="No fleet ownership"
          helper="Drivers and vehicles belong to fleet owners, not agents."
          tone="success"
        />
        <StatCard
          label="Open opportunities"
          value={String(activeOpportunities)}
          helper="Live loads currently visible to the agent."
          tone="info"
        />
        <StatCard
          label="Marketplace status"
          value={formatStatus(profile?.verificationStatus ?? 'PENDING_REVIEW')}
          helper="Trip proposals unlock after marketplace approval."
          tone="warning"
        />
      </div>

      <SurfaceCard
        title="Supply control"
        description="Use the agent workspace to grow supply, prepare capacity, and respond to marketplace demand."
        actions={
          <div className="flex flex-wrap gap-3">
            <Link href="/agent/marketplace">
              <Button>Open marketplace</Button>
            </Link>
            <Link href="/agent/fleet">
              <Button variant="secondary">View fleet policy</Button>
            </Link>
            <Link href="/agent/drivers">
              <Button variant="secondary">View driver policy</Button>
            </Link>
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-700/40 bg-slate-900/55 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
              Verification
            </p>
            <p className="mt-3 text-lg font-semibold text-white">
              {formatStatus(profile?.verificationStatus ?? 'PENDING_REVIEW')}
            </p>
            <p className="text-sm text-slate-300">
              Marketplace approval status for agent operations and trip proposals.
            </p>
          </div>
          <div className="rounded-3xl border border-slate-700/40 bg-slate-900/55 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
              Performance score
            </p>
            <p className="mt-3 text-lg font-semibold text-white">
              {profile?.performance?.performanceScore ?? 0}
            </p>
            <p className="text-sm text-slate-300">
              Completion {formatPercent(profile?.performance?.completionRate ?? 0)}
            </p>
          </div>
          <div className="rounded-3xl border border-slate-700/40 bg-slate-900/55 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
              Awarded jobs
            </p>
            <p className="mt-3 text-lg font-semibold text-white">
              {profile?.performance?.awardedTransactions ?? 0}
            </p>
            <p className="text-sm text-slate-300">
              Marketplace jobs awarded through the agent network.
            </p>
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard
        title="Recent demand"
        description="Recent marketplace openings that can be matched with sourced capacity from approved fleet owners."
      >
        <div className="space-y-3">
          {opportunities.length === 0 ? (
            <p className="text-sm text-slate-400">No agent opportunities are open yet.</p>
          ) : (
            opportunities.slice(0, 5).map((opportunity) => (
              <div
                key={opportunity.bookingId}
                className="rounded-3xl border border-slate-700/40 bg-slate-900/55 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{opportunity.bookingReference}</p>
                    <p className="text-sm text-slate-300">
                      {opportunity.booking?.customerLabel ?? 'Customer pending'} ·{' '}
                      {formatStatus(opportunity.booking?.serviceType ?? 'COURIER')}
                    </p>
                  </div>
                  <div className="text-right text-sm text-slate-300">
                    <p>{formatStatus(opportunity.pricingModel)}</p>
                    <p>{formatStatus(opportunity.status)}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </SurfaceCard>
    </div>
  );
}
