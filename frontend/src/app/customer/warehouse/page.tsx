'use client';

import Image from 'next/image';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, LocateFixed, MapPinned, PackageCheck, Refrigerator, ShieldCheck, Snowflake, Warehouse } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { WarehouseDiscoveryMap } from '@/components/maps/WarehouseDiscoveryMap';
import { ApiError, api } from '@/lib/api';
import { formatDateTime, formatMoney, formatStatus } from '@/lib/format';

type WarehouseListing = {
  id: string;
  title: string;
  description?: string | null;
  companyName: string;
  areaLabel: string;
  address: string;
  storageTypes: string[];
  amenities: string[];
  photoUrls: string[];
  availableCapacity: number;
  totalCapacity: number;
  capacityUnit: string;
  rateAmount: number;
  rateUnit: string;
  handlingFee: number;
  vatApplies: boolean;
  vatRatePct: number;
  minimumBookingDays: number;
  latitude?: number | null;
  longitude?: number | null;
  distanceKm?: number | null;
};

type WarehouseBooking = {
  id: string;
  reference: string;
  status: string;
  totalAmount: number;
  commissionAmount: number;
  partnerNetAmount: number;
  startDate: string;
  endDate: string;
  listing?: { title: string; areaLabel: string } | null;
};

const storageModes = [
  { value: 'ALL', label: 'All', icon: Warehouse },
  { value: 'DRY', label: 'Dry', icon: Warehouse },
  { value: 'COLD', label: 'Cold', icon: Refrigerator },
  { value: 'FROZEN', label: 'Frozen', icon: Snowflake },
  { value: 'CROSS_DOCK', label: 'Cross-dock', icon: PackageCheck },
] as const;

const EMPTY_BOOKING = {
  listingId: '',
  storageType: 'DRY',
  goodsDescription: '',
  startDate: '',
  endDate: '',
  capacityRequested: '',
  capacityUnit: 'SQM',
  customerNote: '',
};

