import type { LoginMode } from './auth-login';
import {
  getPortalConfig,
  getPortalKindForRole,
  type PortalKind,
} from './auth-portals';

export type SessionUser = {
  id: string;
  fullName?: string | null;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  role: string;
  status?: string | null;
  agencyId?: string | null;
  staffScope?: string | null;
  staffDepartment?: string | null;
  staffAgencyName?: string | null;
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
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  status?: string | null;
};

export type OtpSession = {
  tempToken: string;
  contact: string;
  mode: LoginMode;
  stage?: 'otp' | 'password';
  email?: string | null;
  countryCode?: string | null;
  countryOptionCode?: string | null;
  phoneNumber?: string | null;
  resendAvailableAt?: string | null;
  resendRemaining?: number | null;
  otpExpiresAt?: string | null;
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
const SESSION_NOTICE_KEY = 'zito.sessionNotice';

function canUseStorage() {
  return typeof window !== 'undefined';
}

function normalizePath(path: string) {
  if (!path) return '/';
  return path.startsWith('/') ? path : `/${path}`;
}

export function getApiOrigin() {
  const fallback = 'http://127.0.0.1:3001';
  const deployedBackendFallback = 'https://zito-backend.vercel.app';
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/v1\/?$/i, '').replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname.replace(/\/+$/, '');
    if (
      host.endsWith('.vercel.app') &&
      host !== 'zito-backend.vercel.app'
    ) {
      return deployedBackendFallback;
    }
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
    user: userRaw ? (JSON.parse(userRaw) as SessionUser) : null,
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

export function persistOtpSession(session: OtpSession) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(OTP_KEY, JSON.stringify(session));
}

export function getOtpSession(): OtpSession | null {
  if (!canUseStorage()) return null;
  const value = window.localStorage.getItem(OTP_KEY);
  if (!value) {
    return null;
  }

  const parsed = JSON.parse(value) as Partial<OtpSession> & {
    tempToken?: string;
    contact?: string;
  };
  if (!parsed.tempToken || !parsed.contact) {
    return null;
  }

  return {
    tempToken: parsed.tempToken,
    contact: parsed.contact,
    mode:
      parsed.mode ??
      (parsed.contact.includes('@') ? 'email_otp' : 'phone_otp'),
    stage: parsed.stage === 'password' ? 'password' : 'otp',
    email: parsed.email ?? null,
    countryCode: parsed.countryCode ?? null,
    countryOptionCode: parsed.countryOptionCode ?? null,
    phoneNumber: parsed.phoneNumber ?? null,
    resendAvailableAt: parsed.resendAvailableAt ?? null,
    resendRemaining:
      typeof parsed.resendRemaining === 'number' ? parsed.resendRemaining : null,
    otpExpiresAt: parsed.otpExpiresAt ?? null,
  };
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
  return value ? (JSON.parse(value) as PendingRegistration) : null;
}

export function clearPendingRegistration() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(PENDING_KEY);
}

export function persistSessionNotice(message: string) {
  if (!canUseStorage()) return;
  window.sessionStorage.setItem(SESSION_NOTICE_KEY, message);
}

export function consumeSessionNotice() {
  if (!canUseStorage()) return null;
  const message = window.sessionStorage.getItem(SESSION_NOTICE_KEY);
  if (!message) {
    return null;
  }
  window.sessionStorage.removeItem(SESSION_NOTICE_KEY);
  return message;
}

function isAuthSurface(pathname: string) {
  return (
    pathname === '/login' ||
    pathname.startsWith('/agency/login') ||
    pathname.startsWith('/partners/login') ||
    pathname.startsWith('/internal/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/partners/register') ||
    pathname.startsWith('/select-role') ||
    pathname.startsWith('/partners/select-role')
  );
}

function resolvePortalKindForSession(
  role?: string | null,
  staffScope?: string | null,
): PortalKind {
  return getPortalKindForRole(role ?? null, staffScope ?? null);
}

function handleUnauthorizedSession(message: string) {
  if (typeof window === 'undefined') {
    return;
  }

  const currentPath = window.location.pathname;
  if (isAuthSurface(currentPath)) {
    return;
  }

  const { user } = getStoredSession();
  const portalKind = resolvePortalKindForSession(user?.role, user?.staffScope);
  const loginPath = getPortalConfig(portalKind).loginPath;

  clearSession();
  clearOtpSession();
  persistSessionNotice(message || 'Your session expired. Please sign in again.');

  const nextPath = `${currentPath}${window.location.search ?? ''}`;
  const separator = loginPath.includes('?') ? '&' : '?';
  window.location.replace(
    `${loginPath}${separator}reason=session-expired&next=${encodeURIComponent(nextPath)}`,
  );
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  token?: string | null;
  idempotencyKey?: string;
  retry?:
    | boolean
    | {
        enabled?: boolean;
        attempts?: number;
        baseDelayMs?: number;
        maxDelayMs?: number;
      };
};

type RetryPolicy = {
  enabled: boolean;
  attempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function resolveRetryPolicy(method: NonNullable<RequestOptions['method']>, options: RequestOptions): RetryPolicy {
  const configured =
    typeof options.retry === 'object'
      ? options.retry
      : { enabled: options.retry };
  const retryableByDefault = method === 'GET' || method === 'DELETE';

  return {
    enabled:
      configured.enabled ??
      (retryableByDefault || Boolean(options.idempotencyKey)),
    attempts: Math.max(1, configured.attempts ?? 3),
    baseDelayMs: Math.max(150, configured.baseDelayMs ?? 400),
    maxDelayMs: Math.max(400, configured.maxDelayMs ?? 4000),
  };
}

async function retryInterceptor<T>(
  runner: () => Promise<T>,
  policy: RetryPolicy,
): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      return await runner();
    } catch (error) {
      attempt += 1;

      const retryableError =
        !(error instanceof ApiError) || shouldRetryStatus(error.status);
      if (!policy.enabled || !retryableError || attempt >= policy.attempts) {
        throw error;
      }

      const delay =
        Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** (attempt - 1)) +
        Math.floor(Math.random() * 120);
      await sleep(delay);
    }
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { accessToken } = getStoredSession();
  const token = options.token ?? accessToken;
  const method = options.method ?? 'GET';
  const retryPolicy = resolveRetryPolicy(method, options);

  return retryInterceptor(async () => {
    const headers = new Headers(options.headers ?? {});
    const isFormData =
      typeof FormData !== 'undefined' && options.body instanceof FormData;

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
      method,
      headers,
      body:
        options.body == null
          ? undefined
          : isFormData
            ? (options.body as FormData)
            : JSON.stringify(options.body),
      cache: 'no-store',
    });

    const contentType = response.headers.get('content-type') ?? '';
    const payload = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const message =
        typeof payload === 'object' && payload && 'message' in payload
          ? String((payload as { message?: string }).message ?? 'Request failed')
          : 'Request failed';

      if (response.status === 401) {
        handleUnauthorizedSession(message);
      }

      throw new ApiError(message, response.status, payload);
    }

    return payload as T;
  }, retryPolicy);
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
