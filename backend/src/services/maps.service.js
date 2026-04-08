// src/services/maps.service.js
// Free map helpers using OpenStreetMap / Nominatim / OSRM (no API key required)
// All network calls are optional; functions gracefully fall back to local
// haversine distance when the external service is unreachable.

const { haversineDistance } = require('../utils/helpers');

// node-fetch v3 is ESM; use dynamic import for CommonJS
const fetchFn = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const OSRM_BASE = 'https://router.project-osrm.org';

const userAgent = 'ZITO-PRD-Test/1.0 (contact: dev@zito.test)';

const geocode = async (query, limit = 5) => {
  if (!query) throw new Error('Query is required');
  const url = `${NOMINATIM_BASE}/search?format=json&q=${encodeURIComponent(query)}&limit=${limit}&addressdetails=1`;
  const res = await fetchFn(url, { headers: { 'User-Agent': userAgent } });
  if (!res.ok) throw new Error(`Geocode failed: ${res.status}`);
  return res.json();
};

const reverseGeocode = async (lat, lng) => {
  if (lat === undefined || lng === undefined) throw new Error('lat and lng are required');
  const url = `${NOMINATIM_BASE}/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
  const res = await fetchFn(url, { headers: { 'User-Agent': userAgent } });
  if (!res.ok) throw new Error(`Reverse geocode failed: ${res.status}`);
  return res.json();
};

const route = async (from, to) => {
  // Try free OSRM first; fall back to haversine ETA
  try {
    const url = `${OSRM_BASE}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false&geometries=polyline&alternatives=false&steps=false`;
    const res = await fetchFn(url, { headers: { 'User-Agent': userAgent } });
    if (!res.ok) throw new Error(`OSRM failed: ${res.status}`);
    const data = await res.json();
    const best = data?.routes?.[0];
    if (!best) throw new Error('No route');
    return {
      distance_km: Number((best.distance / 1000).toFixed(2)),
      duration_min: Number((best.duration / 60).toFixed(1)),
      mode: 'osrm',
    };
  } catch (err) {
    // fallback
    const distKm = haversineDistance(from.lat, from.lng, to.lat, to.lng);
    const durationMin = Number(((distKm / 40) * 60).toFixed(1)); // assume 40 km/h avg
    return { distance_km: Number(distKm.toFixed(2)), duration_min: durationMin, mode: 'haversine_fallback' };
  }
};

module.exports = {
  geocode,
  reverseGeocode,
  route,
};
