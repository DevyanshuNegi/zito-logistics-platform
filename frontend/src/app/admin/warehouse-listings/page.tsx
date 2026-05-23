'use client';

import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Table } from '@/components/ui/Table';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { ApiError, api } from '@/lib/api';
import { formatDateTime, formatMoney, formatStatus } from '@/lib/format';

type WarehouseListing = {
  id: string;
  title: string;
  companyName: string;
  areaLabel: string;
  address: string;
  storageTypes: string[];
  photoUrls: string[];
  documentUrls: string[];
  availableCapacity: number;
  totalCapacity: number;
  capacityUnit: string;
  rateAmount: number;
  rateUnit: string;
  handlingFee: number;
  vatApplies: boolean;
  vatRatePct: number;
  status: string;
  reviewNote?: string | null;
  warehouse?: { name: string; code: string } | null;
};

type WarehouseBooking = {
  id: string;
  reference: string;
  status: string;
  totalAmount: number;
  commissionAmount: number;
  partnerNetAmount: number;
  createdAt: string;
  listing?: { title: string; companyName: string } | null;
};

const REVIEW_STATUSES = ['APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'SUSPENDED'] as const;

export default function AdminWarehouseListingsPage() {
  const [listings, setListings] = useState<WarehouseListing[]>([]);
  const [bookings, setBookings] = useState<WarehouseBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [listingResponse, bookingResponse] = await Promise.all([
        api.get<WarehouseListing[]>('/warehouse/admin/listings'),
        api.get<WarehouseBooking[]>('/warehouse/admin/bookings'),
      ]);
      setListings(listingResponse);
      setBookings(bookingResponse);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load warehouse listing control.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function reviewListing(listingId: string, status: string) {
    setBusyId(`${listingId}:${status}`);
    setError(null);
    setSuccess(null);
    try {
      await api.patch(`/warehouse/admin/listings/${listingId}/review`, {
        status,
        note:
          status === 'APPROVED'
            ? 'Approved for customer warehouse booking.'
            : `Moved to ${formatStatus(status)} by admin review.`,
      });
      setSuccess(`Warehouse listing moved to ${formatStatus(status)}.`);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to review warehouse listing.');
    } finally {
      setBusyId(null);
    }
  }

  const pending = listings.filter((listing) => listing.status === 'PENDING_REVIEW').length;
  const approved = listings.filter((listing) => listing.status === 'APPROVED').length;
  const commission = bookings.reduce((sum, booking) => sum + booking.commissionAmount, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Listings" value={String(listings.length)} helper="All warehouse listings submitted." />
        <StatCard label="Pending review" value={String(pending)} helper="Need admin verification." tone="warning" />
        <StatCard label="Approved" value={String(approved)} helper="Visible to customers." tone="success" />
        <StatCard label="Commission" value={formatMoney(commission, 'KES')} helper="10% booking commission recorded." tone="info" />
      </div>

      {error ? <Alert title="Warehouse listing control issue" variant="danger">{error}</Alert> : null}
      {success ? <Alert title="Warehouse listing control updated" variant="success">{success}</Alert> : null}

      <SurfaceCard title="Warehouse listing review" description="Verify company details, documents, rates, capacity, VAT, and customer visibility.">
        {loading ? (
          <Spinner />
        ) : (
          <Table
            rows={listings}
            emptyMessage="No warehouse listings submitted yet."
            columns={[
              {
                key: 'listing',
                header: 'Listing',
                render: (listing) => (
                  <div>
                    <p className="font-semibold text-white">{listing.title}</p>
                    <p className="text-xs text-slate-400">{listing.companyName} / {listing.areaLabel}</p>
                    <p className="text-xs text-slate-500">{listing.address}</p>
                  </div>
                ),
              },
              {
                key: 'proof',
                header: 'Proof',
                render: (listing) => (
                  <div className="text-xs text-slate-300">
                    <p>Photos: {listing.photoUrls?.length ?? 0}</p>
                    <p>Documents: {listing.documentUrls?.length ?? 0}</p>
                    <p>VAT: {listing.vatApplies ? `${listing.vatRatePct}%` : 'No'}</p>
                  </div>
                ),
              },
              {
                key: 'capacity',
                header: 'Capacity',
                render: (listing) => `${listing.availableCapacity}/${listing.totalCapacity} ${listing.capacityUnit}`,
              },
              {
                key: 'rates',
                header: 'Rates',
                render: (listing) => (
                  <div className="text-xs text-slate-300">
                    <p>{formatMoney(listing.rateAmount, 'KES')} / {listing.rateUnit}</p>
                    <p>Handling: {formatMoney(listing.handlingFee, 'KES')}</p>
                  </div>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (listing) => (
                  <div className="text-xs text-slate-300">
                    <p>{formatStatus(listing.status)}</p>
                    <p>{listing.reviewNote ?? 'No note yet'}</p>
                  </div>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                render: (listing) => (
                  <div className="grid gap-2">
                    {REVIEW_STATUSES.map((status) => (
                      <Button
                        key={status}
                        className="w-full"
                        disabled={busyId === `${listing.id}:${status}`}
                        variant={status === 'APPROVED' ? 'secondary' : status === 'REJECTED' || status === 'SUSPENDED' ? 'danger' : 'ghost'}
                        onClick={() => void reviewListing(listing.id, status)}
                      >
                        {formatStatus(status)}
                      </Button>
                    ))}
                  </div>
                ),
              },
            ]}
          />
        )}
      </SurfaceCard>

      <SurfaceCard title="Warehouse booking ledger" description="Online customer warehouse bookings and commission capture.">
        <Table
          rows={bookings}
          emptyMessage="No warehouse bookings yet."
          columns={[
            {
              key: 'booking',
              header: 'Booking',
              render: (booking) => (
                <div>
                  <p className="font-semibold text-white">{booking.reference}</p>
                  <p className="text-xs text-slate-400">{booking.listing?.title ?? 'Warehouse booking'}</p>
                  <p className="text-xs text-slate-500">{formatDateTime(booking.createdAt)}</p>
                </div>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              render: (booking) => formatStatus(booking.status),
            },
            {
              key: 'commercial',
              header: 'Commercial',
              render: (booking) => (
                <div className="text-xs text-slate-300">
                  <p>Total: {formatMoney(booking.totalAmount, 'KES')}</p>
                  <p>Commission: {formatMoney(booking.commissionAmount, 'KES')}</p>
                  <p>Partner net: {formatMoney(booking.partnerNetAmount, 'KES')}</p>
                </div>
              ),
            },
          ]}
        />
      </SurfaceCard>
    </div>
  );
}
