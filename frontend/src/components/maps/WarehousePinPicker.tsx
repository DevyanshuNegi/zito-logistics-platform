'use client';

import { useEffect, useMemo, useState } from 'react';
import { LocateFixed, MapPinned, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type WarehousePinPickerProps = {
  latitude?: string;
  longitude?: string;
  address?: string;
  title?: string;
  searchLabel?: string;
  searchPlaceholder?: string;
  onChange: (point: { latitude: string; longitude: string }) => void;
  onAddressChange?: (address: string) => void;
};

type SearchResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

const DEFAULT_POINT = { latitude: -1.286389, longitude: 36.817223 };

function readPoint(latitude?: string, longitude?: string) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { latitude: lat, longitude: lng };
  }
  return DEFAULT_POINT;
}

export function WarehousePinPicker({
  latitude,
  longitude,
  address,
  title = 'Warehouse pin',
  searchLabel = 'Search map',
  searchPlaceholder = 'Search warehouse area, road, landmark, city',
  onChange,
  onAddressChange,
}: WarehousePinPickerProps) {
  const point = readPoint(latitude, longitude);
  const [query, setQuery] = useState(address ?? '');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    setQuery(address ?? '');
  }, [address]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const data = event.data as {
        source?: string;
        latitude?: number;
        longitude?: number;
      };

      if (
        data?.source !== 'zito-warehouse-pin' ||
        typeof data.latitude !== 'number' ||
        typeof data.longitude !== 'number'
      ) {
        return;
      }

      onChange({
        latitude: data.latitude.toFixed(6),
        longitude: data.longitude.toFixed(6),
      });
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onChange]);

  const srcDoc = useMemo(() => {
    const label = address?.trim() || 'Warehouse location';
    return `
<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; }
    body { background: #07111f; font-family: Inter, system-ui, sans-serif; }
    .badge {
      position: absolute;
      left: 14px;
      top: 14px;
      z-index: 500;
      max-width: calc(100% - 28px);
      border: 1px solid rgba(148, 163, 184, 0.35);
      border-radius: 16px;
      background: rgba(7, 17, 31, 0.86);
      color: #e5f3ff;
      padding: 10px 12px;
      font-size: 12px;
      font-weight: 700;
      box-shadow: 0 18px 50px rgba(0, 0, 0, 0.28);
      backdrop-filter: blur(12px);
    }
  </style>
</head>
<body>
  <div class="badge">${label.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const point = [${point.latitude}, ${point.longitude}];
    const map = L.map('map', { zoomControl: true }).setView(point, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    const marker = L.marker(point, { draggable: true }).addTo(map);

    function send(latlng) {
      window.parent.postMessage({
        source: 'zito-warehouse-pin',
        latitude: Number(latlng.lat.toFixed(6)),
        longitude: Number(latlng.lng.toFixed(6))
      }, '*');
    }

    marker.on('dragend', function () {
      send(marker.getLatLng());
    });

    map.on('click', function (event) {
      marker.setLatLng(event.latlng);
      send(event.latlng);
    });
  </script>
</body>
</html>`;
  }, [address, point.latitude, point.longitude]);

  function useCurrentLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((position) => {
      onChange({
        latitude: position.coords.latitude.toFixed(6),
        longitude: position.coords.longitude.toFixed(6),
      });
    });
  }

  async function searchPlaces() {
    const normalized = query.trim();
    if (!normalized) return;

    setSearching(true);
    setSearchError(null);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(normalized)}`,
      );
      if (!response.ok) {
        throw new Error('Search failed');
      }
      const data = (await response.json()) as SearchResult[];
      setResults(data);
      if (data.length === 0) {
        setSearchError('No places found.');
      }
    } catch {
      setSearchError('Map search is unavailable right now.');
    } finally {
      setSearching(false);
    }
  }

  function selectResult(result: SearchResult) {
    onChange({
      latitude: Number(result.lat).toFixed(6),
      longitude: Number(result.lon).toFixed(6),
    });
    onAddressChange?.(result.display_name);
    setQuery(result.display_name);
    setResults([]);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-950/60">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <MapPinned className="h-4 w-4 text-cyan-300" />
          {title}
        </div>
        <Button type="button" variant="ghost" onClick={useCurrentLocation}>
          <LocateFixed className="mr-2 h-4 w-4" />
          Use my location
        </Button>
      </div>
      <div className="border-b border-slate-800 p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <Input
            label={searchLabel}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
          />
          <div className="flex items-end">
            <Button type="button" className="w-full" disabled={searching} onClick={searchPlaces}>
              <Search className="mr-2 h-4 w-4" />
              {searching ? 'Searching...' : 'Search'}
            </Button>
          </div>
        </div>
        {searchError ? <p className="mt-2 text-xs text-amber-300">{searchError}</p> : null}
        {results.length > 0 ? (
          <div className="mt-3 grid gap-2">
            {results.map((result) => (
              <button
                key={result.place_id}
                type="button"
                onClick={() => selectResult(result)}
                className="rounded-xl border border-slate-800 bg-slate-900/72 px-3 py-2 text-left text-xs leading-5 text-slate-200 transition hover:border-cyan-400/60 hover:bg-slate-900"
              >
                {result.display_name}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <iframe
        key={`${point.latitude}:${point.longitude}:${address ?? ''}`}
        title="Warehouse pin map"
        srcDoc={srcDoc}
        className="h-[320px] w-full border-0"
      />
      <div className="flex items-center justify-between gap-3 border-t border-slate-800 px-4 py-3 text-xs text-slate-400">
        <span>Pin status</span>
        <span className={latitude && longitude ? 'font-semibold text-emerald-300' : 'text-slate-500'}>
          {latitude && longitude ? 'Ready' : 'Pending'}
        </span>
      </div>
    </div>
  );
}
