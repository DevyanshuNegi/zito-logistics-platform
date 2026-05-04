'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Clock3, MapPinned, Truck, Wallet } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { ApiError, api } from '@/lib/api';
import { formatMoney, formatStatus } from '@/lib/format';

type DriverProfile = {
  user?: {
    fullName?: string | null;
  } | null;
  vehicle?: {
    plateNumber?: string | null;
    type?: string | null;
    status?: string | null;
  } | null;
  isOnline?: boolean;
  isAvailable?: boolean;
};

type ShiftStatus = {
  active: boolean;
  hoursElapsed?: number;
  hoursRemaining?: number;
  fatigueAlert?: string | null;
};

type PayrollSummary = {
  totalEarned: number;
  pendingAmount: number;
};

type Trip = {
  id: string;
  reference: string;
  status: string;
  stops?: Array<{ address?: string | null }>;
};

type TripResponse = {
  bookings: Trip[];
};

type HeatmapZone = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  intensity: 'LOW' | 'MEDIUM' | 'HIGH';
  demandSupplyRatio: number;
};

type DriverHeatmapResponse = {
  driver: {
    location?: {
      latitude: number;
      longitude: number;
    } | null;
  };
  zones: HeatmapZone[];
  suggestions: Array<{
    rank: number;
    zoneId: string;
    zoneName: string;
    intensity: 'LOW' | 'MEDIUM' | 'HIGH';
    demandSupplyRatio: number;
    recommendation: string;
  }>;
};

type Bounds = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

function buildBounds(points: Array<{ lat: number; lng: number }>): Bounds | null {
  if (points.length === 0) {
    return null;
  }

  const latitudes = points.map((point) => point.lat);
  const longitudes = points.map((point) => point.lng);

  return {
    minLat: Math.min(...latitudes),
    maxLat: Math.max(...latitudes),
    minLng: Math.min(...longitudes),
    maxLng: Math.max(...longitudes),
  };
}

function projectPoint(bounds: Bounds, lat: number, lng: number) {
  const left =
    bounds.maxLng === bounds.minLng
      ? 50
      : ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 74 + 13;
  const top =
    bounds.maxLat === bounds.minLat
      ? 50
      : ((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat)) * 58 + 20;

  return { left, top };
}

function getRouteSummary(trip: Trip) {
  const pickup = trip.stops?.[0]?.address ?? 'Pickup pending';
  const drop = trip.stops?.[1]?.address ?? 'Drop-off pending';
  return `${pickup} -> ${drop}`;
}

function getStatusClasses(status: string) {
  const normalized = status.toUpperCase();
  if (['COMPLETED', 'DELIVERED'].includes(normalized)) {
    return 'bg-[#dcfce7] text-[#15803d]';
  }
  if (['ASSIGNED', 'ACCEPTED', 'ARRIVED', 'PICKED', 'IN_TRANSIT', 'ARRIVED_AT_DESTINATION', 'DELIVERY_VERIFICATION'].includes(normalized)) {
    return 'bg-[#dbeafe] text-[#1d4ed8]';
  }
  if (normalized === 'CANCELLED') {
    return 'bg-[#fee2e2] text-[#b91c1c]';
  }
  return 'bg-[#fef3c7] text-[#92400e]';
}

function normalizeHeatmapNotice(message: string | null) {
  if (!message) {
    return null;
  }

  if (message.toLowerCase().includes('no configured zones')) {
    return 'Demand zones are still being prepared. You can keep your shift running and jobs will still come through normally.';
  }

  return message;
}

