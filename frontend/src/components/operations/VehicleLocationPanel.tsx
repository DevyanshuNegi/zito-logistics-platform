'use client';

import { useEffect, useMemo, useState } from 'react';
import { RoutePreviewMap } from '@/components/maps/RoutePreviewMap';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { formatDateTime, formatStatus } from '@/lib/format';

type VehicleLocationVehicle = {
  id: string;
  plateNumber: string;
  type?: string | null;
  status?: string | null;
  deviceGpsLat?: number | null;
  deviceGpsLng?: number | null;
  lastGpsAt?: string | null;
  driver?: {
    isOnline?: boolean | null;
    currentLatitude?: number | null;
    currentLongitude?: number | null;
    lastLocationAt?: string | null;
    user?: {
      fullName?: string | null;
    } | null;
  } | null;
};

type VehicleLocationPanelProps = {
  description?: string;
  title?: string;
  tone?: 'dark' | 'light';
  vehicles: VehicleLocationVehicle[];
};

type ResolvedLocation = {
  driverName?: string | null;
  lat: number;
  lng: number;
  source: 'driver' | 'device';
  updatedAt?: string | null;
};

function hasCoordinates(lat?: number | null, lng?: number | null) {
  return typeof lat === 'number' && Number.isFinite(lat) && typeof lng === 'number' && Number.isFinite(lng);
}

function resolveVehicleLocation(vehicle?: VehicleLocationVehicle | null): ResolvedLocation | null {
  if (!vehicle) {
    return null;
  }

  if (hasCoordinates(vehicle.deviceGpsLat, vehicle.deviceGpsLng)) {
    return {
      lat: vehicle.deviceGpsLat as number,
      lng: vehicle.deviceGpsLng as number,
      source: 'device',
      updatedAt: vehicle.lastGpsAt ?? null,
      driverName: vehicle.driver?.user?.fullName ?? null,
    };
  }

  if (hasCoordinates(vehicle.driver?.currentLatitude, vehicle.driver?.currentLongitude)) {
    return {
      lat: vehicle.driver?.currentLatitude as number,
      lng: vehicle.driver?.currentLongitude as number,
      source: 'driver',
      updatedAt: vehicle.driver?.lastLocationAt ?? null,
      driverName: vehicle.driver?.user?.fullName ?? null,
    };
  }

  return null;
}

function buildToneClasses(tone: 'dark' | 'light') {
  if (tone === 'light') {
    return {
      card: 'rounded-[20px] border border-[#d7e0ec] bg-[#f8fbff] px-4 py-3',
      empty:
        'rounded-[22px] border border-dashed border-[#d7e0ec] bg-[#f8fbff] px-4 py-6 text-sm text-[#64748b]',
      label: 'text-sm font-medium text-[#1a1a2e]',
      select:
        'w-full rounded-[16px] border border-[#d7e0ec] bg-white px-4 py-3 text-sm text-[#1a1a2e] focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100',
      statLabel: 'text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]',
      statValue: 'mt-2 text-lg font-semibold text-[#1a1a2e]',
      statBody: 'mt-1 text-sm text-[#64748b]',
      external:
        'inline-flex items-center rounded-full bg-[#1b3f72] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#15345c]',
    };
  }

  return {
    card: 'rounded-[20px] border border-slate-700/40 bg-slate-900/60 px-4 py-3',
    empty:
      'rounded-[22px] border border-dashed border-slate-700/50 bg-slate-900/60 px-4 py-6 text-sm text-slate-400',
    label: 'text-sm font-medium text-slate-200',
    select:
      'w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none',
    statLabel: 'text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400',
    statValue: 'mt-2 text-lg font-semibold text-white',
    statBody: 'mt-1 text-sm text-slate-400',
    external:
      'inline-flex items-center rounded-full bg-gradient-to-r from-cyan-500 via-sky-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110',
  };
}

