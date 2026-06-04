'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Bike,
  Boxes,
  CheckCircle2,
  Clock3,
  MapPinned,
  Package,
  Search,
  ShieldCheck,
  Truck,
  Warehouse,
} from 'lucide-react';
import { RoutePreviewMap } from '@/components/maps/RoutePreviewMap';
import { RouteLocationPicker } from '@/components/maps/RouteLocationPicker';
import { CustomerAiAssistant } from '@/components/support/CustomerAiAssistant';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ApiError, api } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import {
  estimateDistanceKm,
  geocodeAddress,
  parseCoordinate,
  reverseGeocodeCoordinates,
  type GeocodeLookup,
} from '@/lib/geo';
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
type RecentPlace = {
  address: string;
  countryCode: string | null;
  county: string | null;
  id: string;
  label: string;
  latitude: string;
  localityType: 'ANY' | 'TOWN' | 'RURAL';
  longitude: string;
};

type SavedPlace = {
  address: string;
  countryCode: string | null;
  county: string | null;
  id: string;
  label: string;
  latitude: string;
  localityType: 'ANY' | 'TOWN' | 'RURAL';
  longitude: string;
};

const RECENT_PLACES_STORAGE_KEY = 'zito_customer_recent_places_v1';
const SAVED_PLACES_STORAGE_KEY = 'zito_customer_saved_places_v1';
const SAVED_PLACE_LABELS = ['Home', 'Office', 'Warehouse'] as const;
const POPULAR_PICKUP_LOCATIONS = [
  'Westlands, Nairobi, Kenya',
  'Upper Hill, Nairobi, Kenya',
  'Industrial Area, Nairobi, Kenya',
  'Jomo Kenyatta International Airport, Nairobi, Kenya',
] as const;

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

const bookingAiQuickActions = [
  {
    label: 'Set pickup correctly',
    message: 'How should I search and confirm the pickup location before I continue?',
  },
  {
    label: 'Set drop-off correctly',
    message: 'How should I search and confirm the drop-off location before I continue?',
  },
  {
    label: 'Confirm the route',
    message: 'Show me the correct customer route-confirmation procedure before vehicle selection.',
  },
  {
    label: 'Book with my fleet',
    message: 'How does customer-owned fleet booking work for this trip?',
  },
] as const;

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

