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

type Driver = {
  id: string;
  isAvailable?: boolean;
  isOnline?: boolean;
  user?: {
    fullName?: string | null;
    status?: string | null;
  } | null;
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
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
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
        const [vehicleResponse, driverResponse] = await Promise.all([
          api.get<Vehicle[]>('/fleet'),
          api.get<Driver[]>('/drivers'),
        ]);

        setVehicles(vehicleResponse);
        setDrivers(driverResponse);

        try {
          const profileResponse = await api.get<MarketplaceProfile>(
            '/marketplace/partner/profile',
          );
          setProfile(profileResponse);
        } catch (caught) {
          if (caught instanceof ApiError && caught.status === 404) {
            setProfile(null);
            setNotice(
              'Complete your marketplace onboarding to expose vehicles and loads through the agent network.',
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

  const availableDrivers = drivers.filter((driver) => driver.isAvailable).length;
  const pendingDrivers = drivers.filter((driver) => driver.user?.status === 'PENDING').length;
  const activeOpportunities = opportunities.filter(
    (opportunity) => opportunity.status === 'OPEN',
  ).length;

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
          label="Vehicles"
          value={String(vehicles.length)}
          helper="Vehicles registered under the agent network."
        />
        <StatCard
          label="Drivers"
          value={String(drivers.length)}
          helper={`${availableDrivers} available right now.`}
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
          helper={`Pending driver invites: ${pendingDrivers}`}
          tone="warning"
        />
      </div>

      <SurfaceCard
        title="Supply control"
        description="Use the agent workspace to grow supply, prepare capacity, and respond to marketplace demand."
        actions={
          <div className="flex flex-wrap gap-3">
            <Link href="/agent/drivers">
              <Button>Onboard driver</Button>
            </Link>
            <Link href="/agent/fleet">
              <Button variant="secondary">Add vehicle</Button>
            </Link>
            <Link href="/agent/marketplace">
              <Button variant="secondary">Open marketplace</Button>
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
              Marketplace approval status for agent operations.
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
              Marketplace jobs awarded to this agent network.
            </p>
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard
        title="Recent demand"
        description="Recent marketplace openings that can be matched with your agent vehicles and drivers."
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
