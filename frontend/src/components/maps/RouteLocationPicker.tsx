'use client';

import { useEffect, useMemo } from 'react';
import { MapPinned } from 'lucide-react';

type StopKind = 'pickup' | 'drop';

type Props = {
  activeStopKind: StopKind;
  pickup: {
    lat: number | null;
    lng: number | null;
  };
  drop: {
    lat: number | null;
    lng: number | null;
  };
  onSelect: (kind: StopKind, latitude: number, longitude: number) => void;
};

const DEFAULT_CENTER = {
  lat: -1.286389,
  lng: 36.817223,
  zoom: 11,
};

function buildMapSource({
  activeStopKind,
  pickup,
  drop,
}: Omit<Props, 'onSelect'>) {
  const activePoint = activeStopKind === 'pickup' ? pickup : drop;
  const fallbackPoint = activeStopKind === 'pickup' ? drop : pickup;
  const center =
    activePoint.lat != null && activePoint.lng != null
      ? { lat: activePoint.lat, lng: activePoint.lng, zoom: 15 }
      : fallbackPoint.lat != null && fallbackPoint.lng != null
        ? { lat: fallbackPoint.lat, lng: fallbackPoint.lng, zoom: 13 }
        : DEFAULT_CENTER;

  const payload = {
    activeStopKind,
    pickup,
    drop,
    center,
  };

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
    />
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
    />
    <style>
      html, body, #map {
        height: 100%;
        margin: 0;
      }

      body {
        background: #dbeafe;
        font-family: Arial, sans-serif;
      }

      .map-banner {
        position: absolute;
        left: 14px;
        top: 14px;
        z-index: 1000;
        border-radius: 999px;
        background: rgba(6, 16, 31, 0.88);
        color: white;
        padding: 8px 12px;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.24);
      }

      .map-hint {
        position: absolute;
        right: 14px;
        bottom: 14px;
        z-index: 1000;
        max-width: 220px;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.96);
        color: #0f172a;
        padding: 10px 12px;
        font-size: 12px;
        line-height: 1.4;
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.16);
      }
    </style>
  </head>
  <body>
    <div class="map-banner">${activeStopKind === 'pickup' ? 'Pickup map refine' : 'Drop-off map refine'}</div>
    <div class="map-hint">Search first, then use the map only if the exact ${activeStopKind === 'pickup' ? 'pickup spot' : 'drop-off point'} needs adjustment.</div>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      const config = ${JSON.stringify(payload)};
      const map = L.map('map', { zoomControl: true }).setView(
        [config.center.lat, config.center.lng],
        config.center.zoom
      );

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      function addStopMarker(point, label) {
        if (typeof point.lat !== 'number' || typeof point.lng !== 'number') {
          return null;
        }

        return L.marker([point.lat, point.lng]).addTo(map).bindPopup(label);
      }

      const pickupMarker = addStopMarker(config.pickup, 'Pickup');
      const dropMarker = addStopMarker(config.drop, 'Drop');

      if (pickupMarker && dropMarker) {
        const bounds = L.latLngBounds([
          [config.pickup.lat, config.pickup.lng],
          [config.drop.lat, config.drop.lng],
        ]);
        L.polyline(
          [
            [config.pickup.lat, config.pickup.lng],
            [config.drop.lat, config.drop.lng],
          ],
          {
            color: '#38bdf8',
            weight: 4,
            opacity: 0.9,
            dashArray: '8 8',
          }
        ).addTo(map);
        map.fitBounds(bounds.pad(0.25));
      }

      map.on('click', function (event) {
        window.parent.postMessage(
          {
            type: 'zito-route-picker/select',
            stop: config.activeStopKind,
            latitude: Number(event.latlng.lat.toFixed(6)),
            longitude: Number(event.latlng.lng.toFixed(6)),
          },
          '*'
        );
      });
    </script>
  </body>
</html>`;
}

export function RouteLocationPicker({ activeStopKind, pickup, drop, onSelect }: Props) {
  const source = useMemo(
    () => buildMapSource({ activeStopKind, pickup, drop }),
    [activeStopKind, drop, pickup],
  );

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const data = event.data as
        | {
            type?: string;
            stop?: StopKind;
            latitude?: number;
            longitude?: number;
          }
        | undefined;

      if (data?.type !== 'zito-route-picker/select') {
        return;
      }

      if (
        (data.stop !== 'pickup' && data.stop !== 'drop') ||
        typeof data.latitude !== 'number' ||
        typeof data.longitude !== 'number'
      ) {
        return;
      }

      onSelect(data.stop, data.latitude, data.longitude);
    }

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [onSelect]);

  return (
    <div className="overflow-hidden rounded-[22px] border border-[#d7e0ec] bg-[#0b1220] shadow-[0_16px_32px_rgba(15,23,42,0.16)]">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-[linear-gradient(135deg,#06101f_0%,#10213d_100%)] px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
            <MapPinned className="h-4.5 w-4.5" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200/70">
              Live route map
            </p>
            <p className="text-sm font-semibold">
              {activeStopKind === 'pickup' ? 'Pickup refinement' : 'Drop-off refinement'}
            </p>
          </div>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100/80">
          Search first
        </span>
      </div>

      <iframe
        title="Route map picker"
        className="h-[420px] w-full bg-[#dbeafe]"
        sandbox="allow-scripts allow-same-origin"
        srcDoc={source}
      />
    </div>
  );
}
