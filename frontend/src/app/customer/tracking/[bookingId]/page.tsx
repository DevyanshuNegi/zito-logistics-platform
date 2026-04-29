'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { LiveMap } from '@/components/maps/LiveMap';
import { TrackingTimeline } from '@/components/tracking/TrackingTimeline';
import { useSocket } from '@/hooks/useSocket';
import { ApiError, api } from '@/lib/api';
import { formatStatus } from '@/lib/format';

type TrackingData = {
  bookingId: string;
  reference: string;
  status: string;
  eta?: string | null;
  driver?: {
    name?: string | null;
    phone?: string | null;
    rating?: number | null;
    location?: {
      lat?: number | null;
      lng?: number | null;
      updatedAt?: string | Date | null;
    } | null;
  } | null;
  route?: {
    source?: string | null;
    optimized?: boolean;
    trafficLevel?: string | null;
    distanceKm?: number | null;
    durationMinutes?: number | null;
    path?: Array<{
      latitude: number;
      longitude: number;
    }>;
    deviation?: {
      isOffRoute?: boolean;
      deviationKm?: number | null;
      thresholdKm?: number | null;
      alertStatus?: string | null;
    } | null;
  } | null;
  stops?: Array<{
    sequence?: number;
    address?: string | null;
    contactName?: string | null;
    contactPhone?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  }>;
};

type LocationUpdatePayload = {
  lat?: number;
  lng?: number;
  updatedAt?: string;
  timestamp?: string;
  routeDeviationKm?: number | null;
  isOffRoute?: boolean;
  alertStatus?: string | null;
};

export default function CustomerTrackingPage() {
  const params = useParams();
  const rawBookingId = params?.bookingId;
  const bookingId = Array.isArray(rawBookingId) ? rawBookingId[0] : rawBookingId;
  const { socket, connected } = useSocket();
  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadTracking() {
    if (!bookingId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.get<TrackingData>(`/tracking/booking/${bookingId}`);
      setTracking(response);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load tracking data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTracking();
  }, [bookingId]);

  useEffect(() => {
    if (!socket || !bookingId) {
      return;
    }

    socket.emit('customer:track', { bookingId });

    const handleUpdate = (payload: LocationUpdatePayload) => {
      setTracking((current) =>
        current
          ? {
              ...current,
              driver: current.driver
                ? {
                    ...current.driver,
                    location: {
                      lat: payload.lat ?? current.driver.location?.lat ?? null,
                      lng: payload.lng ?? current.driver.location?.lng ?? null,
                      updatedAt:
                        payload.updatedAt ??
                        payload.timestamp ??
                        current.driver.location?.updatedAt ??
                        null,
                    },
                  }
                : current.driver,
              route: current.route
                ? {
                    ...current.route,
                    deviation: {
                      ...(current.route.deviation ?? {}),
                      deviationKm:
                        payload.routeDeviationKm ?? current.route.deviation?.deviationKm ?? null,
                      isOffRoute:
                        payload.isOffRoute ?? current.route.deviation?.isOffRoute ?? false,
                      alertStatus:
                        payload.alertStatus ?? current.route.deviation?.alertStatus ?? null,
                    },
                  }
                : current.route,
            }
          : current,
      );
    };

    socket.on('location-update', handleUpdate);

    return () => {
      socket.off('location-update', handleUpdate);
    };
  }, [bookingId, socket]);

  if (loading) {
    return <Spinner />;
  }

  if (!tracking) {
    return (
      <Alert title="Tracking unavailable" variant="danger">
        {error ?? 'No tracking payload returned.'}
      </Alert>
    );
  }

  const normalizedStops = (tracking.stops ?? []).map((stop) => ({
    sequence: stop.sequence,
    address: stop.address ?? undefined,
    contactName: stop.contactName ?? undefined,
    contactPhone: stop.contactPhone ?? undefined,
    latitude: stop.latitude ?? undefined,
    longitude: stop.longitude ?? undefined,
  }));

  return (
    <div className="space-y-6">
      {error ? (
        <Alert title="Tracking warning" variant="warning">
          {error}
        </Alert>
      ) : null}

      {tracking.route?.deviation?.isOffRoute ? (
        <Alert title="Route deviation detected" variant="warning">
          The assigned driver appears to be about{' '}
          {tracking.route.deviation.deviationKm ?? 0} km away from the planned route.
        </Alert>
      ) : null}

      <SurfaceCard
        title={`Tracking ${tracking.reference}`}
        description="Live tracking now uses the Phase 4 route-aware snapshot plus Socket.IO room updates."
        actions={
          <div className="flex items-center gap-3">
            <Badge variant={connected ? 'success' : 'neutral'}>
              {connected ? 'Socket connected' : 'Socket reconnecting'}
            </Badge>
            <Badge variant="info">{formatStatus(tracking.status)}</Badge>
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-slate-700/40 bg-slate-900/55 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Driver</p>
            <p className="mt-3 text-lg font-semibold text-white">
              {tracking.driver?.name ?? 'Awaiting driver assignment'}
            </p>
          </div>
          <div className="rounded-3xl border border-slate-700/40 bg-slate-900/55 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Phone</p>
            <p className="mt-3 text-lg font-semibold text-white">
              {tracking.driver?.phone ?? 'Not available yet'}
            </p>
          </div>
          <div className="rounded-3xl border border-slate-700/40 bg-slate-900/55 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">ETA</p>
            <p className="mt-3 text-lg font-semibold text-white">
              {tracking.eta ?? 'Pending'}
            </p>
          </div>
          <div className="rounded-3xl border border-slate-700/40 bg-slate-900/55 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Route Source</p>
            <p className="mt-3 text-lg font-semibold text-white">
              {tracking.route?.source === 'google-directions' ? 'Google Maps' : 'Fallback'}
            </p>
          </div>
        </div>
      </SurfaceCard>

      <LiveMap
        cacheKey={`tracking-${bookingId}`}
        driver={{
          lat: tracking.driver?.location?.lat,
          lng: tracking.driver?.location?.lng,
        }}
        eta={tracking.eta}
        route={tracking.route}
        status={tracking.status}
        stops={normalizedStops}
      />

      <TrackingTimeline stops={normalizedStops} />
    </div>
  );
}
