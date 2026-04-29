export type SessionUser = {
  id: string;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  role: string;
  status?: string | null;
  agencyId?: string | null;
};

export type StoredSession = {
  user: SessionUser;
  accessToken: string;
  refreshToken?: string | null;
};

export type StoredSessionSnapshot = {
  user: SessionUser | null;
  accessToken: string | null;
  refreshToken: string | null;
};

export type PendingRegistration = {
  id: string;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  status?: string | null;
};

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

const ACCESS_TOKEN_KEY = 'zito.accessToken';
const REFRESH_TOKEN_KEY = 'zito.refreshToken';
const USER_KEY = 'zito.user';
const OTP_KEY = 'zito.otpSession';
const PENDING_KEY = 'zito.pendingRegistration';

function canUseStorage() {
  return typeof window !== 'undefined';
}

function normalizePath(path: string) {
  if (!path) return '/';
  return path.startsWith('/') ? path : `/${path}`;
}

export function getApiOrigin() {
  const fallback = 'http://localhost:3000';
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/v1\/?$/i, '').replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined') {
    return window.location.origin.replace(/\/+$/, '');
  }
  return fallback;
}

export function getApiBaseUrl() {
  return `${getApiOrigin()}/api/v1`;
}

export function getStoredSession(): StoredSessionSnapshot {
  if (!canUseStorage()) {
    return { accessToken: null, refreshToken: null, user: null };
  }

  const accessToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  const refreshToken = window.localStorage.getItem(REFRESH_TOKEN_KEY);
  const userRaw = window.localStorage.getItem(USER_KEY);

  return {
    accessToken,
    refreshToken,
    user: userRaw ? JSON.parse(userRaw) as SessionUser : null,
  };
}

export function persistSession(session: StoredSession) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken);
  if (session.refreshToken) {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
  } else {
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
  window.localStorage.setItem(USER_KEY, JSON.stringify(session.user));
}

export function clearSession() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export function persistOtpSession(tempToken: string, contact: string) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(OTP_KEY, JSON.stringify({ tempToken, contact }));
}

export function getOtpSession(): { tempToken: string; contact: string } | null {
  if (!canUseStorage()) return null;
  const value = window.localStorage.getItem(OTP_KEY);
  return value ? JSON.parse(value) as { tempToken: string; contact: string } : null;
}

export function clearOtpSession() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(OTP_KEY);
}

export function persistPendingRegistration(registration: PendingRegistration) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(PENDING_KEY, JSON.stringify(registration));
}

export function getPendingRegistration() {
  if (!canUseStorage()) return null;
  const value = window.localStorage.getItem(PENDING_KEY);
  return value ? JSON.parse(value) as PendingRegistration : null;
}

export function clearPendingRegistration() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(PENDING_KEY);
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  token?: string | null;
  idempotencyKey?: string;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { accessToken } = getStoredSession();
  const token = options.token ?? accessToken;
  const headers = new Headers(options.headers ?? {});
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  if (!isFormData) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (options.idempotencyKey) {
    headers.set('X-Idempotency-Key', options.idempotencyKey);
  }

  const response = await fetch(`${getApiBaseUrl()}${normalizePath(path)}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body == null
      ? undefined
      : isFormData
        ? options.body as FormData
        : JSON.stringify(options.body),
    cache: 'no-store',
  });

  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = typeof payload === 'object' && payload && 'message' in payload
      ? String((payload as { message?: string }).message ?? 'Request failed')
      : 'Request failed';
    throw new ApiError(message, response.status, payload);
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PUT', body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};
