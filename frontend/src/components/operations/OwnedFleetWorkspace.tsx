'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
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
import { FLEET_VERIFICATION_UPLOAD_CATEGORIES, KENYA_VEHICLE_CATALOG, VEHICLE_TYPES } from '@/lib/phase-one';

type Vehicle = {
  id: string;
  plateNumber: string;
  chassisNumber?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  type: string;
  status: string;
  verificationStatus?: string | null;
  capacityKg: number;
  capacityM3?: number | null;
  insuranceCompany?: string | null;
  insurancePolicyNumber?: string | null;
  insuranceExpiry?: string | null;
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
  chassisNumber: '',
  make: '',
  model: '',
  year: '',
  type: 'VAN',
  capacityKg: '',
  capacityM3: '',
  insuranceCompany: '',
  insurancePolicyNumber: '',
  insuranceExpiry: '',
};

function isVehicleApproved(vehicle: Vehicle) {
  return (
    vehicle.status === 'ACTIVE' &&
    String(vehicle.verificationStatus ?? '').toUpperCase() === 'APPROVED'
  );
}

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
  const [verificationFiles, setVerificationFiles] = useState<Record<string, File | null>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [retiringId, setRetiringId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const approvedVehicles = useMemo(
    () => vehicles.filter((vehicle) => isVehicleApproved(vehicle)),
    [vehicles],
  );

  const pendingVehicles = useMemo(
    () => vehicles.filter((vehicle) => !isVehicleApproved(vehicle)),
    [vehicles],
  );

  const activeVehicles = useMemo(
    () => approvedVehicles.length,
    [approvedVehicles],
  );

  const assignedBookings = useMemo(
    () =>
      vehicles.reduce(
        (total, vehicle) => total + Number(vehicle._count?.bookings ?? 0),
        0,
      ),
    [vehicles],
  );

  const selectedCatalogGroup = useMemo(
    () => KENYA_VEHICLE_CATALOG.find((group) => group.vehicleType === form.type),
    [form.type],
  );
  const makeOptions = useMemo(
    () => Array.from(new Set((selectedCatalogGroup?.models ?? []).map((item) => item.make))).sort(),
    [selectedCatalogGroup],
  );
  const modelOptions = useMemo(
    () =>
      (selectedCatalogGroup?.models ?? [])
        .filter((item) => item.make === form.make)
        .map((item) => item.model)
        .sort(),
    [form.make, selectedCatalogGroup],
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
      const missingUploads = FLEET_VERIFICATION_UPLOAD_CATEGORIES.filter(
        (category) => !verificationFiles[category],
      );
      if (missingUploads.length > 0) {
        throw new Error(`Upload all required photos and documents first: ${missingUploads.map(formatStatus).join(', ')}`);
      }

      const formData = new FormData();
      formData.append('plateNumber', form.plateNumber.trim().toUpperCase());
      formData.append('chassisNumber', form.chassisNumber.trim().toUpperCase());
      formData.append('make', form.make);
      formData.append('model', form.model);
      formData.append('year', form.year);
      formData.append('type', form.type);
      formData.append('capacityKg', form.capacityKg);
      formData.append('capacityM3', form.capacityM3);
      formData.append('insuranceCompany', form.insuranceCompany.trim());
      formData.append('insurancePolicyNumber', form.insurancePolicyNumber.trim().toUpperCase());
      formData.append('insuranceExpiry', form.insuranceExpiry);
      FLEET_VERIFICATION_UPLOAD_CATEGORIES.forEach((category) => {
        formData.append(category, verificationFiles[category]!);
      });

      await api.post('/fleet', formData);

      setForm(INITIAL_FORM);
      setVerificationFiles({});
      await loadFleet();
      await onChange?.();
    } catch (caught) {
      setError(caught instanceof ApiError || caught instanceof Error ? caught.message : 'Unable to create vehicle.');
    } finally {
      setSaving(false);
    }
  }

  function handleVerificationFileChange(category: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setVerificationFiles((current) => ({ ...current, [category]: file }));
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
    <div className="space-y-4">
      <div className="grid gap-3">
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
        vehicles={approvedVehicles}
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
        <form className="grid grid-cols-2 gap-4" onSubmit={handleCreate}>
          <Input
            label="Plate number"
            tone={tone === 'light' ? 'light' : 'dark'}
            value={form.plateNumber}
            onChange={(event) =>
              setForm((current) => ({ ...current, plateNumber: event.target.value }))
            }
            required
            className="col-span-2"
          />
          <Input
            label="Chassis number"
            tone={tone === 'light' ? 'light' : 'dark'}
            value={form.chassisNumber}
            onChange={(event) =>
              setForm((current) => ({ ...current, chassisNumber: event.target.value }))
            }
            required
            className="col-span-2"
          />
          <label className="block space-y-2">
            <span className={classes.label}>Vehicle type</span>
            <select
              className={classes.select}
              value={form.type}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  type: event.target.value,
                  make: '',
                  model: '',
                }))
              }
            >
              {VEHICLE_TYPES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-2">
            <span className={classes.label}>Make</span>
            <select
              className={classes.select}
              value={form.make}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  make: event.target.value,
                  model: '',
                }))
              }
              required
            >
              <option value="">Select make</option>
              {makeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-2">
            <span className={classes.label}>Model</span>
            <select
              className={`${classes.select} disabled:cursor-not-allowed disabled:opacity-60`}
              value={form.model}
              onChange={(event) =>
                setForm((current) => ({ ...current, model: event.target.value }))
              }
              required
              disabled={!form.make}
            >
              <option value="">Select model</option>
              {modelOptions.map((option) => (
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
            required
          />
          <Input
            label="Year"
            type="number"
            tone={tone === 'light' ? 'light' : 'dark'}
            value={form.year}
            onChange={(event) => setForm((current) => ({ ...current, year: event.target.value }))}
            required
          />
          <Input
            label="Insurance company"
            tone={tone === 'light' ? 'light' : 'dark'}
            value={form.insuranceCompany}
            onChange={(event) =>
              setForm((current) => ({ ...current, insuranceCompany: event.target.value }))
            }
            required
          />
          <Input
            label="Policy number"
            tone={tone === 'light' ? 'light' : 'dark'}
            value={form.insurancePolicyNumber}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                insurancePolicyNumber: event.target.value,
              }))
            }
            required
          />
          <Input
            label="Insurance expiry"
            type="date"
            tone={tone === 'light' ? 'light' : 'dark'}
            value={form.insuranceExpiry}
            onChange={(event) =>
              setForm((current) => ({ ...current, insuranceExpiry: event.target.value }))
            }
            required
            className="col-span-2"
          />
          <div className="col-span-2">
            <p className={classes.label}>Mandatory photos and documents</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {FLEET_VERIFICATION_UPLOAD_CATEGORIES.map((category) => (
                <label key={category} className="block space-y-2">
                  <span className={classes.sub}>{formatStatus(category)}</span>
                  <input
                    accept="image/*"
                    capture="environment"
                    className={
                      tone === 'light'
                        ? 'block w-full text-xs text-slate-600 file:mr-3 file:rounded-full file:border-0 file:bg-[#1b3f72] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white'
                        : 'block w-full text-xs text-slate-300 file:mr-3 file:rounded-full file:border-0 file:bg-sky-500/20 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-sky-100'
                    }
                    required
                    type="file"
                    onChange={(event) => handleVerificationFileChange(category, event)}
                  />
                </label>
              ))}
            </div>
          </div>
          <div className="col-span-2 flex items-end">
            <Button className="w-full" disabled={saving} type="submit">
              {saving ? 'Saving vehicle...' : 'Add vehicle'}
            </Button>
          </div>
        </form>
        <p className={`mt-4 ${classes.sub}`}>
          New vehicles stay pending until the structured fleet profile, insurance details, fresh camera-capture inspection package, GPS setup, and internal fleet approval are completed. Only approved vehicles become onboarded and available in the system.
        </p>
      </SurfaceCard>

      <SurfaceCard
        title="Pending admin approval"
        description="These vehicles are saved under your account but are not onboarded yet. Zito operations must verify the full evidence package and activate GPS before they become usable."
        className={classes.card}
        tone={tone}
      >
        {loading ? (
          <Spinner />
        ) : pendingVehicles.length === 0 ? (
          <p className={classes.body}>No vehicles are waiting for approval right now.</p>
        ) : (
          <Table
            emptyMessage="No vehicles are waiting for approval right now."
            tone={tone}
            rows={pendingVehicles}
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
                    <p className={classes.sub}>
                      Chassis: {vehicle.chassisNumber ?? 'Pending'}
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
                key: 'approval',
                header: 'Approval',
                render: (vehicle) => (
                  <div className={classes.usage}>
                    <p>Verification: {formatStatus(vehicle.verificationStatus ?? 'PENDING_REVIEW')}</p>
                    <p>Onboarding: Pending admin approval</p>
                    <p>
                      Insurance: {vehicle.insuranceCompany ?? 'Pending'}
                      {vehicle.insuranceExpiry
                        ? ` · expires ${new Date(vehicle.insuranceExpiry).toLocaleDateString()}`
                        : ''}
                    </p>
                  </div>
                ),
              },
              {
                key: 'actions',
                header: 'Next step',
                render: () => (
                  <div className={classes.usage}>
                    <p>Upload the full verification package below.</p>
                    <p>Zito ops will review, approve, and activate GPS.</p>
                  </div>
                ),
              },
            ]}
          />
        )}
      </SurfaceCard>

      <SurfaceCard
        title="Onboarded fleet roster"
        description="Only admin-approved vehicles appear here as onboarded fleet units ready for self-managed logistics or network-linked assignments."
        className={classes.card}
        tone={tone}
      >
        {loading ? (
          <Spinner />
        ) : (
          <Table
            emptyMessage="No admin-approved vehicles are onboarded yet."
            tone={tone}
            rows={approvedVehicles}
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
                    <p className={classes.sub}>
                      Chassis: {vehicle.chassisNumber ?? 'Pending'}
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
                    <p className={classes.sub}>
                      {vehicle.insuranceCompany
                        ? `${vehicle.insuranceCompany} · policy ${vehicle.insurancePolicyNumber ?? 'Pending'}`
                        : 'Insurance details pending'}
                    </p>
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
                    disabled={retiringId === vehicle.id || !isVehicleApproved(vehicle)}
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
        description="Truck and container units must complete the compulsory number plate, front, right, left, back, chassis, and insurance camera-capture package before internal approval."
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
