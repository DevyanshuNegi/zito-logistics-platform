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
              label: index === 0 ? 'Pickup' : `Stop ${stop.sequence ?? index + 1}`,
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
    driver: 'bg-[#1b3f72] text-white',
    pickup: 'bg-emerald-500 text-white',
    dropoff: 'bg-[#e8a020] text-white',
  };

  return (
    <section className="rounded-[32px] border border-slate-200/90 bg-white/94 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-sky-700">Live route</p>
          <h3 className="mt-1 text-2xl font-semibold text-slate-950">Tracking map</h3>
          <p className="mt-1 text-sm text-slate-500">
            Driver and route markers stay visible even if the app falls back to the last cached snapshot.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">
            Status: {effectiveStatus ?? 'Unknown'}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">
            ETA: {effectiveEta ?? 'Pending'}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">
            Traffic: {effectiveRoute?.trafficLevel ?? 'Unknown'}
          </span>
        </div>
      </div>

      {effectiveRoute?.deviation?.isOffRoute ? (
        <div className="mb-4 rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Driver appears to be off route by about {effectiveRoute.deviation.deviationKm ?? 0} km.
          Alert status: {effectiveRoute.deviation.alertStatus ?? 'pending review'}.
        </div>
      ) : null}

      {usingCache && cachedAt ? (
        <div className="mb-4 rounded-[22px] border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          Showing the last cached route snapshot from {cachedAt}.
          {!isOnline ? ' Offline mode is active.' : ''}
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-[#eef6ff] px-3 py-1 font-medium text-[#1b3f72]">
          Distance: {effectiveRoute?.distanceKm != null ? `${effectiveRoute.distanceKm} km` : 'Pending'}
        </span>
        <span className="rounded-full bg-[#eefbf4] px-3 py-1 font-medium text-emerald-700">
          Duration: {effectiveRoute?.durationMinutes != null ? `${effectiveRoute.durationMinutes} min` : 'Pending'}
        </span>
        <span className="rounded-full bg-[#fff8e8] px-3 py-1 font-medium text-amber-700">
          Route engine: {effectiveRoute?.source === 'google-directions' ? 'Google Maps' : 'Fallback'}
        </span>
      </div>

      <div className="relative h-80 overflow-hidden rounded-[30px] border border-slate-200 bg-[linear-gradient(135deg,#eef6ff_0%,#ffffff_58%,#f8fbff_100%)]">
        <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(148,163,184,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.2)_1px,transparent_1px)] [background-size:2.8rem_2.8rem]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.08),transparent_55%)]" />
        {bounds == null ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">
            No coordinates yet. Once the driver or route shares a location, the map will render here.
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
                  stroke={effectiveRoute?.deviation?.isOffRoute ? '#e8a020' : '#2563eb'}
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
                  className={`rounded-full px-3 py-1 text-xs font-semibold shadow-lg ${toneClass[point.tone]}`}
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
