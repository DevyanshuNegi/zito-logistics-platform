'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Table } from '@/components/ui/Table';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { FleetDriverManager } from '@/components/operations/FleetDriverManager';
import { FuelReportPanel } from '@/components/operations/FuelReportPanel';
import { VehicleLocationPanel } from '@/components/operations/VehicleLocationPanel';
import { VehicleVerificationPanel } from '@/components/operations/VehicleVerificationPanel';
import { ApiError, api } from '@/lib/api';
import { formatStatus } from '@/lib/format';
import { VEHICLE_TYPES } from '@/lib/phase-one';

type Driver = {
  id: string;
  user?: {
    fullName?: string | null;
  } | null;
};

type Vehicle = {
  id: string;
  plateNumber: string;
  type: string;
  status: string;
  verificationStatus?: string | null;
  deviceGpsLat?: number | null;
  deviceGpsLng?: number | null;
  lastGpsAt?: string | null;
  driver?: {
    id?: string | null;
    isOnline?: boolean | null;
    currentLatitude?: number | null;
    currentLongitude?: number | null;
    lastLocationAt?: string | null;
    user?: {
      fullName?: string | null;
    } | null;
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

type BreakdownResponse = {
  breakdowns: Array<{
    id: string;
    status: string;
    description: string;
    vehicle?: {
      plateNumber?: string | null;
    } | null;
  }>;
};

export default function TransporterFleetPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [breakdowns, setBreakdowns] = useState<BreakdownResponse['breakdowns']>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [plateNumber, setPlateNumber] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [type, setType] = useState('VAN');
  const [capacityKg, setCapacityKg] = useState('');
  const [capacityM3, setCapacityM3] = useState('');
  const [driverId, setDriverId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError(caught instanceof ApiError ? caught.message : 'Unable to load transporter fleet.');
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
        make: make || undefined,
        model: model || undefined,
        year: year ? Number(year) : undefined,
        type,
        capacityKg: Number(capacityKg),
        capacityM3: capacityM3 ? Number(capacityM3) : undefined,
        driverId: driverId || undefined,
      });

      setPlateNumber('');
      setMake('');
      setModel('');
      setYear('');
      setType('VAN');
      setCapacityKg('');
      setCapacityM3('');
      setDriverId('');
      await loadFleet();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to create vehicle.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Vehicles" value={String(vehicles.length)} helper="Transporter-visible fleet inventory." />
        <StatCard label="Active" value={String(vehicles.filter((vehicle) => vehicle.status === 'ACTIVE').length)} helper="Ready for use." tone="success" />
        <StatCard label="Breakdowns" value={String(breakdowns.filter((item) => item.status !== 'RESOLVED').length)} helper="Open fleet incidents." tone="warning" />
      </div>

      {error ? (
        <Alert title="Transporter fleet error" variant="danger">
          {error}
        </Alert>
      ) : null}

      <VehicleLocationPanel
        description="Choose a vehicle number to inspect its latest live fleet location before dispatch or reassignment."
        title="Vehicle location"
        vehicles={vehicles}
      />

      <VehicleVerificationPanel
        description="Upload the compulsory five truck photos here so internal teams can verify heavy vehicles and container units before operational approval."
        onChange={() => loadFleet()}
        title="Vehicle verification package"
        vehicles={vehicles}
      />

      <SurfaceCard title="Add vehicle" description="Quick transporter-side vehicle onboarding with the required capacity fields from the live vehicle schema.">
        <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" onSubmit={handleCreate}>
          <Input label="Plate number" value={plateNumber} onChange={(event) => setPlateNumber(event.target.value)} required />
          <Input label="Make" value={make} onChange={(event) => setMake(event.target.value)} />
          <Input label="Model" value={model} onChange={(event) => setModel(event.target.value)} />
          <Input label="Year" type="number" value={year} onChange={(event) => setYear(event.target.value)} />
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
          <Input label="Capacity (kg)" type="number" value={capacityKg} onChange={(event) => setCapacityKg(event.target.value)} required />
          <Input label="Capacity (m3)" type="number" value={capacityM3} onChange={(event) => setCapacityM3(event.target.value)} />
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
          <div className="md:col-span-2 xl:col-span-4">
            <Button disabled={saving} type="submit">
              {saving ? 'Saving vehicle...' : 'Create vehicle'}
            </Button>
          </div>
        </form>
      </SurfaceCard>

      <SurfaceCard title="Fleet view" description="Transporter vehicle roster and active incident list.">
        {loading ? (
          <Spinner />
        ) : (
          <Table
            rows={vehicles}
            columns={[
              { key: 'plate', header: 'Plate', render: (vehicle) => vehicle.plateNumber },
              { key: 'type', header: 'Type', render: (vehicle) => vehicle.type },
              {
                key: 'status',
                header: 'Status',
                render: (vehicle) => (
                  <div>
                    <p>{formatStatus(vehicle.status)}</p>
                    <p className="text-xs text-slate-400">
                      Verification: {formatStatus(vehicle.verificationStatus ?? 'PENDING_REVIEW')}
                    </p>
                  </div>
                ),
              },
              { key: 'driver', header: 'Driver', render: (vehicle) => vehicle.driver?.user?.fullName ?? 'Unassigned' },
            ]}
          />
        )}
      </SurfaceCard>

      <FleetDriverManager
        title="Transporter-managed drivers"
        description="Onboard transporter-owned drivers, keep their readiness visible, and place them onto the right vehicle from the same fleet."
        ownerLabel="transporter fleet"
        vehicles={vehicles}
        onChange={() => loadFleet()}
      />

      <SurfaceCard title="Breakdown watch" description="Open breakdown records across the transporter fleet.">
        {loading ? (
          <Spinner />
        ) : (
          <Table
            rows={breakdowns}
            columns={[
              { key: 'vehicle', header: 'Vehicle', render: (item) => item.vehicle?.plateNumber ?? 'Unknown vehicle' },
              { key: 'status', header: 'Status', render: (item) => formatStatus(item.status) },
              { key: 'description', header: 'Description', render: (item) => item.description },
            ]}
          />
        )}
      </SurfaceCard>

      <FuelReportPanel
        title="Fuel report"
        description="Transporter-side expected vs actual usage report with variance visibility."
        vehicles={vehicles.map((vehicle) => ({
          id: vehicle.id,
          plateNumber: vehicle.plateNumber,
        }))}
      />
    </div>
  );
}
