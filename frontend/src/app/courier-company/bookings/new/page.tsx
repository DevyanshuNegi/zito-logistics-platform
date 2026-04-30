'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { ApiError, api } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { estimateDistanceKm } from '@/lib/geo';
import { SERVICE_TYPES, VEHICLE_TYPES } from '@/lib/phase-one';
import { useAppPreferences } from '@/contexts/AppPreferencesContext';

type CreateBookingResponse = {
  booking: {
    id: string;
  };
};

type RateQuoteResponse = {
  currency: string;
  totalPrice: number;
  effectiveDistance: number;
  baseCurrencyQuote?: {
    currency: string;
    totalPrice: number;
  };
};

type StopForm = {
  id: string;
  address: string;
  latitude: string;
  longitude: string;
  contactName: string;
  contactPhone: string;
  stopType: 'LOAD' | 'UNLOAD' | 'INTERMEDIATE';
};

function createStop(stopType: StopForm['stopType'], id: string): StopForm {
  return {
    id,
    address: '',
    latitude: '',
    longitude: '',
    contactName: '',
    contactPhone: '',
    stopType,
  };
}

function generateStopId(prefix: string) {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function generateIdempotencyKey() {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `courier-booking-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function CourierCompanyNewBookingPage() {
  const router = useRouter();
  const { currency } = useAppPreferences();
  const [step, setStep] = useState(1);
  const [serviceType, setServiceType] = useState('PTL');
  const [vehicleType, setVehicleType] = useState('VAN');
  const [cargoType, setCargoType] = useState('');
  const [cargoWeightKg, setCargoWeightKg] = useState('');
  const [cargoDescription, setCargoDescription] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [isScheduled, setIsScheduled] = useState(false);
  const [useOwnedFleet, setUseOwnedFleet] = useState(false);
  const [stops, setStops] = useState<StopForm[]>([
    createStop('LOAD', 'load-1'),
    createStop('UNLOAD', 'unload-1'),
  ]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [quote, setQuote] = useState<RateQuoteResponse | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  const estimatedDistance = useMemo(() => {
    let total = 0;

    for (let index = 0; index < stops.length - 1; index += 1) {
      const start = stops[index];
      const end = stops[index + 1];
      const coordinates = [
        Number(start.latitude),
        Number(start.longitude),
        Number(end.latitude),
        Number(end.longitude),
      ];

      if (coordinates.some((value) => !Number.isFinite(value))) {
        return null;
      }

      total += estimateDistanceKm(coordinates[0], coordinates[1], coordinates[2], coordinates[3]);
    }

    return total;
  }, [stops]);

  const loadCount = useMemo(
    () => stops.filter((stop) => stop.stopType === 'LOAD').length,
    [stops],
  );
  const unloadCount = useMemo(
    () => stops.filter((stop) => stop.stopType === 'UNLOAD').length,
    [stops],
  );

  useEffect(() => {
    if (step !== 3 || estimatedDistance == null) {
      return;
    }

    setQuoteLoading(true);
    setQuoteError(null);

    void (async () => {
      try {
        const response = await api.post<RateQuoteResponse>(
          '/rate-cards/calculate',
          {
            serviceType,
            vehicleType,
            distanceKm: estimatedDistance,
            stopCount: Math.max(0, stops.length - 1),
            currency,
          },
          { retry: false },
        );
        setQuote(response);
      } catch (caught) {
        setQuoteError(
          caught instanceof ApiError
            ? caught.message
            : 'Unable to calculate the preferred-currency quote.',
        );
      } finally {
        setQuoteLoading(false);
      }
    })();
  }, [currency, estimatedDistance, serviceType, step, stops.length, vehicleType]);

  function updateStop(id: string, field: keyof StopForm, value: string) {
    setStops((current) =>
      current.map((stop) => (stop.id === id ? { ...stop, [field]: value } : stop)),
    );
  }

  function addStop(stopType: StopForm['stopType']) {
    setStops((current) => [...current, createStop(stopType, generateStopId(stopType.toLowerCase()))]);
  }

  function removeStop(id: string) {
    setStops((current) => current.filter((stop) => stop.id !== id));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await api.post<CreateBookingResponse>('/courier-company/bookings', {
        serviceType,
        vehicleType,
        cargoType: cargoType || undefined,
        cargoWeightKg: cargoWeightKg ? Number(cargoWeightKg) : undefined,
        cargoDescription: cargoDescription || undefined,
        specialInstructions: [
          specialInstructions,
          useOwnedFleet ? 'Preferred capacity source: owned fleet first.' : 'Preferred capacity source: platform-hired fleet allowed.',
        ]
          .filter(Boolean)
          .join(' '),
        isScheduled,
        idempotencyKey: generateIdempotencyKey(),
        stops: stops.map((stop, index) => ({
          sequence: index + 1,
          address: stop.address,
          latitude: Number(stop.latitude),
          longitude: Number(stop.longitude),
          contactName: stop.contactName,
          contactPhone: stop.contactPhone,
          stopType: stop.stopType,
        })),
      });

      router.push(`/courier-company/bookings/${response.booking.id}`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to create courier-company booking.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {error ? (
        <Alert title="Courier-company booking could not be created" variant="danger">
          {error}
        </Alert>
      ) : null}

      {quoteError && step === 3 ? (
        <Alert title="Quote unavailable" variant="warning">
          {quoteError}
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <button
            key={item}
            type="button"
            className={[
              'rounded-3xl border px-4 py-4 text-left transition',
              step === item
                ? 'border-amber-400/40 bg-amber-500/15 text-amber-100'
                : 'border-slate-700/40 bg-slate-950/55 text-slate-300',
            ].join(' ')}
            onClick={() => setStep(item)}
          >
            <p className="text-xs uppercase tracking-[0.24em]">Step {item}</p>
            <p className="mt-2 text-lg font-semibold">
              {item === 1 ? 'Service' : item === 2 ? 'Stops' : 'Confirm'}
            </p>
          </button>
        ))}
      </div>

      {step === 1 ? (
        <SurfaceCard title="Service and load profile" description="Courier-company requests can run on your own fleet, on Zito-hired supply, or on a blended capacity model.">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">Service type</span>
              <select
                className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                value={serviceType}
                onChange={(event) => setServiceType(event.target.value)}
              >
                {SERVICE_TYPES.filter((option) => ['PTL', 'COURIER', 'FTL'].includes(option)).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">Vehicle type</span>
              <select
                className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                value={vehicleType}
                onChange={(event) => setVehicleType(event.target.value)}
              >
                {VEHICLE_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <Input label="Cargo type" value={cargoType} onChange={(event) => setCargoType(event.target.value)} />
            <Input label="Cargo weight (kg)" value={cargoWeightKg} onChange={(event) => setCargoWeightKg(event.target.value)} />
            <div className="md:col-span-2">
              <Input label="Cargo description" textarea value={cargoDescription} onChange={(event) => setCargoDescription(event.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Input label="Special instructions" textarea value={specialInstructions} onChange={(event) => setSpecialInstructions(event.target.value)} />
            </div>
            <label className="flex items-center gap-3 text-sm text-slate-300">
              <input
                checked={isScheduled}
                className="h-4 w-4 rounded border-slate-700 bg-slate-950/60"
                onChange={(event) => setIsScheduled(event.target.checked)}
                type="checkbox"
              />
              Mark this as a scheduled movement plan
            </label>
            <label className="flex items-center gap-3 text-sm text-slate-300">
              <input
                checked={useOwnedFleet}
                className="h-4 w-4 rounded border-slate-700 bg-slate-950/60"
                onChange={(event) => setUseOwnedFleet(event.target.checked)}
                type="checkbox"
              />
              Use owned fleet first before marketplace or platform-hired capacity
            </label>
          </div>
        </SurfaceCard>
      ) : null}

      {step === 2 ? (
        <SurfaceCard
          title="Loading and unloading stops"
          description="Courier-company requests can define multiple loading and unloading points. At least one load and one unload stop are required."
          actions={
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => addStop('LOAD')}>
                Add load stop
              </Button>
              <Button type="button" variant="secondary" onClick={() => addStop('UNLOAD')}>
                Add unload stop
              </Button>
              <Button type="button" variant="secondary" onClick={() => addStop('INTERMEDIATE')}>
                Add intermediate stop
              </Button>
            </div>
          }
        >
          <Alert title="Stop coverage" variant="info">
            Loads: {loadCount} · Unloads: {unloadCount} · Total stops: {stops.length}
          </Alert>

          <div className="mt-4 space-y-4">
            {stops.map((stop, index) => (
              <div key={stop.id} className="rounded-3xl border border-slate-700/40 bg-slate-900/55 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">Stop {index + 1}</p>
                    <p className="text-xs text-slate-400">Sequence-aware load planning for courier distribution.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      className="rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-2 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                      value={stop.stopType}
                      onChange={(event) => updateStop(stop.id, 'stopType', event.target.value)}
                    >
                      <option value="LOAD">LOAD</option>
                      <option value="UNLOAD">UNLOAD</option>
                      <option value="INTERMEDIATE">INTERMEDIATE</option>
                    </select>
                    {stops.length > 2 ? (
                      <Button type="button" variant="danger" onClick={() => removeStop(stop.id)}>
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Input label="Address" value={stop.address} onChange={(event) => updateStop(stop.id, 'address', event.target.value)} required />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input label="Latitude" value={stop.latitude} onChange={(event) => updateStop(stop.id, 'latitude', event.target.value)} required />
                    <Input label="Longitude" value={stop.longitude} onChange={(event) => updateStop(stop.id, 'longitude', event.target.value)} required />
                  </div>
                  <Input label="Contact name" value={stop.contactName} onChange={(event) => updateStop(stop.id, 'contactName', event.target.value)} required />
                  <Input label="Contact phone" value={stop.contactPhone} onChange={(event) => updateStop(stop.id, 'contactPhone', event.target.value)} required />
                </div>
              </div>
            ))}
          </div>
        </SurfaceCard>
      ) : null}

      {step === 3 ? (
        <SurfaceCard title="Confirm courier-company request" description="Review the multi-stop load plan before it enters the booking and assignment flow.">
          <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
            <div className="space-y-4">
              {stops.map((stop, index) => (
                <div key={stop.id} className="rounded-3xl border border-slate-700/40 bg-slate-900/55 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                    {stop.stopType} · Stop {index + 1}
                  </p>
                  <p className="mt-2 font-semibold text-white">{stop.address || 'Address pending'}</p>
                  <p className="mt-1 text-sm text-slate-300">
                    {stop.contactName || 'Contact pending'} · {stop.contactPhone || 'Phone pending'}
                  </p>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <div className="rounded-3xl border border-slate-700/40 bg-slate-900/55 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Service</p>
                <p className="mt-2 text-lg font-semibold text-white">{serviceType}</p>
                <p className="mt-1 text-sm text-slate-400">{vehicleType}</p>
              </div>

              <div className="rounded-3xl border border-slate-700/40 bg-slate-900/55 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Distance</p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {estimatedDistance == null ? 'Awaiting coordinates' : `${estimatedDistance.toFixed(1)} km`}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {loadCount} load stop(s) · {unloadCount} unload stop(s)
                </p>
              </div>

              <div className="rounded-3xl border border-slate-700/40 bg-slate-900/55 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Quote</p>
                {quoteLoading ? (
                  <p className="mt-2 text-sm text-slate-300">Calculating...</p>
                ) : quote ? (
                  <>
                    <p className="mt-2 text-lg font-semibold text-white">
                      {formatMoney(quote.totalPrice, quote.currency)}
                    </p>
                    {quote.baseCurrencyQuote ? (
                      <p className="mt-1 text-sm text-slate-400">
                        Base quote: {formatMoney(quote.baseCurrencyQuote.totalPrice, quote.baseCurrencyQuote.currency)}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="mt-2 text-sm text-slate-300">Quote will appear when all route coordinates are available.</p>
                )}
              </div>

              <Button className="w-full" disabled={saving} type="submit">
                {saving ? 'Creating request...' : 'Create courier-company request'}
              </Button>
            </div>
          </div>
        </SurfaceCard>
      ) : null}
    </form>
  );
}
