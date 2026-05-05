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

type SurgeDashboard = {
  generatedAt: string;
  summary: {
    totalZones: number;
    activeZones: number;
    recommendedZones: number;
    highestSuggestedTotalMultiplier: number;
    peakHourMultiplier: number;
  };
  peakHour: {
    evaluatedAt: string;
    activeMultiplier: number;
    activeRules: Array<{ name: string; windowLabel: string; dayLabels: string[] }>;
    rules: Array<{ id: string; name: string; multiplier: number; windowLabel: string; dayLabels: string[]; isActive: boolean }>;
  };
  zones: Array<{
    id: string;
    name: string;
    demandCount: number;
    supplyCount: number;
    demandSupplyRatio: number;
    demandPressure: string;
    recommendedZoneMultiplier: number;
    suggestedTotalMultiplier: number;
    currentAppliedMultiplier: number;
    surgeMultiplier: number;
    isActive: boolean;
    activePeakRules: string[];
    updatedAt: string;
  }>;
};

export default function AdminSurgePricingPage() {
  const [dashboard, setDashboard] = useState<SurgeDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    latitude: '',
    longitude: '',
    radiusKm: '',
    surgeMultiplier: '1.25',
    isActive: false,
  });

  async function loadDashboard() {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<SurgeDashboard>('/surge-pricing/dashboard');
      setDashboard(response);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load surge-pricing controls.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function handleCreateZone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyId('create');
    setMessage(null);
    setError(null);

    try {
      await api.post('/surge-pricing', {
        name: form.name,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        radiusKm: Number(form.radiusKm),
        surgeMultiplier: Number(form.surgeMultiplier),
        isActive: form.isActive,
      });
      setMessage(`Created surge zone ${form.name}.`);
      setForm({
        name: '',
        latitude: '',
        longitude: '',
        radiusKm: '',
        surgeMultiplier: '1.25',
        isActive: false,
      });
      await loadDashboard();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to create surge zone.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggle(zoneId: string, active: boolean, suggestedMultiplier: number) {
    setBusyId(zoneId);
    setMessage(null);
    setError(null);

    try {
      if (active) {
        await api.post(`/surge-pricing/${zoneId}/deactivate`, {});
        setMessage('Surge zone deactivated.');
      } else {
        await api.post(`/surge-pricing/${zoneId}/activate`, {
          surgeMultiplier: suggestedMultiplier,
          reason: 'Activated from admin surge desk',
        });
        setMessage('Surge zone activated with the current recommendation.');
      }
      await loadDashboard();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to update surge zone state.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Configured zones"
          value={String(dashboard?.summary.totalZones ?? 0)}
          helper="Geofenced pricing zones tracked by demand-supply logic."
          tone="info"
        />
        <StatCard
          label="Active zones"
          value={String(dashboard?.summary.activeZones ?? 0)}
          helper="Zones currently applying a zone multiplier."
          tone="success"
        />
        <StatCard
          label="Peak multiplier"
          value={`${(dashboard?.summary.peakHourMultiplier ?? 1).toFixed(2)}x`}
          helper="Current time-based multiplier from peak-hour rules."
          tone="warning"
        />
        <StatCard
          label="Highest suggestion"
          value={`${(dashboard?.summary.highestSuggestedTotalMultiplier ?? 1).toFixed(2)}x`}
          helper="Largest combined multiplier recommended right now."
          tone="danger"
        />
      </div>

      {error ? (
        <Alert title="Surge desk error" variant="danger">
          {error}
        </Alert>
      ) : null}

      {message ? (
        <Alert title="Surge control update" variant="success">
          {message}
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <SurfaceCard title="Create surge zone" description="Add a zone so pricing and heatmap controls can reason over real supply pockets.">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreateZone}>
            <Input
              label="Zone name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
            <Input
              label="Radius (km)"
              type="number"
              value={form.radiusKm}
              onChange={(event) => setForm((current) => ({ ...current, radiusKm: event.target.value }))}
            />
            <Input
              label="Latitude"
              type="number"
              value={form.latitude}
              onChange={(event) => setForm((current) => ({ ...current, latitude: event.target.value }))}
            />
            <Input
              label="Longitude"
              type="number"
              value={form.longitude}
              onChange={(event) => setForm((current) => ({ ...current, longitude: event.target.value }))}
            />
            <Input
              label="Base multiplier"
              type="number"
              value={form.surgeMultiplier}
              onChange={(event) => setForm((current) => ({ ...current, surgeMultiplier: event.target.value }))}
            />
            <label className="flex items-center gap-3 rounded-2xl border border-slate-700/70 bg-slate-950/50 px-4 py-3 text-sm text-slate-200">
              <input
                checked={form.isActive}
                type="checkbox"
                onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
              />
              Activate on publish
            </label>
            <div className="md:col-span-2">
              <Button disabled={busyId === 'create'} type="submit">
                {busyId === 'create' ? 'Creating...' : 'Create zone'}
              </Button>
            </div>
          </form>
        </SurfaceCard>

        <SurfaceCard title="Peak-hour rules" description={`Rules evaluated ${dashboard ? formatDateTime(dashboard.peakHour.evaluatedAt) : 'just now'}.`}>
          {loading && !dashboard ? (
            <div className="flex min-h-[20vh] items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <div className="space-y-3">
              {(dashboard?.peakHour.rules ?? []).map((rule) => (
                <div
                  key={rule.id}
                  className="rounded-2xl border border-slate-700/40 bg-slate-950/60 px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{rule.name}</p>
                      <p className="text-xs text-slate-400">
                        {rule.dayLabels.join(', ')} / {rule.windowLabel}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-cyan-200">{rule.multiplier.toFixed(2)}x</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-300">
                    {rule.isActive ? 'Active right now' : 'Standby'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </SurfaceCard>
      </div>

      <SurfaceCard
        title="Zone control board"
        description={`Dashboard generated ${dashboard ? formatDateTime(dashboard.generatedAt) : 'just now'}. Activate suggested multipliers directly from this queue.`}
      >
        {loading && !dashboard ? (
          <div className="flex min-h-[25vh] items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <Table
            rows={dashboard?.zones ?? []}
            emptyMessage="No surge zones are configured yet."
            columns={[
              {
                key: 'zone',
                header: 'Zone',
                render: (zone) => (
                  <div>
                    <p className="font-semibold text-white">{zone.name}</p>
                    <p className="text-xs text-slate-400">
                      Updated {formatDateTime(zone.updatedAt)}
                    </p>
                  </div>
                ),
              },
              {
                key: 'pressure',
                header: 'Pressure',
                render: (zone) => (
                  <div className="text-xs text-slate-300">
                    <p>{formatStatus(zone.demandPressure)}</p>
                    <p>Demand {zone.demandCount} / Supply {zone.supplyCount}</p>
                    <p>Ratio {zone.demandSupplyRatio.toFixed(2)}</p>
                  </div>
                ),
              },
              {
                key: 'multipliers',
                header: 'Multipliers',
                render: (zone) => (
                  <div className="text-xs text-slate-300">
                    <p>Current: {zone.currentAppliedMultiplier.toFixed(2)}x</p>
                    <p>Zone: {zone.surgeMultiplier.toFixed(2)}x</p>
                    <p>Suggested: {zone.suggestedTotalMultiplier.toFixed(2)}x</p>
                  </div>
                ),
              },
              {
                key: 'actions',
                header: 'Action',
                render: (zone) => (
                  <Button
                    disabled={busyId === zone.id}
                    onClick={() => void handleToggle(zone.id, zone.isActive, zone.recommendedZoneMultiplier)}
                  >
                    {busyId === zone.id
                      ? 'Saving...'
                      : zone.isActive
                        ? 'Deactivate'
                        : `Activate ${zone.recommendedZoneMultiplier.toFixed(2)}x`}
                  </Button>
                ),
              },
            ]}
          />
        )}
      </SurfaceCard>
    </div>
  );
}
