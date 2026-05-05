'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Bike,
  Boxes,
  CheckCircle2,
  Clock3,
  MapPinned,
  Package,
  ShieldCheck,
  Truck,
  Warehouse,
} from 'lucide-react';
import { RoutePreviewMap } from '@/components/maps/RoutePreviewMap';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ApiError, api } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import {
  estimateDistanceKm,
  geocodeAddress,
  parseCoordinate,
  type GeocodeLookup,
} from '@/lib/geo';
import {
  KENYA_COUNTIES,
  LOCATION_RATE_TYPES,
  SUPPORTED_PRICING_COUNTRIES,
} from '@/lib/location-pricing';
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
  pricingScope?: {
    countryCode: string;
    county: string | null;
    localityType: string;
  };
  baseCurrencyQuote?: {
    currency: string;
    totalPrice: number;
  };
};

type LocalityRateType = 'ANY' | 'TOWN' | 'RURAL';

type AutoPricingScope = {
  countryCode: string;
  county: string;
  localityType: LocalityRateType;
  summary: string;
};

function formatLocalityRateType(value: LocalityRateType) {
  if (value === 'TOWN') {
    return 'Town / urban';
  }

  if (value === 'RURAL') {
    return 'Rural';
  }

  return 'Any area';
}

function buildPricingScopeSummary(scope: {
  countryCode: string;
  county: string;
  localityType: LocalityRateType;
}) {
  const countryLabel =
    SUPPORTED_PRICING_COUNTRIES.find((option) => option.code === scope.countryCode)?.label ??
    scope.countryCode;

  const scopeLabel = scope.countryCode === 'KE' ? scope.county || 'Kenya' : countryLabel;
  return `${scopeLabel} / ${formatLocalityRateType(scope.localityType)}`;
}

const serviceCards = [
  {
    value: 'FTL',
    label: 'Trucks',
    description: 'Dedicated full-load and shifting jobs.',
    icon: Truck,
    suggestedVehicleType: 'TRUCK_7T',
    allowedVehicleTypes: [
      'TRUCK_3T',
      'TRUCK_7T',
      'TRUCK_14T',
      'TRUCK_22T',
      'CONTAINER_20FT',
      'CONTAINER_40FT',
      'REFRIGERATED',
    ],
  },
  {
    value: 'PTL',
    label: 'Part Load',
    description: 'Shared-capacity freight for cartons and stock.',
    icon: Boxes,
    suggestedVehicleType: 'VAN',
    allowedVehicleTypes: ['VAN', 'TRUCK_3T', 'TRUCK_7T'],
  },
  {
    value: 'COURIER',
    label: '2 Wheeler',
    description: 'Quick city movement for lightweight goods.',
    icon: Bike,
    suggestedVehicleType: 'MOTORBIKE',
    allowedVehicleTypes: ['MOTORBIKE', 'VAN'],
  },
  {
    value: 'WAREHOUSE',
    label: 'Storage',
    description: 'Inbound, storage, and dispatch support.',
    icon: Warehouse,
    suggestedVehicleType: 'VAN',
    allowedVehicleTypes: ['VAN', 'TRUCK_3T', 'TRUCK_7T', 'REFRIGERATED'],
  },
  {
    value: 'RAIL',
    label: 'Rail / SGR',
    description: 'Mombasa port and inland container rail movements.',
    icon: Package,
    suggestedVehicleType: 'CONTAINER_20FT',
    allowedVehicleTypes: ['CONTAINER_20FT', 'CONTAINER_40FT'],
  },
] as const;

const vehicleMeta: Record<string, { label: string; capacity: string; note: string; eta: string }> = {
  MOTORBIKE: {
    label: '2 Wheeler',
    capacity: 'Light parcels and documents',
    note: 'Fastest city pickup for compact cargo.',
    eta: '4 min ETA',
  },
  VAN: {
    label: 'Van',
    capacity: 'Cartons, part-load, and retail stock',
    note: 'Balanced option for city and intercity moves.',
    eta: '8 min ETA',
  },
  TRUCK_3T: {
    label: '3 Ton Truck',
    capacity: 'SME loads and smaller shifting work',
    note: 'Best for medium-weight dedicated trips.',
    eta: '12 min ETA',
  },
  TRUCK_7T: {
    label: '7 Ton Truck',
    capacity: 'Full-load and house shifting jobs',
    note: 'Strong fit for dedicated cargo execution.',
    eta: '18 min ETA',
  },
  TRUCK_14T: {
    label: '14 Ton Truck',
    capacity: 'Heavier commercial and industrial loads',
    note: 'Regional freight with larger payload coverage.',
    eta: '25 min ETA',
  },
  TRUCK_22T: {
    label: '22 Ton Truck',
    capacity: 'Long-haul and industrial freight',
    note: 'For high-volume dedicated movement.',
    eta: '35 min ETA',
  },
  CONTAINER_20FT: {
    label: '20ft Container Truck',
    capacity: 'Port drayage and containerized freight',
    note: 'Best for container pickup, depot transfer, and inland port legs.',
    eta: 'Container dispatch',
  },
  CONTAINER_40FT: {
    label: '40ft Container Truck',
    capacity: 'High-volume container and export-import movement',
    note: 'Supports large container haulage and corridor logistics.',
    eta: 'Heavy container dispatch',
  },
  REFRIGERATED: {
    label: 'Refrigerated',
    capacity: 'Cold-chain deliveries',
    note: 'Protects temperature-sensitive shipments.',
    eta: 'Cold-chain ready',
  },
};

