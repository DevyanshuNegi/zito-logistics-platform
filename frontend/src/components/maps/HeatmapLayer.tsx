'use client';

import { useOfflineMapSnapshot } from './useOfflineMapSnapshot';

type HeatmapZone = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  demandCount: number;
  supplyCount: number;
  demandSupplyRatio: number;
  intensity: 'LOW' | 'MEDIUM' | 'HIGH';
  distanceFromDriverKm?: number | null;
};

type HeatmapLayerProps = {
  zones: HeatmapZone[];
  driverLocation?: {
    latitude: number;
    longitude: number;
  } | null;
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

export function HeatmapLayer({
  zones,
  driverLocation,
  cacheKey = 'driver-heatmap',
}: HeatmapLayerProps) {
  const { data: snapshot, usingCache, cachedAt, isOnline } = useOfflineMapSnapshot({
    storageKey: `zito.map.${cacheKey}`,
    liveData: {
      zones,
      driverLocation: driverLocation ?? null,
    },
    hasLiveData: zones.length > 0 || driverLocation != null,
  });
  const effectiveZones = snapshot.zones ?? [];
  const effectiveDriverLocation = snapshot.driverLocation;
  const bounds = buildBounds([
    ...effectiveZones.map((zone) => ({ lat: zone.latitude, lng: zone.longitude })),
    ...(effectiveDriverLocation
      ? [{ lat: effectiveDriverLocation.latitude, lng: effectiveDriverLocation.longitude }]
      : []),
  ]);

  const tone = {
    LOW: 'border-emerald-400/35 bg-emerald-500/15 text-emerald-100',
    MEDIUM: 'border-amber-400/35 bg-amber-500/20 text-amber-100',
    HIGH: 'border-rose-400/35 bg-rose-500/20 text-rose-100',
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-emerald-100">
          Low
        </span>
        <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-amber-100">
          Medium
        </span>
        <span className="rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1 text-rose-100">
          High
        </span>
        {usingCache ? (
          <span className="rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-sky-100">
            {isOnline ? 'Cached snapshot' : 'Offline cache active'}
          </span>
        ) : null}
      </div>

      {usingCache && cachedAt ? (
        <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
          Showing the last cached heatmap snapshot from {cachedAt}.
        </div>
      ) : null}

      <div className="relative h-[26rem] overflow-hidden rounded-3xl border border-slate-800 bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(22,78,99,0.88))]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.08),transparent_55%)]" />
        <div className="absolute inset-0 opacity-15 [background-image:linear-gradient(rgba(148,163,184,0.3)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.3)_1px,transparent_1px)] [background-size:3rem_3rem]" />

        {bounds == null ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
            No zone coordinates available yet.
          </div>
        ) : (
          <>
            {effectiveZones.map((zone) => {
              const point = projectPoint(bounds, zone.latitude, zone.longitude);
              const diameter = Math.max(12, Math.min(28, zone.radiusKm * 3.2));
              return (
                <div
                  key={zone.id}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${point.left}%`, top: `${point.top}%` }}
                >
                  <div
                    className={`flex items-center justify-center rounded-full border text-center shadow-2xl backdrop-blur ${tone[zone.intensity]}`}
                    style={{ width: `${diameter}%`, height: `${diameter}%`, minWidth: 88, minHeight: 88 }}
                  >
                    <div className="px-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em]">
                        {zone.intensity}
                      </p>
                      <p className="mt-1 text-sm font-semibold">{zone.name}</p>
                      <p className="mt-1 text-[11px]">
                        D {zone.demandCount} / S {zone.supplyCount}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

            {effectiveDriverLocation ? (
              <div
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${projectPoint(bounds, effectiveDriverLocation.latitude, effectiveDriverLocation.longitude).left}%`,
                  top: `${projectPoint(bounds, effectiveDriverLocation.latitude, effectiveDriverLocation.longitude).top}%`,
                }}
              >
                <div className="rounded-full border border-sky-400/40 bg-sky-400 px-3 py-1 text-xs font-bold text-slate-950 shadow-lg">
                  You
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
