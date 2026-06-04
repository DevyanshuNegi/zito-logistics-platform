'use client';

import { useEffect, useMemo } from 'react';
import { MapPinned } from 'lucide-react';

export type WarehouseMapListing = {
  id: string;
  title: string;
  companyName: string;
  areaLabel: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  rateAmount: number;
  rateUnit: string;
  availableCapacity: number;
  capacityUnit: string;
  distanceKm?: number | null;
};

type WarehouseDiscoveryMapProps = {
  listings: WarehouseMapListing[];
  selectedId?: string;
  customerPoint?: { latitude: number; longitude: number } | null;
  onSelect: (listingId: string) => void;
};

const DEFAULT_CENTER = { latitude: -1.286389, longitude: 36.817223 };

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function WarehouseDiscoveryMap({
  listings,
  selectedId,
  customerPoint,
  onSelect,
}: WarehouseDiscoveryMapProps) {
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const data = event.data as { source?: string; listingId?: string };
      if (data?.source === 'zito-warehouse-discovery' && data.listingId) {
        onSelect(data.listingId);
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onSelect]);

  const locatedListings = listings.filter(
    (listing) =>
      typeof listing.latitude === 'number' &&
      typeof listing.longitude === 'number' &&
      Number.isFinite(listing.latitude) &&
      Number.isFinite(listing.longitude),
  );

  const firstLocatedListing = locatedListings[0];
  const center = customerPoint
    ? customerPoint
    : firstLocatedListing
      ? {
          latitude: Number(firstLocatedListing.latitude),
          longitude: Number(firstLocatedListing.longitude),
        }
      : DEFAULT_CENTER;

  const srcDoc = useMemo(() => {
    const markers = locatedListings
      .map((listing) => ({
        id: listing.id,
        title: escapeHtml(listing.title),
        area: escapeHtml(listing.areaLabel),
        company: escapeHtml(listing.companyName),
        lat: listing.latitude,
        lng: listing.longitude,
        selected: listing.id === selectedId,
        meta: escapeHtml(
          `${listing.availableCapacity} ${listing.capacityUnit} available${
            listing.distanceKm != null ? ` / ${listing.distanceKm} km away` : ''
          }`,
        ),
      }))
      .map(
        (marker, index) => `
      const icon${index} = L.divIcon({
        className: 'warehouse-marker ${marker.selected ? 'selected' : ''}',
        html: '<button class="pin" type="button">${marker.selected ? '●' : '•'}</button>',
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });
      L.marker([${marker.lat}, ${marker.lng}], { icon: icon${index} })
        .addTo(map)
        .bindPopup('<strong>${marker.title}</strong><br>${marker.company}<br>${marker.area}<br>${marker.meta}')
        .on('click', function () {
          window.parent.postMessage({ source: 'zito-warehouse-discovery', listingId: '${marker.id}' }, '*');
        });`,
      )
      .join('\n');

    const customerMarker = customerPoint
      ? `
      L.circleMarker([${customerPoint.latitude}, ${customerPoint.longitude}], {
        radius: 8,
        color: '#0ea5e9',
        fillColor: '#38bdf8',
        fillOpacity: 0.92
      }).addTo(map).bindPopup('Your search point');`
      : '';

    return `
<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; }
    body { background: #eef4ff; font-family: Inter, system-ui, sans-serif; }
    .warehouse-marker { background: transparent; border: 0; }
    .pin {
      width: 34px;
      height: 34px;
      border-radius: 999px;
      border: 3px solid #ffffff;
      background: #1b3f72;
      color: #ffffff;
      box-shadow: 0 12px 26px rgba(15, 23, 42, 0.32);
      font-size: 18px;
      font-weight: 900;
      line-height: 1;
      cursor: pointer;
    }
    .selected .pin { background: #0891b2; transform: scale(1.08); }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const map = L.map('map', { zoomControl: true }).setView([${center.latitude}, ${center.longitude}], ${customerPoint ? 11 : 10});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    ${customerMarker}
    ${markers}
    const bounds = [];
    ${locatedListings
      .map((listing) => `bounds.push([${listing.latitude}, ${listing.longitude}]);`)
      .join('\n')}
    ${customerPoint ? `bounds.push([${customerPoint.latitude}, ${customerPoint.longitude}]);` : ''}
    if (bounds.length > 1) map.fitBounds(bounds, { padding: [36, 36] });
  </script>
</body>
</html>`;
  }, [center.latitude, center.longitude, customerPoint, locatedListings, selectedId]);

  return (
    <div className="overflow-hidden rounded-[22px] border border-[#d7e0ec] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
      <div className="flex items-center justify-between gap-3 border-b border-[#e2e8f0] px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#1a1a2e]">
          <MapPinned className="h-4 w-4 text-[#1b3f72]" />
          Map discovery
        </div>
        <span className="text-xs text-[#64748b]">{locatedListings.length} mapped</span>
      </div>
      {locatedListings.length > 0 ? (
        <iframe
          key={`${selectedId ?? 'all'}:${listings.length}:${customerPoint?.latitude ?? ''}:${customerPoint?.longitude ?? ''}`}
          title="Warehouse discovery map"
          srcDoc={srcDoc}
          className="h-[360px] w-full border-0"
        />
      ) : (
        <div className="flex h-[260px] items-center justify-center px-5 text-center text-sm text-[#64748b]">
          Approved warehouse pins will appear here once listings include map-selected locations.
        </div>
      )}
    </div>
  );
}
