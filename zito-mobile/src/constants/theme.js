import { customerTheme } from './themes/customer';
import { partnerTheme } from './themes/partner';
import { adminTheme } from './themes/admin';

// Get app flavor from environment variable
const APP_FLAVOR = process.env.EXPO_PUBLIC_APP_FLAVOR || 'customer';

// Get theme for current app
const getAppTheme = () => {
  switch (APP_FLAVOR) {
    case 'partner':
      return partnerTheme;
    case 'admin':
      return adminTheme;
    case 'customer':
    default:
      return customerTheme;
  }
};

const appTheme = getAppTheme();

export const colors = {
  primary: appTheme.primary,
  primaryDark: appTheme.primaryDark,
  primarySoft: appTheme.primarySoft,
  bg: '#050914',
  bgCard: '#0c1424',
  bgElevated: '#101b31',
  bgInput: '#0f1a30',
  tabBar: '#08101d',
  border: 'rgba(95,128,255,0.2)',
  text: '#f4f8ff',
  textMuted: '#9eb0ce',
  textFaint: '#677a9d',
  success: '#22c55e',
  danger: '#f45d73',
  warning: '#f59e0b',
  info: '#38bdf8',
  teal: '#22d3ee',
  purple: '#8b5cf6',
  gold: '#c9962f',
};

export const STATUS_COLORS = {
  pending: { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  broadcasted: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)' },
  bidding: { color: '#6366f1', bg: 'rgba(99,102,241,0.15)' },
  approved: { color: '#0ea5e9', bg: 'rgba(14,165,233,0.15)' },
  assigned: { color: '#6366f1', bg: 'rgba(99,102,241,0.15)' },
  accepted: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)' },
  picked_up: { color: '#f97316', bg: 'rgba(249,115,22,0.15)' },
  in_transit: { color: '#22d3ee', bg: 'rgba(34,211,238,0.15)' },
  delivered: { color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
  payment_pending: { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  completed: { color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  cancelled: { color: '#f45d73', bg: 'rgba(244,93,115,0.15)' },
  rejected: { color: '#f45d73', bg: 'rgba(244,93,115,0.12)' },
};

// PRD Section 7.12 - Default vehicle pricing.
export const VEHICLE_TYPES = [
  { key: 'motorcycle', label: 'Motorcycle (Boda)', capacity: '30 kg', base: 200, perKm: 15, icon: 'motorbike', maxKg: 30 },
  { key: 'pickup', label: 'Pickup Truck', capacity: '1,500 kg', base: 1000, perKm: 50, icon: 'pickup-truck', maxKg: 1500 },
  { key: 'van', label: 'Van / Minivan', capacity: '1,200 kg', base: 1500, perKm: 60, icon: 'van-passenger', maxKg: 1200 },
  { key: 'light_truck', label: 'Light Truck', capacity: '4,000 kg', base: 3000, perKm: 80, icon: 'truck-outline', maxKg: 4000 },
  { key: 'heavy_truck', label: 'Heavy Truck', capacity: '20,000 kg', base: 8000, perKm: 150, icon: 'truck-trailer-outline', maxKg: 20000 },
];

// PRD Section 7.13 - Price estimation with surcharges.
export function estimatePrice(vehicleKey, weightKg = 0, distanceKm = 20) {
  const vehicle = VEHICLE_TYPES.find((type) => type.key === vehicleKey);
  if (!vehicle) return 0;

  let price = vehicle.base + vehicle.perKm * distanceKm;
  if (weightKg > vehicle.maxKg * 0.8) price *= 1.2;

  const hour = new Date().getHours();
  if (hour >= 22 || hour < 6) price *= 1.15;

  return Math.round(price);
}

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL || 'https://zito-backend.vercel.app';

export const APP_ENV = process.env.EXPO_PUBLIC_APP_ENV || 'development';