export default function DriverDashboardPage() {
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [shift, setShift] = useState<ShiftStatus | null>(null);
  const [summary, setSummary] = useState<PayrollSummary | null>(null);
  const [jobs, setJobs] = useState<Trip[]>([]);
  const [heatmap, setHeatmap] = useState<DriverHeatmapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [heatmapNotice, setHeatmapNotice] = useState<string | null>(null);

  async function loadDashboard() {
    setLoading(true);
    setError(null);
    setHeatmapNotice(null);

    try {
      const [profileResult, shiftResult, summaryResult, jobsResult, heatmapResult] =
        await Promise.allSettled([
          api.get<DriverProfile>('/drivers/me'),
          api.get<ShiftStatus>('/drivers/shift/status'),
          api.get<PayrollSummary>('/driver/payroll/summary'),
          api.get<TripResponse>('/driver/trips?limit=5'),
          api.get<DriverHeatmapResponse>('/heatmap/driver'),
        ]);

      if (
        profileResult.status !== 'fulfilled' ||
        shiftResult.status !== 'fulfilled' ||
        summaryResult.status !== 'fulfilled' ||
        jobsResult.status !== 'fulfilled'
      ) {
        const primaryFailure = [profileResult, shiftResult, summaryResult, jobsResult].find(
          (result) => result.status === 'rejected',
        );
        throw primaryFailure?.reason;
      }

      setProfile(profileResult.value);
      setShift(shiftResult.value);
      setSummary(summaryResult.value);
      setJobs(jobsResult.value.bookings);

      if (heatmapResult.status === 'fulfilled') {
        setHeatmap(heatmapResult.value);
      } else {
        setHeatmap(null);
        const message =
          heatmapResult.reason instanceof ApiError
            ? heatmapResult.reason.message
            : 'Demand heatmap is not ready yet.';
        setHeatmapNotice(normalizeHeatmapNotice(message));
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load the driver app.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const activeTrip =
    jobs.find((trip) =>
      ['ASSIGNED', 'ACCEPTED', 'ARRIVED', 'PICKED', 'IN_TRANSIT', 'ARRIVED_AT_DESTINATION', 'DELIVERY_VERIFICATION'].includes(
        trip.status.toUpperCase(),
      ),
    ) ?? jobs[0] ?? null;

  const completedTrips = jobs.filter((trip) =>
    ['COMPLETED', 'DELIVERED'].includes(trip.status.toUpperCase()),
  ).length;

  const mapBounds = useMemo(() => {
    const points = [
      ...(heatmap?.zones ?? []).slice(0, 3).map((zone) => ({
        lat: zone.latitude,
        lng: zone.longitude,
      })),
      ...(heatmap?.driver.location
        ? [
            {
              lat: heatmap.driver.location.latitude,
              lng: heatmap.driver.location.longitude,
            },
          ]
        : []),
    ];

    return buildBounds(points);
  }, [heatmap]);

  const demandLabel = heatmap?.suggestions[0]?.zoneName ?? 'Demand watch';
  const demandNote =
    heatmap?.suggestions[0]?.recommendation ??
    heatmapNotice ??
    'Stay online and share your location so nearby demand can surface faster.';
  const hasDriverLocation = Boolean(heatmap?.driver.location);

  if (loading) {
    return <Spinner />;
  }

  return (
    <div className="space-y-4">
      {error ? (
        <Alert title="Driver app issue" variant="danger">
          {error}
        </Alert>
      ) : null}

      {shift?.fatigueAlert ? (
        <Alert title="Fatigue alert" variant="warning">
          {shift.fatigueAlert}
        </Alert>
      ) : null}

      <section className="overflow-hidden rounded-[24px] border border-[#d7e0ec] bg-white shadow-[0_14px_36px_rgba(15,23,42,0.08)]">
        <div className="flex items-center justify-between gap-3 bg-[linear-gradient(180deg,#1b3f72_0%,#142f55_100%)] px-4 py-3 text-white">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100/78">
              Today&apos;s earnings
            </p>
            <p className="mt-1 text-[1.35rem] font-extrabold">
              {formatMoney(summary?.totalEarned)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100/78">
              Trips
            </p>
            <p className="mt-1 text-[1.35rem] font-extrabold">{jobs.length}</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-b border-[#eef2f8] bg-white px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-[#1a1a2e]">
              {profile?.isOnline ? "You're online" : 'You are offline'}
            </p>
            <p className="mt-1 text-[11px] text-[#64748b]">
              {shift?.active
                ? `${shift.hoursRemaining ?? 0}h left in your active shift`
                : 'Start your shift to receive and move new jobs.'}
            </p>
          </div>
          <div
            className={[
              'relative h-[22px] w-10 rounded-full transition',
              profile?.isOnline ? 'bg-[#16a34a]' : 'bg-[#cbd5e1]',
            ].join(' ')}
            aria-hidden="true"
          >
            <span
              className={[
                'absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_4px_rgba(15,23,42,0.16)] transition',
                profile?.isOnline ? 'right-[2px]' : 'left-[2px]',
              ].join(' ')}
            />
          </div>
        </div>

        <div className="relative h-[250px] overflow-hidden bg-[linear-gradient(135deg,#e8eef7_0%,#d4dcf0_100%)]">
          <div className="absolute inset-0 opacity-35">
            <div className="absolute left-0 right-0 top-[32%] h-[3px] rounded-full bg-white" />
            <div className="absolute left-0 right-0 top-[56%] h-[3px] rounded-full bg-white" />
            <div className="absolute left-[22%] top-0 bottom-0 w-[3px] rounded-full bg-white" />
            <div className="absolute left-[54%] top-0 bottom-0 w-[3px] rounded-full bg-white" />
            <div className="absolute left-[78%] top-0 bottom-0 w-[3px] rounded-full bg-white" />
            <div className="absolute left-[6%] top-[8%] h-[22%] w-[20%] rounded-[8px] bg-[#c8d4e8]" />
            <div className="absolute left-[33%] top-[10%] h-[20%] w-[22%] rounded-[8px] bg-[#c8d4e8]" />
            <div className="absolute left-[62%] top-[14%] h-[18%] w-[18%] rounded-[8px] bg-[#c8d4e8]" />
            <div className="absolute left-[10%] top-[62%] h-[18%] w-[20%] rounded-[8px] bg-[#c8d4e8]" />
            <div className="absolute left-[58%] top-[62%] h-[18%] w-[24%] rounded-[8px] bg-[#c8d4e8]" />
          </div>

          <div className="absolute left-3 top-3 rounded-full bg-[#16a34a] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white">
            {profile?.isOnline ? 'Online' : 'Offline'}
          </div>
          <div className="absolute right-3 top-3 rounded-full bg-[#1b3f72] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white">
            {demandLabel}
          </div>

          {mapBounds ? (
            <>
              {(heatmap?.zones ?? []).slice(0, 3).map((zone) => {
                const point = projectPoint(mapBounds, zone.latitude, zone.longitude);
                const chipClass =
                  zone.intensity === 'HIGH'
                    ? 'bg-[#fef3c7] text-[#92400e]'
                    : zone.intensity === 'MEDIUM'
                      ? 'bg-[#dbeafe] text-[#1d4ed8]'
                      : 'bg-[#dcfce7] text-[#15803d]';

                return (
                  <div
                    key={zone.id}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${point.left}%`, top: `${point.top}%` }}
                  >
                    <div className={`rounded-full px-3 py-2 text-[10px] font-bold shadow-sm ${chipClass}`}>
                      {zone.name}
                    </div>
                  </div>
                );
              })}

              {heatmap?.driver.location ? (
                <div
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{
                    left: `${projectPoint(
                      mapBounds,
                      heatmap.driver.location.latitude,
                      heatmap.driver.location.longitude,
                    ).left}%`,
                    top: `${projectPoint(
                      mapBounds,
                      heatmap.driver.location.latitude,
                      heatmap.driver.location.longitude,
                    ).top}%`,
                  }}
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1b3f72] text-white shadow-[0_8px_18px_rgba(27,63,114,0.24)]">
                    <Truck className="h-5 w-5" />
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#1b3f72] text-white shadow-[0_10px_22px_rgba(27,63,114,0.22)]">
              <Truck className="h-6 w-6" />
            </div>
          )}

          <div className="absolute bottom-3 left-3 right-3 rounded-[14px] bg-white/90 px-3 py-2 text-[11px] font-medium text-[#475569] shadow-[0_6px_18px_rgba(15,23,42,0.08)] backdrop-blur">
            {demandNote}
          </div>
        </div>

        <div className="p-3">
          <article className="rounded-[16px] bg-[#e8a020] px-4 py-4 text-white shadow-[0_10px_28px_rgba(232,160,32,0.2)]">
            {activeTrip ? (
              <>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/84">
                  Active job
                </p>
                <h2 className="mt-1 text-base font-bold">{activeTrip.reference}</h2>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-white/92">
                    <span className="h-2 w-2 rounded-full bg-white" />
                    {activeTrip.stops?.[0]?.address ?? 'Pickup pending'}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-white/82">
                    <span className="h-2 w-2 rounded-full bg-white/60" />
                    {activeTrip.stops?.[1]?.address ?? 'Drop-off pending'}
                  </div>
                </div>
                <div className="mt-3 inline-flex rounded-full bg-white/22 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em]">
                  {formatStatus(activeTrip.status)}
                </div>
                <div className="mt-4 flex gap-2">
                  <Link
                    href="/driver/jobs"
                    className="flex-1 rounded-[12px] bg-white px-3 py-3 text-center text-sm font-semibold text-[#b87400]"
                  >
                    Open trips
                  </Link>
                  <Link
                    href="/driver/shift"
                    className="flex-1 rounded-[12px] bg-white/22 px-3 py-3 text-center text-sm font-semibold text-white"
                  >
                    Profile
                  </Link>
                </div>
              </>
            ) : (
              <>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/84">
                  Next request
                </p>
                <h2 className="mt-1 text-base font-bold">No live job requests yet</h2>
                <p className="mt-2 text-[12px] leading-5 text-white/90">
                  Stay visible in the highlighted zone and keep your shift ready so the next assignment can land faster.
                </p>
                <div className="mt-4 flex gap-2">
                  <Link
                    href="/driver/jobs"
                    className="flex-1 rounded-[12px] bg-white px-3 py-3 text-center text-sm font-semibold text-[#b87400]"
                  >
                    Open trips
                  </Link>
                  <Link
                    href={hasDriverLocation ? '/driver/shift' : '/driver/shift'}
                    className="flex-1 rounded-[12px] bg-white/22 px-3 py-3 text-center text-sm font-semibold text-white"
                  >
                    {hasDriverLocation
                      ? shift?.active
                        ? 'Profile'
                        : 'Start shift'
                      : 'Enable location'}
                  </Link>
                </div>
              </>
            )}
          </article>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-3">
        {[
          {
            label: 'Vehicle',
            value: profile?.vehicle?.plateNumber ?? 'Pending',
            icon: Truck,
          },
          {
            label: 'Duty',
            value: shift?.active ? 'On shift' : 'Off shift',
            icon: Clock3,
          },
          {
            label: 'Payouts',
            value: summary?.pendingAmount ? 'Pending' : 'Clear',
            icon: Wallet,
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="rounded-[18px] border border-[#d7e0ec] bg-white px-3 py-4 text-center shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
            >
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#eef4ff] text-[#1b3f72]">
                <Icon className="h-4.5 w-4.5" />
              </div>
              <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">
                {item.label}
              </p>
              <p className="mt-1 text-sm font-semibold text-[#1a1a2e]">{item.value}</p>
            </div>
          );
        })}
      </section>

      <section className="rounded-[22px] border border-[#d7e0ec] bg-white px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
              Recent trips
            </p>
            <h2 className="mt-1 text-base font-semibold text-[#1a1a2e]">
              Active and completed movement
            </h2>
          </div>
          <Link href="/driver/jobs" className="text-sm font-semibold text-[#1b3f72]">
            View all
          </Link>
        </div>

        <div className="mt-4 space-y-3">
          {jobs.length > 0 ? (
            jobs.slice(0, 3).map((trip) => (
              <div
                key={trip.id}
                className="flex items-start gap-3 rounded-[16px] border border-[#edf2f8] bg-[#f8faff] px-3 py-3"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#eef4ff] text-[#1b3f72]">
                  <MapPinned className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[#1a1a2e]">{trip.reference}</p>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${getStatusClasses(trip.status)}`}>
                      {formatStatus(trip.status)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[#64748b]">{getRouteSummary(trip)}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[18px] border border-dashed border-[#d7e0ec] bg-[#f8faff] px-4 py-5 text-center">
              <p className="text-sm font-semibold text-[#1a1a2e]">No trips yet</p>
              <p className="mt-2 text-sm leading-6 text-[#64748b]">
                Once dispatch assigns work, your next movement cards will appear here.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
