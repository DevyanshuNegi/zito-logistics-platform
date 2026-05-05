'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Table } from '@/components/ui/Table';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { FuelReportPanel } from '@/components/operations/FuelReportPanel';
import { VehicleLocationPanel } from '@/components/operations/VehicleLocationPanel';
import { ApiError, api } from '@/lib/api';
import { compactId, formatDateTime, formatStatus } from '@/lib/format';
import { VEHICLE_TYPES } from '@/lib/phase-one';

type Driver = {
  id: string;
  user?: {
    fullName?: string | null;
  } | null;
  vehicle?: {
    id?: string;
    plateNumber?: string | null;
  } | null;
};

type Vehicle = {
  id: string;
  plateNumber: string;
  type: string;
  make?: string | null;
  model?: string | null;
  capacityKg?: number | null;
  status: string;
  deviceGpsLat?: number | null;
  deviceGpsLng?: number | null;
  lastGpsAt?: string | null;
  insuranceExpiry?: string | null;
  permitExpiry?: string | null;
  driver?: {
    id?: string;
    isOnline?: boolean | null;
    currentLatitude?: number | null;
    currentLongitude?: number | null;
    lastLocationAt?: string | null;
    user?: {
      fullName?: string | null;
    } | null;
  } | null;
};

type Breakdown = {
  id: string;
  status: string;
  description: string;
  createdAt?: string;
  vehicle?: {
    plateNumber?: string | null;
  } | null;
  driver?: {
    user?: {
      fullName?: string | null;
    } | null;
  } | null;
};

type BreakdownResponse = {
  breakdowns: Breakdown[];
};