function buildPlaceLabel(address: string) {
  const [firstPart] = address.split(',');
  return firstPart?.trim() || 'Saved place';
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
type CurrentLocationStatus = 'idle' | 'loading' | 'ready' | 'denied' | 'unavailable' | 'error';
type CurrentLocationCandidate = GeocodeLookup & {
  accuracy: number | null;
};

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
  const [activeStopSelection, setActiveStopSelection] = useState<StopKind>('pickup');
  const [resolvingMapStop, setResolvingMapStop] = useState<StopKind | null>(null);
  const [locatingStop, setLocatingStop] = useState<StopKind | null>(null);
  const [searchSheetStop, setSearchSheetStop] = useState<StopKind | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<CurrentLocationCandidate | null>(null);
  const [currentLocationStatus, setCurrentLocationStatus] = useState<CurrentLocationStatus>('idle');
  const [currentLocationMessage, setCurrentLocationMessage] = useState<string | null>(null);
  const [recentPlaces, setRecentPlaces] = useState<RecentPlace[]>([]);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const routePickerRef = useRef<HTMLDivElement | null>(null);
  const currentLocationRequestedRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const requestedService = resolveEnumValue(SERVICE_TYPES, params.get('service'));
    const requestedVehicle = resolveEnumValue(VEHICLE_TYPES, params.get('vehicle'));
    const serviceMeta = serviceCards.find((item) => item.value === requestedService);

    if (requestedService === 'WAREHOUSE') {
      router.replace('/customer/warehouse');
      return;
    }

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
  }, [router]);

  useEffect(() => {
    if (currentLocationRequestedRef.current) {
      return;
    }

    currentLocationRequestedRef.current = true;
    void detectCurrentLocation({ silent: true });
    // GPS permission should be requested once per page session, not on every helper identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const raw = window.localStorage.getItem(RECENT_PLACES_STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as RecentPlace[];
      if (Array.isArray(parsed)) {
        setRecentPlaces(parsed.slice(0, 5));
      }
    } catch {
      window.localStorage.removeItem(RECENT_PLACES_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const raw = window.localStorage.getItem(SAVED_PLACES_STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as SavedPlace[];
      if (Array.isArray(parsed)) {
        setSavedPlaces(parsed);
      }
    } catch {
      window.localStorage.removeItem(SAVED_PLACES_STORAGE_KEY);
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
  const pickupPinned = parseCoordinate(pickupLat) != null && parseCoordinate(pickupLng) != null;
  const dropPinned = parseCoordinate(dropLat) != null && parseCoordinate(dropLng) != null;
  const pricingReviewRequired =
    step === 3 && estimatedDistance != null && !quoteLoading && !quote && Boolean(quoteError);
  const customerQuoteBadge =
    quote
      ? formatMoney(quote.totalPrice, quote.currency)
      : quoteLoading
        ? 'Preparing rate'
        : pricingReviewRequired
          ? 'Rate under review'
          : 'Free map route';
  const customerQuotePillLabel = quote ? 'Quote' : pricingReviewRequired ? 'Rate status' : 'Route';
  const customerQuotePillValue = quote
    ? formatMoney(quote.totalPrice, quote.currency)
    : quoteLoading
      ? 'Preparing'
      : pricingReviewRequired
        ? 'Under review'
        : estimatedDistance != null
          ? `${estimatedDistance} km`
          : 'Route needed';

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
    const supportedCountry = result.countryCode?.trim().toUpperCase() ?? 'KE';
    const localityType: LocalityRateType = supportedCountry === 'KE' ? result.localityType : 'ANY';
    const county = supportedCountry === 'KE' ? result.county ?? '' : '';

    setPricingCountryCode(supportedCountry);
    setPricingCounty(county);
    setPricingAreaType(localityType);
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

  function buildCoordinateFallback(latitude: number, longitude: number): GeocodeLookup {
    const latText = latitude.toFixed(6);
    const lngText = longitude.toFixed(6);

    return {
      address: `Current location (${latText}, ${lngText})`,
      latitude: latText,
      longitude: lngText,
      countryCode: null,
      countryName: null,
      county: null,
      localityType: 'ANY',
    };
  }

  function locationErrorMessage(error: unknown) {
    const code =
      typeof error === 'object' && error && 'code' in error
        ? Number((error as { code?: number }).code)
        : null;

    if (code === 1) {
      return {
        status: 'denied' as CurrentLocationStatus,
        message: 'Location permission was denied. Search pickup manually or move the pin on the map.',
      };
    }

    if (code === 2) {
      return {
        status: 'unavailable' as CurrentLocationStatus,
        message: 'Current location is unavailable right now. Search pickup manually.',
      };
    }

    if (code === 3) {
      return {
        status: 'error' as CurrentLocationStatus,
        message: 'Location detection timed out. Search pickup manually or try again.',
      };
    }

    return {
      status: 'error' as CurrentLocationStatus,
      message: 'Unable to detect current location. Search pickup manually instead.',
    };
  }

  async function detectCurrentLocation({ silent = false } = {}) {
    if (typeof window === 'undefined' || !window.navigator?.geolocation) {
      setCurrentLocationStatus('unavailable');
      setCurrentLocationMessage('Current location is not available in this browser.');
      return null;
    }

    setCurrentLocationStatus('loading');
    if (!silent) {
      setSearchError(null);
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        window.navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        });
      });

      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      const accuracy = Number.isFinite(position.coords.accuracy)
        ? Math.round(position.coords.accuracy)
        : null;

      let lookup: GeocodeLookup;
      try {
        lookup = await reverseGeocodeCoordinates(latitude, longitude);
      } catch {
        lookup = buildCoordinateFallback(latitude, longitude);
      }

      const candidate: CurrentLocationCandidate = {
        ...lookup,
        accuracy,
      };

      setCurrentLocation(candidate);
      setCurrentLocationStatus('ready');
      setCurrentLocationMessage(
        accuracy ? `Detected with about ${accuracy}m accuracy.` : 'Current location detected.',
      );
      return candidate;
    } catch (caught) {
      const next = locationErrorMessage(caught);
      setCurrentLocationStatus(next.status);
      setCurrentLocationMessage(next.message);
      if (!silent) {
        setSearchError(next.message);
      }
      return null;
    }
  }

  function saveRecentPlace(result: GeocodeLookup) {
    const nextItem: RecentPlace = {
      id: `${result.latitude}:${result.longitude}`,
      label: buildPlaceLabel(result.address),
      address: result.address,
      latitude: result.latitude,
      longitude: result.longitude,
      countryCode: result.countryCode,
      county: result.county,
      localityType: result.localityType,
    };

    setRecentPlaces((current) => {
      const nextPlaces = [
        nextItem,
        ...current.filter(
          (item) =>
            item.id !== nextItem.id &&
            item.address.trim().toLowerCase() !== nextItem.address.trim().toLowerCase(),
        ),
      ].slice(0, 5);

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(RECENT_PLACES_STORAGE_KEY, JSON.stringify(nextPlaces));
      }

      return nextPlaces;
    });
  }

  function focusRouteMap(kind: StopKind) {
    setStep(1);
    setActiveStopSelection(kind);
    routePickerRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }

  function openLocationSearch(kind: StopKind) {
    setStep(1);
    setSearchError(null);
    setSearchLoading(false);
    setSearchSheetStop(kind);
    setSearchQuery(kind === 'pickup' ? pickupAddress : dropAddress);
  }

  function closeLocationSearch() {
    setSearchSheetStop(null);
    setSearchLoading(false);
    setSearchError(null);
  }

  async function handleLocationSearch(kind: StopKind) {
    if (!searchQuery.trim()) {
      setSearchError(`Enter a ${kind === 'pickup' ? 'pickup' : 'drop-off'} location first.`);
      return;
    }

    setSearchLoading(true);
    setSearchError(null);

    try {
      const result = await geocodeAddress(searchQuery);
      applyGeocode(kind, result);
      saveRecentPlace(result);
      setActiveStopSelection(kind);
      closeLocationSearch();
      routePickerRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    } catch (caught) {
      setSearchError(
        caught instanceof Error
          ? caught.message
          : 'Location search is unavailable right now. Try again or use move pin.',
      );
    } finally {
      setSearchLoading(false);
    }
  }

  async function handleUseCurrentLocation(kind: StopKind) {
    setLocatingStop(kind);

    try {
      const result = currentLocation ?? await detectCurrentLocation();
      if (!result) {
        return;
      }

      applyGeocode(kind, result);
      saveRecentPlace(result);
      setActiveStopSelection(kind);
      closeLocationSearch();
      routePickerRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    } catch (caught) {
      setSearchError(
        caught instanceof Error
          ? caught.message
          : 'Unable to use current location right now. Search the location manually instead.',
      );
    } finally {
      setLocatingStop((current) => (current === kind ? null : current));
    }
  }

  async function handleMapPinSelection(kind: StopKind, latitude: number, longitude: number) {
    setError(null);
    setResolvingMapStop(kind);

    const latText = latitude.toFixed(6);
    const lngText = longitude.toFixed(6);

    if (kind === 'pickup') {
      setPickupLat(latText);
      setPickupLng(lngText);
    } else {
      setDropLat(latText);
      setDropLng(lngText);
    }

    try {
      const result = await reverseGeocodeCoordinates(latitude, longitude);
      applyGeocode(kind, result);
      saveRecentPlace(result);
    } catch (caught) {
      if (kind === 'pickup') {
        setPickupAddress((current) => current.trim() || `${latText}, ${lngText}`);
      } else {
        setDropAddress((current) => current.trim() || `${latText}, ${lngText}`);
      }

      setError(
        caught instanceof Error
          ? `${caught.message} The pin was still saved, so refine the address manually below.`
          : 'The map pin was saved, but the address lookup failed. Refine the address manually below.',
      );
    } finally {
      setResolvingMapStop((current) => (current === kind ? null : current));
    }

    if (kind === 'pickup') {
      setActiveStopSelection('drop');
      return;
    }

    setActiveStopSelection('pickup');
  }

  async function ensureRouteCoordinates() {
    const hasPickup = parseCoordinate(pickupLat) != null && parseCoordinate(pickupLng) != null;
    const hasDrop = parseCoordinate(dropLat) != null && parseCoordinate(dropLng) != null;

    if (!hasPickup || !hasDrop) {
      setError('Search and confirm both pickup and drop-off locations before continuing.');
      return false;
    }

    return true;
  }

  function handleSelectRecentPlace(kind: StopKind, place: RecentPlace) {
    applyGeocode(kind, {
      address: place.address,
      latitude: place.latitude,
      longitude: place.longitude,
      countryCode: place.countryCode,
      countryName: null,
      county: place.county,
      localityType: place.localityType,
    });
    setActiveStopSelection(kind);
    closeLocationSearch();
    routePickerRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }

  function saveNamedPlace(label: (typeof SAVED_PLACE_LABELS)[number], kind: StopKind) {
    const source =
      kind === 'pickup'
        ? {
            address: pickupAddress,
            latitude: pickupLat,
            longitude: pickupLng,
            countryCode: pricingCountryCode,
            county: pricingCounty || null,
            localityType: pricingAreaType,
          }
        : {
            address: dropAddress,
            latitude: dropLat,
            longitude: dropLng,
            countryCode: null,
            county: null,
            localityType: 'ANY' as const,
          };

    if (!source.address.trim() || !source.latitude || !source.longitude) {
      return;
    }

    const nextPlace: SavedPlace = {
      id: `${label.toLowerCase()}-${kind}`,
      label,
      address: source.address,
      latitude: source.latitude,
      longitude: source.longitude,
      countryCode: source.countryCode,
      county: source.county,
      localityType: source.localityType,
    };

    setSavedPlaces((current) => {
      const nextPlaces = [
        nextPlace,
        ...current.filter((place) => place.label !== label),
      ].slice(0, 6);

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(SAVED_PLACES_STORAGE_KEY, JSON.stringify(nextPlaces));
      }

      return nextPlaces;
    });
  }

  function handleSelectSavedPlace(kind: StopKind, place: SavedPlace) {
    applyGeocode(kind, {
      address: place.address,
      latitude: place.latitude,
      longitude: place.longitude,
      countryCode: place.countryCode,
      countryName: null,
      county: place.county,
      localityType: place.localityType,
    });
    setActiveStopSelection(kind);
    closeLocationSearch();
    routePickerRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }

  async function handleSelectPopularPlace(kind: StopKind, address: string) {
    setSearchQuery(address);
    setSearchLoading(true);
    setSearchError(null);

    try {
      const result = await geocodeAddress(address);
      applyGeocode(kind, result);
      saveRecentPlace(result);
      setActiveStopSelection(kind);
      closeLocationSearch();
      routePickerRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    } catch (caught) {
      setSearchError(
        caught instanceof Error
          ? caught.message
          : 'Unable to use that popular location right now. Try manual search.',
      );
    } finally {
      setSearchLoading(false);
    }
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
      const routeReady = await ensureRouteCoordinates();
      if (!routeReady) {
        return;
      }

      if (!pickupAddress.trim() || !dropAddress.trim()) {
        setError('Refine both stop addresses after placing the map pins before continuing.');
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

    if (
      !pickupContactName.trim() ||
      !pickupContactPhone.trim() ||
      !dropContactName.trim() ||
      !dropContactPhone.trim()
    ) {
      setSaving(false);
      setError('Add both pickup and drop-off contact details before confirming the booking.');
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
      {searchSheetStop ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 p-0 backdrop-blur-[2px]">
          <div className="flex max-h-[82vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[34px] border border-white/10 bg-[#07111f] text-white shadow-[0_-24px_80px_rgba(2,6,23,0.42)]">
            <div className="px-5 pt-3">
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/25" />
            </div>
            <div className="flex items-center justify-between gap-4 px-5 pb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-200/70">
                  {searchSheetStop === 'pickup' ? 'Where from?' : 'Where to?'}
                </p>
                <h2 className="mt-1 text-2xl font-black text-white">
                  {searchSheetStop === 'pickup'
                    ? 'Current pickup'
                    : 'Choose destination'}
                </h2>
              </div>
              <button
                type="button"
                className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-slate-100 transition hover:bg-white/16"
                onClick={closeLocationSearch}
              >
                Close
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-5">
              <div className="flex items-center gap-3 rounded-[22px] bg-white px-4 py-4 text-[#101827] shadow-[0_16px_34px_rgba(0,0,0,0.22)]">
                <Search className="h-5 w-5 shrink-0 text-[#64748b]" />
                <input
                  className="min-w-0 flex-1 bg-transparent text-lg font-bold outline-none placeholder:text-[#94a3b8]"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={searchSheetStop === 'pickup' ? 'Search pickup' : 'Where to?'}
                  autoFocus
                />
              </div>

              {searchSheetStop === 'pickup' ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    className="w-full rounded-[22px] bg-white/10 px-4 py-4 text-left transition hover:bg-white/14 disabled:cursor-wait"
                    onClick={() => void handleUseCurrentLocation('pickup')}
                    disabled={locatingStop === 'pickup' || currentLocationStatus === 'loading'}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#2563eb] text-white">
                        <MapPinned className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-200/70">
                          Current Location
                        </p>
                        {currentLocationStatus === 'loading' || locatingStop === 'pickup' ? (
                          <div className="mt-2 space-y-2">
                            <div className="h-4 w-44 animate-pulse rounded-full bg-white/20" />
                            <div className="h-3 w-64 max-w-full animate-pulse rounded-full bg-white/12" />
                          </div>
                        ) : (
                          <>
                            <p className="mt-1 text-base font-bold text-white">
                              Use Current Location
                            </p>
                            <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-300">
                              {currentLocation?.address ?? currentLocationMessage ?? 'Detect nearest pickup point automatically.'}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                  {currentLocationStatus !== 'ready' && currentLocationStatus !== 'loading' && currentLocationMessage ? (
                    <p className="px-1 text-xs leading-5 text-slate-400">
                      {currentLocationMessage}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <button
                type="button"
                className="w-full rounded-[18px] bg-white/8 px-4 py-3 text-left text-sm font-bold text-slate-200 transition hover:bg-white/12"
                onClick={() => {
                  closeLocationSearch();
                  focusRouteMap(searchSheetStop);
                }}
              >
                Adjust pin on map
              </button>

              {savedPlaces.length ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
                      Saved places
                    </p>
                    <p className="mt-1 text-sm text-[#64748b]">
                      One-tap places for repeat routes like home, office, or warehouse.
                    </p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {savedPlaces.map((place) => (
                      <button
                        key={place.id}
                        type="button"
                        className="rounded-[18px] border border-[#d7e0ec] bg-white px-4 py-3 text-left transition hover:border-[#93c5fd] hover:bg-[#f8fbff]"
                        onClick={() => handleSelectSavedPlace(searchSheetStop, place)}
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#1b3f72]">
                          {place.label}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-[#1a1a2e]">{buildPlaceLabel(place.address)}</p>
                        <p className="mt-1 text-xs leading-5 text-[#64748b]">{place.address}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {recentPlaces.length ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
                      Recent places
                    </p>
                    <p className="mt-1 text-sm text-[#64748b]">
                      Reuse a recent location without typing again.
                    </p>
                  </div>

                  <div className="space-y-2">
                    {recentPlaces.map((place) => (
                      <button
                        key={place.id}
                        type="button"
                        className="w-full rounded-[18px] border border-[#d7e0ec] bg-white px-4 py-3 text-left transition hover:border-[#93c5fd] hover:bg-[#f8fbff]"
                        onClick={() => handleSelectRecentPlace(searchSheetStop, place)}
                      >
                        <p className="text-sm font-semibold text-[#1a1a2e]">{place.label}</p>
                        <p className="mt-1 text-xs leading-5 text-[#64748b]">{place.address}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {searchSheetStop === 'pickup' ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
                      Popular pickup areas
                    </p>
                    <p className="mt-1 text-sm text-[#64748b]">
                      Fast-start locations for Nairobi logistics pickups.
                    </p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {POPULAR_PICKUP_LOCATIONS.map((address) => (
                      <button
                        key={address}
                        type="button"
                        className="rounded-[18px] border border-[#d7e0ec] bg-white px-4 py-3 text-left transition hover:border-[#93c5fd] hover:bg-[#f8fbff]"
                        onClick={() => void handleSelectPopularPlace('pickup', address)}
                        disabled={searchLoading}
                      >
                        <p className="text-sm font-semibold text-[#1a1a2e]">{buildPlaceLabel(address)}</p>
                        <p className="mt-1 text-xs leading-5 text-[#64748b]">{address}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {searchError ? (
                <Alert title="Location search issue" variant="danger">
                  {searchError}
                </Alert>
              ) : null}

              <div className="sticky bottom-0 flex flex-wrap gap-3 border-t border-slate-100 bg-white pb-1 pt-4">
                <Button
                  type="button"
                  className="rounded-[14px] px-4 py-3"
                  onClick={() => void handleLocationSearch(searchSheetStop)}
                  disabled={searchLoading}
                >
                  <Search className="mr-2 h-4 w-4" />
                  {searchLoading ? 'Searching...' : 'Search location'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {error ? (
        <Alert title="Booking could not be created" variant="danger">
          {error}
        </Alert>
      ) : null}

      {pricingReviewRequired ? (
        <Alert title="Rate review needed" variant="warning">
          Final pricing will be confirmed by Zito after admin review and any contract or marketplace proposals needed for this trip.
        </Alert>
      ) : null}

      <section className="overflow-hidden rounded-[32px] border border-white/70 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.14)]">
        <div className="relative">
          <RoutePreviewMap
            className="h-[360px]"
            titleBadge={pickupPinned && dropPinned ? 'Route preview' : 'Set your route'}
            statusBadge={customerQuoteBadge}
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

          <div className="absolute left-4 right-4 top-4 flex items-center justify-between gap-3">
            <div className="rounded-full bg-white/95 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#1b3f72] shadow-[0_10px_28px_rgba(15,23,42,0.16)] backdrop-blur">
              Zito Logistics
            </div>
            <div className="rounded-full bg-[#06101f]/90 px-3 py-2 text-right text-white shadow-[0_10px_28px_rgba(15,23,42,0.2)] backdrop-blur">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200/75">
                {customerQuotePillLabel}
              </span>
              <span className="ml-2 text-sm font-extrabold">{customerQuotePillValue}</span>
            </div>
          </div>
        </div>

        <div className="-mt-16 relative rounded-t-[34px] bg-white px-4 pb-5 pt-4 shadow-[0_-16px_38px_rgba(15,23,42,0.12)]">
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[#cbd5e1]" />

          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#64748b]">
                Book a move
              </p>
              <h1 className="mt-1 text-[2rem] font-black leading-tight text-[#101827]">
                Where to?
              </h1>
              <p className="mt-1 text-sm text-[#64748b]">
                Pickup is location-aware. Add your destination, then choose the best service.
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-[26px] bg-[#f8fbff] p-2 shadow-inner">
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-[22px] bg-white px-4 py-4 text-left shadow-[0_12px_28px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(15,23,42,0.12)]"
              onClick={() => openLocationSearch('drop')}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#06101f] text-white">
                <Search className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#64748b]">
                  Destination
                </p>
                <p className="mt-1 truncate text-lg font-black text-[#101827]">
                  {dropAddress || 'Where to?'}
                </p>
              </div>
            </button>

            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                className="flex items-start gap-3 rounded-[20px] px-3 py-3 text-left transition hover:bg-white"
                onClick={() => openLocationSearch('pickup')}
              >
                <span className="mt-1 h-3 w-3 rounded-full bg-[#10b981] shadow-[0_0_0_4px_rgba(16,185,129,0.14)]" />
                <span className="min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-[#64748b]">
                    From
                  </span>
                  <span className="mt-1 line-clamp-2 block text-sm font-semibold text-[#1a1a2e]">
                    {pickupAddress || currentLocation?.address || 'Current Location'}
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="flex items-start gap-3 rounded-[20px] px-3 py-3 text-left transition hover:bg-white"
                onClick={() => openLocationSearch('drop')}
              >
                <span className="mt-1 h-3 w-3 rounded-full bg-[#7c3aed] shadow-[0_0_0_4px_rgba(124,58,237,0.14)]" />
                <span className="min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-[#64748b]">
                    To
                  </span>
                  <span className="mt-1 line-clamp-2 block text-sm font-semibold text-[#1a1a2e]">
                    {dropAddress || 'Search destination'}
                  </span>
                </span>
              </button>
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            <StepChip active={step === 1} done={step > 1} label="Route" onClick={() => setStep(1)} />
            <StepChip active={step === 2} done={step > 2} label="Service" onClick={() => setStep(2)} />
            <StepChip active={step === 3} done={false} label="Confirm" onClick={() => setStep(3)} />
          </div>
        </div>
      </section>

      {step === 1 ? (
        <div className="space-y-4">
          <section className="overflow-hidden rounded-[30px] bg-[#07111f] p-3 shadow-[0_18px_48px_rgba(2,6,23,0.24)]">
            <div className="space-y-4">
              <div className="space-y-4" ref={routePickerRef}>
                <RouteLocationPicker
                  activeStopKind={activeStopSelection}
                  pickup={{
                    lat: parseCoordinate(pickupLat),
                    lng: parseCoordinate(pickupLng),
                  }}
                  drop={{
                    lat: parseCoordinate(dropLat),
                    lng: parseCoordinate(dropLng),
                  }}
                  onSelect={(kind, latitude, longitude) => {
                    void handleMapPinSelection(kind, latitude, longitude);
                  }}
                />

                {pickupPinned && dropPinned ? (
                  <div className="rounded-[24px] bg-white px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="mt-1 text-sm font-semibold text-[#1a1a2e]">
                          {estimatedDistance != null
                            ? `${estimatedDistance} km route ready`
                            : 'Route ready'}
                        </p>
                      </div>
                      <span className="rounded-full bg-[#dcfce7] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#15803d]">
                        Pickup and drop confirmed
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[16px] bg-white px-4 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
                          Pickup
                        </p>
                        <p className="mt-1 text-sm font-semibold text-[#1a1a2e]">{pickupAddress}</p>
                      </div>
                      <div className="rounded-[16px] bg-white px-4 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
                          Drop-off
                        </p>
                        <p className="mt-1 text-sm font-semibold text-[#1a1a2e]">{dropAddress}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[24px] bg-white/10 px-4 py-4 text-sm font-semibold text-slate-200">
                    Add pickup and destination to preview the route.
                  </div>
                )}
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-[18px] bg-[#f8faff] p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#dbeafe] text-[#2563eb]">
                        <ArrowUpCircle className="h-4.5 w-4.5" />
                      </div>
                      <div className="mt-2 h-14 w-px bg-[#cbd5e1]" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={[
                            'inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold',
                            pickupPinned ? 'bg-[#dbeafe] text-[#1d4ed8]' : 'bg-[#eef2f7] text-[#64748b]',
                          ].join(' ')}
                        >
                          {pickupPinned ? 'Pickup pin ready' : 'Pin required'}
                        </span>
                        {resolvingMapStop === 'pickup' ? (
                          <span className="inline-flex rounded-full bg-[#fff7ed] px-2.5 py-1 text-[10px] font-semibold text-[#c2410c]">
                            Resolving address...
                          </span>
                        ) : null}
                      </div>

                      <Input
                        label="Pickup address"
                        tone="light"
                        value={pickupAddress}
                        onChange={(event) => setPickupAddress(event.target.value)}
                        placeholder="Search pickup first, then refine the address if needed"
                        help={
                          pickupPinned
                            ? 'Auto-filled from the selected pickup location. Refine the landmark or building text if needed.'
                            : 'Search pickup first. Use current location or move pin only if the exact gate needs adjustment.'
                        }
                        disabled={!pickupPinned}
                        required
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          className="rounded-[12px] px-3 py-2 text-xs"
                          onClick={() => openLocationSearch('pickup')}
                        >
                          {pickupPinned ? 'Search pickup again' : 'Search pickup'}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          className="rounded-[12px] border border-[#cbd5e1] bg-white px-3 py-2 text-xs text-[#1b3f72] shadow-none hover:bg-[#eef4ff]"
                          onClick={() => focusRouteMap('pickup')}
                        >
                          {pickupPinned ? 'Adjust pickup pin' : 'Move pin on map'}
                        </Button>
                        {pickupPinned ? (
                          <>
                            {SAVED_PLACE_LABELS.map((label) => (
                              <button
                                key={label}
                                type="button"
                                className="rounded-full border border-[#cbd5e1] bg-white px-3 py-2 text-[11px] font-semibold text-[#1b3f72] transition hover:bg-[#eef4ff]"
                                onClick={() => saveNamedPlace(label, 'pickup')}
                              >
                                Save as {label}
                              </button>
                            ))}
                          </>
                        ) : null}
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
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={[
                            'inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold',
                            dropPinned ? 'bg-[#ede9fe] text-[#7c3aed]' : 'bg-[#eef2f7] text-[#64748b]',
                          ].join(' ')}
                        >
                          {dropPinned ? 'Drop pin ready' : 'Pin required'}
                        </span>
                        {resolvingMapStop === 'drop' ? (
                          <span className="inline-flex rounded-full bg-[#fff7ed] px-2.5 py-1 text-[10px] font-semibold text-[#c2410c]">
                            Resolving address...
                          </span>
                        ) : null}
                      </div>

                      <Input
                        label="Drop-off address"
                        tone="light"
                        value={dropAddress}
                        onChange={(event) => setDropAddress(event.target.value)}
                        placeholder="Search drop-off first, then refine the address if needed"
                        help={
                          dropPinned
                            ? 'Auto-filled from the selected drop-off location. Refine the landmark or building text if needed.'
                            : 'Search drop-off first. Use move pin only if the exact gate needs adjustment.'
                        }
                        disabled={!dropPinned}
                        required
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          className="rounded-[12px] px-3 py-2 text-xs"
                          onClick={() => openLocationSearch('drop')}
                        >
                          {dropPinned ? 'Search drop-off again' : 'Search drop-off'}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          className="rounded-[12px] border border-[#cbd5e1] bg-white px-3 py-2 text-xs text-[#1b3f72] shadow-none hover:bg-[#eef4ff]"
                          onClick={() => focusRouteMap('drop')}
                        >
                          {dropPinned ? 'Adjust drop pin' : 'Move pin on map'}
                        </Button>
                        {dropPinned ? (
                          <>
                            {SAVED_PLACE_LABELS.map((label) => (
                              <button
                                key={label}
                                type="button"
                                className="rounded-full border border-[#cbd5e1] bg-white px-3 py-2 text-[11px] font-semibold text-[#1b3f72] transition hover:bg-[#eef4ff]"
                                onClick={() => saveNamedPlace(label, 'drop')}
                              >
                                Save as {label}
                              </button>
                            ))}
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <CustomerAiAssistant
            compact
            screenContext="CUSTOMER_BOOKING"
            title="Need help with this booking step?"
            description="Ask about pickup search, drop-off search, route confirmation, vehicle choice, or how customer-owned fleet booking works. Zito Assistant explains the procedure without exposing pricing logic."
            quickActions={bookingAiQuickActions}
            placeholder="Example: How should I confirm pickup and drop-off before I choose a vehicle?"
            helpText="Ask only about customer booking procedure, route setup, quote next steps, or owned-fleet booking."
          />
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <section className="rounded-[22px] border border-[#d7e0ec] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
              Service lane
            </p>
            <h2 className="mt-1 text-2xl font-black text-[#101827]">Choose your move</h2>
            <p className="mt-1 text-sm leading-6 text-[#64748b]">
              Pick the lane that matches your cargo. Pricing and dispatch rules stay tied to the selected route.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {serviceCards.map((item) => {
                const active = item.value === serviceType;
                const Icon = item.icon;
                return (
                  <button
                    key={item.value}
                    type="button"
                    className={[
                      'group rounded-[24px] border px-4 py-4 text-left transition hover:-translate-y-0.5',
                      active
                        ? 'border-transparent bg-[#06101f] text-white shadow-[0_18px_42px_rgba(6,16,31,0.22)]'
                        : 'border-[#dbe4ef] bg-[#f8fbff] text-[#1a1a2e] hover:border-[#93c5fd] hover:bg-white hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)]',
                    ].join(' ')}
                    onClick={() => {
                      if (item.value === 'WAREHOUSE') {
                        router.push('/customer/warehouse');
                        return;
                      }
                      setServiceType(item.value);
                      setVehicleType(item.suggestedVehicleType);
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span
                        className={[
                          'flex h-12 w-12 items-center justify-center rounded-[18px]',
                          active ? 'bg-white/12 text-cyan-100' : 'bg-white text-[#1b3f72] shadow-sm',
                        ].join(' ')}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <span
                        className={[
                          'rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em]',
                          active ? 'bg-cyan-300/16 text-cyan-100' : 'bg-[#eef4ff] text-[#1b3f72]',
                        ].join(' ')}
                      >
                        {vehicleMeta[item.suggestedVehicleType]?.eta ?? 'Ready'}
                      </span>
                    </div>
                    <p className="mt-4 text-lg font-black">{item.label}</p>
                    <p className={['mt-1 text-xs leading-5', active ? 'text-slate-300' : 'text-[#64748b]'].join(' ')}>
                      {item.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-[22px] border border-[#d7e0ec] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
              Vehicle cards
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[#1a1a2e]">Choose the best vehicle for this route</h2>
            <p className="mt-1 text-sm leading-6 text-[#64748b]">
              Compare capacity, route fit, and dispatch speed quickly. The review step shows either the final quote or the rate-review status for this trip.
            </p>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {availableVehicleTypes.map((option) => {
                  const meta = vehicleMeta[option];
                  const active = option === vehicleType;
                  const recommended = option === selectedService.suggestedVehicleType;
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
                      'relative flex w-full flex-col items-start gap-3 rounded-[18px] border px-4 py-4 text-left transition',
                      active
                        ? 'border-[#1b3f72] bg-[linear-gradient(180deg,#eef6ff_0%,#ffffff_100%)] shadow-[0_12px_30px_rgba(27,63,114,0.10)]'
                        : 'border-[#e2e8f0] bg-[#f8faff] hover:border-[#b8c9e4] hover:bg-white',
                    ].join(' ')}
                    onClick={() => setVehicleType(option)}
                  >
                    <div className="flex w-full items-start justify-between gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-white text-[#1b3f72] shadow-sm">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        {recommended ? (
                          <span className="inline-flex rounded-full bg-[#dcfce7] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#15803d]">
                            Recommended
                          </span>
                        ) : null}
                        {active ? (
                          <span className="inline-flex rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
                            Selected
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <p className="text-base font-semibold text-[#1a1a2e]">
                        {meta?.label ?? option.replaceAll('_', ' ')}
                      </p>
                      <p className="mt-1 text-[12px] text-[#64748b]">
                        {meta?.capacity ?? 'Vehicle match for this route.'}
                      </p>
                    </div>

                    <div className="grid w-full grid-cols-2 gap-2">
                      <div className="rounded-[14px] bg-white px-3 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">
                          Dispatch
                        </p>
                        <p className="mt-1 text-sm font-semibold text-[#1b3f72]">{meta?.eta ?? 'Route matched'}</p>
                      </div>
                      <div className="rounded-[14px] bg-white px-3 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">
                          Best use
                        </p>
                        <p className="mt-1 text-sm font-semibold text-[#1a1a2e]">{selectedService.label}</p>
                      </div>
                    </div>

                    <p className="text-xs leading-5 text-[#64748b]">
                      {meta?.note ?? 'Recommended option for this service lane.'}
                    </p>
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
          <section className="overflow-hidden rounded-[26px] border border-transparent bg-[linear-gradient(135deg,#06101f_0%,#0f1b31_100%)] p-5 text-white shadow-[0_12px_30px_rgba(6,16,31,0.22)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200/72">
                  Final review
                </p>
                <h2 className="mt-1 text-2xl font-bold leading-tight">Review your trip before you confirm</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                  Check the route, selected vehicle, and contact details. You can still edit the route or vehicle before creating the booking.
                </p>
              </div>

              <div className="rounded-[20px] bg-white/8 px-4 py-4 text-right shadow-[0_10px_30px_rgba(15,23,42,0.16)] backdrop-blur">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200/72">
                  {quote ? 'Estimated quote' : 'Rate status'}
                </p>
                <p className="mt-2 text-3xl font-extrabold">
                  {quote
                    ? formatMoney(quote.totalPrice, quote.currency)
                    : quoteLoading
                      ? 'Preparing...'
                      : pricingReviewRequired
                        ? 'Under review'
                        : 'Awaiting route'}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  {pricingReviewRequired
                    ? 'Admin will confirm the final rate from contract terms or marketplace proposals.'
                    : estimatedDistance != null
                      ? `${estimatedDistance} km route`
                      : 'Add both stops to prepare the booking.'}
                </p>
                {quote?.baseCurrencyQuote && quote.baseCurrencyQuote.currency !== quote.currency ? (
                  <p className="mt-2 text-xs text-slate-400">
                    Base KES quote: {formatMoney(quote.baseCurrencyQuote.totalPrice, quote.baseCurrencyQuote.currency)}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-[18px] border border-white/10 bg-white/8 px-4 py-4 backdrop-blur">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200/72">
                  Service lane
                </p>
                <p className="mt-1 text-base font-semibold">{selectedService.label}</p>
                <p className="mt-1 text-xs leading-5 text-slate-300">
                  {selectedService.description}
                </p>
              </div>
              <div className="rounded-[18px] border border-white/10 bg-white/8 px-4 py-4 backdrop-blur">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200/72">
                  Selected vehicle
                </p>
                <p className="mt-1 text-base font-semibold">{selectedVehicle.label}</p>
                <p className="mt-1 text-xs leading-5 text-slate-300">
                  {selectedVehicle.eta} · {selectedVehicle.capacity}
                </p>
              </div>
              <div className="rounded-[18px] border border-white/10 bg-white/8 px-4 py-4 backdrop-blur">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200/72">
                  Booking confidence
                </p>
                <p className="mt-1 text-base font-semibold">
                  {pricingReviewRequired ? 'Route ready for rate review' : 'Route and quote ready'}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-300">
                  {pricingReviewRequired
                    ? 'We’ll use the confirmed route, then let admin and approved supply confirm the final rate before dispatch.'
                    : 'We’ll use the confirmed route, then coordinate the pickup and drop-off using the contacts below.'}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[22px] border border-[#d7e0ec] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
                  Route summary
                </p>
                <h2 className="mt-1 text-lg font-semibold text-[#1a1a2e]">Stops and service</h2>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="rounded-[12px] border border-[#cbd5e1] bg-white px-3 py-2 text-xs text-[#1b3f72] shadow-none hover:bg-[#eef4ff]"
                  onClick={() => setStep(1)}
                >
                  Edit route
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="rounded-[12px] border border-[#cbd5e1] bg-white px-3 py-2 text-xs text-[#1b3f72] shadow-none hover:bg-[#eef4ff]"
                  onClick={() => setStep(2)}
                >
                  Change vehicle
                </Button>
              </div>
            </div>

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

            <div className="mt-4 rounded-[16px] border border-[#d7e0ec] bg-[#f8fbff] px-4 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
                What happens next
              </p>
              <p className="mt-2 text-sm leading-6 text-[#475569]">
                {pricingReviewRequired
                  ? 'After you send this request, Zito will review contract terms or marketplace proposals, confirm the final rate, and then move the trip toward assignment.'
                  : 'After you confirm, Zito will create the booking reference, prepare assignment, and move you to live tracking once the trip is active.'}
              </p>
            </div>
          </section>

          <section className="rounded-[22px] border border-[#d7e0ec] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
              Stop contacts
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[#1a1a2e]">Who should we reach at each stop?</h2>
            <p className="mt-1 text-sm leading-6 text-[#64748b]">
              Add the pickup and receiver contacts after the route is confirmed so the early booking flow stays simple.
            </p>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-[18px] bg-[#f8faff] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
                  Pickup contact
                </p>
                <div className="mt-3 grid gap-3">
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
                    placeholder="+254..."
                    required
                  />
                </div>
              </div>

              <div className="rounded-[18px] bg-[#f8faff] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
                  Drop-off contact
                </p>
                <div className="mt-3 grid gap-3">
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
                    placeholder="+254..."
                    required
                  />
                </div>
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

              <div className="rounded-[18px] border border-[#d7e0ec] bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_100%)] px-4 py-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#1b3f72] shadow-sm">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#1a1a2e]">Final confirmation</p>
                    <p className="mt-1 text-sm leading-6 text-[#475569]">
                      {pricingReviewRequired
                        ? 'Review the route, stop contacts, and selected vehicle before sending this booking for final rate confirmation.'
                        : 'Review the route, stop contacts, selected vehicle, and quote before creating the booking.'}
                    </p>
                  </div>
                </div>
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
                ? 'Confirm the route.'
                : step === 2
                  ? 'Choose the best vehicle.'
                  : pricingReviewRequired
                    ? 'Add contacts and send for rate review.'
                    : 'Add contacts and create the booking.'}
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
                {step === 1 ? 'Confirm route' : 'Review booking'}
              </Button>
            ) : (
              <Button disabled={saving} type="submit" className="rounded-[14px] px-4">
                {saving
                  ? pricingReviewRequired
                    ? 'Sending...'
                    : 'Creating...'
                  : pricingReviewRequired
                    ? 'Send for rate review'
                    : 'Confirm booking'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
