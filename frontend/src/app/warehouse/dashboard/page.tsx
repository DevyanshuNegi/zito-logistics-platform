'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Table } from '@/components/ui/Table';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { useAuth } from '@/hooks/useAuth';
import { ApiError, api } from '@/lib/api';
import { formatStatus } from '@/lib/format';
import { hasAnyRole } from '@/lib/roles';

type WarehouseZoneCapacity = {
  id: string;
  name: string;
  code: string;
  type: string;
  configuredCapacity: number;
  totalBins: number;
  occupiedBins: number;
  availableBins: number;
  occupancyPercentage: number;
};

type WarehouseCapacity = {
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  totalCapacity: number;
  totalBins: number;
  totalOccupiedBins: number;
  totalAvailableBins: number;
  occupancyPercentage: number;
  zones: WarehouseZoneCapacity[];
};

type WarehouseRecord = {
  id: string;
  name: string;
  code: string;
  address?: string | null;
  status: string;
  zones: Array<{
    id: string;
    name: string;
    code: string;
    type: string;
    racks: Array<{
      id: string;
      label: string;
      bins: Array<{
        id: string;
      }>;
    }>;
  }>;
};

export default function WarehouseDashboardPage() {
  const { user } = useAuth();
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([]);
  const [capacityById, setCapacityById] = useState<Record<string, WarehouseCapacity>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [agencyId, setAgencyId] = useState(user?.agencyId ?? '');
  const [managerId, setManagerId] = useState('');

  const canCreateWarehouse = hasAnyRole(user?.role, [
    'ADMIN',
    'SUPER_ADMIN',
    'AGENCY_STAFF',
  ]);

  async function loadWarehouses() {
    setLoading(true);
    setError(null);

    try {
      const records = await api.get<WarehouseRecord[]>('/warehouse');
      setWarehouses(records);

      const capacities = await Promise.all(
        records.map((warehouse) =>
          api.get<WarehouseCapacity>(`/warehouse/${warehouse.id}/capacity`),
        ),
      );

      setCapacityById(
        Object.fromEntries(
          capacities.map((capacity) => [capacity.warehouseId, capacity]),
        ),
      );
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Unable to load warehouse dashboard.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWarehouses();
  }, []);

  useEffect(() => {
    setAgencyId(user?.agencyId ?? '');
  }, [user?.agencyId]);

  async function handleCreateWarehouse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await api.post('/warehouse', {
        name,
        code,
        address: address || undefined,
        latitude: latitude ? Number(latitude) : undefined,
        longitude: longitude ? Number(longitude) : undefined,
        agencyId: user?.agencyId || agencyId || undefined,
        managerId: managerId || undefined,
      });

      setName('');
      setCode('');
      setAddress('');
      setLatitude('');
      setLongitude('');
      setManagerId('');
      setSuccess('Warehouse created and added to the operations map.');
      await loadWarehouses();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Unable to create warehouse.',
      );
    } finally {
      setSaving(false);
    }
  }

  const capacities = Object.values(capacityById);
  const totalZones = capacities.reduce(
    (sum, warehouse) => sum + warehouse.zones.length,
    0,
  );
  const totalBins = capacities.reduce(
    (sum, warehouse) => sum + warehouse.totalBins,
    0,
  );
  const totalOccupiedBins = capacities.reduce(
    (sum, warehouse) => sum + warehouse.totalOccupiedBins,
    0,
  );
  const occupancyPercentage =
    totalBins > 0 ? (totalOccupiedBins / totalBins) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Warehouses" value={String(warehouses.length)} helper="Facilities visible to this account." />
        <StatCard label="Zones" value={String(totalZones)} helper="Configured storage zones." tone="info" />
        <StatCard label="Bins" value={String(totalBins)} helper="Addressable storage slots." />
        <StatCard
          label="Occupancy"
          value={`${occupancyPercentage.toFixed(1)}%`}
          helper={`${totalOccupiedBins} occupied bins across the network.`}
          tone={occupancyPercentage > 85 ? 'warning' : 'success'}
        />
      </div>

      {error ? (
        <Alert title="Warehouse dashboard error" variant="danger">
          {error}
        </Alert>
      ) : null}

      {success ? (
        <Alert title="Warehouse dashboard update" variant="success">
          {success}
        </Alert>
      ) : null}

      {canCreateWarehouse ? (
        <SurfaceCard title="Create warehouse" description="Phase 2 warehouse CRUD entry point for new locations.">
          <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" onSubmit={handleCreateWarehouse}>
            <Input label="Warehouse name" value={name} onChange={(event) => setName(event.target.value)} required />
            <Input label="Warehouse code" value={code} onChange={(event) => setCode(event.target.value)} required />
            <Input label="Address" value={address} onChange={(event) => setAddress(event.target.value)} />
            <Input label="Latitude" value={latitude} onChange={(event) => setLatitude(event.target.value)} type="number" step="0.000001" />
            <Input label="Longitude" value={longitude} onChange={(event) => setLongitude(event.target.value)} type="number" step="0.000001" />
            <Input label="Manager id" value={managerId} onChange={(event) => setManagerId(event.target.value)} help="Optional manager UUID." />
            {!user?.agencyId ? (
              <Input label="Agency id" value={agencyId} onChange={(event) => setAgencyId(event.target.value)} required />
            ) : null}
            <div className="md:col-span-2 xl:col-span-3">
              <Button disabled={saving} type="submit">
                {saving ? 'Creating warehouse...' : 'Create warehouse'}
              </Button>
            </div>
          </form>
        </SurfaceCard>
      ) : null}

      <SurfaceCard title="Warehouse summary" description="Real-time facility occupancy and zone distribution.">
        {loading ? (
          <Spinner />
        ) : (
          <Table
            rows={capacities}
            emptyMessage="No warehouses are visible for this account yet."
            columns={[
              {
                key: 'warehouse',
                header: 'Warehouse',
                render: (warehouse) => (
                  <div>
                    <p className="font-semibold text-white">{warehouse.warehouseName}</p>
                    <p className="text-xs text-slate-400">{warehouse.warehouseCode}</p>
                  </div>
                ),
              },
              {
                key: 'zones',
                header: 'Zones',
                render: (warehouse) => String(warehouse.zones.length),
              },
              {
                key: 'bins',
                header: 'Bins',
                render: (warehouse) =>
                  `${warehouse.totalOccupiedBins}/${warehouse.totalBins}`,
              },
              {
                key: 'occupancy',
                header: 'Occupancy',
                render: (warehouse) => `${warehouse.occupancyPercentage.toFixed(1)}%`,
              },
            ]}
          />
        )}
      </SurfaceCard>

      {capacities.map((warehouse) => (
        <SurfaceCard
          key={warehouse.warehouseId}
          title={`${warehouse.warehouseName} zone map`}
          description={`Rack and bin occupancy for ${warehouse.warehouseCode}.`}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            {warehouse.zones.map((zone) => (
              <div
                key={zone.id}
                className="rounded-3xl border border-slate-700/40 bg-slate-950/40 p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{zone.name}</h3>
                    <p className="text-sm text-slate-400">
                      {zone.code} · {formatStatus(zone.type)}
                    </p>
                  </div>
                  <div className="text-right text-sm text-slate-300">
                    <p>{zone.occupiedBins}/{zone.totalBins} bins</p>
                    <p>{zone.occupancyPercentage.toFixed(1)}% occupied</p>
                  </div>
                </div>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-amber-400"
                    style={{ width: `${Math.min(zone.occupancyPercentage, 100)}%` }}
                  />
                </div>
                <p className="mt-3 text-sm text-slate-400">
                  Configured capacity: {zone.configuredCapacity} · Available bins: {zone.availableBins}
                </p>
              </div>
            ))}
          </div>
        </SurfaceCard>
      ))}
    </div>
  );
}
