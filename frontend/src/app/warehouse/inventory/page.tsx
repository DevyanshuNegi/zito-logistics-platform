'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Table } from '@/components/ui/Table';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { ApiError, api } from '@/lib/api';
import { compactId, formatStatus } from '@/lib/format';

type WarehouseRecord = {
  id: string;
  name: string;
  zones: Array<{
    racks: Array<{
      bins: Array<{
        id: string;
        label: string;
      }>;
    }>;
  }>;
};

type InventoryItem = {
  id: string;
  parcelId: string;
  ownerId: string;
  status: string;
  weight: number;
  isFragile: boolean;
  isHazmat: boolean;
  warehouseId?: string | null;
  binId?: string | null;
  booking?: {
    reference?: string | null;
  } | null;
  warehouse?: {
    name?: string | null;
  } | null;
  bin?: {
    label?: string | null;
  } | null;
  movements: Array<{
    id: string;
  }>;
};

export default function WarehouseInventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [parcelId, setParcelId] = useState('');
  const [bookingId, setBookingId] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [weight, setWeight] = useState('');
  const [dimensions, setDimensions] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [binId, setBinId] = useState('');
  const [isFragile, setIsFragile] = useState(false);
  const [isHazmat, setIsHazmat] = useState(false);

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      const [inventoryResponse, warehouseResponse] = await Promise.all([
        api.get<InventoryItem[]>('/inventory'),
        api.get<WarehouseRecord[]>('/warehouse'),
      ]);

      setItems(inventoryResponse);
      setWarehouses(warehouseResponse);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Unable to load inventory workspace.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!warehouseId && warehouses[0]) {
      setWarehouseId(warehouses[0].id);
    }
  }, [warehouseId, warehouses]);

  const availableBins = useMemo(() => {
    const selectedWarehouse = warehouses.find(
      (warehouse) => warehouse.id === warehouseId,
    );

    return (
      selectedWarehouse?.zones.flatMap((zone) =>
        zone.racks.flatMap((rack) =>
          rack.bins.map((bin) => ({
            id: bin.id,
            label: bin.label,
          })),
        ),
      ) ?? []
    );
  }, [warehouseId, warehouses]);

  async function handleCreateItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await api.post('/inventory', {
        parcelId,
        bookingId,
        ownerId: ownerId || undefined,
        weight: Number(weight),
        isFragile,
        isHazmat,
        dimensions: dimensions || undefined,
        warehouseId: warehouseId || undefined,
        binId: binId || undefined,
      });

      setParcelId('');
      setBookingId('');
      setOwnerId('');
      setWeight('');
      setDimensions('');
      setBinId('');
      setIsFragile(false);
      setIsHazmat(false);
      setSuccess('Inventory item created.');
      await loadData();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Unable to create inventory item.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Inventory items" value={String(items.length)} helper="Parcels currently tracked in inventory." />
        <StatCard label="Stored" value={String(items.filter((item) => item.status === 'STORED').length)} helper="Warehouse-held parcels." tone="success" />
        <StatCard label="Dispatched" value={String(items.filter((item) => item.status === 'DISPATCHED').length)} helper="Loaded for movement." tone="warning" />
        <StatCard label="Fragile" value={String(items.filter((item) => item.isFragile).length)} helper="Requires careful handling." tone="info" />
      </div>

      {error ? (
        <Alert title="Inventory workspace error" variant="danger">
          {error}
        </Alert>
      ) : null}

      {success ? (
        <Alert title="Inventory workspace update" variant="success">
          {success}
        </Alert>
      ) : null}

      <SurfaceCard title="Create inventory item" description="Register an inbound parcel and link it to warehouse storage.">
        <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" onSubmit={handleCreateItem}>
          <Input label="Parcel id" value={parcelId} onChange={(event) => setParcelId(event.target.value)} required />
          <Input label="Booking id" value={bookingId} onChange={(event) => setBookingId(event.target.value)} required />
          <Input label="Owner id" value={ownerId} onChange={(event) => setOwnerId(event.target.value)} help="Optional customer UUID override." />
          <Input label="Weight (kg)" type="number" min="0" step="0.01" value={weight} onChange={(event) => setWeight(event.target.value)} required />
          <Input label="Dimensions" value={dimensions} onChange={(event) => setDimensions(event.target.value)} />
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-200">Warehouse</span>
            <select
              className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
              value={warehouseId}
              onChange={(event) => setWarehouseId(event.target.value)}
            >
              <option value="">No warehouse yet</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-200">Bin</span>
            <select
              className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
              value={binId}
              onChange={(event) => setBinId(event.target.value)}
            >
              <option value="">No bin yet</option>
              {availableBins.map((bin) => (
                <option key={bin.id} value={bin.id}>
                  {bin.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-slate-700/40 bg-slate-950/40 px-4 py-3 text-sm text-slate-200">
            <input type="checkbox" checked={isFragile} onChange={(event) => setIsFragile(event.target.checked)} />
            Fragile handling
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-slate-700/40 bg-slate-950/40 px-4 py-3 text-sm text-slate-200">
            <input type="checkbox" checked={isHazmat} onChange={(event) => setIsHazmat(event.target.checked)} />
            Hazardous material
          </label>
          <div className="md:col-span-2 xl:col-span-3">
            <Button disabled={saving} type="submit">
              {saving ? 'Saving item...' : 'Create item'}
            </Button>
          </div>
        </form>
      </SurfaceCard>

      <SurfaceCard title="Inventory list" description="Movement-ready parcel list with drilldown into full history.">
        {loading ? (
          <Spinner />
        ) : (
          <Table
            rows={items}
            emptyMessage="No inventory items are registered yet."
            columns={[
              {
                key: 'parcel',
                header: 'Parcel',
                render: (item) => (
                  <div>
                    <p className="font-semibold text-white">{item.parcelId}</p>
                    <p className="text-xs text-slate-400">{item.booking?.reference ?? compactId(item.booking?.reference ?? item.id)}</p>
                  </div>
                ),
              },
              { key: 'status', header: 'Status', render: (item) => formatStatus(item.status) },
              { key: 'weight', header: 'Weight', render: (item) => `${item.weight.toFixed(2)} kg` },
              {
                key: 'location',
                header: 'Location',
                render: (item) =>
                  `${item.warehouse?.name ?? 'No warehouse'} / ${item.bin?.label ?? 'No bin'}`,
              },
              {
                key: 'movements',
                header: 'Trail',
                render: (item) => `${item.movements.length} entries`,
              },
              {
                key: 'actions',
                header: 'Actions',
                render: (item) => (
                  <Link
                    href={`/warehouse/inventory/${item.id}`}
                    className="text-sm font-semibold text-amber-300 transition hover:text-amber-200"
                  >
                    View detail
                  </Link>
                ),
              },
            ]}
          />
        )}
      </SurfaceCard>
    </div>
  );
}
