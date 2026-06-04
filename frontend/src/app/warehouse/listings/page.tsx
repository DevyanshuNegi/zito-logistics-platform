'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Table } from '@/components/ui/Table';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { WarehousePinPicker } from '@/components/maps/WarehousePinPicker';
import { ApiError, api } from '@/lib/api';
import { formatMoney, formatStatus } from '@/lib/format';

type WarehouseRecord = {
  id: string;
  name: string;
  code: string;
  address?: string | null;
};

type WarehouseListing = {
  id: string;
  title: string;
  companyName: string;
  areaLabel: string;
  address: string;
  storageTypes: string[];
  totalCapacity: number;
  availableCapacity: number;
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

const EMPTY_FORM = {
  warehouseId: '',
  companyName: '',
  companyEmail: '',
  companyPhone: '',
  vatNumber: '',
  vatApplies: false,
  vatRatePct: '16',
  title: '',
  description: '',
  areaLabel: '',
  address: '',
  latitude: '',
  longitude: '',
  serviceRadiusKm: '',
  storageTypes: 'DRY',
  amenities: '',
  photoUrls: '',
  documentUrls: '',
  totalCapacity: '',
  availableCapacity: '',
  capacityUnit: 'SQM',
  rateAmount: '',
  rateUnit: 'DAY',
  handlingFee: '0',
  minimumBookingDays: '1',
};

function splitCsv(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

export default function WarehouseListingsPage() {
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([]);
  const [listings, setListings] = useState<WarehouseListing[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [warehouseResponse, listingResponse] = await Promise.all([
        api.get<WarehouseRecord[]>('/warehouse'),
        api.get<WarehouseListing[]>('/warehouse/partner/listings'),
      ]);
      setWarehouses(warehouseResponse);
      setListings(listingResponse);
      setForm((current) => ({
        ...current,
        warehouseId: current.warehouseId || warehouseResponse[0]?.id || '',
      }));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load warehouse listings.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const approvedCount = useMemo(
    () => listings.filter((listing) => listing.status === 'APPROVED').length,
    [listings],
  );

  function updatePin(point: { latitude: string; longitude: string }) {
    setForm((current) => ({
      ...current,
      latitude: point.latitude,
      longitude: point.longitude,
    }));
  }

  async function submitListing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await api.post('/warehouse/partner/listings', {
        warehouseId: form.warehouseId,
        companyName: form.companyName,
        companyEmail: form.companyEmail || undefined,
        companyPhone: form.companyPhone || undefined,
        vatNumber: form.vatNumber || undefined,
        vatApplies: form.vatApplies,
        vatRatePct: form.vatApplies ? Number(form.vatRatePct || '0') : 0,
        title: form.title,
        description: form.description || undefined,
        areaLabel: form.areaLabel,
        address: form.address,
        latitude: form.latitude ? Number(form.latitude) : undefined,
        longitude: form.longitude ? Number(form.longitude) : undefined,
        serviceRadiusKm: form.serviceRadiusKm ? Number(form.serviceRadiusKm) : undefined,
        storageTypes: splitCsv(form.storageTypes),
        amenities: splitCsv(form.amenities),
        photoUrls: splitCsv(form.photoUrls),
        documentUrls: splitCsv(form.documentUrls),
        totalCapacity: Number(form.totalCapacity),
        availableCapacity: Number(form.availableCapacity),
        capacityUnit: form.capacityUnit,
        rateAmount: Number(form.rateAmount),
        rateUnit: form.rateUnit,
        handlingFee: Number(form.handlingFee || '0'),
        minimumBookingDays: Number(form.minimumBookingDays || '1'),
      });
      setSuccess('Warehouse listing submitted for admin review.');
      setForm({ ...EMPTY_FORM, warehouseId: warehouses[0]?.id || '' });
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to submit warehouse listing.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Listings" value={String(listings.length)} helper="Warehouse listings submitted by your company." />
        <StatCard label="Approved" value={String(approvedCount)} helper="Visible to customers for online booking." tone="success" />
        <StatCard label="Commission" value="10%" helper="Charged to partner on confirmed bookings." tone="warning" />
      </div>

      {error ? <Alert title="Warehouse listing issue" variant="danger">{error}</Alert> : null}
      {success ? <Alert title="Warehouse listing saved" variant="success">{success}</Alert> : null}

      <SurfaceCard title="List warehouse" description="Submit warehouse details, rates, capacity, photos, documents, and VAT setup for admin approval.">
        <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" onSubmit={submitListing}>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-200">Managed warehouse</span>
            <select
              className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-cyan-400/80 focus:outline-none"
              value={form.warehouseId}
              onChange={(event) => setForm((current) => ({ ...current, warehouseId: event.target.value }))}
              required
            >
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name} ({warehouse.code})
                </option>
              ))}
            </select>
          </label>
          <Input label="Company name" value={form.companyName} onChange={(event) => setForm((current) => ({ ...current, companyName: event.target.value }))} required />
          <Input label="Company email" type="email" value={form.companyEmail} onChange={(event) => setForm((current) => ({ ...current, companyEmail: event.target.value }))} />
          <Input label="Company phone" value={form.companyPhone} onChange={(event) => setForm((current) => ({ ...current, companyPhone: event.target.value }))} />
          <Input label="VAT number" value={form.vatNumber} onChange={(event) => setForm((current) => ({ ...current, vatNumber: event.target.value }))} />
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-200">VAT applies</span>
            <select
              className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-cyan-400/80 focus:outline-none"
              value={form.vatApplies ? 'yes' : 'no'}
              onChange={(event) => setForm((current) => ({ ...current, vatApplies: event.target.value === 'yes' }))}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </label>
          <Input label="VAT %" type="number" min="0" max="100" value={form.vatRatePct} onChange={(event) => setForm((current) => ({ ...current, vatRatePct: event.target.value }))} />
          <Input label="Listing title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required />
          <Input label="Area" value={form.areaLabel} onChange={(event) => setForm((current) => ({ ...current, areaLabel: event.target.value }))} placeholder="Nairobi Industrial Area" required />
          <Input label="Address" value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} required />
          <Input label="Service radius km" type="number" min="1" value={form.serviceRadiusKm} onChange={(event) => setForm((current) => ({ ...current, serviceRadiusKm: event.target.value }))} />
          <Input label="Storage types" value={form.storageTypes} onChange={(event) => setForm((current) => ({ ...current, storageTypes: event.target.value }))} help="Comma-separated: DRY, COLD, FROZEN, CROSS_DOCK" required />
          <Input label="Amenities" value={form.amenities} onChange={(event) => setForm((current) => ({ ...current, amenities: event.target.value }))} help="Security, forklift, loading bay, CCTV..." />
          <Input label="Photo URLs" value={form.photoUrls} onChange={(event) => setForm((current) => ({ ...current, photoUrls: event.target.value }))} help="Comma-separated image URLs." />
          <Input label="Document URLs" value={form.documentUrls} onChange={(event) => setForm((current) => ({ ...current, documentUrls: event.target.value }))} help="License, insurance, safety, lease/ownership docs." />
          <Input label="Total capacity" type="number" min="0" value={form.totalCapacity} onChange={(event) => setForm((current) => ({ ...current, totalCapacity: event.target.value }))} required />
          <Input label="Available capacity" type="number" min="0" value={form.availableCapacity} onChange={(event) => setForm((current) => ({ ...current, availableCapacity: event.target.value }))} required />
          <Input label="Capacity unit" value={form.capacityUnit} onChange={(event) => setForm((current) => ({ ...current, capacityUnit: event.target.value }))} />
          <Input label="Rate amount" type="number" min="0" value={form.rateAmount} onChange={(event) => setForm((current) => ({ ...current, rateAmount: event.target.value }))} required />
          <Input label="Rate unit" value={form.rateUnit} onChange={(event) => setForm((current) => ({ ...current, rateUnit: event.target.value }))} help="DAY, WEEK, MONTH, PALLET_DAY" />
          <Input label="Handling fee" type="number" min="0" value={form.handlingFee} onChange={(event) => setForm((current) => ({ ...current, handlingFee: event.target.value }))} />
          <Input label="Minimum days" type="number" min="1" value={form.minimumBookingDays} onChange={(event) => setForm((current) => ({ ...current, minimumBookingDays: event.target.value }))} />
          <div className="md:col-span-2 xl:col-span-3">
            <Input label="Description" textarea rows={3} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
          </div>
          <div className="md:col-span-2 xl:col-span-3">
            <WarehousePinPicker
              latitude={form.latitude}
              longitude={form.longitude}
              address={[form.title, form.areaLabel, form.address].filter(Boolean).join(' / ')}
              onChange={updatePin}
            />
          </div>
          <div className="md:col-span-2 xl:col-span-3">
            <Button disabled={saving || warehouses.length === 0} type="submit">
              {saving ? 'Submitting...' : 'Submit for admin review'}
            </Button>
          </div>
        </form>
      </SurfaceCard>

      <SurfaceCard title="My warehouse listings" description="Admin approval controls which warehouses appear to customers.">
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
                    <p className="text-xs text-slate-400">{listing.areaLabel} / {listing.warehouse?.code}</p>
                  </div>
                ),
              },
              {
                key: 'capacity',
                header: 'Capacity',
                render: (listing) => `${listing.availableCapacity}/${listing.totalCapacity} ${listing.capacityUnit}`,
              },
              {
                key: 'rate',
                header: 'Rate',
                render: (listing) => `${formatMoney(listing.rateAmount, 'KES')} / ${listing.rateUnit}`,
              },
              {
                key: 'status',
                header: 'Status',
                render: (listing) => (
                  <div className="text-xs text-slate-300">
                    <p>{formatStatus(listing.status)}</p>
                    <p>{listing.reviewNote ?? 'No review note'}</p>
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