export default function CustomerWarehousePage() {
  const [listings, setListings] = useState<WarehouseListing[]>([]);
  const [bookings, setBookings] = useState<WarehouseBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [locationFilter, setLocationFilter] = useState('');
  const [storageType, setStorageType] = useState<(typeof storageModes)[number]['value']>('ALL');
  const [nearbyPoint, setNearbyPoint] = useState<{ latitude: number; longitude: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState('25');
  const [bookingForm, setBookingForm] = useState(EMPTY_BOOKING);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (locationFilter.trim()) query.set('location', locationFilter.trim());
      if (storageType !== 'ALL') query.set('storageType', storageType);
      if (nearbyPoint) {
        query.set('latitude', String(nearbyPoint.latitude));
        query.set('longitude', String(nearbyPoint.longitude));
        query.set('radiusKm', radiusKm || '25');
      }
      const suffix = query.toString() ? `?${query.toString()}` : '';
      const [listingResponse, bookingResponse] = await Promise.all([
        api.get<WarehouseListing[]>(`/warehouse/listings/public${suffix}`),
        api.get<WarehouseBooking[]>('/warehouse/bookings'),
      ]);
      setListings(listingResponse);
      setBookings(bookingResponse);
      setBookingForm((current) => ({
        ...current,
        listingId: current.listingId || listingResponse[0]?.id || '',
        storageType:
          current.storageType === 'ALL'
            ? listingResponse[0]?.storageTypes?.[0] ?? 'DRY'
            : current.storageType,
      }));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load warehouse booking options.');
    } finally {
      setLoading(false);
    }
  }, [locationFilter, nearbyPoint, radiusKm, storageType]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedListing = useMemo(
    () => listings.find((listing) => listing.id === bookingForm.listingId) ?? listings[0] ?? null,
    [bookingForm.listingId, listings],
  );

  function selectListing(listingId: string) {
    const listing = listings.find((item) => item.id === listingId);
    setBookingForm((current) => ({
      ...current,
      listingId,
      storageType: listing?.storageTypes[0] ?? current.storageType,
      capacityUnit: listing?.capacityUnit ?? current.capacityUnit,
    }));
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError('Location permission is not available in this browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setNearbyPoint({
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
        });
      },
      () => setError('Unable to read your current location.'),
    );
  }

  const estimate = useMemo(() => {
    if (!selectedListing || !bookingForm.startDate || !bookingForm.endDate || !bookingForm.capacityRequested) {
      return null;
    }

    const start = new Date(bookingForm.startDate);
    const end = new Date(bookingForm.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return null;
    }

    const days = Math.max(
      selectedListing.minimumBookingDays,
      Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)),
    );
    const baseAmount = Number(bookingForm.capacityRequested) * selectedListing.rateAmount * days;
    const taxableAmount = baseAmount + selectedListing.handlingFee;
    const vatAmount = selectedListing.vatApplies ? taxableAmount * (selectedListing.vatRatePct / 100) : 0;
    return {
      days,
      baseAmount,
      vatAmount,
      totalAmount: taxableAmount + vatAmount,
    };
  }, [bookingForm.capacityRequested, bookingForm.endDate, bookingForm.startDate, selectedListing]);

  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const booking = await api.post<WarehouseBooking>('/warehouse/bookings', {
        listingId: bookingForm.listingId,
        storageType: bookingForm.storageType,
        goodsDescription: bookingForm.goodsDescription,
        startDate: bookingForm.startDate,
        endDate: bookingForm.endDate,
        capacityRequested: Number(bookingForm.capacityRequested),
        capacityUnit: bookingForm.capacityUnit,
        customerNote: bookingForm.customerNote || undefined,
      });
      setSuccess(`Warehouse booking ${booking.reference} submitted online.`);
      setBookingForm({
        ...EMPTY_BOOKING,
        listingId: selectedListing?.id ?? '',
        storageType: selectedListing?.storageTypes?.[0] ?? 'DRY',
        capacityUnit: selectedListing?.capacityUnit ?? 'SQM',
      });
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to create warehouse booking.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {error ? <Alert title="Warehouse booking issue" variant="danger">{error}</Alert> : null}
      {success ? <Alert title="Warehouse booking submitted" variant="success">{success}</Alert> : null}

      <section className="overflow-hidden rounded-[24px] border border-[#d7e0ec] bg-[linear-gradient(135deg,#06101f_0%,#0f1b31_100%)] p-4 text-white shadow-[0_12px_30px_rgba(6,16,31,0.22)]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/72">
          Warehouse booking
        </p>
        <h1 className="mt-1 text-[1.65rem] font-bold leading-[1.15]">Find and book approved warehouses online</h1>
        <p className="mt-2.5 max-w-3xl text-[13px] leading-6 text-slate-300">
          Browse admin-approved warehouse listings by location, storage type, rates, capacity, VAT, and partner details.
          Your booking is sent directly to the warehouse partner, with Zito commission recorded behind the scenes.
        </p>
      </section>

      <section className="rounded-[22px] border border-[#d7e0ec] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
        <div className="grid gap-3 md:grid-cols-[1fr_140px_auto_auto]">
          <Input
            label="Find warehouse by location"
            tone="light"
            value={locationFilter}
            onChange={(event) => setLocationFilter(event.target.value)}
            placeholder="Industrial Area, Mombasa, Kisumu..."
          />
          <Input
            label="Radius km"
            tone="light"
            type="number"
            min="1"
            value={radiusKm}
            onChange={(event) => setRadiusKm(event.target.value)}
          />
          <div className="flex items-end">
            <Button type="button" variant="secondary" className="w-full rounded-[14px]" onClick={useCurrentLocation}>
              <LocateFixed className="mr-2 h-4 w-4" />
              Near me
            </Button>
          </div>
          <div className="flex items-end">
            <Button type="button" className="w-full rounded-[14px]" onClick={() => void load()}>
              Search
            </Button>
          </div>
        </div>
        {nearbyPoint ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[14px] bg-[#eef4ff] px-3 py-2 text-xs text-[#1b3f72]">
            <span>Nearby search is active.</span>
            <button type="button" className="font-semibold" onClick={() => setNearbyPoint(null)}>
              Clear
            </button>
          </div>
        ) : null}

        <div className="mt-4 flex gap-2 overflow-x-auto">
          {storageModes.map((mode) => {
            const Icon = mode.icon;
            const active = storageType === mode.value;
            return (
              <button
                key={mode.value}
                type="button"
                onClick={() => setStorageType(mode.value)}
                className={[
                  'inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition',
                  active
                    ? 'border-[#1b3f72] bg-[#eef4ff] text-[#1b3f72]'
                    : 'border-[#d7e0ec] bg-white text-[#64748b] hover:border-[#93c5fd]',
                ].join(' ')}
              >
                <Icon className="h-4 w-4" />
                {mode.label}
              </button>
            );
          })}
        </div>
      </section>

      <WarehouseDiscoveryMap
        listings={listings}
        selectedId={bookingForm.listingId}
        customerPoint={nearbyPoint}
        onSelect={selectListing}
      />

      <section className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center rounded-[22px] border border-[#d7e0ec] bg-white py-10">
              <Spinner />
            </div>
          ) : listings.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-[#d7e0ec] bg-white px-4 py-8 text-center">
              <MapPinned className="mx-auto h-6 w-6 text-[#1b3f72]" />
              <p className="mt-3 text-sm font-semibold text-[#1a1a2e]">No approved warehouses match yet</p>
              <p className="mt-1 text-xs text-[#64748b]">Try another location or storage type.</p>
            </div>
          ) : (
            listings.map((listing) => (
              <button
                key={listing.id}
                type="button"
                onClick={() => selectListing(listing.id)}
                className={[
                  'w-full rounded-[22px] border bg-white p-4 text-left shadow-[0_8px_24px_rgba(15,23,42,0.05)] transition',
                  selectedListing?.id === listing.id ? 'border-[#1b3f72]' : 'border-[#d7e0ec] hover:border-[#93c5fd]',
                ].join(' ')}
              >
                <div className="grid gap-4 md:grid-cols-[150px_1fr]">
                  <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[16px] bg-[#eef4ff] text-[#1b3f72]">
                    {listing.photoUrls?.[0] ? (
                      <Image
                        src={listing.photoUrls[0]}
                        alt={listing.title}
                        width={300}
                        height={225}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Warehouse className="h-8 w-8" />
                    )}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
                          {listing.companyName}
                        </p>
                        <h2 className="mt-1 text-lg font-semibold text-[#1a1a2e]">{listing.title}</h2>
                        <p className="mt-1 text-sm leading-6 text-[#64748b]">{listing.areaLabel} / {listing.address}</p>
                        {listing.distanceKm != null ? (
                          <p className="mt-1 text-xs font-semibold text-[#1b3f72]">{listing.distanceKm} km from search point</p>
                        ) : null}
                      </div>
                      <span className="rounded-full bg-[#dcfce7] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#15803d]">
                        Approved
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                      <div className="rounded-[14px] bg-[#f8fbff] px-3 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">Rate</p>
                        <p className="mt-1 text-sm font-semibold text-[#1a1a2e]">{formatMoney(listing.rateAmount, 'KES')}</p>
                        <p className="text-[11px] text-[#64748b]">/{listing.rateUnit}</p>
                      </div>
                      <div className="rounded-[14px] bg-[#f8fbff] px-3 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">Capacity</p>
                        <p className="mt-1 text-sm font-semibold text-[#1a1a2e]">{listing.availableCapacity}</p>
                        <p className="text-[11px] text-[#64748b]">{listing.capacityUnit} available</p>
                      </div>
                      <div className="rounded-[14px] bg-[#f8fbff] px-3 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">VAT</p>
                        <p className="mt-1 text-sm font-semibold text-[#1a1a2e]">{listing.vatApplies ? `${listing.vatRatePct}%` : 'No'}</p>
                      </div>
                      <div className="rounded-[14px] bg-[#f8fbff] px-3 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">Min</p>
                        <p className="mt-1 text-sm font-semibold text-[#1a1a2e]">{listing.minimumBookingDays} days</p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {listing.storageTypes.map((item) => (
                        <span key={item} className="rounded-full border border-[#d1dcf0] bg-white px-3 py-1 text-[11px] font-semibold text-[#1b3f72]">
                          {formatStatus(item)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        <form onSubmit={submitBooking} className="rounded-[22px] border border-[#d7e0ec] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
          <div className="mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">Book online</p>
            <h2 className="mt-1 text-lg font-semibold text-[#1a1a2e]">
              {selectedListing?.title ?? 'Choose a warehouse'}
            </h2>
            <p className="mt-1 text-sm leading-6 text-[#64748b]">
              Partner pays Zito 10% commission after confirmed booking.
            </p>
          </div>

          <div className="grid gap-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Warehouse</span>
              <select
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                value={bookingForm.listingId}
                onChange={(event) => setBookingForm((current) => ({ ...current, listingId: event.target.value }))}
                required
              >
                {listings.map((listing) => (
                  <option key={listing.id} value={listing.id}>{listing.title}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Storage type</span>
              <select
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                value={bookingForm.storageType}
                onChange={(event) => setBookingForm((current) => ({ ...current, storageType: event.target.value }))}
              >
                {(selectedListing?.storageTypes ?? ['DRY']).map((item) => (
                  <option key={item} value={item}>{formatStatus(item)}</option>
                ))}
              </select>
            </label>
            <Input label="Goods description" tone="light" value={bookingForm.goodsDescription} onChange={(event) => setBookingForm((current) => ({ ...current, goodsDescription: event.target.value }))} required />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Start date" tone="light" type="date" value={bookingForm.startDate} onChange={(event) => setBookingForm((current) => ({ ...current, startDate: event.target.value }))} required />
              <Input label="End date" tone="light" type="date" value={bookingForm.endDate} onChange={(event) => setBookingForm((current) => ({ ...current, endDate: event.target.value }))} required />
            </div>
            <div className="grid grid-cols-[1fr_92px] gap-3">
              <Input label="Capacity needed" tone="light" type="number" min="0.01" step="0.01" value={bookingForm.capacityRequested} onChange={(event) => setBookingForm((current) => ({ ...current, capacityRequested: event.target.value }))} required />
              <Input label="Unit" tone="light" value={bookingForm.capacityUnit} onChange={(event) => setBookingForm((current) => ({ ...current, capacityUnit: event.target.value }))} />
            </div>
            <Input label="Customer note" tone="light" textarea rows={3} value={bookingForm.customerNote} onChange={(event) => setBookingForm((current) => ({ ...current, customerNote: event.target.value }))} />
          </div>

          <div className="mt-4 rounded-[18px] bg-[#f8fbff] px-4 py-4">
            <div className="flex items-center gap-2 text-[#1b3f72]">
              <CalendarClock className="h-4 w-4" />
              <p className="text-sm font-semibold">Booking estimate</p>
            </div>
            {estimate ? (
              <div className="mt-3 grid gap-2 text-sm text-[#475569]">
                <p>Duration: {estimate.days} days</p>
                <p>Storage: {formatMoney(estimate.baseAmount, 'KES')}</p>
                <p>VAT: {formatMoney(estimate.vatAmount, 'KES')}</p>
                <p className="font-semibold text-[#1a1a2e]">Customer total: {formatMoney(estimate.totalAmount, 'KES')}</p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-[#64748b]">Choose dates and capacity to calculate the total.</p>
            )}
          </div>

          <Button disabled={saving || listings.length === 0} type="submit" className="mt-4 w-full rounded-[14px]">
            <ShieldCheck className="mr-2 h-4 w-4" />
            {saving ? 'Submitting...' : 'Book warehouse online'}
          </Button>
        </form>
      </section>

      <section className="rounded-[22px] border border-[#d7e0ec] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">My warehouse bookings</p>
        <div className="mt-3 grid gap-3">
          {bookings.length === 0 ? (
            <p className="text-sm text-[#64748b]">No warehouse bookings yet.</p>
          ) : (
            bookings.map((booking) => (
              <div key={booking.id} className="rounded-[18px] border border-[#d7e0ec] bg-[#f8fbff] px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#1a1a2e]">{booking.reference}</p>
                    <p className="text-sm text-[#64748b]">{booking.listing?.title ?? 'Warehouse booking'}</p>
                    <p className="text-xs text-[#64748b]">{formatDateTime(booking.startDate)} to {formatDateTime(booking.endDate)}</p>
                  </div>
                  <span className="rounded-full bg-[#eef4ff] px-3 py-1 text-xs font-semibold text-[#1b3f72]">
                    {formatStatus(booking.status)}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-[#1a1a2e]">{formatMoney(booking.totalAmount, 'KES')}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
