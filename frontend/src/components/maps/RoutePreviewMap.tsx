import { Truck } from 'lucide-react';

type MapPoint = {
  lat?: number | null;
  lng?: number | null;
  label: string;
  tone?: 'pickup' | 'drop';
};

type RoutePreviewMapProps = {
  points: MapPoint[];
  titleBadge?: string;
  statusBadge?: string;
  className?: string;
};

type ValidMapPoint = MapPoint & {
  lat: number;
  lng: number;
};

const DEFAULT_CENTER = {
  lat: -1.286389,
  lng: 36.817223,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function RoutePreviewMap({
  points,
  titleBadge = 'Map first',
  statusBadge,
  className = '',
}: RoutePreviewMapProps) {
  const validPoints = points.filter(
    (point): point is ValidMapPoint =>
      typeof point.lat === 'number' &&
      Number.isFinite(point.lat) &&
      typeof point.lng === 'number' &&
      Number.isFinite(point.lng),
  );

  const latitudes = validPoints.map((point) => point.lat);
  const longitudes = validPoints.map((point) => point.lng);

  const minLat =
    validPoints.length > 0 ? Math.min(...latitudes) - 0.03 : DEFAULT_CENTER.lat - 0.05;
  const maxLat =
    validPoints.length > 0 ? Math.max(...latitudes) + 0.03 : DEFAULT_CENTER.lat + 0.05;
  const minLng =
    validPoints.length > 0 ? Math.min(...longitudes) - 0.03 : DEFAULT_CENTER.lng - 0.05;
  const maxLng =
    validPoints.length > 0 ? Math.max(...longitudes) + 0.03 : DEFAULT_CENTER.lng + 0.05;

  const bbox = `${minLng},${minLat},${maxLng},${maxLat}`;
  const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik`;

  const projectedPoints = validPoints.map((point) => {
    const left = clamp(((point.lng - minLng) / (maxLng - minLng)) * 100, 12, 88);
    const top = clamp(((maxLat - point.lat) / (maxLat - minLat)) * 100, 14, 86);

    return {
      ...point,
      left,
      top,
    };
  });

  const routeLine =
    projectedPoints.length >= 2
      ? (() => {
          const [start, end] = projectedPoints;
          const dx = end.left - start.left;
          const dy = end.top - start.top;
          const length = Math.sqrt(dx * dx + dy * dy);
          const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
          return {
            left: start.left,
            top: start.top,
            length,
            angle,
          };
        })()
      : null;

  return (
    <div
      className={[
        'relative overflow-hidden bg-[linear-gradient(135deg,rgba(232,238,247,0.92)_0%,rgba(212,220,240,0.94)_100%)]',
        className,
      ].join(' ')}
    >
      <iframe
        src={embedUrl}
        title="Route preview map"
        className="absolute inset-0 h-full w-full border-0 saturate-[0.92]"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,16,31,0.06),rgba(255,255,255,0.04))]" />

      <div className="absolute left-4 right-4 top-4 flex items-center justify-between gap-3">
        <span className="rounded-full bg-[#06101f]/82 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white shadow-sm backdrop-blur">
          {titleBadge}
        </span>
        {statusBadge ? (
          <span className="rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-3 py-1 text-[10px] font-semibold text-white shadow-sm">
            {statusBadge}
          </span>
        ) : null}
      </div>

      {routeLine ? (
        <div
          className="absolute h-[2px] origin-left border-t-2 border-dashed border-[#2563eb]/70"
          style={{
            left: `${routeLine.left}%`,
            top: `${routeLine.top}%`,
            width: `${routeLine.length}%`,
            transform: `rotate(${routeLine.angle}deg)`,
          }}
        />
      ) : null}

      {projectedPoints.map((point) => {
        const isPickup = point.tone !== 'drop';
        return (
          <div
            key={`${point.label}-${point.left}-${point.top}`}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
            style={{ left: `${point.left}%`, top: `${point.top}%` }}
          >
            {point.label ? (
              <div className="rounded-full bg-white px-2 py-1 text-[9px] font-bold text-[#1a1a2e] shadow-sm">
                {point.label}
              </div>
            ) : null}
            <div
              className={[
                'mt-1 h-4 w-4 rounded-full border-[3px] border-white shadow-[0_2px_10px_rgba(0,0,0,0.2)]',
                isPickup ? 'bg-[#2563eb]' : 'bg-[#7c3aed]',
              ].join(' ')}
            />
            <div className={['h-4 w-[2px]', isPickup ? 'bg-[#2563eb]' : 'bg-[#7c3aed]'].join(' ')} />
          </div>
        );
      })}

      <div className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full bg-white/92 shadow-[0_10px_28px_rgba(15,23,42,0.18)]">
        <Truck className="h-5 w-5 text-[#1b3f72]" />
      </div>
    </div>
  );
}
