'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Table } from '@/components/ui/Table';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { ApiError, api } from '@/lib/api';
import { formatMoney, formatPercent, formatStatus } from '@/lib/format';

type Vehicle = {
  id: string;
  plateNumber: string;
  type: string;
  status: string;
};

type MarketplaceProfile = {
  userId: string;
  companyName: string;
  verificationStatus: string;
  serviceAreas: string[];
  commissionRatePct: number;
  serviceFeeFlat: number;
  premiumListing: boolean;
  linkedVehicles: Vehicle[];
  performance?: {
    performanceScore: number;
    completionRate: number;
    awardedTransactions: number;
  } | null;
};

type MarketplaceOpportunity = {
  bookingId: string;
  bookingReference: string;
  pricingModel: string;
  partnerType: string;
  status: string;
  bookingPrice: number;
  fixedPrice?: number | null;
  minimumBid?: number | null;
  booking?: {
    customerLabel: string;
    serviceType: string;
  } | null;
  bidsDetailed: Array<{
    id: string;
    amount: number;
    status: string;
  }>;
};

type OpportunityResponse = {
  opportunities: MarketplaceOpportunity[];
};

export default function AgentMarketplacePage() {
  const [profile, setProfile] = useState<MarketplaceProfile | null>(null);
  const [opportunities, setOpportunities] = useState<MarketplaceOpportunity[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [companyName, setCompanyName] = useState('');
  const [serviceAreas, setServiceAreas] = useState('');
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [commissionRatePct, setCommissionRatePct] = useState('12');
  const [serviceFeeFlat, setServiceFeeFlat] = useState('0');
  const [premiumListing, setPremiumListing] = useState('false');
  const [bookingId, setBookingId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingResponse, setSavingResponse] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedOpportunity = useMemo(
    () => opportunities.find((opportunity) => opportunity.bookingId === bookingId) ?? null,
    [bookingId, opportunities],
  );

  useEffect(() => {
    async function loadMarketplace() {
      setLoading(true);
      setError(null);
      setNotice(null);

      try {
        const vehicleResponse = await api.get<Vehicle[]>('/fleet');
        setVehicles(vehicleResponse);

        try {
          const profileResponse = await api.get<MarketplaceProfile>(
            '/marketplace/partner/profile',
          );

          setProfile(profileResponse);
          setCompanyName(profileResponse.companyName ?? '');
          setServiceAreas(profileResponse.serviceAreas.join(', '));
          setSelectedVehicleIds(profileResponse.linkedVehicles.map((vehicle) => vehicle.id));
          setCommissionRatePct(String(profileResponse.commissionRatePct ?? 12));
          setServiceFeeFlat(String(profileResponse.serviceFeeFlat ?? 0));
          setPremiumListing(profileResponse.premiumListing ? 'true' : 'false');
        } catch (caught) {
          if (caught instanceof ApiError && caught.status === 404) {
            setProfile(null);
            setNotice(
              'Submit the agent marketplace profile first. Opportunities appear after approval.',
            );
          } else {
            throw caught;
          }
        }

        try {
          const opportunitiesResponse = await api.get<OpportunityResponse>(
            '/marketplace/partner/opportunities',
          );
          setOpportunities(opportunitiesResponse.opportunities);
        } catch (caught) {
          if (caught instanceof ApiError && (caught.status === 400 || caught.status === 404)) {
            setOpportunities([]);
            setNotice(
              'Marketplace opportunities become visible after the agent profile is approved.',
            );
          } else {
            throw caught;
          }
        }
      } catch (caught) {
        setError(
          caught instanceof ApiError ? caught.message : 'Unable to load agent marketplace.',
        );
      } finally {
        setLoading(false);
      }
    }

    void loadMarketplace();
  }, []);

  async function reload() {
    try {
      const profileResponse = await api.get<MarketplaceProfile>('/marketplace/partner/profile');
      setProfile(profileResponse);
      setCompanyName(profileResponse.companyName ?? '');
      setServiceAreas(profileResponse.serviceAreas.join(', '));
      setSelectedVehicleIds(profileResponse.linkedVehicles.map((vehicle) => vehicle.id));
      setCommissionRatePct(String(profileResponse.commissionRatePct ?? 12));
      setServiceFeeFlat(String(profileResponse.serviceFeeFlat ?? 0));
      setPremiumListing(profileResponse.premiumListing ? 'true' : 'false');
    } catch {
      // keep current state if the profile refresh fails
    }

    try {
      const opportunitiesResponse = await api.get<OpportunityResponse>(
        '/marketplace/partner/opportunities',
      );
      setOpportunities(opportunitiesResponse.opportunities);
    } catch {
      setOpportunities([]);
    }
  }

  async function handleOnboard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProfile(true);
    setError(null);
    setSuccess(null);

    try {
      await api.post('/marketplace/partner/agent/onboard', {
        companyName,
        serviceAreas: serviceAreas
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        vehicleIds: selectedVehicleIds,
        commissionRatePct: Number(commissionRatePct),
        serviceFeeFlat: Number(serviceFeeFlat),
        premiumListing: premiumListing === 'true',
      });

      setSuccess('Agent marketplace profile submitted for review.');
      await reload();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Unable to save the agent marketplace profile.',
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleOpportunityResponse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOpportunity) {
      setError('Choose a marketplace opportunity first.');
      return;
    }

    setSavingResponse(true);
    setError(null);
    setSuccess(null);

    try {
      if (selectedOpportunity.pricingModel === 'FIXED_PRICE') {
        await api.post(`/marketplace/partner/opportunities/${selectedOpportunity.bookingId}/accept`);
        setSuccess('Fixed-price opportunity accepted.');
      } else {
        await api.post(`/marketplace/partner/opportunities/${selectedOpportunity.bookingId}/bids`, {
          amount: Number(amount),
          note: note.trim() || undefined,
        });
        setSuccess('Bid submitted to the marketplace opportunity.');
      }

      setBookingId('');
      setAmount('');
      setNote('');
      await reload();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Unable to respond to the marketplace opportunity.',
      );
    } finally {
      setSavingResponse(false);
    }
  }

  if (loading) {
    return <Spinner />;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Marketplace status"
          value={formatStatus(profile?.verificationStatus ?? 'PENDING_REVIEW')}
          helper="Approval state for the agent partner profile."
          tone="info"
        />
        <StatCard
          label="Linked vehicles"
          value={String(profile?.linkedVehicles.length ?? 0)}
          helper="Vehicles currently exposed to marketplace supply."
        />
        <StatCard
          label="Awarded jobs"
          value={String(profile?.performance?.awardedTransactions ?? 0)}
          helper="Jobs awarded to this agent network."
          tone="success"
        />
        <StatCard
          label="Completion rate"
          value={formatPercent(profile?.performance?.completionRate ?? 0)}
          helper={`Score ${profile?.performance?.performanceScore ?? 0}`}
          tone="warning"
        />
      </div>

      {error ? (
        <Alert title="Agent marketplace error" variant="danger">
          {error}
        </Alert>
      ) : null}
      {success ? (
        <Alert title="Marketplace update applied" variant="success">
          {success}
        </Alert>
      ) : null}
      {notice ? <Alert title="Marketplace setup">{notice}</Alert> : null}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SurfaceCard
          title="Agent marketplace profile"
          description="Publish your supply footprint, service areas, and commission model for approval."
        >
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleOnboard}>
            <Input
              label="Company name"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              required
            />
            <Input
              label="Service areas"
              value={serviceAreas}
              onChange={(event) => setServiceAreas(event.target.value)}
              placeholder="Mumbai, Thane, Pune"
            />
            <label className="block space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-slate-200">Linked vehicles</span>
              <select
                multiple
                className="min-h-[180px] w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                value={selectedVehicleIds}
                onChange={(event) =>
                  setSelectedVehicleIds(
                    Array.from(event.target.selectedOptions).map((option) => option.value),
                  )
                }
              >
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.plateNumber} · {vehicle.type} · {formatStatus(vehicle.status)}
                  </option>
                ))}
              </select>
            </label>
            <Input
              label="Commission %"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={commissionRatePct}
              onChange={(event) => setCommissionRatePct(event.target.value)}
            />
            <Input
              label="Service fee"
              type="number"
              min="0"
              step="0.01"
              value={serviceFeeFlat}
              onChange={(event) => setServiceFeeFlat(event.target.value)}
            />
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">Listing mode</span>
              <select
                className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                value={premiumListing}
                onChange={(event) => setPremiumListing(event.target.value)}
              >
                <option value="false">Standard</option>
                <option value="true">Premium listing</option>
              </select>
            </label>
            <div className="md:col-span-2">
              <Button disabled={savingProfile} type="submit">
                {savingProfile ? 'Saving profile...' : 'Submit profile'}
              </Button>
            </div>
          </form>
        </SurfaceCard>

        <SurfaceCard
          title="Opportunity response"
          description="Accept fixed-price work or submit a bid when the load is opened for pricing."
        >
          <form className="grid gap-4" onSubmit={handleOpportunityResponse}>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">Opportunity</span>
              <select
                className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                value={bookingId}
                onChange={(event) => setBookingId(event.target.value)}
              >
                <option value="">Select opportunity</option>
                {opportunities.map((opportunity) => (
                  <option key={opportunity.bookingId} value={opportunity.bookingId}>
                    {opportunity.bookingReference} · {formatStatus(opportunity.pricingModel)} ·{' '}
                    {formatStatus(opportunity.status)}
                  </option>
                ))}
              </select>
            </label>
            {selectedOpportunity && selectedOpportunity.pricingModel !== 'FIXED_PRICE' ? (
              <>
                <Input
                  label="Bid amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  required
                />
                <Input
                  label="Bid note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Availability, service promise, or dispatch note"
                />
              </>
            ) : null}
            <Button disabled={savingResponse || !selectedOpportunity} type="submit">
              {savingResponse
                ? 'Submitting...'
                : selectedOpportunity?.pricingModel === 'FIXED_PRICE'
                  ? 'Accept fixed price'
                  : 'Submit bid'}
            </Button>
          </form>
        </SurfaceCard>
      </div>

      <SurfaceCard
        title="Opportunity board"
        description="Live marketplace demand currently visible to this agent account."
      >
        <Table
          emptyMessage="No marketplace opportunities are visible to this agent yet."
          rows={opportunities}
          columns={[
            {
              key: 'opportunity',
              header: 'Opportunity',
              render: (opportunity) => (
                <div>
                  <p className="font-semibold text-white">{opportunity.bookingReference}</p>
                  <p className="text-xs text-slate-400">
                    {opportunity.booking?.customerLabel ?? 'Customer pending'} ·{' '}
                    {formatStatus(opportunity.booking?.serviceType ?? 'COURIER')}
                  </p>
                </div>
              ),
            },
            {
              key: 'pricing',
              header: 'Pricing',
              render: (opportunity) => (
                <div className="text-xs text-slate-300">
                  <p>{formatStatus(opportunity.pricingModel)}</p>
                  <p>Booking: {formatMoney(opportunity.bookingPrice, 'KES')}</p>
                  <p>Fixed: {formatMoney(opportunity.fixedPrice ?? 0, 'KES')}</p>
                </div>
              ),
            },
            {
              key: 'bids',
              header: 'Bids',
              render: (opportunity) => (
                <div className="text-xs text-slate-300">
                  <p>{opportunity.bidsDetailed.length} submitted</p>
                  <p>{formatStatus(opportunity.status)}</p>
                </div>
              ),
            },
          ]}
        />
      </SurfaceCard>
    </div>
  );
}
