'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { WarehousePinPicker } from '@/components/maps/WarehousePinPicker';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Table } from '@/components/ui/Table';
import { useAuth } from '@/hooks/useAuth';
import { ApiError, api } from '@/lib/api';
import {
  compactId,
  formatDateTime,
  formatMoney,
  formatPercent,
  formatStatus,
} from '@/lib/format';
import {
  KENYA_COUNTIES,
  LOCATION_RATE_TYPES,
  SUPPORTED_PRICING_COUNTRIES,
} from '@/lib/location-pricing';

type TabKey = 'rates' | 'surge';

type RateCard = {
  id: string;
  vehicleType: string;
  serviceType: string;
  countryCode: string;
  county: string | null;
  localityType: string;
  baseFare: number;
  ratePerKm: number;
  perStopRate: number;
  minDistance: number;
  surgeMultiplier: number;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
};

type RateCardsResponse = {
  rateCards: RateCard[];
  total: number;
};

type CalculatorResult = {
  rateCard: RateCard;
  pricingScope?: {
    countryCode: string;
    county: string | null;
    localityType: string;
  };
  effectiveDistance: number;
  baseFare: number;
  distanceFare: number;
  stopFare: number;
  surgeMultiplier: number;
  totalPrice: number;
};

type SurgeZoneRow = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  surgeMultiplier: number;
  isActive: boolean;
  activatedAt: string | null;
  deactivatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  demandCount: number;
  supplyCount: number;
  demandSupplyRatio: number;
  demandPressure: 'NORMAL' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
  recommendedZoneMultiplier: number;
  peakHourMultiplier: number;
  suggestedTotalMultiplier: number;
  currentAppliedMultiplier: number;
  activePeakRules: string[];
};

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
    activeRules: Array<{
      id: string;
      name: string;
      multiplier: number;
      windowLabel: string;
      dayLabels: string[];
      isActive: boolean;
    }>;
    rules: Array<{
      id: string;
      name: string;
      multiplier: number;
      windowLabel: string;
      dayLabels: string[];
      isActive: boolean;
    }>;
  };
  zones: SurgeZoneRow[];
  notes: string[];
};

type RateCardFormState = {
  vehicleType: string;
  serviceType: string;
  countryCode: string;
  county: string;
  localityType: string;
  baseFare: string;
  ratePerKm: string;
  perStopRate: string;
  minDistance: string;
  surgeMultiplier: string;
  isActive: boolean;
};

type CalculatorState = {
  vehicleType: string;
  serviceType: string;
  countryCode: string;
  county: string;
  localityType: string;
  distanceKm: string;
  stopCount: string;
};

type SurgeFormState = {
  name: string;
  latitude: string;
  longitude: string;
  radiusKm: string;
  surgeMultiplier: string;
  isActive: boolean;
};

const VEHICLE_TYPES = [
  'MOTORBIKE',
  'VAN',
  'TRUCK_3T',
  'TRUCK_7T',
  'TRUCK_14T',
  'TRUCK_22T',
  'CONTAINER_20FT',
  'CONTAINER_40FT',
  'REFRIGERATED',
] as const;

const SERVICE_TYPES = ['FTL', 'PTL', 'COURIER', 'WAREHOUSE', 'RAIL'] as const;

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  MOTORBIKE: 'Motorbike',
  VAN: 'Van',
  TRUCK_3T: '3 Ton Truck',
  TRUCK_7T: '7 Ton Truck',
  TRUCK_14T: '14 Ton Truck',
  TRUCK_22T: '22 Ton Truck',
  CONTAINER_20FT: '20ft Container Truck',
  CONTAINER_40FT: '40ft Container Truck',
  REFRIGERATED: 'Refrigerated Truck',
};

const SERVICE_TYPE_LABELS: Record<string, string> = {
  FTL: 'FTL',
  PTL: 'PTL / Part Load',
  COURIER: 'Courier',
  WAREHOUSE: 'Warehouse',
  RAIL: 'Rail / SGR',
};

function formatVehicleTypeLabel(value: string) {
  return VEHICLE_TYPE_LABELS[value] ?? formatStatus(value);
}

function formatServiceTypeLabel(value: string) {
  return SERVICE_TYPE_LABELS[value] ?? formatStatus(value);
}

const INITIAL_RATE_FORM: RateCardFormState = {
  vehicleType: 'MOTORBIKE',
  serviceType: 'COURIER',
  countryCode: 'KE',
  county: '',
  localityType: 'ANY',
  baseFare: '',
  ratePerKm: '',
  perStopRate: '0',
  minDistance: '0',
  surgeMultiplier: '1',
  isActive: true,
};

