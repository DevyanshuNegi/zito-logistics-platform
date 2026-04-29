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

function generateIdempotencyKey() {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `corporate-booking-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function CorporateNewBookingPage() {
  const router = useRouter();
  const { currency } = useAppPreferences();
  const [step, setStep] = useState(1);
  const [serviceType, setServiceType] = useState('FTL');
  const [vehicleType, setVehicleType] = useState('VAN');
  const [cargoType, setCargoType] = useState('');
  const [cargoWeightKg, setCargoWeightKg] = useState('');
  const [cargoDescription, setCargoDescription] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupLat, setPickupLat] = useState('');
  const [pickupLng, setPickupLng] = useState('');
  const [pickupContactName, setPickupContactName] = useState('');
  const [pickupContactPhone, setPickupContactPhone] = useState('');
  const [dropAddress, setDropAddress] = useState('');
  const [dropLat, setDropLat] = useState('');
  const [dropLng, setDropLng] = useState('');
  const [dropContactName, setDropContactName] = useState('');
  const [dropContactPhone, setDropContactPhone] = useState('');
  const [isScheduled, setIsScheduled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [quote, setQuote] = useState<RateQuoteResponse | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  const summaryStops = useMemo(
    () => [
      { label: 'Pickup', address: pickupAddress, contact: pickupContactName, phone: pickupContactPhone },
      { label: 'Drop-off', address: dropAddress, contact: dropContactName, phone: dropContactPhone },
    ],
    [dropAddress, dropContactName, dropContactPhone, pickupAddress, pickupContactName, pickupContactPhone],
  );

  const estimatedDistance = useMemo(() => {
    const values = [pickupLat, pickupLng, dropLat, dropLng].map((value) => Number(value));
    if (values.some((value) => !Number.isFinite(value))) {
      return null;
    }

    return estimateDistanceKm(values[0], values[1], values[2], values[3]);
  }, [dropLat, dropLng, pickupLat, pickupLng]);

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
            stopCount: 0,
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
  }, [currency, estimatedDistance, serviceType, step, vehicleType]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await api.post<CreateBookingResponse>('/corporate/bookings', {
        serviceType,
        vehicleType,
        cargoType: cargoType || undefined,
        cargoWeightKg: cargoWeightKg ? Number(cargoWeightKg) : undefined,
        cargoDescription: cargoDescription || undefined,
        specialInstructions: specialInstructions || undefined,
        isScheduled,
        idempotencyKey: generateIdempotencyKey(),
        stops: [
          {
            sequence: 1,
            address: pickupAddress,
            latitude: Number(pickupLat),
            longitude: Number(pickupLng),
            contactName: pickupContactName,
            contactPhone: pickupContactPhone,
            stopType: 'PICKUP',
          },
          {
            sequence: 2,
            address: dropAddress,
            latitude: Number(dropLat),
            longitude: Number(dropLng),
            contactName: dropContactName,
            contactPhone: dropContactPhone,
            stopType: 'DROPOFF',
          },
        ],
      });

      router.push(`/corporate/bookings/${response.booking.id}`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to create corporate booking.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {error ? (
        <Alert title="Corporate booking could not be created" variant="danger">
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
              {item === 1 ? 'Service' : item === 2 ? 'Route' : 'Confirm'}
            </p>
          </button>
        ))}
      </div>

      {step === 1 ? (
        <SurfaceCard title="Cargo and service" description="Corporate bookings use the same rate-card engine, but credit approval is enforced before creation.">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">Service type</span>
              <select
                className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                value={serviceType}
                onChange={(event) => setServiceType(event.target.value)}
              >
                {SERVICE_TYPES.map((option) => (
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
            <label className="flex items-center gap-3 text-sm text-slate-300 md:col-span-2">
              <input
                checked={isScheduled}
                className="h-4 w-4 rounded border-slate-700 bg-slate-950/60"
                onChange={(event) => setIsScheduled(event.target.checked)}
                type="checkbox"
              />
              Mark this as a scheduled trip
            </label>
          </div>
        </SurfaceCard>
      ) : null}

      {step === 2 ? (
        <SurfaceCard title="Route and contacts" description="Provide the mandatory pickup and drop-off fields required by the PRD booking contract.">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Pickup</h3>
              <Input label="Pickup address" value={pickupAddress} onChange={(event) => setPickupAddress(event.target.value)} required />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Latitude" value={pickupLat} onChange={(event) => setPickupLat(event.target.value)} required />
                <Input label="Longitude" value={pickupLng} onChange={(event) => setPickupLng(event.target.value)} required />
              </div>
              <Input label="Contact name" value={pickupContactName} onChange={(event) => setPickupContactName(event.target.value)} required />
              <Input label="Contact phone" value={pickupContactPhone} onChange={(event) => setPickupContactPhone(event.target.value)} required />
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Drop-off</h3>
              <Input label="Drop-off address" value={dropAddress} onChange={(event) => setDropAddress(event.target.value)} required />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Latitude" value={dropLat} onChange={(event) => setDropLat(event.target.value)} required />
                <Input label="Longitude" value={dropLng} onChange={(event) => setDropLng(event.target.value)} required />
              </div>
              <Input label="Contact name" value={dropContactName} onChange={(event) => setDropContactName(event.target.value)} required />
              <Input label="Contact phone" value={dropContactPhone} onChange={(event) => setDropContactPhone(event.target.value)} required />
            </div>
          </div>
        </SurfaceCard>
      ) : null}

      {step === 3 ? (
        <SurfaceCard title="Confirm corporate booking" description="Review the request before the backend checks contract credit and creates the booking.">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-slate-700/40 bg-slate-900/55 p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Service summary</p>
              <div className="mt-4 space-y-2 text-sm text-slate-200">
                <p>Service type: {serviceType}</p>
                <p>Vehicle type: {vehicleType}</p>
                <p>Cargo type: {cargoType || 'Not specified'}</p>
                <p>Cargo weight: {cargoWeightKg || 'Not specified'} kg</p>
                <p>Scheduled: {isScheduled ? 'Yes' : 'No'}</p>
                <p>Estimated distance: {estimatedDistance != null ? `${estimatedDistance} km` : 'Pending coordinates'}</p>
                <p>
                  Estimated quote:{' '}
                  {quote
                    ? formatMoney(quote.totalPrice, quote.currency)
                    : quoteLoading
                      ? 'Calculating...'
                      : 'Pending'}
                </p>
                {quote?.baseCurrencyQuote && quote.baseCurrencyQuote.currency !== quote.currency ? (
                  <p className="text-xs text-slate-400">
                    Base KES quote: {formatMoney(quote.baseCurrencyQuote.totalPrice, quote.baseCurrencyQuote.currency)}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-700/40 bg-slate-900/55 p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Stops</p>
              <div className="mt-4 space-y-3 text-sm text-slate-200">
                {summaryStops.map((stop) => (
                  <div key={stop.label} className="rounded-2xl border border-slate-700/40 bg-slate-950/55 px-4 py-3">
                    <p className="font-semibold text-white">{stop.label}</p>
                    <p>{stop.address || 'Address missing'}</p>
                    <p className="text-xs text-slate-400">
                      {stop.contact || 'Contact missing'} · {stop.phone || 'Phone missing'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SurfaceCard>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {step > 1 ? (
          <Button type="button" variant="secondary" onClick={() => setStep((current) => current - 1)}>
            Back
          </Button>
        ) : null}
        {step < 3 ? (
          <Button type="button" onClick={() => setStep((current) => current + 1)}>
            Continue
          </Button>
        ) : (
          <Button disabled={saving} type="submit">
            {saving ? 'Creating booking...' : 'Create corporate booking'}
          </Button>
        )}
      </div>
    </form>
  );
}
