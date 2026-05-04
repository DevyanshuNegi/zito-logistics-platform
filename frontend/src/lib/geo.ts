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
};

export async function geocodeAddress(address: string): Promise<GeocodeLookup> {
  const query = address.trim();
  if (!query) {
    throw new Error('Address is required before it can be pinned on the map.');
  }

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`,
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
  }>;

  const match = matches[0];
  if (!match?.lat || !match?.lon) {
    throw new Error('No map result found for that address yet. Try a clearer area or landmark.');
  }

  return {
    address: match.display_name?.trim() || query,
    latitude: match.lat,
    longitude: match.lon,
  };
}
