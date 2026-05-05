'use client';

import { FormEvent, useEffect, useState } from 'react';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Table } from '@/components/ui/Table';
import { ApiError, api } from '@/lib/api';
import { formatDateTime, formatPercent, formatStatus } from '@/lib/format';

const SERVICE_TYPES = ['FTL', 'PTL', 'COURIER', 'WAREHOUSE', 'RAIL'] as const;
const VEHICLE_TYPES = [
  'MOTORBIKE',
  'VAN',
  'TRUCK_3T',
  'TRUCK_7T',
  'TRUCK_14T',
  'TRUCK_22T',
  'CONTAINER_20FT',
  'CONTAINER_40FT',
  'REFRIGERATED',
] as const;

type WarehouseCapacityResponse = {
  generatedAt: string;
  summary: {
    totalWarehouses: number;
    fullWarehouses: number;
    nearFullWarehouses: number;
    averageOccupancyPercentage: number;
  };
  warehouses: Array<{
    id: string;
    name: string;
    code: string;
    status: string;
    occupiedBins: number;
    totalBins: number;
    availableBins: number;
    occupancyPercentage: number;
    storedItemCount: number;
    isFull: boolean;
    isNearFull: boolean;
    recommendation: string;
  }>;
};

type FleetCapacityResponse = {
  generatedAt: string;
  summary: {
    totalVehicles: number;
    availableVehicles: number;
    dispatchReadyVehicles: number;
    onlineVehicles: number;
    totalCapacityKg: number;
    availableCapacityKg: number;
    dispatchReadyCapacityKg: number;
  };
  byType: Array<{
    vehicleType: string;
    totalVehicles: number;
    availableVehicles: number;
    dispatchReadyVehicles: number;
    blockedByBreakdown: number;
    availableCapacityKg: number;
  }>;
};

type ForecastResponse = {
  generatedAt: string;
  historyWindowDays: number;
  upcoming: Array<{
    date: string;
    projectedBookings: number;
    projectedWarehouseBookings: number;
  }>;
  currentPressure: {
    warehouseAverageOccupancyPercentage: number;
    fleetAvailableVehicles: number;
    forecastedDailyAverageBookings: number;
  };
  notes: string[];
};

type EnforceResponse = {
  allowed: boolean;
  constraintType: 'WAREHOUSE' | 'FLEET';
  recommendedWarehouse?: {
    id: string;
    name: string;
    occupancyPercentage: number;
    availableBins: number;
  };
  recommendedVehicle?: {
    id: string;
    plateNumber: string;
    capacityKg: number;
  };
  availableVehicleCount?: number;
};

