/**
 * Complete theme configuration
 * This is self-contained with no external dependencies to prevent import errors
 */

// Theme colors - COMPLETE AND ALWAYS AVAILABLE
const themeColors = {
  // Brand colors (defaults to customer blue)
  primary: '#0066FF',
  primaryDark: '#0052CC',
  primarySoft: 'rgba(0,102,255,0.14)',
  
  // Background colors
  bg: '#050914',
  bgCard: '#0c1424',
  bgElevated: '#101b31',
  bgInput: '#0f1a30',
  tabBar: '#08101d',
  
  // Borders and text
  border: 'rgba(95,128,255,0.2)',
  text: '#f4f8ff',
  textMuted: '#9eb0ce',
  textFaint: '#677a9d',
  
  // Status colors
  success: '#22c55e',
  danger: '#f45d73',
  warning: '#f59e0b',
  info: '#38bdf8',
  teal: '#22d3ee',
  purple: '#8b5cf6',
  gold: '#c9962f',
};

// Export colors directly
export const colors = themeColors;

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

// Backend API URL - can be overridden via EXPO_PUBLIC_API_URL env variable
// For local development: http://192.168.x.x:5000/api/v1 (use your machine's local IP)
// For production: https://api.zito.app/api/v1
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

export const APP_ENV = process.env.EXPO_PUBLIC_APP_ENV || 'development';

/**
 * Modern Design System Tokens
 * Used for consistent spacing, shadows, typography, and styling
 */

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};

export const typography = {
  display: {
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 40,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  body: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  bodyBold: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
  },
};

export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1.0,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 4.65,
    elevation: 4,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 6.27,
    elevation: 8,
  },
};