const cargoChips = ['Documents', 'Electronics', 'Retail cartons', 'Furniture', 'Perishables', 'Machinery'] as const;

const freightTradeModes = [
  { value: 'LOCAL', label: 'Local move' },
  { value: 'IMPORT', label: 'Import' },
  { value: 'EXPORT', label: 'Export' },
  { value: 'TRANSIT', label: 'Transit' },
] as const;

const railCorridorOptions = [
  { value: 'MOMBASA_TO_ICD_NAIROBI', label: 'Mombasa Port -> ICD Nairobi' },
  { value: 'MOMBASA_TO_ICD_NAIVASHA', label: 'Mombasa Port -> ICD Naivasha' },
  { value: 'ICD_NAIROBI_TO_MOMBASA', label: 'ICD Nairobi -> Mombasa Port' },
  { value: 'ICD_NAIVASHA_TO_MOMBASA', label: 'ICD Naivasha -> Mombasa Port' },
  { value: 'OTHER', label: 'Other rail corridor' },
] as const;

const tradeDocumentStatuses = [
  { value: 'NOT_REQUIRED', label: 'Not required' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'READY', label: 'Ready' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'CLEARED', label: 'Cleared' },
  { value: 'HOLD', label: 'Hold' },
] as const;

function generateIdempotencyKey() {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `booking-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function resolveEnumValue<T extends readonly string[]>(options: T, value: string | null) {
  if (!value) {
    return null;
  }

  return options.includes(value as T[number]) ? value : null;
}

function StepChip({
  active,
  done,
  label,
  onClick,
}: {
  active: boolean;
  done: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-full px-3 py-2 text-[11px] font-semibold transition',
        active
          ? 'bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 text-white'
          : done
            ? 'bg-[#eef4ff] text-[#1b3f72]'
            : 'bg-[#f1f5fb] text-[#64748b]',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

type StopKind = 'pickup' | 'drop';

export default function NewBookingPage() {
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
  const [pricingCountryCode, setPricingCountryCode] = useState('KE');
  const [pricingCounty, setPricingCounty] = useState('');
  const [pricingAreaType, setPricingAreaType] = useState<LocalityRateType>('ANY');
  const [detectedPricingScope, setDetectedPricingScope] = useState<AutoPricingScope | null>(null);
  const [pricingScopeMode, setPricingScopeMode] = useState<'auto' | 'manual'>('auto');
  const [tradeMode, setTradeMode] = useState('LOCAL');
  const [railCorridorCode, setRailCorridorCode] = useState('');
  const [originNode, setOriginNode] = useState('');
  const [destinationNode, setDestinationNode] = useState('');
  const [containerReference, setContainerReference] = useState('');
  const [billOfLadingNumber, setBillOfLadingNumber] = useState('');
  const [idfNumber, setIdfNumber] = useState('');
  const [pacReady, setPacReady] = useState(false);
  const [customsStatus, setCustomsStatus] = useState('NOT_REQUIRED');
  const [icmsStatus, setIcmsStatus] = useState('NOT_REQUIRED');
  const [isScheduled, setIsScheduled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [quote, setQuote] = useState<RateQuoteResponse | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [resolvingPickup, setResolvingPickup] = useState(false);
  const [resolvingDrop, setResolvingDrop] = useState(false);
  const usingPickupDetectedScope = pricingScopeMode === 'auto' && detectedPricingScope != null;

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const requestedService = resolveEnumValue(SERVICE_TYPES, params.get('service'));
    const requestedVehicle = resolveEnumValue(VEHICLE_TYPES, params.get('vehicle'));
    const serviceMeta = serviceCards.find((item) => item.value === requestedService);

    if (requestedService) {
      setServiceType(requestedService);
    }

    if (requestedVehicle) {
      setVehicleType(requestedVehicle);
      return;
    }

    if (serviceMeta) {
      setVehicleType(serviceMeta.suggestedVehicleType);
    }
  }, []);

  const summaryStops = useMemo(
    () => [
      { label: 'Pickup', address: pickupAddress, contact: pickupContactName, phone: pickupContactPhone },
      { label: 'Drop-off', address: dropAddress, contact: dropContactName, phone: dropContactPhone },
    ],
    [dropAddress, dropContactName, dropContactPhone, pickupAddress, pickupContactName, pickupContactPhone],
  );

  const estimatedDistance = useMemo(() => {
    const values = [pickupLat, pickupLng, dropLat, dropLng].map(parseCoordinate);
    if (values.some((value) => value == null)) {
      return null;
    }

    return estimateDistanceKm(values[0]!, values[1]!, values[2]!, values[3]!);
  }, [dropLat, dropLng, pickupLat, pickupLng]);

  const selectedService = useMemo(
    () => serviceCards.find((item) => item.value === serviceType) ?? serviceCards[0],
    [serviceType],
  );
  const availableVehicleTypes = selectedService.allowedVehicleTypes;
  const selectedVehicle = vehicleMeta[vehicleType] ?? vehicleMeta.VAN;
  const isContainerWorkflow =
    serviceType === 'RAIL' || vehicleType === 'CONTAINER_20FT' || vehicleType === 'CONTAINER_40FT';
  const requiresTradeDocuments = isContainerWorkflow && tradeMode !== 'LOCAL';

  useEffect(() => {
    if (!(availableVehicleTypes as readonly string[]).includes(vehicleType)) {
      setVehicleType(selectedService.suggestedVehicleType);
    }
  }, [availableVehicleTypes, selectedService, vehicleType]);

  useEffect(() => {
    if (step !== 3 || estimatedDistance == null) {
      setQuote(null);
      setQuoteError(null);
      setQuoteLoading(false);
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
            countryCode: pricingCountryCode,
            county: pricingCountryCode === 'KE' && pricingCounty ? pricingCounty : undefined,
            localityType: pricingAreaType,
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
  }, [
    currency,
    estimatedDistance,
    pricingAreaType,
    pricingCountryCode,
    pricingCounty,
    serviceType,
    step,
    vehicleType,
  ]);

  function applyPickupPricingScope(result: GeocodeLookup) {
    const supportedCountry = SUPPORTED_PRICING_COUNTRIES.find(
      (option) => option.code === result.countryCode,
    )?.code;

    if (!supportedCountry) {
      setDetectedPricingScope(null);
      return;
    }

    const localityType: LocalityRateType =
      supportedCountry === 'KE' ? result.localityType : 'ANY';
    const county = supportedCountry === 'KE' ? result.county ?? '' : '';
    const nextScope: AutoPricingScope = {
      countryCode: supportedCountry,
      county,
      localityType,
      summary: buildPricingScopeSummary({
        countryCode: supportedCountry,
        county,
        localityType,
      }),
    };

    setDetectedPricingScope(nextScope);
    setPricingScopeMode('auto');
    setPricingCountryCode(nextScope.countryCode);
    setPricingCounty(nextScope.county);
    setPricingAreaType(nextScope.localityType);
  }

  function restorePickupDetectedPricingScope() {
    if (!detectedPricingScope) {
      return;
    }

    setPricingScopeMode('auto');
    setPricingCountryCode(detectedPricingScope.countryCode);
    setPricingCounty(detectedPricingScope.county);
    setPricingAreaType(detectedPricingScope.localityType);
  }

  function applyGeocode(kind: StopKind, result: GeocodeLookup) {
    if (kind === 'pickup') {
      setPickupAddress(result.address);
      setPickupLat(result.latitude);
      setPickupLng(result.longitude);
      applyPickupPricingScope(result);
      return;
    }

    setDropAddress(result.address);
    setDropLat(result.latitude);
    setDropLng(result.longitude);
  }

  async function resolveStopCoordinates(kind: StopKind, silent = false) {
    const address = kind === 'pickup' ? pickupAddress : dropAddress;
    const setBusy = kind === 'pickup' ? setResolvingPickup : setResolvingDrop;

    if (!address.trim()) {
      if (!silent) {
        setError(`Add the ${kind} address before using the free map lookup.`);
      }
      return false;
    }

    setBusy(true);
    if (!silent) {
      setError(null);
    }

    try {
      const result = await geocodeAddress(address);
      applyGeocode(kind, result);
      return true;
    } catch (caught) {
      if (!silent) {
        setError(caught instanceof Error ? caught.message : 'Free map lookup failed.');
      }
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function ensureRouteCoordinates() {
    const hasPickup = parseCoordinate(pickupLat) != null && parseCoordinate(pickupLng) != null;
    const hasDrop = parseCoordinate(dropLat) != null && parseCoordinate(dropLng) != null;

    const pickupReady = hasPickup ? true : await resolveStopCoordinates('pickup', true);
    const dropReady = hasDrop ? true : await resolveStopCoordinates('drop', true);

    if (!pickupReady || !dropReady) {
      setError('Use the free map lookup for both addresses, or enter route pins manually before continuing.');
      return false;
    }

    return true;
  }

  function validateFreightWorkflow() {
    if (!isContainerWorkflow) {
      return null;
    }

    if (!originNode.trim() || !destinationNode.trim()) {
      return 'Container and rail bookings need both an origin node and a destination node.';
    }

    if (serviceType === 'RAIL' && !railCorridorCode) {
      return 'Rail / SGR bookings must select a corridor before review.';
    }

    if (!requiresTradeDocuments) {
      return null;
    }

    if (!containerReference.trim()) {
      return 'Import, export, and transit jobs must include a container reference.';
    }

    if (!billOfLadingNumber.trim()) {
      return 'Import, export, and transit jobs must include a bill of lading number.';
    }

    if (!idfNumber.trim()) {
      return 'Import, export, and transit jobs must include an IDF number.';
    }

    if (customsStatus === 'NOT_REQUIRED' || icmsStatus === 'NOT_REQUIRED') {
      return 'Import, export, and transit jobs must declare customs and iCMS readiness.';
    }

    return null;
  }

  async function advanceStep() {
    setError(null);

    if (step === 1) {
      if (
        !pickupAddress.trim() ||
        !pickupContactName.trim() ||
        !pickupContactPhone.trim() ||
        !dropAddress.trim() ||
        !dropContactName.trim() ||
        !dropContactPhone.trim()
      ) {
        setError('Add both stop addresses and both contact blocks before continuing.');
        return;
      }

      const routeReady = await ensureRouteCoordinates();
      if (!routeReady) {
        return;
      }
    }

    if (step === 2) {
      const workflowError = validateFreightWorkflow();
      if (workflowError) {
        setError(workflowError);
        return;
      }
    }

    setStep((current) => Math.min(current + 1, 3));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const routeReady = await ensureRouteCoordinates();
    if (!routeReady) {
      setSaving(false);
      return;
    }

    const workflowError = validateFreightWorkflow();
    if (workflowError) {
      setSaving(false);
      setError(workflowError);
      return;
    }

    const pickupLatitude = parseCoordinate(pickupLat);
    const pickupLongitude = parseCoordinate(pickupLng);
    const dropLatitude = parseCoordinate(dropLat);
    const dropLongitude = parseCoordinate(dropLng);

    try {
      const response = await api.post<CreateBookingResponse>('/customer/bookings', {
        serviceType,
        vehicleType,
        cargoType: cargoType || undefined,
        cargoWeightKg: cargoWeightKg ? Number(cargoWeightKg) : undefined,
        cargoDescription: cargoDescription || undefined,
        specialInstructions: specialInstructions || undefined,
        isScheduled,
        tradeMode: isContainerWorkflow ? tradeMode : undefined,
        railCorridorCode: serviceType === 'RAIL' ? railCorridorCode || undefined : undefined,
        originNode: isContainerWorkflow ? originNode || undefined : undefined,
        destinationNode: isContainerWorkflow ? destinationNode || undefined : undefined,
        containerReference:
          requiresTradeDocuments && containerReference ? containerReference : undefined,
        billOfLadingNumber:
          requiresTradeDocuments && billOfLadingNumber ? billOfLadingNumber : undefined,
        idfNumber: requiresTradeDocuments && idfNumber ? idfNumber : undefined,
        pacReady: requiresTradeDocuments ? pacReady : undefined,
        customsStatus:
          requiresTradeDocuments && customsStatus !== 'NOT_REQUIRED'
            ? customsStatus
            : undefined,
        icmsStatus:
          requiresTradeDocuments && icmsStatus !== 'NOT_REQUIRED' ? icmsStatus : undefined,
        idempotencyKey: generateIdempotencyKey(),
        stops: [
          {
            sequence: 1,
            address: pickupAddress,
            latitude: pickupLatitude,
            longitude: pickupLongitude,
            contactName: pickupContactName,
            contactPhone: pickupContactPhone,
            stopType: 'PICKUP',
          },
          {
            sequence: 2,
            address: dropAddress,
            latitude: dropLatitude,
            longitude: dropLongitude,
            contactName: dropContactName,
            contactPhone: dropContactPhone,
            stopType: 'DROPOFF',
          },
        ],
      });

      router.push(`/customer/bookings/${response.booking.id}`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to create booking.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {error ? (
        <Alert title="Booking could not be created" variant="danger">
          {error}
        </Alert>
      ) : null}

      {quoteError && step === 3 ? (
        <Alert title="Quote unavailable" variant="warning">
          {quoteError}
        </Alert>
      ) : null}

      <section className="overflow-hidden rounded-[26px] border border-[#d7e0ec] bg-white shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
        <RoutePreviewMap
          className="h-[250px]"
          titleBadge={`${selectedService.label} route`}
          statusBadge={
            quote
              ? formatMoney(quote.totalPrice, quote.currency)
              : quoteLoading
                ? 'Calculating quote'
                : 'Free map route'
          }
          points={[
            {
              label: 'Pickup',
              tone: 'pickup',
              lat: parseCoordinate(pickupLat),
              lng: parseCoordinate(pickupLng),
            },
            {
              label: 'Drop',
              tone: 'drop',
              lat: parseCoordinate(dropLat),
              lng: parseCoordinate(dropLng),
            },
          ]}
        />

        <div className="-mt-5 rounded-t-[24px] bg-white px-4 pb-4 pt-3 shadow-[0_-8px_22px_rgba(15,23,42,0.06)]">
          <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-[#cbd5e1]" />

          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#64748b]">
                New booking
              </p>
              <h1 className="mt-1 text-[1.75rem] font-bold leading-tight text-[#1a1a2e]">
                {step === 1
                  ? 'Set the route'
                  : step === 2
                    ? 'Choose service and vehicle'
                    : 'Review and confirm'}
              </h1>
            </div>

            <div className="min-w-[118px] rounded-[18px] bg-[linear-gradient(180deg,#06101f_0%,#0b1730_100%)] px-3 py-3 text-right text-white shadow-[0_12px_28px_rgba(6,16,31,0.18)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-200/72">
                Quote
              </p>
              <p className="mt-1 text-base font-bold">
                {quote
                  ? formatMoney(quote.totalPrice, quote.currency)
                  : quoteLoading
                    ? 'Calculating'
                    : estimatedDistance != null
                      ? `${estimatedDistance} km`
                      : 'Route needed'}
              </p>
              {quote?.pricingScope ? (
                <p className="mt-1 text-[10px] font-medium text-cyan-100/72">
                  {quote.pricingScope.county ?? quote.pricingScope.countryCode} /{' '}
                  {quote.pricingScope.localityType === 'ANY'
                    ? 'Any area'
                    : quote.pricingScope.localityType === 'TOWN'
                      ? 'Town'
                      : 'Rural'}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <StepChip active={step === 1} done={step > 1} label="Route" onClick={() => setStep(1)} />
            <StepChip active={step === 2} done={step > 2} label="Vehicle" onClick={() => setStep(2)} />
            <StepChip active={step === 3} done={false} label="Review" onClick={() => setStep(3)} />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-[16px] bg-[#f1f5fb] px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#64748b]">
                Pickup
              </p>
              <p className="mt-1 line-clamp-2 text-sm font-semibold text-[#1a1a2e]">
                {pickupAddress || 'Add pickup stop'}
              </p>
            </div>
            <div className="rounded-[16px] bg-[#f1f5fb] px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#64748b]">
                Drop
              </p>
              <p className="mt-1 line-clamp-2 text-sm font-semibold text-[#1a1a2e]">
                {dropAddress || 'Add drop stop'}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-[18px] border border-[#d7e0ec] bg-[#f8fbff] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#64748b]">
              Pricing scope
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-[#475569]">Country</span>
                <select
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  value={pricingCountryCode}
                  onChange={(event) => {
                    const nextCountry = event.target.value;
                    setPricingScopeMode('manual');
                    setPricingCountryCode(nextCountry);
                    if (nextCountry !== 'KE') {
                      setPricingCounty('');
                      setPricingAreaType('ANY');
                    }
                  }}
                >
                  {SUPPORTED_PRICING_COUNTRIES.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-[#475569]">Kenya county</span>
                <select
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:bg-slate-100 disabled:text-slate-400"
                  disabled={pricingCountryCode !== 'KE'}
                  value={pricingCounty}
                  onChange={(event) => {
                    setPricingScopeMode('manual');
                    setPricingCounty(event.target.value);
                  }}
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
                <span className="text-sm font-medium text-[#475569]">Area type</span>
                <select
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  value={pricingAreaType}
                  onChange={(event) => {
                    setPricingScopeMode('manual');
                    setPricingAreaType(event.target.value as LocalityRateType);
                  }}
                >
                  {LOCATION_RATE_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {detectedPricingScope ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={[
                    'inline-flex rounded-full px-2.5 py-1 font-semibold',
                    usingPickupDetectedScope
                      ? 'bg-[#dcfce7] text-[#166534]'
                      : 'bg-[#fef3c7] text-[#92400e]',
                  ].join(' ')}
                >
                  {usingPickupDetectedScope ? 'Pickup scope auto-detected' : 'Manual pricing override'}
                </span>
                <span className="text-[#64748b]">
                  {usingPickupDetectedScope
                    ? `Using ${detectedPricingScope.summary} from the pickup map pin.`
                    : `Pickup pin suggested ${detectedPricingScope.summary}.`}
                </span>
                {!usingPickupDetectedScope ? (
                  <button
                    type="button"
                    className="font-semibold text-[#1d4ed8] transition hover:text-[#1e3a8a]"
                    onClick={restorePickupDetectedPricingScope}
                  >
                    Use pickup scope
                  </button>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-xs text-[#64748b]">
                Kenya quotes can use county pricing and separate town versus rural rates before surge and tax are applied. The pickup map pin will auto-fill this scope when the lookup can identify it.
              </p>
            )}
          </div>
        </div>
      </section>

      {step === 1 ? (
        <section className="rounded-[22px] border border-[#d7e0ec] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
          <div className="mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
              Route setup
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[#1a1a2e]">Add both stops cleanly</h2>
            <p className="mt-1 text-sm leading-6 text-[#64748b]">
              Use address lookup first. Free-map pinning will resolve the route without exposing technical fields.
            </p>
          </div>

          <div className="space-y-4">
            <div className="rounded-[18px] bg-[#f8faff] p-4">
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#dbeafe] text-[#2563eb]">
                    <ArrowUpCircle className="h-4.5 w-4.5" />
                  </div>
                  <div className="mt-2 h-14 w-px bg-[#cbd5e1]" />
                </div>
                <div className="min-w-0 flex-1 space-y-3">
                  <Input
                    label="Pickup address"
                    tone="light"
                    value={pickupAddress}
                    onChange={(event) => setPickupAddress(event.target.value)}
                    placeholder="Building, street, area, city"
                    required
                  />
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Input
                      label="Contact name"
                      tone="light"
                      value={pickupContactName}
                      onChange={(event) => setPickupContactName(event.target.value)}
                      placeholder="Pickup contact"
                      required
                    />
                    <Input
                      label="Phone"
                      tone="light"
                      value={pickupContactPhone}
                      onChange={(event) => setPickupContactPhone(event.target.value)}
                      placeholder="+91..."
                      required
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      className="rounded-[12px] px-3 py-2 text-xs"
                      onClick={() => {
                        void resolveStopCoordinates('pickup');
                      }}
                      disabled={resolvingPickup}
                    >
                      {resolvingPickup ? 'Finding pickup...' : pickupLat && pickupLng ? 'Refresh free map pin' : 'Find on free map'}
                    </Button>
                    <span
                      className={[
                        'inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold',
                        pickupLat && pickupLng
                          ? 'bg-[#dbeafe] text-[#1d4ed8]'
                          : 'bg-[#eef2f7] text-[#64748b]',
                      ].join(' ')}
                    >
                      {pickupLat && pickupLng ? 'Free-map pin ready' : 'Waiting for map pin'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[18px] bg-[#f8faff] p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ede9fe] text-[#7c3aed]">
                  <ArrowDownCircle className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1 space-y-3">
                  <Input
                    label="Drop-off address"
                    tone="light"
                    value={dropAddress}
                    onChange={(event) => setDropAddress(event.target.value)}
                    placeholder="Building, street, area, city"
                    required
                  />
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Input
                      label="Receiver name"
                      tone="light"
                      value={dropContactName}
                      onChange={(event) => setDropContactName(event.target.value)}
                      placeholder="Receiver contact"
                      required
                    />
                    <Input
                      label="Receiver phone"
                      tone="light"
                      value={dropContactPhone}
                      onChange={(event) => setDropContactPhone(event.target.value)}
                      placeholder="+91..."
                      required
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      className="rounded-[12px] px-3 py-2 text-xs"
                      onClick={() => {
                        void resolveStopCoordinates('drop');
                      }}
                      disabled={resolvingDrop}
                    >
                      {resolvingDrop ? 'Finding drop...' : dropLat && dropLng ? 'Refresh free map pin' : 'Find on free map'}
                    </Button>
                    <span
                      className={[
                        'inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold',
                        dropLat && dropLng
                          ? 'bg-[#ede9fe] text-[#7c3aed]'
                          : 'bg-[#eef2f7] text-[#64748b]',
                      ].join(' ')}
                    >
                      {dropLat && dropLng ? 'Free-map pin ready' : 'Waiting for map pin'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <section className="rounded-[22px] border border-[#d7e0ec] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
              Service lane
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[#1a1a2e]">Choose the right service</h2>

            <div className="mt-3 flex flex-wrap gap-2">
              {serviceCards.map((item) => {
                const active = item.value === serviceType;
                return (
                  <button
                    key={item.value}
                    type="button"
                    className={[
                      'rounded-full border px-3 py-2 text-[11px] font-semibold transition',
                      active
                        ? 'border-transparent bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 text-white shadow-[0_10px_20px_rgba(59,130,246,0.16)]'
                        : 'border-[#b8c9e4] bg-white text-[#1b3f72] hover:bg-[#eef4ff]',
                    ].join(' ')}
                    onClick={() => {
                      setServiceType(item.value);
                      setVehicleType(item.suggestedVehicleType);
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-[22px] border border-[#d7e0ec] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
              Vehicle cards
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[#1a1a2e]">Instant pricing selection</h2>

              <div className="mt-3 space-y-2">
                {availableVehicleTypes.map((option) => {
                  const meta = vehicleMeta[option];
                  const active = option === vehicleType;
                  const Icon =
                    option === 'MOTORBIKE'
                      ? Bike
                    : option === 'VAN'
                      ? Package
                      : option === 'REFRIGERATED'
                        ? Warehouse
                        : Truck;

                return (
                  <button
                    key={option}
                    type="button"
                    className={[
                      'flex w-full items-center gap-3 rounded-[14px] border px-3 py-3 text-left transition',
                      active
                        ? 'border-[#1b3f72] bg-[#eef4ff]'
                        : 'border-[#e2e8f0] bg-[#f8faff] hover:border-[#b8c9e4] hover:bg-white',
                    ].join(' ')}
                    onClick={() => setVehicleType(option)}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-white text-[#1b3f72] shadow-sm">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#1a1a2e]">
                        {meta?.label ?? option.replaceAll('_', ' ')}
                      </p>
                      <p className="text-[11px] text-[#64748b]">{meta?.capacity ?? 'Vehicle match for this route.'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-[#1b3f72]">{meta?.eta ?? 'Route matched'}</p>
                      {active ? (
                        <span className="mt-1 inline-flex rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-2 py-1 text-[10px] font-semibold text-white">
                          Selected
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-[22px] border border-[#d7e0ec] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eef4ff] text-[#1b3f72]">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
                  Cargo
                </p>
                <h2 className="text-lg font-semibold text-[#1a1a2e]">Optional shipment details</h2>
              </div>
            </div>

            <div className="mb-3 flex flex-wrap gap-2">
              {cargoChips.map((chip) => {
                const active = cargoType === chip;
                return (
                  <button
                    key={chip}
                    type="button"
                    className={[
                      'rounded-full border px-3 py-2 text-[11px] font-semibold transition',
                      active
                        ? 'border-transparent bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 text-white'
                        : 'border-[#d7e0ec] bg-white text-[#64748b] hover:border-[#b8c9e4]',
                    ].join(' ')}
                    onClick={() => setCargoType(chip)}
                  >
                    {chip}
                  </button>
                );
              })}
            </div>

            <div className="space-y-3">
              <Input
                label="Cargo type"
                tone="light"
                value={cargoType}
                onChange={(event) => setCargoType(event.target.value)}
                placeholder="Documents, electronics, cartons"
              />
              <Input
                label="Weight (kg)"
                tone="light"
                value={cargoWeightKg}
                onChange={(event) => setCargoWeightKg(event.target.value)}
                placeholder="25"
              />
              <Input
                label="Cargo description"
                tone="light"
                textarea
                value={cargoDescription}
                onChange={(event) => setCargoDescription(event.target.value)}
                placeholder="Short handling summary"
              />
              <Input
                label="Special instructions"
                tone="light"
                textarea
                value={specialInstructions}
                onChange={(event) => setSpecialInstructions(event.target.value)}
                placeholder="Fragile handling, gate pass, timing"
              />
            </div>

            <label className="mt-3 flex items-center gap-3 rounded-[14px] bg-[#f8faff] px-3 py-3 text-sm text-[#475569]">
              <input
                checked={isScheduled}
                className="h-4 w-4 rounded border-[#cbd5e1]"
                onChange={(event) => setIsScheduled(event.target.checked)}
                type="checkbox"
              />
              Schedule this move instead of treating it as immediate.
            </label>
          </section>

          {isContainerWorkflow ? (
            <section className="rounded-[22px] border border-[#d7e0ec] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ecfeff] text-[#0f766e]">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
                    Rail and container controls
                  </p>
                  <h2 className="text-lg font-semibold text-[#1a1a2e]">
                    Corridor and customs readiness
                  </h2>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-[#475569]">Trade mode</span>
                  <select
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    value={tradeMode}
                    onChange={(event) => setTradeMode(event.target.value)}
                  >
                    {freightTradeModes.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                {serviceType === 'RAIL' ? (
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-[#475569]">Rail corridor</span>
                    <select
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                      value={railCorridorCode}
                      onChange={(event) => setRailCorridorCode(event.target.value)}
                    >
                      <option value="">Select corridor</option>
                      {railCorridorOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                <Input
                  label="Origin node"
                  tone="light"
                  value={originNode}
                  onChange={(event) => setOriginNode(event.target.value)}
                  placeholder="Mombasa Port, ICD Nairobi, depot, warehouse"
                  required={isContainerWorkflow}
                />
                <Input
                  label="Destination node"
                  tone="light"
                  value={destinationNode}
                  onChange={(event) => setDestinationNode(event.target.value)}
                  placeholder="ICD Naivasha, consignee yard, warehouse"
                  required={isContainerWorkflow}
                />
              </div>

              {requiresTradeDocuments ? (
                <div className="mt-4 space-y-3 rounded-[18px] bg-[#f8faff] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
                    Trade document pack
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input
                      label="Container reference"
                      tone="light"
                      value={containerReference}
                      onChange={(event) => setContainerReference(event.target.value)}
                      placeholder="MSKU1234567"
                      required={requiresTradeDocuments}
                    />
                    <Input
                      label="Bill of lading"
                      tone="light"
                      value={billOfLadingNumber}
                      onChange={(event) => setBillOfLadingNumber(event.target.value)}
                      placeholder="B/L reference"
                      required={requiresTradeDocuments}
                    />
                    <Input
                      label="IDF number"
                      tone="light"
                      value={idfNumber}
                      onChange={(event) => setIdfNumber(event.target.value)}
                      placeholder="KRA / IDF reference"
                      required={requiresTradeDocuments}
                    />
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-[#475569]">Customs status</span>
                      <select
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                        value={customsStatus}
                        onChange={(event) => setCustomsStatus(event.target.value)}
                      >
                        {tradeDocumentStatuses
                          .filter((option) => option.value !== 'NOT_REQUIRED')
                          .map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-[#475569]">iCMS status</span>
                      <select
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                        value={icmsStatus}
                        onChange={(event) => setIcmsStatus(event.target.value)}
                      >
                        {tradeDocumentStatuses
                          .filter((option) => option.value !== 'NOT_REQUIRED')
                          .map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                      </select>
                    </label>
                  </div>

                  <label className="flex items-center gap-3 rounded-[14px] border border-[#d7e0ec] bg-white px-3 py-3 text-sm text-[#475569]">
                    <input
                      checked={pacReady}
                      className="h-4 w-4 rounded border-[#cbd5e1]"
                      onChange={(event) => setPacReady(event.target.checked)}
                      type="checkbox"
                    />
                    Pre-arrival clearance (PAC) is ready for this movement.
                  </label>
                </div>
              ) : (
                <p className="mt-4 text-xs text-[#64748b]">
                  Local container and local rail jobs can skip customs document references, but they still need origin and destination nodes for corridor control.
                </p>
              )}
            </section>
          ) : null}
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-4">
          <section className="rounded-[22px] border border-transparent bg-[linear-gradient(135deg,#06101f_0%,#0f1b31_100%)] p-4 text-white shadow-[0_12px_30px_rgba(6,16,31,0.22)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200/72">
              Estimated quote
            </p>
            <p className="mt-2 text-3xl font-extrabold">
              {quote
                ? formatMoney(quote.totalPrice, quote.currency)
                : quoteLoading
                  ? 'Calculating...'
                  : 'Awaiting route'}
            </p>
            <p className="mt-2 text-sm text-slate-300">
              {estimatedDistance != null
                ? `${estimatedDistance} km route`
                : 'Add both stops to calculate price.'}
            </p>
            {quote?.baseCurrencyQuote && quote.baseCurrencyQuote.currency !== quote.currency ? (
              <p className="mt-2 text-xs text-slate-400">
                Base KES quote: {formatMoney(quote.baseCurrencyQuote.totalPrice, quote.baseCurrencyQuote.currency)}
              </p>
            ) : null}
          </section>

          <section className="rounded-[22px] border border-[#d7e0ec] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
              Route summary
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[#1a1a2e]">Stops and service</h2>

            <div className="mt-4 space-y-3">
              {summaryStops.map((stop, index) => (
                <div key={stop.label} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full ${
                        index === 0 ? 'bg-[#dbeafe] text-[#2563eb]' : 'bg-[#ede9fe] text-[#7c3aed]'
                      }`}
                    >
                      {index === 0 ? (
                        <ArrowUpCircle className="h-4 w-4" />
                      ) : (
                        <ArrowDownCircle className="h-4 w-4" />
                      )}
                    </div>
                    {index < summaryStops.length - 1 ? <div className="h-10 w-px bg-[#cbd5e1]" /> : null}
                  </div>
                  <div className="min-w-0 flex-1 rounded-[14px] bg-[#f8faff] px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
                      {stop.label}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#1a1a2e]">
                      {stop.address || 'Address missing'}
                    </p>
                    <p className="mt-1 text-xs text-[#64748b]">
                      {stop.contact || 'Contact missing'}
                      {stop.phone ? ` / ${stop.phone}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-[14px] bg-[#f1f5fb] px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
                  Service
                </p>
                <p className="mt-1 text-sm font-semibold text-[#1a1a2e]">{selectedService.label}</p>
              </div>
              <div className="rounded-[14px] bg-[#f1f5fb] px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
                  Vehicle
                </p>
                <p className="mt-1 text-sm font-semibold text-[#1a1a2e]">{selectedVehicle.label}</p>
              </div>
            </div>
          </section>

          {isContainerWorkflow ? (
            <section className="rounded-[22px] border border-[#d7e0ec] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
                Rail and container control
              </p>
              <h2 className="mt-1 text-lg font-semibold text-[#1a1a2e]">Operational handoff summary</h2>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-[14px] bg-[#f8faff] px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
                    Trade mode
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#1a1a2e]">
                    {tradeMode.replaceAll('_', ' ')}
                  </p>
                </div>
                {serviceType === 'RAIL' ? (
                  <div className="rounded-[14px] bg-[#f8faff] px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
                      Rail corridor
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#1a1a2e]">
                      {railCorridorOptions.find((option) => option.value === railCorridorCode)?.label ||
                        'Corridor pending'}
                    </p>
                  </div>
                ) : null}
                <div className="rounded-[14px] bg-[#f8faff] px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
                    Origin node
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#1a1a2e]">
                    {originNode || 'Origin pending'}
                  </p>
                </div>
                <div className="rounded-[14px] bg-[#f8faff] px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
                    Destination node
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#1a1a2e]">
                    {destinationNode || 'Destination pending'}
                  </p>
                </div>
              </div>

              {requiresTradeDocuments ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-[14px] bg-[#f8faff] px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
                      Container reference
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#1a1a2e]">
                      {containerReference || 'Container reference pending'}
                    </p>
                  </div>
                  <div className="rounded-[14px] bg-[#f8faff] px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
                      Bill of lading
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#1a1a2e]">
                      {billOfLadingNumber || 'B/L pending'}
                    </p>
                  </div>
                  <div className="rounded-[14px] bg-[#f8faff] px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
                      IDF number
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#1a1a2e]">
                      {idfNumber || 'IDF pending'}
                    </p>
                  </div>
                  <div className="rounded-[14px] bg-[#f8faff] px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
                      Compliance state
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#1a1a2e]">
                      Customs {customsStatus.replaceAll('_', ' ')} / iCMS {icmsStatus.replaceAll('_', ' ')}
                    </p>
                    <p className="mt-1 text-xs text-[#64748b]">
                      {pacReady ? 'PAC ready' : 'PAC still pending'}
                    </p>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="rounded-[22px] border border-[#d7e0ec] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f5f3ff] text-[#7c3aed]">
                <Boxes className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
                  Shipment notes
                </p>
                <h2 className="text-lg font-semibold text-[#1a1a2e]">Ops-ready summary</h2>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-[14px] bg-[#f8faff] px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
                  Cargo
                </p>
                <p className="mt-1 text-sm text-[#1a1a2e]">
                  {cargoDescription || cargoType || 'No cargo description provided.'}
                </p>
              </div>
              <div className="rounded-[14px] bg-[#f8faff] px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
                  Special instructions
                </p>
                <p className="mt-1 text-sm text-[#1a1a2e]">
                  {specialInstructions || 'No special handling notes.'}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[22px] border border-[#d7e0ec] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#dcfce7] text-[#15803d]">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
                  Final checks
                </p>
                <h2 className="text-lg font-semibold text-[#1a1a2e]">Before you confirm</h2>
              </div>
            </div>

            <div className="space-y-2">
              {[
                'Pickup and drop addresses should match the actual route.',
                'Each stop should have the right contact and phone number.',
                'Free map lookup is now preferred; manual route pins remain only as a fallback.',
              ].map((item) => (
                <div key={item} className="flex gap-3 rounded-[14px] bg-[#f8faff] px-3 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#1b3f72] shadow-sm">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <p className="text-sm leading-6 text-[#475569]">{item}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      <div className="sticky bottom-20 z-20 rounded-[18px] border border-white/80 bg-white/95 px-3 py-2.5 shadow-[0_14px_30px_rgba(15,23,42,0.10)] backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] font-medium text-[#64748b]">
            {step === 1 ? (
              <MapPinned className="h-4 w-4 text-[#1b3f72]" />
            ) : step === 2 ? (
              <Truck className="h-4 w-4 text-[#1b3f72]" />
            ) : (
              <Clock3 className="h-4 w-4 text-[#1b3f72]" />
            )}
            <span>
              {step === 1
                ? 'Finish route details.'
                : step === 2
                  ? 'Choose the best vehicle.'
                  : 'Review and create the booking.'}
            </span>
          </div>

          <div className="flex gap-2">
            {step > 1 ? (
              <Button
                type="button"
                variant="secondary"
                className="rounded-[14px] bg-[#f1f5fb] px-4 text-[#1b3f72] hover:bg-[#e7eef8]"
                onClick={() => setStep((current) => current - 1)}
              >
                Back
              </Button>
            ) : null}

            {step < 3 ? (
              <Button
                type="button"
                className="rounded-[14px] px-4 shadow-[0_10px_24px_rgba(59,130,246,0.18)]"
                onClick={() => {
                  void advanceStep();
                }}
              >
                {step === 1 ? 'Continue to vehicles' : 'Review quote'}
              </Button>
            ) : (
              <Button disabled={saving} type="submit" className="rounded-[14px] px-4">
                {saving ? 'Creating...' : 'Confirm booking'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
