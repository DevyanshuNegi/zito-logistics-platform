'use client';

import { useOfflineMapSnapshot } from './useOfflineMapSnapshot';

type Coordinate = {
  latitude: number;
  longitude: number;
};

type MapPoint = {
  key: string;
  label: string;
  lat: number;
  lng: number;
  tone: 'driver' | 'pickup' | 'dropoff';
};

type RouteSnapshot = {
  source?: string | null;
  optimized?: boolean;
  trafficLevel?: string | null;
  distanceKm?: number | null;
  durationMinutes?: number | null;
  path?: Coordinate[];
  deviation?: {
    isOffRoute?: boolean;
    deviationKm?: number | null;
    thresholdKm?: number | null;
    alertStatus?: string | null;
  } | null;
};

type LiveMapProps = {
  driver?: { lat?: number | null; lng?: number | null } | null;
  stops?: Array<{
    sequence?: number;
    address?: string;
    latitude?: number | null;
    longitude?: number | null;
  }>;
  eta?: string | null;
  status?: string | null;
  route?: RouteSnapshot | null;
  cacheKey?: string;
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
      : ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 80 + 10;
  const top =
    bounds.maxLat === bounds.minLat
      ? 50
      : ((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat)) * 70 + 15;

  return { left, top };
}

export function LiveMap({
  driver,
  stops = [],
  eta,
  status,
  route,
  cacheKey = 'live-map-default',
}: LiveMapProps) {
  const { data: snapshot, usingCache, cachedAt, isOnline } = useOfflineMapSnapshot({
    storageKey: `zito.map.${cacheKey}`,
    liveData: {
      driver: driver ?? null,
      stops,
      eta: eta ?? null,
      status: status ?? null,
      route: route ?? null,
    },
    hasLiveData:
      Boolean(driver?.lat != null && driver?.lng != null) ||
      stops.some((stop) => stop.latitude != null && stop.longitude != null) ||
      Boolean(route?.path?.length),
  });

  const effectiveDriver = snapshot.driver;
  const effectiveStops = snapshot.stops ?? [];
  const effectiveEta = snapshot.eta;
  const effectiveStatus = snapshot.status;
  const effectiveRoute = snapshot.route;

  const markers: MapPoint[] = [
    ...(effectiveDriver?.lat != null && effectiveDriver?.lng != null
      ? [
          {
            key: 'driver',
            label: 'Driver',
            lat: effectiveDriver.lat,
            lng: effectiveDriver.lng,
            tone: 'driver' as const,
          },
        ]
      : []),
    ...effectiveStops.flatMap((stop, index) =>
      stop.latitude != null && stop.longitude != null
        ? [
            {
              key: `stop-${stop.sequence ?? index + 1}`,
              label: stop.sequence ? `Stop ${stop.sequence}` : `Stop ${index + 1}`,
              lat: stop.latitude,
              lng: stop.longitude,
              tone: index === 0 ? ('pickup' as const) : ('dropoff' as const),
            },
          ]
        : [],
    ),
  ];

  const routePath =
    effectiveRoute?.path?.filter(
      (point) =>
        point.latitude != null &&
        point.longitude != null &&
        Number.isFinite(point.latitude) &&
        Number.isFinite(point.longitude),
    ) ?? [];
  const bounds = buildBounds([
    ...markers.map((marker) => ({ lat: marker.lat, lng: marker.lng })),
    ...routePath.map((point) => ({ lat: point.latitude, lng: point.longitude })),
  ]);

  const renderedMarkers =
    bounds == null
      ? []
      : markers.map((marker) => ({
          ...marker,
          ...projectPoint(bounds, marker.lat, marker.lng),
        }));
  const routePolyline =
    bounds == null || routePath.length < 2
      ? null
      : routePath
          .map((point) => {
            const projected = projectPoint(bounds, point.latitude, point.longitude);
            return `${projected.left},${projected.top}`;
          })
          .join(' ');

  const toneClass = {
    driver: 'bg-sky-400 text-slate-950',
    pickup: 'bg-emerald-400 text-slate-950',
    dropoff: 'bg-amber-400 text-slate-950',
  };

  return (
    <section className="rounded-3xl border border-slate-700/40 bg-slate-950/55 p-5 shadow-2xl backdrop-blur">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">Live Tracking Board</h3>
          <p className="text-sm text-slate-400">
            Phase 4 route layer with ETA, traffic-aware routing, and deviation visibility.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
          <span className="rounded-full border border-slate-700 px-3 py-1">
            Status: {effectiveStatus ?? 'Unknown'}
          </span>
          <span className="rounded-full border border-slate-700 px-3 py-1">
            ETA: {effectiveEta ?? 'Pending'}
          </span>
          <span className="rounded-full border border-slate-700 px-3 py-1">
            Route: {effectiveRoute?.source === 'google-directions' ? 'Google Maps' : 'Fallback'}
          </span>
          <span className="rounded-full border border-slate-700 px-3 py-1">
            Traffic: {effectiveRoute?.trafficLevel ?? 'Unknown'}
          </span>
          {usingCache ? (
            <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-amber-100">
              {isOnline ? 'Cached snapshot' : 'Offline cache active'}
            </span>
          ) : null}
        </div>
      </div>

      {effectiveRoute?.deviation?.isOffRoute ? (
        <div className="mb-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Driver is off route by about {effectiveRoute.deviation.deviationKm ?? 0} km. Alert status:{' '}
          {effectiveRoute.deviation.alertStatus ?? 'pending review'}.
        </div>
      ) : null}

      {usingCache && cachedAt ? (
        <div className="mb-4 rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
          Showing the last cached route snapshot from {cachedAt}.
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-sky-100">
          Distance: {effectiveRoute?.distanceKm != null ? `${effectiveRoute.distanceKm} km` : 'Pending'}
        </span>
        <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-emerald-100">
          Duration: {effectiveRoute?.durationMinutes != null ? `${effectiveRoute.durationMinutes} min` : 'Pending'}
        </span>
        <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-amber-100">
          Multi-stop optimization: {effectiveRoute?.optimized ? 'On' : 'Off'}
        </span>
      </div>

      <div className="relative h-80 overflow-hidden rounded-3xl border border-slate-800 bg-[linear-gradient(135deg,rgba(15,23,42,0.9),rgba(8,47,73,0.8))]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.12),transparent_55%)]" />
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(148,163,184,0.3)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.3)_1px,transparent_1px)] [background-size:3rem_3rem]" />
        {bounds == null ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
            No coordinates yet. Once the driver shares location, the route board will render here.
          </div>
        ) : (
          <>
            {routePolyline ? (
              <svg
                className="absolute inset-0 h-full w-full"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                <polyline
                  fill="none"
                  points={routePolyline}
                  stroke={effectiveRoute?.deviation?.isOffRoute ? '#f59e0b' : '#38bdf8'}
                  strokeDasharray={
                    effectiveRoute?.source === 'google-directions' ? undefined : '3 2'
                  }
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
              </svg>
            ) : null}

            {renderedMarkers.map((point) => (
              <div
                key={point.key}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${point.left}%`, top: `${point.top}%` }}
              >
                <div
                  className={`rounded-full px-3 py-1 text-xs font-bold shadow-lg ${toneClass[point.tone]}`}
                >
                  {point.label}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </section>
  );
}
