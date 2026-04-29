export function formatMoney(value?: number | null, currency = 'KES') {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatDateTime(value?: string | Date | null) {
  if (!value) return 'Not available';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Invalid date';
  return new Intl.DateTimeFormat('en-KE', {
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

export function compactId(value?: string | null) {
  if (!value) return 'N/A';
  return value.length <= 12 ? value : `${value.slice(0, 8)}...`;
}
