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
import {
  compactId,
  formatDateTime,
  formatMoney,
  formatPercent,
  formatStatus,
} from '@/lib/format';

type UserOption = {
  id: string;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  role: string;
  status?: string | null;
};

type UsersResponse = {
  data: UserOption[];
};

type BookingOption = {
  id: string;
  reference: string;
  status: string;
  serviceType: string;
  totalPrice: number;
};

type BookingsResponse = {
  bookings: BookingOption[];
};

type MarketplacePartner = {
  userId: string;
  partnerType: string;
  companyName: string;
  verificationStatus: string;
  serviceAreas: string[];
  commissionRatePct: number;
  serviceFeeFlat: number;
  premiumListing: boolean;
  linkedVehicles: Array<{ id: string; plateNumber: string; type: string; status: string }>;
  linkedWarehouses: Array<{ id: string; name: string; code: string; status: string }>;
  user?: {
    id: string;
    fullName?: string | null;
    email?: string | null;
    phone?: string | null;
    role: string;
    status?: string | null;
  } | null;
  performance?: {
    performanceScore: number;
    completionRate: number;
    onTimeRate: number;
    awardedTransactions: number;
    fraudIncidents: number;
    statusRecommendation: string;
  } | null;
};

type MarketplaceBid = {
  id: string;
  partnerId: string;
  amount: number;
  status: string;
  submittedAt: string;
  counterAmount?: number | null;
  note?: string | null;
  partner?: MarketplacePartner | null;
};

type MarketplaceOpportunity = {
  bookingId: string;
  bookingReference: string;
  pricingModel: string;
  partnerType: string;
  status: string;
  fixedPrice?: number | null;
  minimumBid?: number | null;
  bookingPrice: number;
  publishedAt: string;
  expiresAt?: string | null;
  commissionAmount?: number | null;
  partnerNetAmount?: number | null;
  matchedPartnerIds: string[];
  awardedPartner?: MarketplacePartner | null;
  bidsDetailed: MarketplaceBid[];
  booking?: {
    id: string;
    customerLabel: string;
    status: string;
    serviceType: string;
    totalPrice: number;
  } | null;
};

type MarketplaceDashboardResponse = {
  summary: {
    totalPartners: number;
    approvedPartners: number;
    pendingPartners: number;
    suspendedPartners: number;
    openOpportunities: number;
    awardedTransactions: number;
    totalCommissionRevenue: number;
  };
  partners: MarketplacePartner[];
  opportunities: MarketplaceOpportunity[];
  performance: Array<{
    partnerId: string;
    companyName: string;
    performanceScore: number;
    completionRate: number;
    onTimeRate: number;
    acceptanceRate: number;
    fraudIncidents: number;
    statusRecommendation: string;
  }>;
};

const PARTNER_TYPES = [
  { value: 'TRANSPORTER', label: 'Transporter' },
  { value: 'WAREHOUSE', label: 'Warehouse partner' },
] as const;

const PRICING_MODELS = [
  { value: 'FIXED_PRICE', label: 'Fixed price' },
  { value: 'OPEN_BID', label: 'Open bid' },
  { value: 'NEGOTIATION', label: 'Negotiation' },
] as const;

const PARTNER_STATUSES = ['APPROVED', 'REJECTED', 'SUSPENDED'] as const;

const EMPTY_PARTNER_FORM = {
  partnerType: 'TRANSPORTER',
  userId: '',
  companyName: '',
  serviceAreas: '',
  assetIds: '',
  commissionRatePct: '12',
  serviceFeeFlat: '0',
  premiumListing: 'false',
};

const EMPTY_OPPORTUNITY_FORM = {
  bookingId: '',
  partnerType: 'TRANSPORTER',
  pricingModel: 'FIXED_PRICE',
  fixedPrice: '',
  minimumBid: '',
  expiresAt: '',
};

