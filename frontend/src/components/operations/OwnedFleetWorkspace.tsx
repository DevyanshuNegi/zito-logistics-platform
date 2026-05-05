'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Table } from '@/components/ui/Table';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { VehicleLocationPanel } from '@/components/operations/VehicleLocationPanel';
import { VehicleVerificationPanel } from '@/components/operations/VehicleVerificationPanel';
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
  verificationStatus?: string | null;
  capacityKg: number;
  capacityM3?: number | null;
  deviceGpsLat?: number | null;
  deviceGpsLng?: number | null;
  lastGpsAt?: string | null;
  driver?: {
    isOnline?: boolean | null;
    currentLatitude?: number | null;
    currentLongitude?: number | null;
    lastLocationAt?: string | null;
    user?: {
      fullName?: string | null;
    } | null;
  } | null;
  _count?: {
    bookings?: number;
    breakdowns?: number;
  } | null;
  verificationPhotos?: Array<{
    id: string;
    category: string;
    status?: string | null;
    reviewNote?: string | null;
    rejectionReason?: string | null;
    fileUrl?: string | null;
  }> | null;
};

type OwnedFleetWorkspaceProps = {
  title: string;
  description: string;
  platformFeeCopy: string;
  emptyMessage: string;
  tone?: 'dark' | 'light';
  refreshToken?: number;
  onChange?: () => void | Promise<void>;
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

function buildToneClasses(tone: 'dark' | 'light') {
  if (tone === 'light') {
    return {
      card:
        'rounded-[22px] border border-[#d7e0ec] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]',
      select:
        'w-full rounded-[16px] border border-[#d7e0ec] bg-white px-4 py-3 text-sm text-[#1a1a2e] focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100',
      label: 'text-sm font-medium text-slate-700',
      head: 'font-semibold text-[#1a1a2e]',
      sub: 'text-xs text-[#64748b]',
      body: 'text-sm text-[#1a1a2e]',
      usage: 'text-xs text-[#64748b]',
    };
  }

  return {
    card: '',
    select:
      'w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none',
    label: 'text-sm font-medium text-slate-200',
    head: 'font-semibold text-white',
    sub: 'text-xs text-slate-400',
    body: 'text-sm text-slate-200',
    usage: 'text-xs text-slate-300',
  };
}

export function OwnedFleetWorkspace({
  title,
  description,
  platformFeeCopy,
  emptyMessage,
  tone = 'dark',
  refreshToken = 0,
  onChange,
}: OwnedFleetWorkspaceProps) {
  const classes = buildToneClasses(tone);
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
      setError(
        caught instanceof ApiError ? caught.message : 'Unable to load owned vehicles.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFleet();
  }, [refreshToken]);

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
      await onChange?.();
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
      await onChange?.();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to retire vehicle.');
    } finally {
      setRetiringId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Owned vehicles"
          value={String(vehicles.length)}
          helper="Vehicles scoped to this account."
          surfaceTone={tone}
        />
        <StatCard
          label="Active fleet"
          value={String(activeVehicles)}
          helper="Ready or currently available vehicles."
          tone="success"
          surfaceTone={tone}
        />
        <StatCard
          label="Booking links"
          value={String(assignedBookings)}
          helper="Trips already mapped to this fleet roster."
          tone="info"
          surfaceTone={tone}
        />
      </div>

      <Alert title="Platform fee policy" variant="info">
        {platformFeeCopy}
      </Alert>

      <VehicleLocationPanel
        description="Pick a vehicle number to inspect where your fleet unit is right now, using either onboard GPS or the assigned driver's latest live coordinates."
        title="Vehicle location"
        tone={tone}
        vehicles={vehicles}
      />

      {error ? (
        <Alert title="Owned fleet workspace error" variant="danger">
          {error}
        </Alert>
      ) : null}

      <SurfaceCard
        title={title}
        description={description}
        className={classes.card}
        tone={tone}
      >
        <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" onSubmit={handleCreate}>
          <Input
            label="Plate number"
            tone={tone === 'light' ? 'light' : 'dark'}
            value={form.plateNumber}
            onChange={(event) =>
              setForm((current) => ({ ...current, plateNumber: event.target.value }))
            }
            required
          />
          <label className="block space-y-2">
            <span className={classes.label}>Vehicle type</span>
            <select
              className={classes.select}
              value={form.type}
              onChange={(event) =>
                setForm((current) => ({ ...current, type: event.target.value }))
              }
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
            tone={tone === 'light' ? 'light' : 'dark'}
            value={form.capacityKg}
            onChange={(event) =>
              setForm((current) => ({ ...current, capacityKg: event.target.value }))
            }
            required
          />
          <Input
            label="Capacity (m3)"
            type="number"
            tone={tone === 'light' ? 'light' : 'dark'}
            value={form.capacityM3}
            onChange={(event) =>
              setForm((current) => ({ ...current, capacityM3: event.target.value }))
            }
          />
          <Input
            label="Make"
            tone={tone === 'light' ? 'light' : 'dark'}
            value={form.make}
            onChange={(event) => setForm((current) => ({ ...current, make: event.target.value }))}
          />
          <Input
            label="Model"
            tone={tone === 'light' ? 'light' : 'dark'}
            value={form.model}
            onChange={(event) =>
              setForm((current) => ({ ...current, model: event.target.value }))
            }
          />
          <Input
            label="Year"
            type="number"
            tone={tone === 'light' ? 'light' : 'dark'}
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

      <SurfaceCard
        title="Owned fleet roster"
        description="Vehicle records created under this account can be used for self-managed logistics or network-linked assignments."
        className={classes.card}
        tone={tone}
      >
        {loading ? (
          <Spinner />
        ) : (
          <Table
            emptyMessage={emptyMessage}
            tone={tone}
            rows={vehicles}
            columns={[
              {
                key: 'plate',
                header: 'Vehicle',
                render: (vehicle) => (
                  <div>
                    <p className={classes.head}>{vehicle.plateNumber}</p>
                    <p className={classes.sub}>
                      {[vehicle.make, vehicle.model, vehicle.year]
                        .filter(Boolean)
                        .join(' ') || 'Vehicle profile pending'}
                    </p>
                  </div>
                ),
              },
              {
                key: 'type',
                header: 'Type',
                render: (vehicle) => (
                  <div className={classes.body}>
                    <p>{vehicle.type}</p>
                    <p className={classes.sub}>
                      {vehicle.capacityKg} kg
                      {vehicle.capacityM3 ? ` · ${vehicle.capacityM3} m3` : ''}
                    </p>
                  </div>
                ),
              },
              {
                key: 'driver',
                header: 'Driver',
                render: (vehicle) => (
                  <div className={classes.body}>
                    <p>{vehicle.driver?.user?.fullName ?? 'No driver assigned'}</p>
                    <p className={classes.sub}>Managed from the fleet driver roster.</p>
                  </div>
                ),
              },
              {
                key: 'usage',
                header: 'Usage',
                render: (vehicle) => (
                  <div className={classes.usage}>
                    <p>Bookings: {vehicle._count?.bookings ?? 0}</p>
                    <p>Breakdowns: {vehicle._count?.breakdowns ?? 0}</p>
                  </div>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (vehicle) => (
                  <div className={classes.usage}>
                    <p>Operational: {formatStatus(vehicle.status)}</p>
                    <p>Verification: {formatStatus(vehicle.verificationStatus ?? 'PENDING_REVIEW')}</p>
                  </div>
                ),
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

      <VehicleVerificationPanel
        description="Truck and container units must complete the compulsory dashboard, front, right, left, and back photo package before internal approval."
        onChange={async () => {
          await loadFleet();
          await onChange?.();
        }}
        title="Vehicle verification package"
        tone={tone}
        vehicles={vehicles}
      />
    </div>
  );
}
