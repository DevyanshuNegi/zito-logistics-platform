'use client';

import { useEffect, useState } from 'react';
import { HeatmapLayer } from '@/components/maps/HeatmapLayer';
import { StatCard } from '@/components/layout/StatCard';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ApiError, api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

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
  recommendedAction: string;
  distanceFromDriverKm?: number | null;
};

type DriverHeatmapResponse = {
  generatedAt: string;
  thresholds: {
    low: number;
    medium: number;
    high: number;
  };
  driver: {
    id: string;
    name: string;
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
    distanceFromDriverKm?: number | null;
    recommendation: string;
  }>;
};

export default function DriverHeatmapPage() {
  const [snapshot, setSnapshot] = useState<DriverHeatmapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadHeatmap() {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get<DriverHeatmapResponse>('/heatmap/driver');
      setSnapshot(response);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load driver heatmap.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadHeatmap();
  }, []);

  if (loading) {
    return <Spinner />;
  }

  return (
    <div className="space-y-6">
      {error ? (
        <Alert title="Heatmap unavailable" variant="danger">
          {error}
        </Alert>
      ) : null}

      {!snapshot?.driver.location ? (
        <Alert title="Location missing" variant="warning">
          Share your live driver location to receive distance-aware move-to-zone suggestions.
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="High-demand zones"
          value={String(snapshot?.zones.filter((zone) => zone.intensity === 'HIGH').length ?? 0)}
          helper="Immediate reposition opportunities."
          tone="warning"
        />
        <StatCard
          label="Suggested moves"
          value={String(snapshot?.suggestions.length ?? 0)}
          helper="Zones ranked by demand pressure and distance."
          tone="info"
        />
        <StatCard
          label="Top ratio"
          value={
            snapshot?.zones[0]
              ? `${snapshot.zones[0].demandSupplyRatio}x`
              : '0x'
          }
          helper={snapshot?.zones[0]?.name ?? 'No zone data'}
          tone="success"
        />
        <StatCard
          label="Last refresh"
          value={snapshot ? formatDateTime(snapshot.generatedAt) : 'Pending'}
          helper="Refresh when demand shifts."
          tone="neutral"
        />
      </div>

      <SurfaceCard
        title="Demand heatmap"
        description="Real-time zone pressure based on active bookings vs available drivers."
        actions={<Button onClick={() => void loadHeatmap()}>Refresh heatmap</Button>}
      >
        <HeatmapLayer
          cacheKey={`driver-heatmap-${snapshot?.driver.id ?? 'default'}`}
          zones={snapshot?.zones ?? []}
          driverLocation={snapshot?.driver.location ?? null}
        />
      </SurfaceCard>

      <SurfaceCard
        title="Move-to-zone suggestions"
        description={`Thresholds: low ${snapshot?.thresholds.low ?? 0}, medium ${snapshot?.thresholds.medium ?? 0}, high ${snapshot?.thresholds.high ?? 0}.`}
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {(snapshot?.suggestions ?? []).map((suggestion) => (
            <div
              key={suggestion.zoneId}
              className="rounded-3xl border border-slate-700/40 bg-slate-900/55 p-4"
            >
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                Rank {suggestion.rank}
              </p>
              <p className="mt-3 text-lg font-semibold text-white">{suggestion.zoneName}</p>
              <p className="mt-2 text-sm text-slate-300">
                Pressure {suggestion.demandSupplyRatio}x
                {suggestion.distanceFromDriverKm != null
                  ? ` • ${suggestion.distanceFromDriverKm} km away`
                  : ''}
              </p>
              <p className="mt-3 text-sm text-slate-300">{suggestion.recommendation}</p>
            </div>
          ))}

          {(snapshot?.suggestions.length ?? 0) === 0 ? (
            <div className="rounded-3xl border border-slate-700/40 bg-slate-900/55 p-4 text-sm text-slate-300 lg:col-span-3">
              No medium or high intensity zones right now. Stay available and refresh again shortly.
            </div>
          ) : null}
        </div>
      </SurfaceCard>
    </div>
  );
}
