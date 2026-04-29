import {
  DEFAULT_APP_LOCALE,
  LOCALE_FORMAT_MAP,
  PREFERENCES_STORAGE_KEY,
  type AppLocale,
} from './i18n';

function resolveLocale() {
  if (typeof window === 'undefined') {
    return LOCALE_FORMAT_MAP[DEFAULT_APP_LOCALE];
  }

  try {
    const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) {
      return LOCALE_FORMAT_MAP[DEFAULT_APP_LOCALE];
    }

    const parsed = JSON.parse(raw) as { language?: AppLocale };
    return parsed.language ? LOCALE_FORMAT_MAP[parsed.language] ?? LOCALE_FORMAT_MAP[DEFAULT_APP_LOCALE] : LOCALE_FORMAT_MAP[DEFAULT_APP_LOCALE];
  } catch {
    return LOCALE_FORMAT_MAP[DEFAULT_APP_LOCALE];
  }
}

export function formatMoney(value?: number | null, currency = 'KES') {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat(resolveLocale(), {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatDateTime(value?: string | Date | null) {
  if (!value) return 'Not available';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Invalid date';
  return new Intl.DateTimeFormat(resolveLocale(), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatStatus(value?: string | null) {
  if (!value) return 'Unknown';
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function formatPercent(value?: number | null, digits = 1) {
  const amount = Number(value ?? 0);
  return `${(Number.isFinite(amount) ? amount : 0).toFixed(digits)}%`;
}

export function compactId(value?: string | null) {
  if (!value) return 'N/A';
  return value.length <= 12 ? value : `${value.slice(0, 8)}...`;
}
