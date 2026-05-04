'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Headset, LocateFixed, Phone, ShieldAlert, Truck } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
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

function statusClassName(status: string) {
  const normalized = status.toUpperCase();
  if (normalized === 'COMPLETED') return 'bg-emerald-100 text-emerald-700';
  if (normalized === 'CANCELLED') return 'bg-rose-100 text-rose-700';
  if (normalized === 'IN_TRANSIT' || normalized === 'ASSIGNED' || normalized === 'PICKED_UP') {
    return 'bg-sky-100 text-sky-700';
  }
  return 'bg-amber-100 text-amber-700';
}

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
          The assigned driver appears to be about {tracking.route.deviation.deviationKm ?? 0} km away from the planned route.
        </Alert>
      ) : null}

      <section className="overflow-hidden rounded-[34px] border border-white/80 bg-[linear-gradient(135deg,#e9f4ff_0%,#f5f9ff_48%,#ffffff_100%)] p-6 shadow-[0_22px_60px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                {tracking.reference}
              </span>
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClassName(tracking.status)}`}
              >
                {formatStatus(tracking.status)}
              </span>
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                  connected ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {connected ? 'Live updates connected' : 'Reconnecting'}
              </span>
            </div>
            <h1 className="mt-3 text-3xl font-semibold text-slate-950">
              Live tracking centred on the route, driver, and ETA.
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Follow the driver, route status, and stop progression without leaving the customer journey.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {tracking.driver?.phone ? (
              <a href={`tel:${tracking.driver.phone}`}>
                <Button className="rounded-[16px] bg-[#1b3f72] px-4 py-3 text-white shadow-none hover:bg-[#163561]">
                  <Phone className="mr-2 h-4 w-4" />
                  Call driver
                </Button>
              </a>
            ) : null}
            <Link href={`/customer/bookings/${tracking.bookingId}`}>
              <Button
                variant="secondary"
                className="rounded-[16px] bg-slate-100 px-4 py-3 text-slate-800 shadow-none hover:bg-slate-200"
              >
                Booking detail
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'Driver',
            value: tracking.driver?.name ?? 'Awaiting driver assignment',
            helper: tracking.driver?.phone ?? 'Driver phone appears after assignment.',
          },
          {
            label: 'ETA',
            value: tracking.eta ?? 'Pending',
            helper: 'Updated from the live tracking stream.',
          },
          {
            label: 'Route source',
            value: tracking.route?.source === 'google-directions' ? 'Google Maps' : 'Fallback',
            helper: 'Current routing engine for this booking.',
          },
          {
            label: 'Deviation',
            value: tracking.route?.deviation?.isOffRoute ? 'Attention needed' : 'On route',
            helper: tracking.route?.deviation?.isOffRoute
              ? `${tracking.route.deviation.deviationKm ?? 0} km deviation detected.`
              : 'No route anomaly detected right now.',
          },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-[28px] border border-slate-200/90 bg-white/94 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]"
          >
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{item.label}</p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">{item.value}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{item.helper}</p>
          </div>
        ))}
      </section>

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

      <section className="grid gap-6 xl:grid-cols-[1fr_.95fr]">
        <TrackingTimeline stops={normalizedStops} />

        <div className="space-y-6">
          <div className="rounded-[32px] border border-slate-200/90 bg-white/94 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[#eef6ff] text-[#1b3f72]">
                <Truck className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Status message</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                  What is happening with this booking right now?
                </h2>
              </div>
            </div>

            <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-sm font-semibold text-slate-950">{formatStatus(tracking.status)}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {tracking.status === 'ASSIGNED'
                  ? 'Your driver has been assigned and is preparing to move to the pickup point.'
                  : tracking.status === 'PICKED_UP'
                    ? 'The cargo has been collected and the route is now active.'
                    : tracking.status === 'IN_TRANSIT'
                      ? 'Your goods are on the move and the map is tracking the trip.'
                      : tracking.status === 'DELIVERED' || tracking.status === 'COMPLETED'
                        ? 'Delivery has been completed. You can return to the booking detail for payments and rating.'
                        : 'This booking is still progressing through the service workflow.'}
              </p>
            </div>
          </div>

          <div className="rounded-[32px] border border-slate-200/90 bg-white/94 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-rose-100 text-rose-600">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Need help?</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                  Reach support or open the booking detail
                </h2>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/customer/support">
                <Button
                  variant="secondary"
                  className="rounded-[16px] bg-slate-100 px-4 py-3 text-slate-800 shadow-none hover:bg-slate-200"
                >
                  <Headset className="mr-2 h-4 w-4" />
                  Contact support
                </Button>
              </Link>
              <Link href={`/customer/bookings/${tracking.bookingId}`}>
                <Button className="rounded-[16px] bg-[#1b3f72] px-4 py-3 text-white shadow-none hover:bg-[#163561]">
                  <LocateFixed className="mr-2 h-4 w-4" />
                  Open booking detail
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
