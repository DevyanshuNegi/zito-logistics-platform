'use client';

type MapPoint = {
  label: string;
  lat: number | null | undefined;
  lng: number | null | undefined;
  tone?: 'driver' | 'pickup' | 'dropoff';
};

type LiveMapProps = {
  driver?: { lat?: number | null; lng?: number | null } | null;
  stops?: Array<{ sequence?: number; address?: string; latitude?: number | null; longitude?: number | null }>;
  eta?: string | null;
  status?: string | null;
};

function normalizePoints(points: MapPoint[]) {
  const valid = points.filter((point) => point.lat != null && point.lng != null) as Array<MapPoint & { lat: number; lng: number }>;
  if (valid.length === 0) return [];

  const latitudes = valid.map((point) => point.lat);
  const longitudes = valid.map((point) => point.lng);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);

  return valid.map((point) => {
    const left = maxLng === minLng ? 50 : ((point.lng - minLng) / (maxLng - minLng)) * 80 + 10;
    const top = maxLat === minLat ? 50 : ((maxLat - point.lat) / (maxLat - minLat)) * 70 + 15;
    return { ...point, left, top };
  });
}

export function LiveMap({ driver, stops = [], eta, status }: LiveMapProps) {
  const points = normalizePoints([
    ...(driver?.lat != null && driver?.lng != null
      ? [{ label: 'Driver', lat: driver.lat, lng: driver.lng, tone: 'driver' as const }]
      : []),
    ...stops.map((stop, index) => ({
      label: stop.sequence ? `Stop ${stop.sequence}` : `Stop ${index + 1}`,
      lat: stop.latitude,
      lng: stop.longitude,
      tone: index === 0 ? 'pickup' as const : 'dropoff' as const,
    })),
  ]);

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
          <p className="text-sm text-slate-400">Phase 1 fallback map with live coordinates.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
          <span className="rounded-full border border-slate-700 px-3 py-1">Status: {status ?? 'Unknown'}</span>
          <span className="rounded-full border border-slate-700 px-3 py-1">ETA: {eta ?? 'Pending'}</span>
        </div>
      </div>

      <div className="relative h-80 overflow-hidden rounded-3xl border border-slate-800 bg-[linear-gradient(135deg,rgba(15,23,42,0.9),rgba(8,47,73,0.8))]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.12),transparent_55%)]" />
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(148,163,184,0.3)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.3)_1px,transparent_1px)] [background-size:3rem_3rem]" />
        {points.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
            No coordinates yet. Once the driver shares location, markers will appear here.
          </div>
        ) : (
          points.map((point) => (
            <div
              key={`${point.label}-${point.left}-${point.top}`}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${point.left}%`, top: `${point.top}%` }}
            >
              <div className={`rounded-full px-3 py-1 text-xs font-bold shadow-lg ${toneClass[point.tone ?? 'dropoff']}`}>
                {point.label}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
