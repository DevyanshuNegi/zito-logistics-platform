'use client';

import { FormEvent, useEffect, useState } from 'react';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { Table } from '@/components/ui/Table';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { ApiError, api } from '@/lib/api';
import { compactId, formatDateTime, formatMoney, formatStatus } from '@/lib/format';

type FuelVehicle = {
  id: string;
  plateNumber: string;
};

type FuelLog = {
  id: string;
  fuelExpected: number;
  fuelActual: number;
  fuelCost: number;
  variance: number;
  isFlagged: boolean;
  notes?: string | null;
  createdAt: string;
  vehicle?: {
    plateNumber?: string | null;
  } | null;
  driver?: {
    user?: {
      fullName?: string | null;
    } | null;
  } | null;
  booking?: {
    reference?: string | null;
    status?: string | null;
  } | null;
};

type FuelReportResponse = {
  items: FuelLog[];
  total: number;
  page: number;
  limit: number;
  summary: {
    totalExpected: number;
    totalActual: number;
    totalVariance: number;
    flaggedCount: number;
  };
};

type FuelReportPanelProps = {
  title?: string;
  description?: string;
  vehicles: FuelVehicle[];
};

export function FuelReportPanel({
  title = 'Fuel report',
  description = 'Expected vs actual trip fuel usage and abnormal variance watch.',
  vehicles,
}: FuelReportPanelProps) {
  const [report, setReport] = useState<FuelReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vehicleId, setVehicleId] = useState('');
  const [bookingId, setBookingId] = useState('');
  const [fuelExpected, setFuelExpected] = useState('');
  const [fuelActual, setFuelActual] = useState('');
  const [fuelCost, setFuelCost] = useState('');
  const [notes, setNotes] = useState('');

  async function loadReport() {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get<FuelReportResponse>('/fleet/fuel/logs');
      setReport(response);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Unable to load fuel report.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReport();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await api.post('/fleet/fuel/logs', {
        vehicleId,
        bookingId: bookingId || undefined,
        fuelExpected: Number(fuelExpected),
        fuelActual: Number(fuelActual),
        fuelCost: Number(fuelCost),
        notes: notes || undefined,
      });

      setBookingId('');
      setFuelExpected('');
      setFuelActual('');
      setFuelCost('');
      setNotes('');
      await loadReport();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Unable to create fuel log.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <SurfaceCard title={title} description={description}>
      {error ? (
        <div className="mb-5">
          <Alert title="Fuel report error" variant="danger">
            {error}
          </Alert>
        </div>
      ) : null}

      <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-5" onSubmit={handleSubmit}>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-200">Vehicle</span>
          <select
            className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
            value={vehicleId}
            onChange={(event) => setVehicleId(event.target.value)}
            required
          >
            <option value="">Select vehicle</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.plateNumber}
              </option>
            ))}
          </select>
        </label>
        <Input
          label="Booking id"
          value={bookingId}
          onChange={(event) => setBookingId(event.target.value)}
          placeholder="Optional booking UUID"
        />
        <Input
          label="Expected fuel"
          value={fuelExpected}
          onChange={(event) => setFuelExpected(event.target.value)}
          type="number"
          min="0"
          step="0.01"
          required
        />
        <Input
          label="Actual fuel"
          value={fuelActual}
          onChange={(event) => setFuelActual(event.target.value)}
          type="number"
          min="0"
          step="0.01"
          required
        />
        <Input
          label="Fuel cost"
          value={fuelCost}
          onChange={(event) => setFuelCost(event.target.value)}
          type="number"
          min="0"
          step="0.01"
          required
        />
        <div className="md:col-span-2 xl:col-span-4">
          <Input
            label="Notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Trip notes or pump reference"
          />
        </div>
        <div className="md:self-end">
          <Button disabled={saving || vehicles.length === 0} type="submit">
            {saving ? 'Saving fuel log...' : 'Record fuel log'}
          </Button>
        </div>
      </form>

      <div className="mt-6">
        {loading ? (
          <Spinner />
        ) : report ? (
          <Table
            rows={report.items}
            emptyMessage="No fuel logs recorded yet."
            columns={[
              {
                key: 'vehicle',
                header: 'Vehicle',
                render: (item) => (
                  <div>
                    <p className="font-semibold text-white">
                      {item.vehicle?.plateNumber ?? compactId(item.id)}
                    </p>
                    <p className="text-xs text-slate-400">
                      {item.booking?.reference ?? 'No booking linked'}
                    </p>
                  </div>
                ),
              },
              {
                key: 'usage',
                header: 'Usage',
                render: (item) => {
                  const variancePercentage =
                    item.fuelExpected > 0
                      ? (item.variance / item.fuelExpected) * 100
                      : item.fuelActual > 0
                        ? 100
                        : 0;
                  return (
                    <div className="text-sm text-slate-200">
                      <p>Expected: {item.fuelExpected.toFixed(2)} L</p>
                      <p>Actual: {item.fuelActual.toFixed(2)} L</p>
                      <p className={item.isFlagged ? 'text-amber-300' : 'text-slate-400'}>
                        Variance: {item.variance.toFixed(2)} L ({variancePercentage.toFixed(1)}%)
                      </p>
                    </div>
                  );
                },
              },
              {
                key: 'driver',
                header: 'Driver',
                render: (item) => item.driver?.user?.fullName ?? 'Unassigned',
              },
              {
                key: 'cost',
                header: 'Cost',
                render: (item) => formatMoney(item.fuelCost),
              },
              {
                key: 'status',
                header: 'Review',
                render: (item) => (
                  <div className="text-sm">
                    <p>{item.isFlagged ? formatStatus('FLAGGED') : formatStatus('NORMAL')}</p>
                    <p className="text-xs text-slate-400">{formatDateTime(item.createdAt)}</p>
                  </div>
                ),
              },
            ]}
          />
        ) : null}
      </div>
    </SurfaceCard>
  );
}
