'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Table } from '@/components/ui/Table';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { FeaturedListingPanel } from '@/components/marketplace/FeaturedListingPanel';
import { ApiError, api } from '@/lib/api';
import { formatMoney, formatPercent, formatStatus } from '@/lib/format';

type Vehicle = {
  id: string;
  plateNumber: string;
  type: string;
  status: string;
};

type MarketplaceProfile = {
  companyName: string;
  verificationStatus: string;
  serviceAreas: string[];
  commissionRatePct: number;
  serviceFeeFlat: number;
  premiumListing: boolean;
  linkedVehicles: Vehicle[];
  linkedWarehouses: Array<{ id: string; name: string; code: string; status: string }>;
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
  serviceAreaHints: string[];
  routeSummary?: { summary: string } | null;
  fleetRequirements?: { vehicleType?: string | null; cargoWeightKg?: number | null } | null;
  myBid?: { amount: number; status: string } | null;
};

type OpportunityResponse = {
  opportunities: MarketplaceOpportunity[];
};

type PartnerMarketplaceWorkspaceProps = {
  title: string;
  profileTitle: string;
  onboardEndpoint: string;
  showVehicleSelect?: boolean;
};

export function PartnerMarketplaceWorkspace({
  title,
  profileTitle,
  onboardEndpoint,
  showVehicleSelect = false,
}: PartnerMarketplaceWorkspaceProps) {
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
      setProfile(null);
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

  useEffect(() => {
    async function loadMarketplace() {
      setLoading(true);
      setError(null);

      try {
        if (showVehicleSelect) {
          setVehicles(await api.get<Vehicle[]>('/fleet'));
        }
        await reload();
        setNotice(null);
      } catch (caught) {
        setError(
          caught instanceof ApiError ? caught.message : 'Unable to load marketplace workspace.',
        );
      } finally {
        setLoading(false);
      }
    }

    void loadMarketplace();
  }, [showVehicleSelect]);

  async function handleOnboard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProfile(true);
    setError(null);
    setSuccess(null);

    try {
      await api.post(onboardEndpoint, {
        companyName,
        serviceAreas: serviceAreas
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        vehicleIds: showVehicleSelect ? selectedVehicleIds : undefined,
        commissionRatePct: Number(commissionRatePct),
        serviceFeeFlat: Number(serviceFeeFlat),
        premiumListing: premiumListing === 'true',
      });
      setSuccess('Marketplace profile submitted for review.');
      await reload();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Unable to save the marketplace profile.',
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
        setSuccess('Bid submitted.');
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
        <StatCard label="Marketplace status" value={formatStatus(profile?.verificationStatus ?? 'PENDING_REVIEW')} helper="Approval state for this partner profile." tone="info" />
        <StatCard label="Open opportunities" value={String(opportunities.length)} helper="Published bookings matched to this profile." />
        <StatCard label="Awarded jobs" value={String(profile?.performance?.awardedTransactions ?? 0)} helper="Jobs awarded through marketplace." tone="success" />
        <StatCard label="Completion rate" value={formatPercent(profile?.performance?.completionRate ?? 0)} helper={`Score ${profile?.performance?.performanceScore ?? 0}`} tone="warning" />
      </div>

      {error ? <Alert title="Marketplace error" variant="danger">{error}</Alert> : null}
      {success ? <Alert title="Marketplace update applied" variant="success">{success}</Alert> : null}
      {notice ? <Alert title="Marketplace setup">{notice}</Alert> : null}

      <FeaturedListingPanel opportunities={opportunities} onPurchased={reload} />

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SurfaceCard title={profileTitle} description="Publish your supply footprint, service areas, and commercial setup for approval.">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleOnboard}>
            <Input label="Company name" value={companyName} onChange={(event) => setCompanyName(event.target.value)} required />
            <Input label="Service areas" value={serviceAreas} onChange={(event) => setServiceAreas(event.target.value)} placeholder="Nairobi, Mombasa, Kisumu" />
            {showVehicleSelect ? (
              <label className="block space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-200">Linked vehicles</span>
                <select
                  multiple
                  className="min-h-[160px] w-full rounded-lg border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                  value={selectedVehicleIds}
                  onChange={(event) =>
                    setSelectedVehicleIds(
                      Array.from(event.target.selectedOptions).map((option) => option.value),
                    )
                  }
                >
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.plateNumber} - {vehicle.type} - {formatStatus(vehicle.status)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <Input label="Commission %" type="number" min="0" max="100" step="0.01" value={commissionRatePct} onChange={(event) => setCommissionRatePct(event.target.value)} />
            <Input label="Service fee" type="number" min="0" step="0.01" value={serviceFeeFlat} onChange={(event) => setServiceFeeFlat(event.target.value)} />
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">Listing mode</span>
              <select className="w-full rounded-lg border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none" value={premiumListing} onChange={(event) => setPremiumListing(event.target.value)}>
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

        <SurfaceCard title="Opportunity response" description="Accept fixed-price work or submit a bid when the load is opened for pricing.">
          <form className="grid gap-4" onSubmit={handleOpportunityResponse}>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">Opportunity</span>
              <select className="w-full rounded-lg border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none" value={bookingId} onChange={(event) => setBookingId(event.target.value)}>
                <option value="">Select opportunity</option>
                {opportunities.map((opportunity) => (
                  <option key={opportunity.bookingId} value={opportunity.bookingId}>
                    {opportunity.bookingReference} - {formatStatus(opportunity.pricingModel)} - {formatStatus(opportunity.status)}
                  </option>
                ))}
              </select>
            </label>
            {selectedOpportunity && selectedOpportunity.pricingModel !== 'FIXED_PRICE' ? (
              <>
                <Input label="Bid amount" type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required />
                <Input label="Bid note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Availability or dispatch note" />
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

      <SurfaceCard title={title} description="Live marketplace demand currently visible to this partner account.">
        <Table
          emptyMessage="No marketplace opportunities are visible yet."
          rows={opportunities}
          columns={[
            {
              key: 'opportunity',
              header: 'Opportunity',
              render: (opportunity) => (
                <div>
                  <p className="font-semibold text-white">{opportunity.bookingReference}</p>
                  <p className="text-xs text-slate-400">{opportunity.routeSummary?.summary ?? opportunity.serviceAreaHints.join(' -> ')}</p>
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
              key: 'response',
              header: 'My response',
              render: (opportunity) => (
                <div className="text-xs text-slate-300">
                  <p>{formatStatus(opportunity.status)}</p>
                  <p>{opportunity.myBid ? `${formatMoney(opportunity.myBid.amount, 'KES')} - ${formatStatus(opportunity.myBid.status)}` : 'No response yet'}</p>
                </div>
              ),
            },
          ]}
        />
      </SurfaceCard>
    </div>
  );
}