export default function AdminFleetPage() {
  const [activePanel, setActivePanel] = useState<'fleet' | 'breakdowns' | 'fuel'>('fleet');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [breakdowns, setBreakdowns] = useState<Breakdown[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [plateNumber, setPlateNumber] = useState('');
  const [type, setType] = useState('VAN');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [capacityKg, setCapacityKg] = useState('');
  const [driverId, setDriverId] = useState('');
  const [insuranceExpiry, setInsuranceExpiry] = useState('');
  const [permitExpiry, setPermitExpiry] = useState('');
  const [driverSelection, setDriverSelection] = useState<Record<string, string>>({});
  const [backupSelection, setBackupSelection] = useState<Record<string, string>>({});

  async function loadFleet() {
    setLoading(true);
    setError(null);

    try {
      const [vehicleResponse, breakdownResponse, driverResponse] = await Promise.all([
        api.get<Vehicle[]>('/fleet'),
        api.get<BreakdownResponse>('/fleet/breakdowns'),
        api.get<Driver[]>('/drivers'),
      ]);

      setVehicles(vehicleResponse);
      setBreakdowns(breakdownResponse.breakdowns);
      setDrivers(driverResponse);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load fleet data.');
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
        plateNumber,
        type,
        make: make || undefined,
        model: model || undefined,
        capacityKg: capacityKg ? Number(capacityKg) : undefined,
        driverId: driverId || undefined,
        insuranceExpiry: insuranceExpiry || undefined,
        permitExpiry: permitExpiry || undefined,
      });

      setPlateNumber('');
      setType('VAN');
      setMake('');
      setModel('');
      setCapacityKg('');
      setDriverId('');
      setInsuranceExpiry('');
      setPermitExpiry('');
      await loadFleet();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to create vehicle.');
    } finally {
      setSaving(false);
    }
  }

  async function assignDriver(vehicleId: string) {
    const selectedDriverId = driverSelection[vehicleId];
    if (!selectedDriverId) {
      setError('Choose a driver before assigning.');
      return;
    }

    try {
      await api.patch(`/fleet/${vehicleId}/assign-driver`, { driverId: selectedDriverId });
      await loadFleet();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to assign driver.');
    }
  }

  async function retireVehicle(vehicleId: string) {
    try {
      await api.patch(`/fleet/${vehicleId}/retire`, { note: 'Retired from admin fleet overview' });
      await loadFleet();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to retire vehicle.');
    }
  }

  async function assignBackup(breakdownId: string) {
    const backupVehicleId = backupSelection[breakdownId];
    if (!backupVehicleId) {
      setError('Choose a backup vehicle first.');
      return;
    }

    try {
      await api.post(`/fleet/breakdowns/${breakdownId}/assign-backup`, {
        backupVehicleId,
      });
      await loadFleet();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to assign backup vehicle.');
    }
  }

  async function resolveBreakdown(breakdownId: string) {
    try {
      await api.post(`/fleet/breakdowns/${breakdownId}/resolve`);
      await loadFleet();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to resolve breakdown.');
    }
  }

  const activeVehicles = vehicles.filter((vehicle) => vehicle.status === 'ACTIVE');

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Fleet size" value={String(vehicles.length)} helper="Vehicles visible to the admin portal." />
        <StatCard label="Active vehicles" value={String(activeVehicles.length)} helper="Ready for assignment." tone="success" />
        <StatCard label="Open breakdowns" value={String(breakdowns.filter((item) => item.status !== 'RESOLVED').length)} helper="Incidents still in motion." tone="warning" />
      </div>

      {error ? (
        <Alert title="Fleet workflow error" variant="danger">
          {error}
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button variant={activePanel === 'fleet' ? 'primary' : 'secondary'} onClick={() => setActivePanel('fleet')}>
          Fleet
        </Button>
        <Button variant={activePanel === 'breakdowns' ? 'primary' : 'secondary'} onClick={() => setActivePanel('breakdowns')}>
          Breakdowns
        </Button>
        <Button variant={activePanel === 'fuel' ? 'primary' : 'secondary'} onClick={() => setActivePanel('fuel')}>
          Fuel
        </Button>
      </div>

      {activePanel === 'fleet' ? (
        <>
      <VehicleLocationPanel
        description="Select a vehicle number to inspect its live location before dispatch, reassignment, or incident response."
        title="Fleet location"
        vehicles={vehicles}
      />
      <SurfaceCard title="Add vehicle" description="Fleet CRUD and assignment control for admin operations.">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreate}>
          <Input label="Plate number" value={plateNumber} onChange={(event) => setPlateNumber(event.target.value)} required />
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-200">Vehicle type</span>
            <select
              className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
              value={type}
              onChange={(event) => setType(event.target.value)}
            >
              {VEHICLE_TYPES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <Input label="Make" value={make} onChange={(event) => setMake(event.target.value)} />
          <Input label="Model" value={model} onChange={(event) => setModel(event.target.value)} />
          <Input label="Capacity (kg)" value={capacityKg} onChange={(event) => setCapacityKg(event.target.value)} />
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-200">Assign driver</span>
            <select
              className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
              value={driverId}
              onChange={(event) => setDriverId(event.target.value)}
            >
              <option value="">No driver yet</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.user?.fullName ?? 'Unnamed driver'}
                </option>
              ))}
            </select>
          </label>
          <Input label="Insurance expiry" type="date" value={insuranceExpiry} onChange={(event) => setInsuranceExpiry(event.target.value)} />
          <Input label="Permit expiry" type="date" value={permitExpiry} onChange={(event) => setPermitExpiry(event.target.value)} />
          <div className="md:col-span-2">
            <Button disabled={saving} type="submit">
              {saving ? 'Saving vehicle...' : 'Add vehicle'}
            </Button>
          </div>
        </form>
      </SurfaceCard>

      <SurfaceCard title="Fleet overview" description="Vehicles, driver linkage, and status controls.">
        {loading ? (
          <Spinner />
        ) : (
          <Table
            rows={vehicles}
            columns={[
              {
                key: 'vehicle',
                header: 'Vehicle',
                render: (vehicle) => (
                  <div>
                    <p className="font-semibold text-white">{vehicle.plateNumber}</p>
                    <p className="text-xs text-slate-400">
                      {vehicle.make ?? 'Unknown make'} {vehicle.model ?? ''}
                    </p>
                  </div>
                ),
              },
              {
                key: 'type',
                header: 'Type',
                render: (vehicle) => vehicle.type,
              },
              {
                key: 'status',
                header: 'Status',
                render: (vehicle) => formatStatus(vehicle.status),
              },
              {
                key: 'driver',
                header: 'Driver',
                render: (vehicle) => (
                  <div className="space-y-2">
                    <p className="text-sm text-slate-200">{vehicle.driver?.user?.fullName ?? 'Unassigned'}</p>
                    <select
                      className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-3 py-2 text-xs text-slate-100 focus:border-sky-400/70 focus:outline-none"
                      value={driverSelection[vehicle.id] ?? ''}
                      onChange={(event) =>
                        setDriverSelection((current) => ({
                          ...current,
                          [vehicle.id]: event.target.value,
                        }))
                      }
                    >
                      <option value="">Select driver</option>
                      {drivers.map((driver) => (
                        <option key={driver.id} value={driver.id}>
                          {driver.user?.fullName ?? 'Unnamed driver'}
                        </option>
                      ))}
                    </select>
                    <Button variant="secondary" onClick={() => void assignDriver(vehicle.id)}>
                      Reassign
                    </Button>
                  </div>
                ),
              },
              {
                key: 'expiry',
                header: 'Expiry',
                render: (vehicle) => (
                  <div className="text-xs text-slate-300">
                    <p>Insurance: {formatDateTime(vehicle.insuranceExpiry)}</p>
                    <p>Permit: {formatDateTime(vehicle.permitExpiry)}</p>
                  </div>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                render: (vehicle) => (
                  <Button variant="danger" onClick={() => void retireVehicle(vehicle.id)}>
                    Retire
                  </Button>
                ),
              },
            ]}
          />
        )}
      </SurfaceCard>
        </>
      ) : null}

      {activePanel === 'breakdowns' ? (
      <SurfaceCard title="Breakdown rescue flow" description="Admin rescue coordination, backup assignment, and close-out.">
        {loading ? (
          <Spinner />
        ) : (
          <Table
            rows={breakdowns}
            columns={[
              {
                key: 'incident',
                header: 'Incident',
                render: (breakdown) => (
                  <div>
                    <p className="font-semibold text-white">{breakdown.vehicle?.plateNumber ?? compactId(breakdown.id)}</p>
                    <p className="text-xs text-slate-400">{breakdown.description}</p>
                  </div>
                ),
              },
              {
                key: 'driver',
                header: 'Driver',
                render: (breakdown) => breakdown.driver?.user?.fullName ?? 'Unknown driver',
              },
              {
                key: 'status',
                header: 'Status',
                render: (breakdown) => formatStatus(breakdown.status),
              },
              {
                key: 'created',
                header: 'Reported',
                render: (breakdown) => formatDateTime(breakdown.createdAt),
              },
              {
                key: 'actions',
                header: 'Actions',
                render: (breakdown) => (
                  <div className="space-y-2">
                    <select
                      className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-3 py-2 text-xs text-slate-100 focus:border-sky-400/70 focus:outline-none"
                      value={backupSelection[breakdown.id] ?? ''}
                      onChange={(event) =>
                        setBackupSelection((current) => ({
                          ...current,
                          [breakdown.id]: event.target.value,
                        }))
                      }
                    >
                      <option value="">Select backup vehicle</option>
                      {activeVehicles.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.plateNumber}
                        </option>
                      ))}
                    </select>
                    <Button variant="secondary" onClick={() => void assignBackup(breakdown.id)}>
                      Assign backup
                    </Button>
                    <Button onClick={() => void resolveBreakdown(breakdown.id)}>Resolve</Button>
                  </div>
                ),
              },
            ]}
          />
        )}
      </SurfaceCard>
      ) : null}

      {activePanel === 'fuel' ? (
        <FuelReportPanel
          title="Fuel variance tab"
          description="Phase 2 admin fuel report, variance analysis, and exception logging."
          vehicles={vehicles.map((vehicle) => ({
            id: vehicle.id,
            plateNumber: vehicle.plateNumber,
          }))}
        />
      ) : null}
    </div>
  );
}
