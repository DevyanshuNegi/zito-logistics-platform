'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Table } from '@/components/ui/Table';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { ApiError, api } from '@/lib/api';
import { formatStatus } from '@/lib/format';

type WarehouseRecord = {
  id: string;
  name: string;
  code: string;
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
        label: string;
        isOccupied?: boolean;
        _count?: {
          items: number;
        };
      }>;
    }>;
  }>;
};

export default function WarehouseBinsPage() {
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [selectedZoneId, setSelectedZoneId] = useState('');
  const [selectedRackId, setSelectedRackId] = useState('');
  const [zoneName, setZoneName] = useState('');
  const [zoneCode, setZoneCode] = useState('');
  const [zoneType, setZoneType] = useState('DRY');
  const [zoneCapacity, setZoneCapacity] = useState('');
  const [rackLabel, setRackLabel] = useState('');
  const [binLabel, setBinLabel] = useState('');

  async function loadWarehouses() {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get<WarehouseRecord[]>('/warehouse');
      setWarehouses(response);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Unable to load warehouse structure.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWarehouses();
  }, []);

  useEffect(() => {
    if (!selectedWarehouseId && warehouses[0]) {
      setSelectedWarehouseId(warehouses[0].id);
    }
  }, [selectedWarehouseId, warehouses]);

  const selectedWarehouse = useMemo(
    () => warehouses.find((warehouse) => warehouse.id === selectedWarehouseId),
    [selectedWarehouseId, warehouses],
  );
  const zones = selectedWarehouse?.zones ?? [];

  useEffect(() => {
    if (!zones.length) {
      setSelectedZoneId('');
      return;
    }

    if (!zones.some((zone) => zone.id === selectedZoneId)) {
      setSelectedZoneId(zones[0].id);
    }
  }, [selectedZoneId, zones]);

  const selectedZone = zones.find((zone) => zone.id === selectedZoneId);
  const racks = selectedZone?.racks ?? [];

  useEffect(() => {
    if (!racks.length) {
      setSelectedRackId('');
      return;
    }

    if (!racks.some((rack) => rack.id === selectedRackId)) {
      setSelectedRackId(racks[0].id);
    }
  }, [racks, selectedRackId]);

  const flattenedBins = warehouses.flatMap((warehouse) =>
    warehouse.zones.flatMap((zone) =>
      zone.racks.flatMap((rack) =>
        rack.bins.map((bin) => ({
          warehouse: warehouse.name,
          zone: zone.code,
          rack: rack.label,
          label: bin.label,
          occupied:
            bin.isOccupied || (bin._count?.items ?? 0) > 0 ? 'Occupied' : 'Available',
          itemCount: bin._count?.items ?? 0,
        })),
      ),
    ),
  );

  async function createZone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedWarehouseId) {
      setError('Choose a warehouse before creating a zone.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await api.post(`/warehouse/${selectedWarehouseId}/zones`, {
        name: zoneName,
        code: zoneCode,
        type: zoneType,
        capacity: Number(zoneCapacity),
      });
      setZoneName('');
      setZoneCode('');
      setZoneType('DRY');
      setZoneCapacity('');
      setSuccess('Zone created.');
      await loadWarehouses();
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Unable to create zone.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function createRack(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedZoneId) {
      setError('Choose a zone before creating a rack.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await api.post(`/warehouse/zones/${selectedZoneId}/racks`, {
        label: rackLabel,
      });
      setRackLabel('');
      setSuccess('Rack created.');
      await loadWarehouses();
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Unable to create rack.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function createBin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRackId) {
      setError('Choose a rack before creating a bin.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await api.post(`/warehouse/racks/${selectedRackId}/bins`, {
        label: binLabel,
      });
      setBinLabel('');
      setSuccess('Bin created.');
      await loadWarehouses();
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Unable to create bin.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {error ? (
        <Alert title="Bin management error" variant="danger">
          {error}
        </Alert>
      ) : null}

      {success ? (
        <Alert title="Bin management update" variant="success">
          {success}
        </Alert>
      ) : null}

      <SurfaceCard title="Structure controls" description="Create zones, racks, and bins for the selected warehouse.">
        {loading ? (
          <Spinner />
        ) : (
          <div className="grid gap-6 xl:grid-cols-3">
            <form className="space-y-4" onSubmit={createZone}>
              <h3 className="text-lg font-semibold text-white">Create zone</h3>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-200">Warehouse</span>
                <select
                  className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                  value={selectedWarehouseId}
                  onChange={(event) => setSelectedWarehouseId(event.target.value)}
                >
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name} ({warehouse.code})
                    </option>
                  ))}
                </select>
              </label>
              <Input label="Zone name" value={zoneName} onChange={(event) => setZoneName(event.target.value)} required />
              <Input label="Zone code" value={zoneCode} onChange={(event) => setZoneCode(event.target.value)} required />
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-200">Zone type</span>
                <select
                  className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                  value={zoneType}
                  onChange={(event) => setZoneType(event.target.value)}
                >
                  {['DRY', 'COLD', 'FRAGILE', 'HAZMAT'].map((option) => (
                    <option key={option} value={option}>
                      {formatStatus(option)}
                    </option>
                  ))}
                </select>
              </label>
              <Input label="Capacity" type="number" min="0" value={zoneCapacity} onChange={(event) => setZoneCapacity(event.target.value)} required />
              <Button disabled={saving} type="submit">
                Create zone
              </Button>
            </form>

            <form className="space-y-4" onSubmit={createRack}>
              <h3 className="text-lg font-semibold text-white">Create rack</h3>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-200">Zone</span>
                <select
                  className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                  value={selectedZoneId}
                  onChange={(event) => setSelectedZoneId(event.target.value)}
                >
                  {zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name} ({zone.code})
                    </option>
                  ))}
                </select>
              </label>
              <Input label="Rack label" value={rackLabel} onChange={(event) => setRackLabel(event.target.value)} required />
              <Button disabled={saving || zones.length === 0} type="submit">
                Create rack
              </Button>
            </form>

            <form className="space-y-4" onSubmit={createBin}>
              <h3 className="text-lg font-semibold text-white">Create bin</h3>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-200">Rack</span>
                <select
                  className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                  value={selectedRackId}
                  onChange={(event) => setSelectedRackId(event.target.value)}
                >
                  {racks.map((rack) => (
                    <option key={rack.id} value={rack.id}>
                      {rack.label}
                    </option>
                  ))}
                </select>
              </label>
              <Input label="Bin label" value={binLabel} onChange={(event) => setBinLabel(event.target.value)} required />
              <Button disabled={saving || racks.length === 0} type="submit">
                Create bin
              </Button>
            </form>
          </div>
        )}
      </SurfaceCard>

      <SurfaceCard title="Bin registry" description="Current bin occupancy across all visible warehouses.">
        {loading ? (
          <Spinner />
        ) : (
          <Table
            rows={flattenedBins}
            emptyMessage="No bins have been configured yet."
            columns={[
              { key: 'warehouse', header: 'Warehouse', render: (row) => row.warehouse },
              { key: 'zone', header: 'Zone', render: (row) => row.zone },
              { key: 'rack', header: 'Rack', render: (row) => row.rack },
              { key: 'bin', header: 'Bin', render: (row) => row.label },
              { key: 'items', header: 'Items', render: (row) => String(row.itemCount) },
              { key: 'status', header: 'Status', render: (row) => row.occupied },
            ]}
          />
        )}
      </SurfaceCard>
    </div>
  );
}
