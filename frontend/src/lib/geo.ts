import { KENYA_COUNTIES } from './location-pricing';

export function estimateDistanceKm(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(endLat - startLat);
  const dLng = toRadians(endLng - startLng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(startLat)) *
      Math.cos(toRadians(endLat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((earthRadiusKm * c).toFixed(2));
}

export function parseCoordinate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export type GeocodeLookup = {
  address: string;
  latitude: string;
  longitude: string;
  countryCode: string | null;
  countryName: string | null;
  county: string | null;
  localityType: 'ANY' | 'TOWN' | 'RURAL';
};

type NominatimAddress = Partial<
  Record<
    | 'country_code'
    | 'country'
    | 'state'
    | 'county'
    | 'region'
    | 'state_district'
    | 'city'
    | 'town'
    | 'municipality'
    | 'village'
    | 'hamlet'
    | 'suburb'
    | 'borough'
    | 'quarter'
    | 'city_district'
    | 'neighbourhood'
    | 'residential'
    | 'commercial'
    | 'farm'
    | 'isolated_dwelling',
    string
  >
>;

function normalizeLookupValue(value: string) {
  return value
    .toLowerCase()
    .replace(/\bcounty\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function findKenyaCounty(address: NominatimAddress) {
  const countyCandidates = [
    address.county,
    address.state,
    address.region,
    address.state_district,
    address.city_district,
    address.city,
    address.town,
  ].filter((value): value is string => Boolean(value?.trim()));

  for (const candidate of countyCandidates) {
    const normalizedCandidate = normalizeLookupValue(candidate);
    const match = KENYA_COUNTIES.find(
      (county) => normalizeLookupValue(county) === normalizedCandidate,
    );

    if (match) {
      return match;
    }
  }

  return null;
}

function inferLocalityType(address: NominatimAddress): 'ANY' | 'TOWN' | 'RURAL' {
  const urbanSignals = [
    address.city,
    address.town,
    address.municipality,
    address.suburb,
    address.borough,
    address.quarter,
    address.city_district,
    address.neighbourhood,
    address.residential,
    address.commercial,
  ];

  if (urbanSignals.some((value) => Boolean(value?.trim()))) {
    return 'TOWN';
  }

  const ruralSignals = [address.village, address.hamlet, address.farm, address.isolated_dwelling];
  if (ruralSignals.some((value) => Boolean(value?.trim()))) {
    return 'RURAL';
  }

  return 'ANY';
}

export async function geocodeAddress(address: string): Promise<GeocodeLookup> {
  const query = address.trim();
  if (!query) {
    throw new Error('Address is required before it can be pinned on the map.');
  }

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&q=${encodeURIComponent(query)}`,
    {
      headers: {
        Accept: 'application/json',
      },
    },
  );

  if (!response.ok) {
    throw new Error('Free map lookup is unavailable right now. Please try again.');
  }

  const matches = (await response.json()) as Array<{
    display_name?: string;
    lat?: string;
    lon?: string;
    address?: NominatimAddress;
  }>;

  const match = matches[0];
  if (!match?.lat || !match?.lon) {
    throw new Error('No map result found for that address yet. Try a clearer area or landmark.');
  }

  const countryCode = match.address?.country_code?.trim().toUpperCase() || null;
  const localityType = inferLocalityType(match.address ?? {});

  return {
    address: match.display_name?.trim() || query,
    latitude: match.lat,
    longitude: match.lon,
    countryCode,
    countryName: match.address?.country?.trim() || null,
    county: countryCode === 'KE' ? findKenyaCounty(match.address ?? {}) : null,
    localityType,
  };
}