function splitCsv(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function AdminMarketplacePage() {
  const [dashboard, setDashboard] = useState<MarketplaceDashboardResponse | null>(null);
  const [transporterUsers, setTransporterUsers] = useState<UserOption[]>([]);
  const [warehouseUsers, setWarehouseUsers] = useState<UserOption[]>([]);
  const [bookings, setBookings] = useState<BookingOption[]>([]);
  const [partnerForm, setPartnerForm] = useState(EMPTY_PARTNER_FORM);
  const [opportunityForm, setOpportunityForm] = useState(EMPTY_OPPORTUNITY_FORM);
  const [loading, setLoading] = useState(true);
  const [savingPartner, setSavingPartner] = useState(false);
  const [savingOpportunity, setSavingOpportunity] = useState(false);
  const [monitoring, setMonitoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const userOptions = useMemo(
    () =>
      partnerForm.partnerType === 'WAREHOUSE'
        ? warehouseUsers
        : transporterUsers,
    [partnerForm.partnerType, transporterUsers, warehouseUsers],
  );

  const marketplaceBookings = useMemo(
    () =>
      bookings.filter((booking) =>
        ['CREATED', 'SEARCHING', 'APPROVED'].includes(booking.status),
      ),
    [bookings],
  );

  async function loadPage() {
    setLoading(true);
    setError(null);

    try {
      const [dashboardResponse, transporterResponse, warehouseResponse, bookingsResponse] =
        await Promise.all([
          api.get<MarketplaceDashboardResponse>('/marketplace/dashboard'),
          api.get<UsersResponse>('/users?role=TRANSPORTER&limit=100'),
          api.get<UsersResponse>('/users?role=WAREHOUSE_PARTNER&limit=100'),
          api.get<BookingsResponse>('/admin/bookings?limit=100'),
        ]);

      setDashboard(dashboardResponse);
      setTransporterUsers(transporterResponse.data);
      setWarehouseUsers(warehouseResponse.data);
      setBookings(bookingsResponse.bookings);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Unable to load marketplace workspace.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPage();
  }, []);

  async function handlePartnerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingPartner(true);
    setError(null);
    setSuccess(null);

    const assetIds = splitCsv(partnerForm.assetIds);
    const payload =
      partnerForm.partnerType === 'WAREHOUSE'
        ? {
            userId: partnerForm.userId,
            companyName: partnerForm.companyName,
            serviceAreas: splitCsv(partnerForm.serviceAreas),
            warehouseIds: assetIds,
            commissionRatePct: Number(partnerForm.commissionRatePct),
            serviceFeeFlat: Number(partnerForm.serviceFeeFlat),
            premiumListing: partnerForm.premiumListing === 'true',
          }
        : {
            userId: partnerForm.userId,
            companyName: partnerForm.companyName,
            serviceAreas: splitCsv(partnerForm.serviceAreas),
            vehicleIds: assetIds,
            commissionRatePct: Number(partnerForm.commissionRatePct),
            serviceFeeFlat: Number(partnerForm.serviceFeeFlat),
            premiumListing: partnerForm.premiumListing === 'true',
          };

    try {
      if (partnerForm.partnerType === 'WAREHOUSE') {
        await api.post('/marketplace/partners/warehouse', payload);
      } else {
        await api.post('/marketplace/partners/transporter', payload);
      }

      setPartnerForm(EMPTY_PARTNER_FORM);
      setSuccess('Marketplace partner submitted for review.');
      await loadPage();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Unable to save marketplace partner.',
      );
    } finally {
      setSavingPartner(false);
    }
  }

  async function handleOpportunitySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingOpportunity(true);
    setError(null);
    setSuccess(null);

    const payload = {
      partnerType: opportunityForm.partnerType,
      pricingModel: opportunityForm.pricingModel,
      fixedPrice:
        opportunityForm.pricingModel === 'FIXED_PRICE' && opportunityForm.fixedPrice
          ? Number(opportunityForm.fixedPrice)
          : undefined,
      minimumBid:
        opportunityForm.pricingModel !== 'FIXED_PRICE' && opportunityForm.minimumBid
          ? Number(opportunityForm.minimumBid)
          : undefined,
      expiresAt: opportunityForm.expiresAt || undefined,
    };

    try {
      await api.post(
        `/marketplace/bookings/${opportunityForm.bookingId}/publish`,
        payload,
      );
      setOpportunityForm(EMPTY_OPPORTUNITY_FORM);
      setSuccess('Marketplace opportunity published.');
      await loadPage();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Unable to publish marketplace opportunity.',
      );
    } finally {
      setSavingOpportunity(false);
    }
  }

  async function handlePartnerStatus(userId: string, status: string) {
    setError(null);
    setSuccess(null);

    try {
      await api.patch(`/marketplace/partners/${userId}/status`, { status });
      setSuccess(`Partner moved to ${formatStatus(status)}.`);
      await loadPage();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Unable to update marketplace partner status.',
      );
    }
  }

  async function runMonitoring() {
    setMonitoring(true);
    setError(null);
    setSuccess(null);

    try {
      await api.post('/marketplace/monitor');
      setSuccess('Marketplace performance review completed.');
      await loadPage();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Unable to run marketplace monitoring.',
      );
    } finally {
      setMonitoring(false);
    }
  }

  if (loading) {
    return <Spinner />;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Partners"
          value={String(dashboard?.summary.totalPartners ?? 0)}
          helper="Approved, pending, and suspended marketplace supply."
        />
        <StatCard
          label="Pending Review"
          value={String(dashboard?.summary.pendingPartners ?? 0)}
          helper="Partners waiting for verification and approval."
          tone="warning"
        />
        <StatCard
          label="Open Opportunities"
          value={String(dashboard?.summary.openOpportunities ?? 0)}
          helper="Bookings currently exposed to transporter or warehouse partners."
          tone="info"
        />
        <StatCard
          label="Commission Revenue"
          value={formatMoney(dashboard?.summary.totalCommissionRevenue ?? 0, 'KES')}
          helper="Marketplace commission earned from awarded transactions."
          tone="success"
        />
      </div>

      {error ? (
        <Alert title="Marketplace workflow error" variant="danger">
          {error}
        </Alert>
      ) : null}
      {success ? (
        <Alert title="Marketplace update applied" variant="success">
          {success}
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SurfaceCard
          title="Partner onboarding"
          description="Phase 5.3 onboarding, approval, and service-area registration for third-party transporters and warehouse partners."
        >
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handlePartnerSubmit}>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">Partner type</span>
              <select
                className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                value={partnerForm.partnerType}
                onChange={(event) =>
                  setPartnerForm((current) => ({
                    ...current,
                    partnerType: event.target.value,
                    userId: '',
                    assetIds: '',
                  }))
                }
              >
                {PARTNER_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">User account</span>
              <select
                className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                value={partnerForm.userId}
                onChange={(event) =>
                  setPartnerForm((current) => ({ ...current, userId: event.target.value }))
                }
              >
                <option value="">Select partner account</option>
                {userOptions.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.fullName ?? user.email ?? user.phone ?? user.id}
                  </option>
                ))}
              </select>
            </label>
            <Input
              label="Company name"
              required
              value={partnerForm.companyName}
              onChange={(event) =>
                setPartnerForm((current) => ({
                  ...current,
                  companyName: event.target.value,
                }))
              }
            />
            <Input
              label="Service areas"
              value={partnerForm.serviceAreas}
              onChange={(event) =>
                setPartnerForm((current) => ({
                  ...current,
                  serviceAreas: event.target.value,
                }))
              }
              placeholder="Nairobi, Mombasa, Kampala"
            />
            <Input
              label={
                partnerForm.partnerType === 'WAREHOUSE'
                  ? 'Warehouse IDs'
                  : 'Vehicle IDs'
              }
              value={partnerForm.assetIds}
              onChange={(event) =>
                setPartnerForm((current) => ({
                  ...current,
                  assetIds: event.target.value,
                }))
              }
              placeholder="Comma-separated IDs"
            />
            <Input
              label="Commission %"
              min="0"
              max="100"
              step="0.01"
              type="number"
              value={partnerForm.commissionRatePct}
              onChange={(event) =>
                setPartnerForm((current) => ({
                  ...current,
                  commissionRatePct: event.target.value,
                }))
              }
            />
            <Input
              label="Service fee (KES)"
              min="0"
              step="0.01"
              type="number"
              value={partnerForm.serviceFeeFlat}
              onChange={(event) =>
                setPartnerForm((current) => ({
                  ...current,
                  serviceFeeFlat: event.target.value,
                }))
              }
            />
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">Premium listing</span>
              <select
                className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                value={partnerForm.premiumListing}
                onChange={(event) =>
                  setPartnerForm((current) => ({
                    ...current,
                    premiumListing: event.target.value,
                  }))
                }
              >
                <option value="false">Standard</option>
                <option value="true">Premium listing</option>
              </select>
            </label>
            <div className="md:col-span-2">
              <Button disabled={savingPartner} type="submit">
                {savingPartner ? 'Saving partner...' : 'Submit onboarding'}
              </Button>
            </div>
          </form>
        </SurfaceCard>

        <SurfaceCard
          title="Opportunity publisher"
          description="Open a booking to fixed-price acceptance, bidding, or negotiation for marketplace partners."
        >
          <form className="grid gap-4" onSubmit={handleOpportunitySubmit}>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">Booking</span>
              <select
                className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                value={opportunityForm.bookingId}
                onChange={(event) =>
                  setOpportunityForm((current) => ({
                    ...current,
                    bookingId: event.target.value,
                  }))
                }
              >
                <option value="">Select booking</option>
                {marketplaceBookings.map((booking) => (
                  <option key={booking.id} value={booking.id}>
                    {booking.reference} · {formatStatus(booking.serviceType)} ·{' '}
                    {formatStatus(booking.status)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">Partner type</span>
              <select
                className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                value={opportunityForm.partnerType}
                onChange={(event) =>
                  setOpportunityForm((current) => ({
                    ...current,
                    partnerType: event.target.value,
                  }))
                }
              >
                {PARTNER_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">Pricing mode</span>
              <select
                className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                value={opportunityForm.pricingModel}
                onChange={(event) =>
                  setOpportunityForm((current) => ({
                    ...current,
                    pricingModel: event.target.value,
                  }))
                }
              >
                {PRICING_MODELS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {opportunityForm.pricingModel === 'FIXED_PRICE' ? (
              <Input
                label="Fixed price (KES)"
                min="0"
                step="0.01"
                type="number"
                value={opportunityForm.fixedPrice}
                onChange={(event) =>
                  setOpportunityForm((current) => ({
                    ...current,
                    fixedPrice: event.target.value,
                  }))
                }
              />
            ) : (
              <Input
                label="Minimum bid (KES)"
                min="0"
                step="0.01"
                type="number"
                value={opportunityForm.minimumBid}
                onChange={(event) =>
                  setOpportunityForm((current) => ({
                    ...current,
                    minimumBid: event.target.value,
                  }))
                }
              />
            )}
            <Input
              label="Expires at"
              type="datetime-local"
              value={opportunityForm.expiresAt}
              onChange={(event) =>
                setOpportunityForm((current) => ({
                  ...current,
                  expiresAt: event.target.value,
                }))
              }
            />
            <Button disabled={savingOpportunity} type="submit">
              {savingOpportunity ? 'Publishing...' : 'Publish opportunity'}
            </Button>
          </form>
        </SurfaceCard>
      </div>

      <SurfaceCard
        title="Partner register"
        description="Approve, reject, suspend, and review service coverage plus performance for marketplace supply."
        actions={
          <Button disabled={monitoring} variant="secondary" onClick={() => void runMonitoring()}>
            {monitoring ? 'Reviewing...' : 'Run performance review'}
          </Button>
        }
      >
        <Table
          emptyMessage="No marketplace partners have been onboarded yet."
          rows={dashboard?.partners ?? []}
          columns={[
            {
              key: 'partner',
              header: 'Partner',
              render: (partner) => (
                <div>
                  <p className="font-semibold text-white">{partner.companyName}</p>
                  <p className="text-xs text-slate-400">
                    {partner.user?.fullName ?? partner.user?.email ?? compactId(partner.userId)}
                  </p>
                  <p className="text-xs text-slate-500">{formatStatus(partner.partnerType)}</p>
                </div>
              ),
            },
            {
              key: 'coverage',
              header: 'Coverage',
              render: (partner) => (
                <div className="text-xs text-slate-300">
                  <p>{partner.serviceAreas.length > 0 ? partner.serviceAreas.join(', ') : 'Coverage not set'}</p>
                  <p>
                    Assets:{' '}
                    {partner.partnerType === 'WAREHOUSE'
                      ? partner.linkedWarehouses.length
                      : partner.linkedVehicles.length}
                  </p>
                </div>
              ),
            },
            {
              key: 'commercial',
              header: 'Commercial',
              render: (partner) => (
                <div className="text-xs text-slate-300">
                  <p>Commission: {formatPercent(partner.commissionRatePct)}</p>
                  <p>Service fee: {formatMoney(partner.serviceFeeFlat, 'KES')}</p>
                  <p>{partner.premiumListing ? 'Premium listing' : 'Standard listing'}</p>
                </div>
              ),
            },
            {
              key: 'performance',
              header: 'Performance',
              render: (partner) => (
                <div className="text-xs text-slate-300">
                  <p>Score: {partner.performance?.performanceScore ?? 0}</p>
                  <p>Completion: {formatPercent(partner.performance?.completionRate ?? 0)}</p>
                  <p>On time: {formatPercent(partner.performance?.onTimeRate ?? 0)}</p>
                </div>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              render: (partner) => (
                <div className="text-xs text-slate-300">
                  <p>{formatStatus(partner.verificationStatus)}</p>
                  <p>{formatStatus(partner.user?.status ?? 'UNKNOWN')}</p>
                </div>
              ),
            },
            {
              key: 'actions',
              header: 'Actions',
              render: (partner) => (
                <div className="space-y-2">
                  {PARTNER_STATUSES.map((status) => (
                    <Button
                      key={status}
                      className="w-full"
                      variant={
                        status === 'SUSPENDED'
                          ? 'danger'
                          : status === 'REJECTED'
                            ? 'ghost'
                            : 'secondary'
                      }
                      onClick={() => void handlePartnerStatus(partner.userId, status)}
                    >
                      {formatStatus(status)}
                    </Button>
                  ))}
                </div>
              ),
            },
          ]}
        />
      </SurfaceCard>

      <SurfaceCard
        title="Marketplace opportunity board"
        description="Published bookings, matching supply, bid activity, and awarded commission outcomes."
      >
        <Table
          emptyMessage="No marketplace opportunities have been published yet."
          rows={dashboard?.opportunities ?? []}
          columns={[
            {
              key: 'booking',
              header: 'Booking',
              render: (opportunity) => (
                <div>
                  <p className="font-semibold text-white">{opportunity.bookingReference}</p>
                  <p className="text-xs text-slate-400">
                    {opportunity.booking?.customerLabel ?? compactId(opportunity.bookingId)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatStatus(opportunity.partnerType)} ·{' '}
                    {formatStatus(opportunity.pricingModel)}
                  </p>
                </div>
              ),
            },
            {
              key: 'pricing',
              header: 'Pricing',
              render: (opportunity) => (
                <div className="text-xs text-slate-300">
                  <p>Booking: {formatMoney(opportunity.bookingPrice, 'KES')}</p>
                  <p>Fixed: {formatMoney(opportunity.fixedPrice ?? 0, 'KES')}</p>
                  <p>Minimum bid: {formatMoney(opportunity.minimumBid ?? 0, 'KES')}</p>
                </div>
              ),
            },
            {
              key: 'market',
              header: 'Market fit',
              render: (opportunity) => (
                <div className="text-xs text-slate-300">
                  <p>Matches: {opportunity.matchedPartnerIds.length}</p>
                  <p>Bids: {opportunity.bidsDetailed.length}</p>
                  <p>Expires: {formatDateTime(opportunity.expiresAt)}</p>
                </div>
              ),
            },
            {
              key: 'winner',
              header: 'Award',
              render: (opportunity) => (
                <div className="text-xs text-slate-300">
                  <p>
                    {opportunity.awardedPartner?.companyName ?? 'Not awarded'}
                  </p>
                  <p>Commission: {formatMoney(opportunity.commissionAmount ?? 0, 'KES')}</p>
                  <p>Partner net: {formatMoney(opportunity.partnerNetAmount ?? 0, 'KES')}</p>
                </div>
              ),
            },
            {
              key: 'bids',
              header: 'Bid stack',
              render: (opportunity) => (
                <div className="space-y-2 text-xs text-slate-300">
                  {opportunity.bidsDetailed.length === 0 ? (
                    <p>No bids yet.</p>
                  ) : (
                    opportunity.bidsDetailed.slice(0, 3).map((bid) => (
                      <div key={bid.id} className="rounded-2xl border border-slate-800/80 p-2">
                        <p>{bid.partner?.companyName ?? compactId(bid.partnerId)}</p>
                        <p>
                          {formatMoney(bid.amount, 'KES')} · {formatStatus(bid.status)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              ),
            },
          ]}
        />
      </SurfaceCard>
    </div>
  );
}