export function VehicleLocationPanel({
  description = 'Select a vehicle by plate number to inspect its latest live location from vehicle GPS or the assigned driver app.',
  title = 'Fleet location',
  tone = 'dark',
  vehicles,
}: VehicleLocationPanelProps) {
  const classes = buildToneClasses(tone);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');

  const vehiclesWithLiveLocation = useMemo(
    () => vehicles.filter((vehicle) => Boolean(resolveVehicleLocation(vehicle))),
    [vehicles],
  );

  useEffect(() => {
    const stillExists = vehicles.some((vehicle) => vehicle.id === selectedVehicleId);
    if (selectedVehicleId && stillExists) {
      return;
    }

    setSelectedVehicleId(vehiclesWithLiveLocation[0]?.id ?? vehicles[0]?.id ?? '');
  }, [selectedVehicleId, vehicles, vehiclesWithLiveLocation]);

  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null,
    [selectedVehicleId, vehicles],
  );
  const resolvedLocation = useMemo(
    () => resolveVehicleLocation(selectedVehicle),
    [selectedVehicle],
  );

  const mapHref =
    resolvedLocation == null
      ? null
      : `https://www.openstreetmap.org/?mlat=${resolvedLocation.lat}&mlon=${resolvedLocation.lng}#map=16/${resolvedLocation.lat}/${resolvedLocation.lng}`;

  return (
    <SurfaceCard title={title} description={description} tone={tone}>
      {vehicles.length === 0 ? (
        <div className={classes.empty}>No vehicles are available yet. Add or sync a vehicle first to inspect its location.</div>
      ) : (
        <div className="space-y-4">
          <label className="block space-y-2">
            <span className={classes.label}>Vehicle number</span>
            <select
              className={classes.select}
              value={selectedVehicleId}
              onChange={(event) => setSelectedVehicleId(event.target.value)}
            >
              {vehicles.map((vehicle) => {
                const hasLiveLocation = resolveVehicleLocation(vehicle) != null;
                return (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.plateNumber} · {vehicle.type ?? 'Vehicle'} · {hasLiveLocation ? 'Location live' : 'No live location'}
                  </option>
                );
              })}
            </select>
          </label>

          {selectedVehicle ? (
            <div className="grid gap-3 md:grid-cols-4">
              <div className={classes.card}>
                <p className={classes.statLabel}>Plate number</p>
                <p className={classes.statValue}>{selectedVehicle.plateNumber}</p>
                <p className={classes.statBody}>{selectedVehicle.type ?? 'Vehicle type pending'}</p>
              </div>
              <div className={classes.card}>
                <p className={classes.statLabel}>Status</p>
                <p className={classes.statValue}>{formatStatus(selectedVehicle.status ?? 'UNKNOWN')}</p>
                <p className={classes.statBody}>
                  {resolvedLocation?.source === 'device'
                    ? 'Using vehicle GPS'
                    : resolvedLocation?.source === 'driver'
                      ? 'Using driver live location'
                      : 'Waiting for a live signal'}
                </p>
              </div>
              <div className={classes.card}>
                <p className={classes.statLabel}>Coordinates</p>
                <p className={classes.statValue}>
                  {resolvedLocation ? `${resolvedLocation.lat.toFixed(5)}, ${resolvedLocation.lng.toFixed(5)}` : 'Pending'}
                </p>
                <p className={classes.statBody}>
                  Updated: {resolvedLocation?.updatedAt ? formatDateTime(resolvedLocation.updatedAt) : 'No timestamp yet'}
                </p>
              </div>
              <div className={classes.card}>
                <p className={classes.statLabel}>Assigned driver</p>
                <p className={classes.statValue}>{selectedVehicle.driver?.user?.fullName ?? 'Unassigned'}</p>
                <p className={classes.statBody}>
                  {resolvedLocation?.source === 'device'
                    ? 'Vehicle GPS signal is active'
                    : selectedVehicle.driver?.isOnline
                      ? 'Driver is online'
                      : 'Driver signal unavailable'}
                </p>
              </div>
            </div>
          ) : null}

          {resolvedLocation ? (
            <div className="space-y-4">
              <RoutePreviewMap
                className="h-[320px] rounded-[28px] border border-slate-200/20"
                points={[
                  {
                    lat: resolvedLocation.lat,
                    lng: resolvedLocation.lng,
                    label: selectedVehicle?.plateNumber ?? 'Vehicle',
                    tone: 'pickup',
                  },
                ]}
                statusBadge={
                  resolvedLocation.source === 'device' ? 'Vehicle GPS' : 'Driver live location'
                }
                titleBadge="Fleet location"
              />
              {mapHref ? (
                <a
                  className={classes.external}
                  href={mapHref}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open full map
                </a>
              ) : null}
            </div>
          ) : (
            <div className={classes.empty}>
              The selected vehicle does not have a live location yet. Once either vehicle GPS or the assigned driver shares coordinates, this panel will render the location here.
            </div>
          )}
        </div>
      )}
    </SurfaceCard>
  );
}
