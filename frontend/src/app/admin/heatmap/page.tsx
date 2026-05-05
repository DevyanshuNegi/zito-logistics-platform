'use client';

import { FormEvent, useEffect, useState } from 'react';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Table } from '@/components/ui/Table';
import { ApiError, api } from '@/lib/api';
import { formatDateTime, formatStatus } from '@/lib/format';

type HeatmapDashboard = {
  generatedAt: string;
  thresholds: {
    low: number;
    medium: number;
    high: number;
  };
  summary: {
    totalZones: number;
    highZones: number;
    mediumZones: number;
    lowZones: number;
  };
  zones: Array<{
    id: string;
    name: string;
    demandCount: number;
    supplyCount: number;
    demandSupplyRatio: number;
    intensity: string;
    recommendedAction: string;
  }>;
};

type ThresholdResponse = {
  low: number;
  medium: number;
  high: number;
  updatedAt: string;
};

export default function AdminHeatmapPage() {
  const [dashboard, setDashboard] = useState<HeatmapDashboard | null>(null);
  const [thresholds, setThresholds] = useState({
    low: '0',
    medium: '1.2',
    high: '2',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadHeatmap() {
    setLoading(true);
    setError(null);

    const responses = await Promise.allSettled([
      api.get<HeatmapDashboard>('/heatmap/dashboard'),
      api.get<ThresholdResponse>('/heatmap/thresholds'),
    ]);

    const [dashboardResult, thresholdResult] = responses;
    if (thresholdResult.status === 'fulfilled') {
      setThresholds({
        low: String(thresholdResult.value.low),
        medium: String(thresholdResult.value.medium),
        high: String(thresholdResult.value.high),
      });
    }

    if (dashboardResult.status === 'fulfilled') {
      setDashboard(dashboardResult.value);
    } else {
      setError(
        dashboardResult.reason instanceof ApiError
          ? dashboardResult.reason.message
          : 'Unable to load heatmap controls.',
      );
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadHeatmap();
  }, []);

  async function handleSaveThresholds(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      await api.patch('/heatmap/thresholds', {
        low: Number(thresholds.low),
        medium: Number(thresholds.medium),
        high: Number(thresholds.high),
      });
      setMessage('Heatmap thresholds updated.');
      await loadHeatmap();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to update heatmap thresholds.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Tracked zones"
          value={String(dashboard?.summary.totalZones ?? 0)}
          helper="Zones visible to demand-intensity monitoring."
          tone="info"
        />
        <StatCard
          label="High intensity"
          value={String(dashboard?.summary.highZones ?? 0)}
          helper="Zones that need immediate driver rebalancing."
          tone="danger"
        />
        <StatCard
          label="Medium intensity"
          value={String(dashboard?.summary.mediumZones ?? 0)}
          helper="Zones that merit nearby staging."
          tone="warning"
        />
        <StatCard
          label="Low intensity"
          value={String(dashboard?.summary.lowZones ?? 0)}
          helper="Zones with stable or quiet demand pressure."
          tone="success"
        />
      </div>

      {error ? (
        <Alert title="Heatmap status" variant="warning">
          {error}
        </Alert>
      ) : null}

      {message ? (
        <Alert title="Threshold update" variant="success">
          {message}
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <SurfaceCard title="Threshold control" description="Update low, medium, and high demand-intensity cutoffs used by the heatmap engine.">
          <form className="grid gap-4 md:grid-cols-3" onSubmit={handleSaveThresholds}>
            <Input
              label="Low"
              type="number"
              value={thresholds.low}
              onChange={(event) => setThresholds((current) => ({ ...current, low: event.target.value }))}
            />
            <Input
              label="Medium"
              type="number"
              value={thresholds.medium}
              onChange={(event) => setThresholds((current) => ({ ...current, medium: event.target.value }))}
            />
            <Input
              label="High"
              type="number"
              value={thresholds.high}
              onChange={(event) => setThresholds((current) => ({ ...current, high: event.target.value }))}
            />
            <div className="md:col-span-3">
              <Button disabled={saving} type="submit">
                {saving ? 'Saving...' : 'Save thresholds'}
              </Button>
            </div>
          </form>
        </SurfaceCard>

        <SurfaceCard title="Demand heatmap queue" description={`Operational heatmap generated ${dashboard ? formatDateTime(dashboard.generatedAt) : 'just now'}.`}>
          {loading && !dashboard ? (
            <div className="flex min-h-[20vh] items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <Table
              rows={dashboard?.zones ?? []}
              emptyMessage="No surge/heatmap zones are configured yet."
              columns={[
                {
                  key: 'zone',
                  header: 'Zone',
                  render: (zone) => (
                    <div>
                      <p className="font-semibold text-white">{zone.name}</p>
                      <p className="text-xs text-slate-400">{formatStatus(zone.intensity)} intensity</p>
                    </div>
                  ),
                },
                {
                  key: 'mix',
                  header: 'Demand vs supply',
                  render: (zone) => (
                    <div className="text-xs text-slate-300">
                      <p>Demand: {zone.demandCount}</p>
                      <p>Supply: {zone.supplyCount}</p>
                      <p>Ratio: {zone.demandSupplyRatio.toFixed(2)}</p>
                    </div>
                  ),
                },
                {
                  key: 'action',
                  header: 'Recommended action',
                  render: (zone) => zone.recommendedAction,
                },
              ]}
            />
          )}
        </SurfaceCard>
      </div>
    </div>
  );
}