const INITIAL_CALCULATOR: CalculatorState = {
  vehicleType: 'MOTORBIKE',
  serviceType: 'COURIER',
  countryCode: 'KE',
  county: '',
  localityType: 'ANY',
  distanceKm: '',
  stopCount: '0',
};

const INITIAL_SURGE_FORM: SurgeFormState = {
  name: '',
  latitude: '',
  longitude: '',
  radiusKm: '2',
  surgeMultiplier: '1.25',
  isActive: false,
};

function normalizeZonePoints(zones: SurgeZoneRow[]) {
  const valid = zones.filter(
    (zone) => Number.isFinite(zone.latitude) && Number.isFinite(zone.longitude),
  );
  if (valid.length === 0) {
    return [];
  }

  const latitudes = valid.map((zone) => zone.latitude);
  const longitudes = valid.map((zone) => zone.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);

  return valid.map((zone) => {
    const left =
      maxLng === minLng ? 50 : ((zone.longitude - minLng) / (maxLng - minLng)) * 78 + 11;
    const top =
      maxLat === minLat ? 50 : ((maxLat - zone.latitude) / (maxLat - minLat)) * 66 + 16;
    const ringSize = Math.max(56, Math.min(170, zone.radiusKm * 24));
    return { ...zone, left, top, ringSize };
  });
}

