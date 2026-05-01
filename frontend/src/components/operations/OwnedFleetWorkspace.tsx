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
import { formatStatus } from '@/lib/format';
import { VEHICLE_TYPES } from '@/lib/phase-one';

type Vehicle = {
  id: string;
  plateNumber: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  type: string;
  status: string;
  capacityKg: number;
  capacityM3?: number | null;
  _count?: {
    bookings?: number;
    breakdowns?: number;
  } | null;
};

type OwnedFleetWorkspaceProps = {
  title: string;
  description: string;
  platformFeeCopy: string;
  emptyMessage: string;
};

const INITIAL_FORM = {
  plateNumber: '',
  make: '',
  model: '',
  year: '',
  type: 'VAN',
  capacityKg: '',
  capacityM3: '',
};

export function OwnedFleetWorkspace({
  title,
  description,
  platformFeeCopy,
  emptyMessage,
}: OwnedFleetWorkspaceProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [retiringId, setRetiringId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeVehicles = useMemo(
    () => vehicles.filter((vehicle) => vehicle.status === 'ACTIVE').length,
    [vehicles],
  );

  const assignedBookings = useMemo(
    () =>
      vehicles.reduce(
        (total, vehicle) => total + Number(vehicle._count?.bookings ?? 0),
        0,
      ),
    [vehicles],
  );

  async function loadFleet() {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get<Vehicle[]>('/fleet');
      setVehicles(response);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load owned vehicles.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFleet();
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await api.post('/fleet', {
        plateNumber: form.plateNumber.trim().toUpperCase(),
        make: form.make || undefined,
        model: form.model || undefined,
        year: form.year ? Number(form.year) : undefined,
        type: form.type,
        capacityKg: Number(form.capacityKg),
        capacityM3: form.capacityM3 ? Number(form.capacityM3) : undefined,
      });

      setForm(INITIAL_FORM);
      await loadFleet();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to create vehicle.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRetire(vehicleId: string) {
    setRetiringId(vehicleId);
    setError(null);

    try {
      await api.patch(`/fleet/${vehicleId}/retire`, {});
      await loadFleet();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to retire vehicle.');
    } finally {
      setRetiringId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Owned vehicles" value={String(vehicles.length)} helper="Vehicles scoped to this account." />
        <StatCard label="Active fleet" value={String(activeVehicles)} helper="Ready or currently available vehicles." tone="success" />
        <StatCard label="Booking links" value={String(assignedBookings)} helper="Trips already mapped to this fleet roster." tone="info" />
      </div>

      <Alert title="Platform fee policy" variant="info">
        {platformFeeCopy}
      </Alert>

      {error ? (
        <Alert title="Owned fleet workspace error" variant="danger">
          {error}
        </Alert>
      ) : null}

      <SurfaceCard title={title} description={description}>
        <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" onSubmit={handleCreate}>
          <Input
            label="Plate number"
            value={form.plateNumber}
            onChange={(event) => setForm((current) => ({ ...current, plateNumber: event.target.value }))}
            required
          />
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-200">Vehicle type</span>
            <select
              className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
              value={form.type}
              onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
            >
              {VEHICLE_TYPES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <Input
            label="Capacity (kg)"
            type="number"
            value={form.capacityKg}
            onChange={(event) => setForm((current) => ({ ...current, capacityKg: event.target.value }))}
            required
          />
          <Input
            label="Capacity (m3)"
            type="number"
            value={form.capacityM3}
            onChange={(event) => setForm((current) => ({ ...current, capacityM3: event.target.value }))}
          />
          <Input
            label="Make"
            value={form.make}
            onChange={(event) => setForm((current) => ({ ...current, make: event.target.value }))}
          />
          <Input
            label="Model"
            value={form.model}
            onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))}
          />
          <Input
            label="Year"
            type="number"
            value={form.year}
            onChange={(event) => setForm((current) => ({ ...current, year: event.target.value }))}
          />
          <div className="flex items-end">
            <Button className="w-full" disabled={saving} type="submit">
              {saving ? 'Saving vehicle...' : 'Add vehicle'}
            </Button>
          </div>
        </form>
      </SurfaceCard>

      <SurfaceCard title="Owned fleet roster" description="Vehicle records created under this account can be used for self-managed logistics or network-linked assignments.">
        {loading ? (
          <Spinner />
        ) : (
          <Table
            emptyMessage={emptyMessage}
            rows={vehicles}
            columns={[
              {
                key: 'plate',
                header: 'Vehicle',
                render: (vehicle) => (
                  <div>
                    <p className="font-semibold text-white">{vehicle.plateNumber}</p>
                    <p className="text-xs text-slate-400">
                      {[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' ') || 'Vehicle profile pending'}
                    </p>
                  </div>
                ),
              },
              {
                key: 'type',
                header: 'Type',
                render: (vehicle) => (
                  <div className="text-sm text-slate-200">
                    <p>{vehicle.type}</p>
                    <p className="text-xs text-slate-400">
                      {vehicle.capacityKg} kg
                      {vehicle.capacityM3 ? ` · ${vehicle.capacityM3} m3` : ''}
                    </p>
                  </div>
                ),
              },
              {
                key: 'usage',
                header: 'Usage',
                render: (vehicle) => (
                  <div className="text-xs text-slate-300">
                    <p>Bookings: {vehicle._count?.bookings ?? 0}</p>
                    <p>Breakdowns: {vehicle._count?.breakdowns ?? 0}</p>
                  </div>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (vehicle) => formatStatus(vehicle.status),
              },
              {
                key: 'actions',
                header: 'Actions',
                render: (vehicle) => (
                  <Button
                    disabled={retiringId === vehicle.id || vehicle.status !== 'ACTIVE'}
                    variant="danger"
                    onClick={() => void handleRetire(vehicle.id)}
                  >
                    {retiringId === vehicle.id ? 'Retiring...' : 'Retire'}
                  </Button>
                ),
              },
            ]}
          />
        )}
      </SurfaceCard>
    </div>
  );
}
