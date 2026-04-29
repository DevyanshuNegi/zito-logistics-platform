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
  driver?: {
    user?: {
      fullName?: string | null;
    } | null;
  } | null;
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
  const [type, setType] = useState('VAN');
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
        type,
        driverId: driverId || undefined,
      });

      setPlateNumber('');
      setType('VAN');
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

      <SurfaceCard title="Add vehicle" description="Quick transporter-side vehicle onboarding for Phase 1.">
        <form className="grid gap-4 md:grid-cols-3" onSubmit={handleCreate}>
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
          <div className="md:col-span-3">
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
              { key: 'status', header: 'Status', render: (vehicle) => formatStatus(vehicle.status) },
              { key: 'driver', header: 'Driver', render: (vehicle) => vehicle.driver?.user?.fullName ?? 'Unassigned' },
            ]}
          />
        )}
      </SurfaceCard>

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