export default function AdminRateCardsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('rates');

  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(true);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [calculatorError, setCalculatorError] = useState<string | null>(null);
  const [calculatorResult, setCalculatorResult] = useState<CalculatorResult | null>(null);
  const [form, setForm] = useState<RateCardFormState>(INITIAL_RATE_FORM);
  const [calculator, setCalculator] = useState<CalculatorState>(INITIAL_CALCULATOR);

  const [surgeDashboard, setSurgeDashboard] = useState<SurgeDashboard | null>(null);
  const [surgeLoading, setSurgeLoading] = useState(true);
  const [surgeSaving, setSurgeSaving] = useState(false);
  const [surgeAction, setSurgeAction] = useState<string | null>(null);
  const [surgeError, setSurgeError] = useState<string | null>(null);
  const [surgeSuccess, setSurgeSuccess] = useState<string | null>(null);
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [surgeForm, setSurgeForm] = useState<SurgeFormState>(INITIAL_SURGE_FORM);

  const activeCards = useMemo(
    () => rateCards.filter((rateCard) => rateCard.isActive),
    [rateCards],
  );

  const uniqueCombos = useMemo(() => {
    return new Set(rateCards.map((rateCard) => `${rateCard.vehicleType}:${rateCard.serviceType}`))
      .size;
  }, [rateCards]);

  const mappedZones = useMemo(
    () => normalizeZonePoints(surgeDashboard?.zones ?? []),
    [surgeDashboard?.zones],
  );

  const isSuperAdmin = (user?.role ?? '').toUpperCase() === 'SUPER_ADMIN';

  async function loadRateCards() {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get<RateCardsResponse>(
        `/rate-cards?includeInactive=${includeInactive ? 'true' : 'false'}`,
      );
      setRateCards(response.rateCards);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load rate cards.');
    } finally {
      setLoading(false);
    }
  }

  async function loadSurgeDashboard() {
    setSurgeLoading(true);
    setSurgeError(null);

    try {
      const response = await api.get<SurgeDashboard>('/surge-pricing/dashboard');
      setSurgeDashboard(response);
    } catch (caught) {
      setSurgeError(
        caught instanceof ApiError ? caught.message : 'Unable to load surge dashboard.',
      );
    } finally {
      setSurgeLoading(false);
    }
  }

  useEffect(() => {
    void loadRateCards();
  }, [includeInactive]);

  useEffect(() => {
    void loadSurgeDashboard();
  }, []);

  function resetForm() {
    setEditingCardId(null);
    setForm(INITIAL_RATE_FORM);
  }

  function resetSurgeForm() {
    setEditingZoneId(null);
    setSurgeForm(INITIAL_SURGE_FORM);
  }

  function startVersioning(rateCard: RateCard) {
    setEditingCardId(rateCard.id);
    setForm({
      vehicleType: rateCard.vehicleType,
      serviceType: rateCard.serviceType,
      countryCode: rateCard.countryCode,
      county: rateCard.county ?? '',
      localityType: rateCard.localityType,
      baseFare: String(rateCard.baseFare),
      ratePerKm: String(rateCard.ratePerKm),
      perStopRate: String(rateCard.perStopRate),
      minDistance: String(rateCard.minDistance),
      surgeMultiplier: String(rateCard.surgeMultiplier),
      isActive: rateCard.isActive,
    });
  }

  function startEditingZone(zone: SurgeZoneRow) {
    setEditingZoneId(zone.id);
    setSurgeForm({
      name: zone.name,
      latitude: String(zone.latitude),
      longitude: String(zone.longitude),
      radiusKm: String(zone.radiusKm),
      surgeMultiplier: String(zone.surgeMultiplier),
      isActive: zone.isActive,
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      ...(editingCardId
        ? {}
        : {
            vehicleType: form.vehicleType,
            serviceType: form.serviceType,
          }),
      countryCode: form.countryCode,
      county: form.countryCode === 'KE' && form.county ? form.county : undefined,
      localityType: form.localityType,
      baseFare: Number(form.baseFare),
      ratePerKm: Number(form.ratePerKm),
      perStopRate: Number(form.perStopRate || '0'),
      minDistance: Number(form.minDistance || '0'),
      surgeMultiplier: Number(form.surgeMultiplier || '1'),
      isActive: form.isActive,
    };

    try {
      if (editingCardId) {
        await api.patch(`/rate-cards/${editingCardId}`, payload);
      } else {
        await api.post('/rate-cards', payload);
      }

      resetForm();
      await loadRateCards();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to save rate card.');
    } finally {
      setSaving(false);
    }
  }

  async function handleCalculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCalculatorError(null);
    setCalculatorResult(null);

    try {
      const response = await api.post<CalculatorResult>('/rate-cards/calculate', {
        vehicleType: calculator.vehicleType,
        serviceType: calculator.serviceType,
        countryCode: calculator.countryCode,
        county: calculator.countryCode === 'KE' && calculator.county ? calculator.county : undefined,
        localityType: calculator.localityType,
        distanceKm: Number(calculator.distanceKm),
        stopCount: Number(calculator.stopCount || '0'),
      });
      setCalculatorResult(response);
    } catch (caught) {
      setCalculatorError(
        caught instanceof ApiError ? caught.message : 'Unable to calculate pricing.',
      );
    }
  }

  async function handleSurgeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSurgeSaving(true);
    setSurgeError(null);
    setSurgeSuccess(null);

    const payload = {
      name: surgeForm.name,
      latitude: Number(surgeForm.latitude),
      longitude: Number(surgeForm.longitude),
      radiusKm: Number(surgeForm.radiusKm),
      surgeMultiplier: Number(surgeForm.surgeMultiplier),
      ...(editingZoneId ? {} : { isActive: surgeForm.isActive }),
    };

    try {
      if (editingZoneId) {
        await api.patch(`/surge-pricing/${editingZoneId}`, payload);
      } else {
        await api.post('/surge-pricing', payload);
      }

      setSurgeSuccess(editingZoneId ? 'Surge zone updated.' : 'Surge zone created.');
      resetSurgeForm();
      await loadSurgeDashboard();
    } catch (caught) {
      setSurgeError(caught instanceof ApiError ? caught.message : 'Unable to save surge zone.');
    } finally {
      setSurgeSaving(false);
    }
  }

  async function runSurgeAction(
    actionKey: string,
    request: () => Promise<unknown>,
    successMessage: string,
  ) {
    setSurgeAction(actionKey);
    setSurgeError(null);
    setSurgeSuccess(null);

    try {
      await request();
      setSurgeSuccess(successMessage);
      await loadSurgeDashboard();
    } catch (caught) {
      setSurgeError(caught instanceof ApiError ? caught.message : 'Surge action failed.');
    } finally {
      setSurgeAction(null);
    }
  }

  function renderTabSelector() {
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          variant={activeTab === 'rates' ? 'primary' : 'secondary'}
          onClick={() => setActiveTab('rates')}
        >
          Rate Cards
        </Button>
        <Button
          variant={activeTab === 'surge' ? 'primary' : 'secondary'}
          onClick={() => setActiveTab('surge')}
        >
          Surge Tab
        </Button>
      </div>
    );
  }

  function renderRateCardsTab() {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            label="Stored versions"
            value={String(rateCards.length)}
            helper="All returned rate-card versions in the current view."
          />
          <StatCard
            label="Active combinations"
            value={String(activeCards.length)}
            helper="Cards currently used by booking pricing."
            tone="success"
          />
          <StatCard
            label="Coverage"
            value={`${uniqueCombos} lane combos`}
            helper="Vehicle type x service type combinations."
            tone="info"
          />
        </div>

        {error ? (
          <Alert title="Rate-card workflow error" variant="danger">
            {error}
          </Alert>
        ) : null}

        <SurfaceCard
          title={editingCardId ? 'Publish next rate version' : 'Create rate card'}
          description="Phase 3.1 pricing control. New versions preserve history instead of mutating live rates in place."
          actions={
            editingCardId ? (
              <Button variant="ghost" onClick={resetForm}>
                Cancel versioning
              </Button>
            ) : null
          }
        >
          <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" onSubmit={handleSubmit}>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">Vehicle type</span>
              <select
                className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none disabled:opacity-60"
                disabled={Boolean(editingCardId)}
                value={form.vehicleType}
                onChange={(event) =>
                  setForm((current) => ({ ...current, vehicleType: event.target.value }))
                }
              >
                {VEHICLE_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {formatVehicleTypeLabel(option)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">Service type</span>
              <select
                className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none disabled:opacity-60"
                disabled={Boolean(editingCardId)}
                value={form.serviceType}
                onChange={(event) =>
                  setForm((current) => ({ ...current, serviceType: event.target.value }))
                }
              >
                {SERVICE_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {formatServiceTypeLabel(option)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">Country</span>
              <select
                className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                value={form.countryCode}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    countryCode: event.target.value,
                    county: event.target.value === 'KE' ? current.county : '',
                    localityType: event.target.value === 'KE' ? current.localityType : 'ANY',
                  }))
                }
              >
                {SUPPORTED_PRICING_COUNTRIES.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">Kenya county</span>
              <select
                className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none disabled:opacity-60"
                disabled={form.countryCode !== 'KE'}
                value={form.county}
                onChange={(event) =>
                  setForm((current) => ({ ...current, county: event.target.value }))
                }
              >
                <option value="">All Kenya counties</option>
                {KENYA_COUNTIES.map((county) => (
                  <option key={county} value={county}>
                    {county}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">Area type</span>
              <select
                className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                value={form.localityType}
                onChange={(event) =>
                  setForm((current) => ({ ...current, localityType: event.target.value }))
                }
              >
                {LOCATION_RATE_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <Input
              label="Base fare"
              min="0"
              required
              step="0.01"
              type="number"
              value={form.baseFare}
              onChange={(event) =>
                setForm((current) => ({ ...current, baseFare: event.target.value }))
              }
            />
            <Input
              label="Rate per km"
              min="0"
              required
              step="0.01"
              type="number"
              value={form.ratePerKm}
              onChange={(event) =>
                setForm((current) => ({ ...current, ratePerKm: event.target.value }))
              }
            />
            <Input
              label="Per stop rate"
              min="0"
              step="0.01"
              type="number"
              value={form.perStopRate}
              onChange={(event) =>
                setForm((current) => ({ ...current, perStopRate: event.target.value }))
              }
            />
            <Input
              label="Minimum distance"
              min="0"
              step="0.01"
              type="number"
              value={form.minDistance}
              onChange={(event) =>
                setForm((current) => ({ ...current, minDistance: event.target.value }))
              }
            />
            <Input
              label="Base surge multiplier"
              min="0"
              step="0.01"
              type="number"
              value={form.surgeMultiplier}
              onChange={(event) =>
                setForm((current) => ({ ...current, surgeMultiplier: event.target.value }))
              }
            />

            <label className="flex items-center gap-3 rounded-2xl border border-slate-700/60 bg-slate-950/50 px-4 py-3 text-sm text-slate-200">
              <input
                checked={form.isActive}
                className="h-4 w-4 accent-amber-400"
                type="checkbox"
                onChange={(event) =>
                  setForm((current) => ({ ...current, isActive: event.target.checked }))
                }
              />
              Activate this version after publish
            </label>

            <div className="xl:col-span-4">
              <Button disabled={saving} type="submit">
                {saving
                  ? 'Saving pricing...'
                  : editingCardId
                    ? 'Publish next version'
                    : 'Create rate card'}
              </Button>
            </div>
          </form>
        </SurfaceCard>

        <SurfaceCard
          title="Pricing calculator"
          description="Preview the base active pricing formula before booking flow applies surge intelligence."
        >
          {calculatorError ? (
            <div className="mb-4">
              <Alert title="Calculator error" variant="danger">
                {calculatorError}
              </Alert>
            </div>
          ) : null}

          <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-5" onSubmit={handleCalculate}>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">Vehicle type</span>
              <select
                className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                value={calculator.vehicleType}
                onChange={(event) =>
                  setCalculator((current) => ({ ...current, vehicleType: event.target.value }))
                }
              >
                {VEHICLE_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {formatVehicleTypeLabel(option)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">Service type</span>
              <select
                className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                value={calculator.serviceType}
                onChange={(event) =>
                  setCalculator((current) => ({ ...current, serviceType: event.target.value }))
                }
              >
                {SERVICE_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {formatServiceTypeLabel(option)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">Country</span>
              <select
                className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                value={calculator.countryCode}
                onChange={(event) =>
                  setCalculator((current) => ({
                    ...current,
                    countryCode: event.target.value,
                    county: event.target.value === 'KE' ? current.county : '',
                    localityType: event.target.value === 'KE' ? current.localityType : 'ANY',
                  }))
                }
              >
                {SUPPORTED_PRICING_COUNTRIES.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">Kenya county</span>
              <select
                className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none disabled:opacity-60"
                disabled={calculator.countryCode !== 'KE'}
                value={calculator.county}
                onChange={(event) =>
                  setCalculator((current) => ({ ...current, county: event.target.value }))
                }
              >
                <option value="">All Kenya counties</option>
                {KENYA_COUNTIES.map((county) => (
                  <option key={county} value={county}>
                    {county}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">Area type</span>
              <select
                className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                value={calculator.localityType}
                onChange={(event) =>
                  setCalculator((current) => ({ ...current, localityType: event.target.value }))
                }
              >
                {LOCATION_RATE_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <Input
              label="Distance (km)"
              min="0"
              required
              step="0.01"
              type="number"
              value={calculator.distanceKm}
              onChange={(event) =>
                setCalculator((current) => ({ ...current, distanceKm: event.target.value }))
              }
            />
            <Input
              label="Intermediate stops"
              min="0"
              required
              step="1"
              type="number"
              value={calculator.stopCount}
              onChange={(event) =>
                setCalculator((current) => ({ ...current, stopCount: event.target.value }))
              }
            />

            <div className="flex items-end">
              <Button className="w-full" type="submit">
                Calculate
              </Button>
            </div>
          </form>

          {calculatorResult ? (
            <div className="mt-5 grid gap-4 md:grid-cols-4">
              <StatCard
                label="Applied card"
                value={`v${calculatorResult.rateCard.version}`}
                helper={`${formatVehicleTypeLabel(calculatorResult.rateCard.vehicleType)} / ${formatServiceTypeLabel(calculatorResult.rateCard.serviceType)} / ${calculatorResult.pricingScope?.county ?? calculatorResult.rateCard.countryCode} / ${formatStatus(calculatorResult.pricingScope?.localityType ?? calculatorResult.rateCard.localityType)}`}
              />
              <StatCard
                label="Distance fare"
                value={formatMoney(calculatorResult.distanceFare)}
                helper={`Effective distance: ${calculatorResult.effectiveDistance} km`}
              />
              <StatCard
                label="Stop fare"
                value={formatMoney(calculatorResult.stopFare)}
                helper={`Base surge x ${calculatorResult.surgeMultiplier.toFixed(2)}`}
                tone="info"
              />
              <StatCard
                label="Estimated total"
                value={formatMoney(calculatorResult.totalPrice)}
                helper={`Base: ${formatMoney(calculatorResult.baseFare)}`}
                tone="success"
              />
            </div>
          ) : null}
        </SurfaceCard>

        <SurfaceCard
          title="Rate-card register"
          description="Active cards drive booking pricing; inactive cards remain visible here as audit-friendly history."
          actions={
            <label className="flex items-center gap-3 text-sm text-slate-300">
              <input
                checked={includeInactive}
                className="h-4 w-4 accent-amber-400"
                type="checkbox"
                onChange={(event) => setIncludeInactive(event.target.checked)}
              />
              Show historical versions
            </label>
          }
        >
          {loading ? (
            <Spinner />
          ) : (
            <Table
              emptyMessage="No rate cards found yet."
              rows={rateCards}
              columns={[
                {
                  key: 'combo',
                  header: 'Lane combo',
                  render: (rateCard) => (
                    <div>
                      <p className="font-semibold text-white">
                        {formatVehicleTypeLabel(rateCard.vehicleType)} / {formatServiceTypeLabel(rateCard.serviceType)}
                      </p>
                      <p className="text-xs text-slate-400">
                        {rateCard.countryCode}
                        {rateCard.county ? ` / ${rateCard.county}` : ' / Country-wide'}
                        {` / ${formatStatus(rateCard.localityType)}`}
                      </p>
                      <p className="text-xs text-slate-400">{compactId(rateCard.id)}</p>
                    </div>
                  ),
                },
                {
                  key: 'version',
                  header: 'Version',
                  render: (rateCard) => (
                    <div className="text-sm text-slate-200">
                      <p>v{rateCard.version}</p>
                      <p className="text-xs text-slate-400">
                        {rateCard.isActive ? 'Live' : 'Historical'}
                      </p>
                    </div>
                  ),
                },
                {
                  key: 'rates',
                  header: 'Rates',
                  render: (rateCard) => (
                    <div className="text-xs text-slate-300">
                      <p>Base: {formatMoney(rateCard.baseFare)}</p>
                      <p>Per km: {formatMoney(rateCard.ratePerKm)}</p>
                      <p>Per stop: {formatMoney(rateCard.perStopRate)}</p>
                    </div>
                  ),
                },
                {
                  key: 'controls',
                  header: 'Controls',
                  render: (rateCard) => (
                    <div className="text-xs text-slate-300">
                      <p>Min dist: {rateCard.minDistance} km</p>
                      <p>Base surge: x{rateCard.surgeMultiplier.toFixed(2)}</p>
                      <p>Status: {formatStatus(rateCard.isActive ? 'ACTIVE' : 'INACTIVE')}</p>
                    </div>
                  ),
                },
                {
                  key: 'updated',
                  header: 'Updated',
                  render: (rateCard) => formatDateTime(rateCard.updatedAt),
                },
                {
                  key: 'actions',
                  header: 'Actions',
                  render: (rateCard) => (
                    <Button variant="secondary" onClick={() => startVersioning(rateCard)}>
                      Version from this
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

  function renderSurgeTab() {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard
            label="Configured zones"
            value={String(surgeDashboard?.summary.totalZones ?? 0)}
            helper="All surge zones available to the demand engine."
          />
          <StatCard
            label="Active zones"
            value={String(surgeDashboard?.summary.activeZones ?? 0)}
            helper="Zones currently applying live surge pricing."
            tone="success"
          />
          <StatCard
            label="Peak-hour multiplier"
            value={`x${(surgeDashboard?.summary.peakHourMultiplier ?? 1).toFixed(2)}`}
            helper="Time-based multiplier from the current active peak-hour rule set."
            tone="info"
          />
          <StatCard
            label="Highest suggestion"
            value={`x${(surgeDashboard?.summary.highestSuggestedTotalMultiplier ?? 1).toFixed(2)}`}
            helper="Strongest total multiplier currently suggested across all zones."
            tone="warning"
          />
        </div>

        {surgeError ? (
          <Alert title="Surge pricing error" variant="danger">
            {surgeError}
          </Alert>
        ) : null}
        {surgeSuccess ? (
          <Alert title="Surge pricing updated" variant="success">
            {surgeSuccess}
          </Alert>
        ) : null}

        <SurfaceCard
          title="Surge controls"
          description="Phase 4.2 dynamic surge pricing. Configure zone radii, run demand-vs-supply logic, and apply live multipliers from the finance command center."
          actions={
            <div className="text-xs text-slate-400">
              Generated: {surgeDashboard ? formatDateTime(surgeDashboard.generatedAt) : 'Loading...'}
            </div>
          }
        >
          <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-5" onSubmit={handleSurgeSubmit}>
            <Input
              label="Zone name"
              required
              value={surgeForm.name}
              onChange={(event) =>
                setSurgeForm((current) => ({ ...current, name: event.target.value }))
              }
            />
            <Input
              label="Radius (km)"
              min="0.1"
              required
              step="0.1"
              type="number"
              value={surgeForm.radiusKm}
              onChange={(event) =>
                setSurgeForm((current) => ({ ...current, radiusKm: event.target.value }))
              }
            />
            <Input
              label="Zone multiplier"
              min="1"
              required
              step="0.01"
              type="number"
              value={surgeForm.surgeMultiplier}
              onChange={(event) =>
                setSurgeForm((current) => ({ ...current, surgeMultiplier: event.target.value }))
              }
            />

            <div className="md:col-span-2 xl:col-span-5">
              <WarehousePinPicker
                title="Surge zone map"
                searchLabel="Search surge zone"
                searchPlaceholder="Search demand area, neighborhood, road, or landmark"
                address={surgeForm.name}
                latitude={surgeForm.latitude}
                longitude={surgeForm.longitude}
                onAddressChange={(value) =>
                  setSurgeForm((current) => ({ ...current, name: current.name || value }))
                }
                onChange={(point) =>
                  setSurgeForm((current) => ({
                    ...current,
                    latitude: point.latitude,
                    longitude: point.longitude,
                  }))
                }
              />
            </div>

            {!editingZoneId ? (
              <label className="flex items-center gap-3 rounded-2xl border border-slate-700/60 bg-slate-950/50 px-4 py-3 text-sm text-slate-200">
                <input
                  checked={surgeForm.isActive}
                  className="h-4 w-4 accent-amber-400"
                  type="checkbox"
                  onChange={(event) =>
                    setSurgeForm((current) => ({ ...current, isActive: event.target.checked }))
                  }
                />
                Activate immediately after create
              </label>
            ) : (
              <div className="rounded-2xl border border-slate-700/60 bg-slate-950/50 px-4 py-3 text-sm text-slate-300">
                Editing zone: <span className="font-semibold text-white">{surgeForm.name}</span>
              </div>
            )}

            <div className="xl:col-span-5 flex flex-wrap gap-3">
              <Button disabled={surgeSaving} type="submit">
                {surgeSaving
                  ? 'Saving surge zone...'
                  : editingZoneId
                    ? 'Update surge zone'
                    : 'Create surge zone'}
              </Button>
              <Button type="button" variant="ghost" onClick={resetSurgeForm}>
                Reset form
              </Button>
              <Button type="button" variant="secondary" onClick={() => void loadSurgeDashboard()}>
                Refresh surge dashboard
              </Button>
              {editingZoneId && isSuperAdmin ? (
                <Button
                  type="button"
                  variant="danger"
                  disabled={Boolean(surgeAction)}
                  onClick={() =>
                    void runSurgeAction(
                      `override:${editingZoneId}`,
                      () =>
                        api.post(`/surge-pricing/${editingZoneId}/override`, {
                          surgeMultiplier: Number(surgeForm.surgeMultiplier),
                          forceActive: true,
                          reason: 'Emergency override from surge tab',
                        }),
                      'Emergency surge override applied.',
                    )
                  }
                >
                  {surgeAction === `override:${editingZoneId}`
                    ? 'Applying override...'
                    : 'Emergency override'}
                </Button>
              ) : null}
            </div>
          </form>
        </SurfaceCard>

        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <SurfaceCard
            title="Surge zone map"
            description="Visual pulse of active, recommended, and calm zones based on configured zone centers and radii."
          >
            {surgeLoading && !surgeDashboard ? (
              <Spinner />
            ) : (
              <div className="relative h-[28rem] overflow-hidden rounded-3xl border border-slate-800 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.12),transparent_42%),linear-gradient(160deg,rgba(2,6,23,0.98),rgba(15,23,42,0.9))]">
                <div className="absolute inset-0 opacity-15 [background-image:linear-gradient(rgba(148,163,184,0.35)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.35)_1px,transparent_1px)] [background-size:3.5rem_3.5rem]" />
                {mappedZones.length === 0 ? (
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
                    No surge zones configured yet. Create one to start zone-based pricing.
                  </div>
                ) : (
                  mappedZones.map((zone) => {
                    const toneClass = zone.isActive
                      ? 'border-rose-300/70 bg-rose-400/20'
                      : zone.recommendedZoneMultiplier > 1
                        ? 'border-amber-300/70 bg-amber-400/18'
                        : 'border-emerald-300/60 bg-emerald-400/12';

                    const pinClass = zone.isActive
                      ? 'bg-rose-400 text-rose-950'
                      : zone.recommendedZoneMultiplier > 1
                        ? 'bg-amber-300 text-amber-950'
                        : 'bg-emerald-300 text-emerald-950';

                    return (
                      <div
                        key={zone.id}
                        className="absolute -translate-x-1/2 -translate-y-1/2"
                        style={{ left: `${zone.left}%`, top: `${zone.top}%` }}
                      >
                        <div
                          className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border ${toneClass}`}
                          style={{
                            width: `${zone.ringSize}px`,
                            height: `${zone.ringSize}px`,
                            left: '50%',
                            top: '50%',
                          }}
                        />
                        <div
                          className={`relative z-10 rounded-full px-3 py-1 text-xs font-bold shadow-lg ${pinClass}`}
                        >
                          {zone.name}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </SurfaceCard>

          <SurfaceCard
            title="Peak-hour rules"
            description="Time-based surge rules are layered on top of zone multipliers during demand spikes."
          >
            {surgeLoading && !surgeDashboard ? (
              <Spinner />
            ) : (
              <div className="space-y-3">
                <StatCard
                  label="Active peak rules"
                  value={String(surgeDashboard?.peakHour.activeRules.length ?? 0)}
                  helper="Rules that are active right now."
                  tone="info"
                />
                {(surgeDashboard?.peakHour.rules ?? []).map((rule) => (
                  <div
                    key={rule.id}
                    className={`rounded-2xl border px-4 py-4 text-sm ${
                      rule.isActive
                        ? 'border-amber-400/40 bg-amber-500/10 text-amber-100'
                        : 'border-slate-800/70 bg-slate-950/40 text-slate-300'
                    }`}
                  >
                    <p className="font-semibold text-white">{rule.name}</p>
                    <p className="mt-1">
                      {rule.dayLabels.join(', ')} • {rule.windowLabel}
                    </p>
                    <p className="mt-1">Multiplier: x{rule.multiplier.toFixed(2)}</p>
                    <p className="mt-1">{rule.isActive ? 'Active now' : 'Inactive right now'}</p>
                  </div>
                ))}
              </div>
            )}
          </SurfaceCard>
        </div>

        {surgeDashboard?.notes?.length ? (
          <div className="space-y-3">
            {surgeDashboard.notes.map((note) => (
              <Alert key={note} title="Implementation note" variant="info">
                {note}
              </Alert>
            ))}
          </div>
        ) : null}

        <SurfaceCard
          title="Zone command table"
          description="Demand and supply ratios per zone, plus activation and emergency-control actions."
        >
          {surgeLoading ? (
            <Spinner />
          ) : (
            <Table
              emptyMessage="No surge zones configured yet."
              rows={surgeDashboard?.zones ?? []}
              columns={[
                {
                  key: 'zone',
                  header: 'Zone',
                  render: (zone) => (
                    <div>
                      <p className="font-semibold text-white">{zone.name}</p>
                      <p className="text-xs text-slate-400">{compactId(zone.id)}</p>
                    </div>
                  ),
                },
                {
                  key: 'coverage',
                  header: 'Coverage',
                  render: (zone) => (
                    <div className="text-xs text-slate-300">
                      <p>Radius: {zone.radiusKm} km</p>
                      <p>
                        {zone.latitude.toFixed(4)}, {zone.longitude.toFixed(4)}
                      </p>
                    </div>
                  ),
                },
                {
                  key: 'ratio',
                  header: 'Demand / supply',
                  render: (zone) => (
                    <div className="text-xs text-slate-300">
                      <p>
                        Demand: {zone.demandCount} • Supply: {zone.supplyCount}
                      </p>
                      <p>Ratio: {zone.demandSupplyRatio.toFixed(2)}</p>
                      <p>Pressure: {formatStatus(zone.demandPressure)}</p>
                    </div>
                  ),
                },
                {
                  key: 'multiplier',
                  header: 'Multiplier',
                  render: (zone) => (
                    <div className="text-xs text-slate-300">
                      <p>Stored zone: x{zone.surgeMultiplier.toFixed(2)}</p>
                      <p>Suggested zone: x{zone.recommendedZoneMultiplier.toFixed(2)}</p>
                      <p>Suggested total: x{zone.suggestedTotalMultiplier.toFixed(2)}</p>
                    </div>
                  ),
                },
                {
                  key: 'status',
                  header: 'Live state',
                  render: (zone) => (
                    <div className="text-xs text-slate-300">
                      <p>{zone.isActive ? 'Active' : 'Inactive'}</p>
                      <p>Live total: x{zone.currentAppliedMultiplier.toFixed(2)}</p>
                      <p>
                        {zone.activePeakRules.length > 0
                          ? zone.activePeakRules.join(', ')
                          : 'No peak-hour boost'}
                      </p>
                    </div>
                  ),
                },
                {
                  key: 'actions',
                  header: 'Actions',
                  render: (zone) => (
                    <div className="flex flex-col gap-2">
                      <Button variant="secondary" onClick={() => startEditingZone(zone)}>
                        Edit zone
                      </Button>
                      {zone.isActive ? (
                        <Button
                          disabled={Boolean(surgeAction)}
                          variant="ghost"
                          onClick={() =>
                            void runSurgeAction(
                              `deactivate:${zone.id}`,
                              () => api.post(`/surge-pricing/${zone.id}/deactivate`),
                              `Surge deactivated for ${zone.name}.`,
                            )
                          }
                        >
                          {surgeAction === `deactivate:${zone.id}`
                            ? 'Deactivating...'
                            : 'Deactivate'}
                        </Button>
                      ) : (
                        <Button
                          disabled={Boolean(surgeAction)}
                          onClick={() =>
                            void runSurgeAction(
                              `activate:${zone.id}`,
                              () => api.post(`/surge-pricing/${zone.id}/activate`),
                              `Surge activated for ${zone.name}.`,
                            )
                          }
                        >
                          {surgeAction === `activate:${zone.id}`
                            ? 'Activating...'
                            : 'Activate'}
                        </Button>
                      )}
                      {isSuperAdmin ? (
                        <Button
                          disabled={Boolean(surgeAction)}
                          variant="danger"
                          onClick={() => {
                            startEditingZone(zone);
                            void runSurgeAction(
                              `override:${zone.id}`,
                              () =>
                                api.post(`/surge-pricing/${zone.id}/override`, {
                                  surgeMultiplier: zone.recommendedZoneMultiplier,
                                  forceActive: true,
                                  reason: 'Emergency override from zone table',
                                }),
                              `Emergency override applied for ${zone.name}.`,
                            );
                          }}
                        >
                          {surgeAction === `override:${zone.id}`
                            ? 'Overriding...'
                            : 'Override'}
                        </Button>
                      ) : null}
                    </div>
                  ),
                },
              ]}
            />
          )}
        </SurfaceCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SurfaceCard
        title="Pricing Control"
        description="Rate cards and surge controls now share the same command surface, matching the PRD finance and intelligence handoff."
        actions={renderTabSelector()}
      >
        <div className="text-sm text-slate-400">
          {activeTab === 'rates'
            ? 'Use the Rate Cards tab for baseline fares and versioned pricing.'
            : 'Use the Surge Tab for demand-based multipliers, peak-hour rules, and emergency controls.'}
        </div>
      </SurfaceCard>

      {activeTab === 'rates' ? renderRateCardsTab() : renderSurgeTab()}
    </div>
  );
}
