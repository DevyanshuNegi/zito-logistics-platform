// src/constants/theme.js
export const colors = {
  primary:     '#e8a020',
  primaryDark: '#c4861a',
  bg:          '#0f121c',
  bgCard:      '#181e2d',
  bgInput:     '#111621',
  border:      'rgba(255,255,255,0.08)',
  text:        '#e8eaf2',
  textMuted:   '#8892a4',
  textFaint:   '#545f73',
  success:     '#22c55e',
  danger:      '#ef4444',
  warning:     '#f59e0b',
  info:        '#0ea5e9',
  teal:        '#2dd4bf',
  purple:      '#6366f1',
};

export const STATUS_COLORS = {
  pending:         { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)'  },
  broadcasted:     { color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)' },
  bidding:         { color: '#6366f1', bg: 'rgba(99,102,241,0.15)' },
  approved:        { color: '#0ea5e9', bg: 'rgba(14,165,233,0.15)' },
  assigned:        { color: '#6366f1', bg: 'rgba(99,102,241,0.15)' },
  accepted:        { color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)' },
  picked_up:       { color: '#f97316', bg: 'rgba(249,115,22,0.15)' },
  in_transit:      { color: '#2dd4bf', bg: 'rgba(45,212,191,0.15)' },
  delivered:       { color: '#22c55e', bg: 'rgba(34,197,94,0.15)'  },
  payment_pending: { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  completed:       { color: '#22c55e', bg: 'rgba(34,197,94,0.12)'  },
  cancelled:       { color: '#ef4444', bg: 'rgba(239,68,68,0.15)'  },
  rejected:        { color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
};

// PRD Section 7.12 — Default Vehicle Pricing
export const VEHICLE_TYPES = [
  { key: 'motorcycle',  label: 'Motorcycle (Boda)', capacity: '30 kg',     base: 200,  perKm: 15,  icon: '🛵', maxKg: 30    },
  { key: 'pickup',      label: 'Pickup Truck',      capacity: '1,500 kg',  base: 1000, perKm: 50,  icon: '🛻', maxKg: 1500  },
  { key: 'van',         label: 'Van / Minivan',     capacity: '1,200 kg',  base: 1500, perKm: 60,  icon: '🚐', maxKg: 1200  },
  { key: 'light_truck', label: 'Light Truck',       capacity: '4,000 kg',  base: 3000, perKm: 80,  icon: '🚚', maxKg: 4000  },
  { key: 'heavy_truck', label: 'Heavy Truck',       capacity: '20,000 kg', base: 8000, perKm: 150, icon: '🚛', maxKg: 20000 },
];

// PRD Section 7.13 — Price estimation with surcharges
export function estimatePrice(vehicleKey, weightKg = 0, distanceKm = 20) {
  const v = VEHICLE_TYPES.find(t => t.key === vehicleKey);
  if (!v) return 0;
  let price = v.base + v.perKm * distanceKm;
  if (weightKg > v.maxKg * 0.8) price *= 1.20; // heavy load +20%
  const hour = new Date().getHours();
  if (hour >= 22 || hour < 6) price *= 1.15;    // night +15%
  return Math.round(price);
}

export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://your-railway-backend.railway.app';
