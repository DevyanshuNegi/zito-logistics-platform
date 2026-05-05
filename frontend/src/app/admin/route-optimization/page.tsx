'use client';

import { FormEvent, useEffect, useState } from 'react';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Table } from '@/components/ui/Table';
import { ApiError, api } from '@/lib/api';
import { compactId, formatDateTime, formatStatus } from '@/lib/format';

type RoutePayload = {
  generatedAt?: string;
  bookingId?: string;
  bookingReference?: string;
  status?: string;
  route: {
    source: string;
    optimized: boolean;
    trafficLevel: string;
    distanceKm: number;
    durationMinutes: number;
    eta: string | null;
    estimatedArrivalAt: string | null;
    notes: string[];
    legs: Array<{
      from: string;
      to: string;
      distanceKm: number;
      durationMinutes: number;
    }>;
  };
};

type DeviationPayload = {
  bookingId: string;
  bookingReference?: string;
  isOffRoute: boolean;
  deviationKm: number;
  thresholdKm: number;
  alertStatus: string | null;
};

export default function AdminRouteOptimizationPage() {
  const [manualRoute, setManualRoute] = useState<RoutePayload | null>(null);
  const [bookingRoute, setBookingRoute] = useState<RoutePayload | null>(null);
  const [deviation, setDeviation] = useState<DeviationPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [manualForm, setManualForm] = useState({
    originLabel: 'Origin',
    originLat: '-1.286389',
    originLng: '36.817223',
    destinationLabel: 'Destination',
    destinationLat: '-4.043477',
    destinationLng: '39.668206',
    currentLat: '',
    currentLng: '',
    optimizeStops: true,
    considerTraffic: true,
  });
  const [bookingForm, setBookingForm] = useState({
    bookingId: '',
    liveLat: '',
    liveLng: '',
    thresholdKm: '3',
  });

  useEffect(() => {
    setMessage('Use manual route simulation for corridor planning or inspect a live booking by ID for route/deviation review.');
  }, []);

  async function handleManualRoute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await api.post<RoutePayload>('/route-optimization/calculate', {
        stops: [
          {
            label: manualForm.originLabel,
            latitude: Number(manualForm.originLat),
            longitude: Number(manualForm.originLng),
          },
          {
            label: manualForm.destinationLabel,
            latitude: Number(manualForm.destinationLat),
            longitude: Number(manualForm.destinationLng),
          },
        ],
        currentLocation:
          manualForm.currentLat && manualForm.currentLng
            ? {
                label: 'Driver',
                latitude: Number(manualForm.currentLat),
                longitude: Number(manualForm.currentLng),
              }
            : undefined,
        optimizeStops: manualForm.optimizeStops,
        considerTraffic: manualForm.considerTraffic,
      });
      setManualRoute(response);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to calculate route.');
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadBookingRoute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<RoutePayload>(`/route-optimization/booking/${bookingForm.bookingId}`);
      setBookingRoute(response);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load booking route.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeviationCheck() {
    if (!bookingForm.bookingId || !bookingForm.liveLat || !bookingForm.liveLng) {
      setError('Booking ID, live latitude, and live longitude are required for deviation checks.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await api.post<DeviationPayload>(
        `/route-optimization/booking/${bookingForm.bookingId}/detect-deviation`,
        {
          latitude: Number(bookingForm.liveLat),
          longitude: Number(bookingForm.liveLng),
          thresholdKm: Number(bookingForm.thresholdKm),
        },
      );
      setDeviation(response);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to detect route deviation.');
    } finally {
      setLoading(false);
    }
  }

  function renderRoute(title: string, payload: RoutePayload | null) {
    if (!payload) {
      return (
        <div className="rounded-2xl border border-dashed border-slate-700/50 bg-slate-950/50 px-4 py-5 text-sm text-slate-400">
          No route calculation yet.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard label={`${title} source`} value={formatStatus(payload.route.source)} helper="Directions provider used for the route response." />
          <StatCard label="Traffic" value={formatStatus(payload.route.trafficLevel)} helper="Current traffic posture in the route engine." tone="warning" />
          <StatCard label="Distance" value={`${payload.route.distanceKm.toFixed(2)} km`} helper="Total route distance." tone="info" />
          <StatCard label="ETA" value={payload.route.eta ?? 'N/A'} helper={payload.route.estimatedArrivalAt ? `Arrival ${formatDateTime(payload.route.estimatedArrivalAt)}` : 'No ETA available.'} tone="success" />
        </div>

        {payload.bookingReference ? (
          <Alert title="Linked booking" variant="info">
            {payload.bookingReference} / {formatStatus(payload.status ?? 'unknown')} / {compactId(payload.bookingId)}
          </Alert>
        ) : null}

        <Table
          rows={payload.route.legs}
          emptyMessage="No route legs available."
          columns={[
            {
              key: 'from',
              header: 'Leg',
              render: (leg) => (
                <div>
                  <p className="font-semibold text-white">{leg.from}</p>
                  <p className="text-xs text-slate-400">To {leg.to}</p>
                </div>
              ),
            },
            {
              key: 'distance',
              header: 'Distance',
              render: (leg) => `${leg.distanceKm.toFixed(2)} km`,
            },
            {
              key: 'duration',
              header: 'Duration',
              render: (leg) => `${leg.durationMinutes.toFixed(0)} min`,
            },
          ]}
        />

        {payload.route.notes.length > 0 ? (
          <div className="space-y-2">
            {payload.route.notes.map((note) => (
              <Alert key={note} variant="info">
                {note}
              </Alert>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error ? (
        <Alert title="Route optimization error" variant="danger">
          {error}
        </Alert>
      ) : null}

      {message ? (
        <Alert title="Route desk guidance" variant="info">
          {message}
        </Alert>
      ) : null}

      {deviation ? (
        <Alert title="Deviation check" variant={deviation.isOffRoute ? 'warning' : 'success'}>
          {deviation.bookingReference ?? compactId(deviation.bookingId)} is {deviation.isOffRoute ? 'off route' : 'within route tolerance'}.
          Deviation {deviation.deviationKm.toFixed(2)} km against {deviation.thresholdKm.toFixed(2)} km threshold.
          {deviation.alertStatus ? ` Alert state: ${formatStatus(deviation.alertStatus)}.` : ''}
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <SurfaceCard title="Manual route simulator" description="Model a route corridor manually to validate ETA and distance assumptions before linking a real booking.">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleManualRoute}>
            <Input label="Origin label" value={manualForm.originLabel} onChange={(event) => setManualForm((current) => ({ ...current, originLabel: event.target.value }))} />
            <Input label="Destination label" value={manualForm.destinationLabel} onChange={(event) => setManualForm((current) => ({ ...current, destinationLabel: event.target.value }))} />
            <Input label="Origin latitude" type="number" value={manualForm.originLat} onChange={(event) => setManualForm((current) => ({ ...current, originLat: event.target.value }))} />
            <Input label="Origin longitude" type="number" value={manualForm.originLng} onChange={(event) => setManualForm((current) => ({ ...current, originLng: event.target.value }))} />
            <Input label="Destination latitude" type="number" value={manualForm.destinationLat} onChange={(event) => setManualForm((current) => ({ ...current, destinationLat: event.target.value }))} />
            <Input label="Destination longitude" type="number" value={manualForm.destinationLng} onChange={(event) => setManualForm((current) => ({ ...current, destinationLng: event.target.value }))} />
            <Input label="Current latitude (optional)" type="number" value={manualForm.currentLat} onChange={(event) => setManualForm((current) => ({ ...current, currentLat: event.target.value }))} />
            <Input label="Current longitude (optional)" type="number" value={manualForm.currentLng} onChange={(event) => setManualForm((current) => ({ ...current, currentLng: event.target.value }))} />
            <label className="flex items-center gap-3 rounded-2xl border border-slate-700/70 bg-slate-950/50 px-4 py-3 text-sm text-slate-200">
              <input checked={manualForm.optimizeStops} type="checkbox" onChange={(event) => setManualForm((current) => ({ ...current, optimizeStops: event.target.checked }))} />
              Optimize stop order
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-slate-700/70 bg-slate-950/50 px-4 py-3 text-sm text-slate-200">
              <input checked={manualForm.considerTraffic} type="checkbox" onChange={(event) => setManualForm((current) => ({ ...current, considerTraffic: event.target.checked }))} />
              Consider traffic
            </label>
            <div className="md:col-span-2">
              <Button disabled={loading} type="submit">
                {loading ? 'Calculating...' : 'Calculate route'}
              </Button>
            </div>
          </form>
        </SurfaceCard>

        <SurfaceCard title="Booking route and deviation" description="Inspect a live booking route and run an off-route detection check against current driver coordinates.">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleLoadBookingRoute}>
            <Input label="Booking ID" value={bookingForm.bookingId} onChange={(event) => setBookingForm((current) => ({ ...current, bookingId: event.target.value }))} />
            <div className="flex items-end">
              <Button disabled={loading} type="submit">
                {loading ? 'Loading...' : 'Load booking route'}
              </Button>
            </div>
            <Input label="Live latitude" type="number" value={bookingForm.liveLat} onChange={(event) => setBookingForm((current) => ({ ...current, liveLat: event.target.value }))} />
            <Input label="Live longitude" type="number" value={bookingForm.liveLng} onChange={(event) => setBookingForm((current) => ({ ...current, liveLng: event.target.value }))} />
            <Input label="Deviation threshold (km)" type="number" value={bookingForm.thresholdKm} onChange={(event) => setBookingForm((current) => ({ ...current, thresholdKm: event.target.value }))} />
            <div className="flex items-end">
              <Button disabled={loading} type="button" onClick={() => void handleDeviationCheck()}>
                {loading ? 'Checking...' : 'Detect deviation'}
              </Button>
            </div>
          </form>
        </SurfaceCard>
      </div>

      <SurfaceCard title="Manual route output" description="Live route planning response for the manual simulator.">
        {renderRoute('Manual', manualRoute)}
      </SurfaceCard>

      <SurfaceCard title="Booking route output" description="Current route plan associated with the booking route engine.">
        {renderRoute('Booking', bookingRoute)}
      </SurfaceCard>
    </div>
  );
}
