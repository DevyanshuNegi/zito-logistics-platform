'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
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
  const [plateNumber, setPlateNumber] = useState('');
  const [chassisNumber, setChassisNumber] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [type, setType] = useState('VAN');
  const [capacityKg, setCapacityKg] = useState('');
  const [capacityM3, setCapacityM3] = useState('');
  const [insuranceCompany, setInsuranceCompany] = useState('');
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState('');
  const [insuranceExpiry, setInsuranceExpiry] = useState('');
  const [verificationFiles, setVerificationFiles] = useState<Record<string, File | null>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCatalogGroup = useMemo(
    () => KENYA_VEHICLE_CATALOG.find((group) => group.vehicleType === type),
    [type],
  );
  const makeOptions = useMemo(
    () => Array.from(new Set((selectedCatalogGroup?.models ?? []).map((item) => item.make))).sort(),
    [selectedCatalogGroup],
  );
  const modelOptions = useMemo(
    () =>
      (selectedCatalogGroup?.models ?? [])
        .filter((item) => item.make === make)
        .map((item) => item.model)
        .sort(),
    [make, selectedCatalogGroup],
  );

  async function loadFleet() {
    setLoading(true);
    setError(null);

    try {
      const [vehicleResponse, breakdownResponse] = await Promise.all([
        api.get<Vehicle[]>('/fleet'),
        api.get<BreakdownResponse>('/fleet/breakdowns'),
      ]);

      setVehicles(vehicleResponse);
      setBreakdowns(breakdownResponse.breakdowns);
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
      const missingUploads = FLEET_VERIFICATION_UPLOAD_CATEGORIES.filter(
        (category) => !verificationFiles[category],
      );
      if (missingUploads.length > 0) {
        throw new Error(`Upload all required photos and documents first: ${missingUploads.map(formatStatus).join(', ')}`);
      }

      const formData = new FormData();
      formData.append('plateNumber', plateNumber);
      formData.append('chassisNumber', chassisNumber);
      formData.append('make', make);
      formData.append('model', model);
      formData.append('year', year);
      formData.append('type', type);
      formData.append('capacityKg', capacityKg);
      formData.append('capacityM3', capacityM3);
      formData.append('insuranceCompany', insuranceCompany);
      formData.append('insurancePolicyNumber', insurancePolicyNumber);
      formData.append('insuranceExpiry', insuranceExpiry);
      FLEET_VERIFICATION_UPLOAD_CATEGORIES.forEach((category) => {
        formData.append(category, verificationFiles[category]!);
      });

      await api.post('/fleet', formData);

      setPlateNumber('');
      setChassisNumber('');
      setMake('');
      setModel('');
      setYear('');
      setType('VAN');
      setCapacityKg('');
      setCapacityM3('');
      setInsuranceCompany('');
      setInsurancePolicyNumber('');
      setInsuranceExpiry('');
      setVerificationFiles({});
      await loadFleet();
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
        description="Upload the compulsory number plate, front, right, left, back, chassis, and insurance camera-capture packet here so internal teams can verify heavy vehicles and container units before operational approval."
        onChange={() => loadFleet()}
        title="Vehicle verification package"
        vehicles={vehicles}
      />

      <SurfaceCard title="Add vehicle" description="Transporter fleet onboarding uses the same structured vehicle profile and approval rules as the customer and courier-company fleet workflow.">
        <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" onSubmit={handleCreate}>
          <Input label="Plate number" value={plateNumber} onChange={(event) => setPlateNumber(event.target.value)} required />
          <Input label="Chassis number" value={chassisNumber} onChange={(event) => setChassisNumber(event.target.value)} required />
          <Input label="Year" type="number" value={year} onChange={(event) => setYear(event.target.value)} required />
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-200">Vehicle type</span>
            <select
              className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
              value={type}
              onChange={(event) => {
                setType(event.target.value);
                setMake('');
                setModel('');
              }}
            >
              {VEHICLE_TYPES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-200">Make</span>
            <select
              className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
              value={make}
              onChange={(event) => {
                setMake(event.target.value);
                setModel('');
              }}
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
            <span className="text-sm font-medium text-slate-200">Model</span>
            <select
              className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              required
              disabled={!make}
            >
              <option value="">Select model</option>
              {modelOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <Input label="Capacity (kg)" type="number" value={capacityKg} onChange={(event) => setCapacityKg(event.target.value)} required />
          <Input label="Capacity (m3)" type="number" value={capacityM3} onChange={(event) => setCapacityM3(event.target.value)} required />
          <Input label="Insurance company" value={insuranceCompany} onChange={(event) => setInsuranceCompany(event.target.value)} required />
          <Input label="Policy number" value={insurancePolicyNumber} onChange={(event) => setInsurancePolicyNumber(event.target.value)} required />
          <Input label="Insurance expiry" type="date" value={insuranceExpiry} onChange={(event) => setInsuranceExpiry(event.target.value)} required />
          <div className="md:col-span-2 xl:col-span-4">
            <p className="text-sm font-medium text-slate-200">Mandatory photos and documents</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {FLEET_VERIFICATION_UPLOAD_CATEGORIES.map((category) => (
                <label key={category} className="block space-y-2 rounded-2xl border border-slate-800 bg-slate-950/50 p-3">
                  <span className="text-xs font-semibold text-slate-200">{formatStatus(category)}</span>
                  <input
                    accept="image/*"
                    capture="environment"
                    className="block w-full text-xs text-slate-300 file:mr-3 file:rounded-full file:border-0 file:bg-sky-500/20 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-sky-100"
                    required
                    type="file"
                    onChange={(event) => handleVerificationFileChange(category, event)}
                  />
                </label>
              ))}
            </div>
          </div>
          <div className="md:col-span-2 xl:col-span-4">
            <Button disabled={saving} type="submit">
              {saving ? 'Saving vehicle...' : 'Create vehicle'}
            </Button>
            <p className="mt-3 text-xs text-slate-400">
              New vehicles remain pending until the full camera-capture verification packet is reviewed, internal operations approve the unit, GPS is configured, and the vehicle becomes active for assignment.
            </p>
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
        title="Linked driver roster"
        description="Link drivers who already registered in Zito Partners, then assign them to transporter vehicles after internal approval."
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