export default function AdminCapacityPlanningPage() {
  const [warehouseSnapshot, setWarehouseSnapshot] = useState<WarehouseCapacityResponse | null>(null);
  const [fleetSnapshot, setFleetSnapshot] = useState<FleetCapacityResponse | null>(null);
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [enforcing, setEnforcing] = useState(false);
  const [form, setForm] = useState({
    serviceType: 'FTL',
    vehicleType: 'TRUCK_14T',
    cargoWeightKg: '',
    agencyId: '',
  });

  async function loadSnapshots() {
    setLoading(true);
    setError(null);

    const responses = await Promise.allSettled([
      api.get<WarehouseCapacityResponse>('/capacity-planning/warehouse'),
      api.get<FleetCapacityResponse>('/capacity-planning/fleet'),
      api.get<ForecastResponse>('/capacity-planning/forecast?days=30'),
    ]);

    const [warehouseResult, fleetResult, forecastResult] = responses;
    if (warehouseResult.status !== 'fulfilled') {
      setError(
        warehouseResult.reason instanceof ApiError
          ? warehouseResult.reason.message
          : 'Unable to load capacity planning.',
      );
      setLoading(false);
      return;
    }

    setWarehouseSnapshot(warehouseResult.value);
    setFleetSnapshot(fleetResult.status === 'fulfilled' ? fleetResult.value : null);
    setForecast(forecastResult.status === 'fulfilled' ? forecastResult.value : null);
    if (fleetResult.status !== 'fulfilled' || forecastResult.status !== 'fulfilled') {
      setError('Part of the capacity data is unavailable right now. Core occupancy data is still live.');
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadSnapshots();
  }, []);

  async function handleEnforce(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEnforcing(true);
    setActionMessage(null);
    setError(null);

    try {
      const response = await api.post<EnforceResponse>('/capacity-planning/enforce-limit', {
        serviceType: form.serviceType,
        vehicleType: form.vehicleType,
        cargoWeightKg: form.cargoWeightKg ? Number(form.cargoWeightKg) : undefined,
        agencyId: form.agencyId || undefined,
      });

      setActionMessage(
        response.constraintType === 'WAREHOUSE'
          ? `Warehouse capacity allows intake. Recommended site: ${response.recommendedWarehouse?.name ?? 'N/A'} (${formatPercent(response.recommendedWarehouse?.occupancyPercentage ?? 0)} occupied).`
          : `Fleet capacity allows dispatch. Recommended vehicle: ${response.recommendedVehicle?.plateNumber ?? 'N/A'} (${response.recommendedVehicle?.capacityKg ?? 0} kg).`,
      );
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to validate capacity.');
    } finally {
      setEnforcing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Full warehouses"
          value={String(warehouseSnapshot?.summary.fullWarehouses ?? 0)}
          helper="Sites that should block new intake immediately."
          tone="warning"
        />
        <StatCard
          label="Near full"
          value={String(warehouseSnapshot?.summary.nearFullWarehouses ?? 0)}
          helper="Warehouses approaching the capacity guardrail."
          tone="info"
        />
        <StatCard
          label="Dispatch ready"
          value={String(fleetSnapshot?.summary.dispatchReadyVehicles ?? 0)}
          helper="Vehicles with driver, signal, and free capacity."
          tone="success"
        />
        <StatCard
          label="Forecast avg / day"
          value={String(Math.round(forecast?.currentPressure.forecastedDailyAverageBookings ?? 0))}
          helper="Recent booking baseline feeding the capacity forecast."
          tone="neutral"
        />
      </div>

      {error ? (
        <Alert title="Capacity planning status" variant="warning">
          {error}
        </Alert>
      ) : null}

      {actionMessage ? (
        <Alert title="Capacity validation" variant="success">
          {actionMessage}
        </Alert>
      ) : null}

      <SurfaceCard
        title="Capacity guardrail"
        description="Pre-flight a booking before it is accepted into warehouse or fleet operations."
      >
        <form className="grid gap-4 md:grid-cols-4" onSubmit={handleEnforce}>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-200">Service type</span>
            <select
              className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
              value={form.serviceType}
              onChange={(event) => setForm((current) => ({ ...current, serviceType: event.target.value }))}
            >
              {SERVICE_TYPES.map((item) => (
                <option key={item} value={item}>
                  {formatStatus(item)}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-200">Vehicle type</span>
            <select
              className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
              value={form.vehicleType}
              onChange={(event) => setForm((current) => ({ ...current, vehicleType: event.target.value }))}
            >
              {VEHICLE_TYPES.map((item) => (
                <option key={item} value={item}>
                  {formatStatus(item)}
                </option>
              ))}
            </select>
          </label>

          <Input
            label="Cargo weight (kg)"
            type="number"
            value={form.cargoWeightKg}
            onChange={(event) => setForm((current) => ({ ...current, cargoWeightKg: event.target.value }))}
          />

          <Input
            label="Agency ID (optional)"
            value={form.agencyId}
            onChange={(event) => setForm((current) => ({ ...current, agencyId: event.target.value }))}
          />

          <div className="md:col-span-4">
            <Button disabled={enforcing} type="submit">
              {enforcing ? 'Validating...' : 'Validate capacity'}
            </Button>
          </div>
        </form>
      </SurfaceCard>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SurfaceCard
          title="Warehouse occupancy"
          description={`Live snapshot generated ${warehouseSnapshot ? formatDateTime(warehouseSnapshot.generatedAt) : 'just now'}.`}
        >
          {loading && !warehouseSnapshot ? (
            <div className="flex min-h-[20vh] items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <Table
              rows={warehouseSnapshot?.warehouses ?? []}
              emptyMessage="No warehouses available for capacity planning."
              columns={[
                {
                  key: 'warehouse',
                  header: 'Warehouse',
                  render: (warehouse) => (
                    <div>
                      <p className="font-semibold text-white">{warehouse.name}</p>
                      <p className="text-xs text-slate-400">{warehouse.code}</p>
                    </div>
                  ),
                },
                {
                  key: 'bins',
                  header: 'Bin usage',
                  render: (warehouse) => (
                    <div className="text-xs text-slate-300">
                      <p>{warehouse.occupiedBins} / {warehouse.totalBins} occupied</p>
                      <p>{warehouse.availableBins} free bins</p>
                    </div>
                  ),
                },
                {
                  key: 'occupancy',
                  header: 'Occupancy',
                  render: (warehouse) => (
                    <div className="text-xs text-slate-300">
                      <p>{formatPercent(warehouse.occupancyPercentage)}</p>
                      <p>{warehouse.storedItemCount} stored items</p>
                    </div>
                  ),
                },
                {
                  key: 'recommendation',
                  header: 'Recommendation',
                  render: (warehouse) => warehouse.recommendation,
                },
              ]}
            />
          )}
        </SurfaceCard>

        <SurfaceCard
          title="Forecast"
          description="Next-seven-day demand forecast with current pressure indicators."
        >
          {loading && !forecast ? (
            <div className="flex min-h-[20vh] items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <StatCard
                  label="Fleet available"
                  value={String(forecast?.currentPressure.fleetAvailableVehicles ?? 0)}
                  helper="Vehicles free in the current live snapshot."
                  tone="info"
                />
                <StatCard
                  label="Warehouse avg"
                  value={formatPercent(forecast?.currentPressure.warehouseAverageOccupancyPercentage ?? 0)}
                  helper="Current occupancy pressure across the network."
                  tone="warning"
                />
              </div>

              <Table
                rows={forecast?.upcoming ?? []}
                emptyMessage="No forecast data available."
                columns={[
                  {
                    key: 'date',
                    header: 'Date',
                    render: (day) => formatDateTime(day.date),
                  },
                  {
                    key: 'bookings',
                    header: 'Projected bookings',
                    render: (day) => String(day.projectedBookings),
                  },
                  {
                    key: 'warehouse',
                    header: 'Warehouse bookings',
                    render: (day) => String(day.projectedWarehouseBookings),
                  },
                ]}
              />
            </div>
          )}
        </SurfaceCard>
      </div>

      <SurfaceCard
        title="Fleet readiness by type"
        description={`Fleet snapshot generated ${fleetSnapshot ? formatDateTime(fleetSnapshot.generatedAt) : 'just now'}.`}
      >
        {loading && !fleetSnapshot ? (
          <div className="flex min-h-[20vh] items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <Table
            rows={fleetSnapshot?.byType ?? []}
            emptyMessage="No fleet records are available."
            columns={[
              {
                key: 'type',
                header: 'Vehicle type',
                render: (row) => formatStatus(row.vehicleType),
              },
              {
                key: 'availability',
                header: 'Availability',
                render: (row) => (
                  <div className="text-xs text-slate-300">
                    <p>Total: {row.totalVehicles}</p>
                    <p>Available: {row.availableVehicles}</p>
                  </div>
                ),
              },
              {
                key: 'dispatch',
                header: 'Dispatch ready',
                render: (row) => (
                  <div className="text-xs text-slate-300">
                    <p>{row.dispatchReadyVehicles} vehicles</p>
                    <p>{row.blockedByBreakdown} blocked by breakdown</p>
                  </div>
                ),
              },
              {
                key: 'capacity',
                header: 'Available capacity',
                render: (row) => `${row.availableCapacityKg.toFixed(2)} kg`,
              },
            ]}
          />
        )}
      </SurfaceCard>
    </div>
  );
}
