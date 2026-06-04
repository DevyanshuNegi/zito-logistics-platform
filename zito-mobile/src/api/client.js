import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../constants/theme';

const REQUEST_TIMEOUT_MS = 30000;
const DEFAULT_SERVICE_ERROR = 'The service is temporarily unavailable. Please try again shortly.';
const unauthorizedListeners = new Set();

export class ApiError extends Error {
  constructor(
    message,
    { status = null, details = null, contentType = '', bodyPreview = '' } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    this.contentType = contentType;
    this.bodyPreview = bodyPreview;
  }
}

function bodyLooksJson(rawText) {
  return /^[\s\r\n]*[\[{]/.test(rawText);
}

export function extractErrorMessage(error, fallbackMessage = DEFAULT_SERVICE_ERROR) {
  if (!error) {
    return fallbackMessage;
  }

  if (error instanceof ApiError) {
    return (
      error.details?.error?.message ||
      error.details?.message ||
      error.message ||
      fallbackMessage
    );
  }

  return error?.error?.message || error?.message || fallbackMessage;
}

function fallbackMessageForStatus(status, defaultMessage) {
  if (status === 401) {
    return 'Your session has expired. Please sign in again.';
  }

  if (status === 403) {
    return 'You do not have permission to perform this action.';
  }

  if (status === 404) {
    return 'The requested resource was not found.';
  }

  return defaultMessage;
}

export function onUnauthorizedSession(listener) {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

async function handleUnauthorizedSession() {
  await AsyncStorage.multiRemove(['accessToken', 'user']);
  unauthorizedListeners.forEach((listener) => {
    try {
      listener();
    } catch (listenerError) {
      console.warn('Auth session listener failed:', listenerError?.message || listenerError);
    }
  });
}

async function readResponsePayload(response) {
  const contentType = response.headers.get('content-type') || '';
  const rawText = await response.text();

  if (!rawText.trim()) {
    return { data: {}, rawText, contentType };
  }

  if (
    contentType.includes('application/json') ||
    contentType.includes('+json') ||
    bodyLooksJson(rawText)
  ) {
    try {
      return { data: JSON.parse(rawText), rawText, contentType };
    } catch (parseError) {
      return { data: null, rawText, contentType, parseError };
    }
  }

  return { data: null, rawText, contentType };
}

function logUnexpectedResponse(method, path, response, payload) {
  console.warn(`[API ${method} ${path}] Unexpected response`, {
    status: response.status,
    contentType: payload.contentType,
    bodyPreview: payload.rawText.slice(0, 200),
  });
}

export async function apiRequest(method, path, body = null, options = {}) {
  let timeout;
  try {
    const {
      headers: extraHeaders = {},
      token,
      responseFallbackMessage = DEFAULT_SERVICE_ERROR,
    } = options;
    const resolvedToken =
      token === undefined ? await AsyncStorage.getItem('accessToken') : token;
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    const headers = { ...extraHeaders };
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }
    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    if (resolvedToken && !headers.Authorization) {
      headers.Authorization = `Bearer ${resolvedToken}`;
    }

    const response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? (isFormData ? body : JSON.stringify(body)) : null,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const payload = await readResponsePayload(response);
    const fallbackMessage = fallbackMessageForStatus(
      response.status,
      responseFallbackMessage,
    );

    if (payload.parseError || (!payload.data && payload.rawText.trim())) {
      logUnexpectedResponse(method, path, response, payload);
      throw new ApiError(
        response.ok ? responseFallbackMessage : fallbackMessage,
        {
          status: response.status,
          details: payload.data,
          contentType: payload.contentType,
          bodyPreview: payload.rawText.slice(0, 200),
        },
      );
    }

    if (!response.ok) {
      if (response.status === 401) {
        await handleUnauthorizedSession();
      }

      throw new ApiError(
        extractErrorMessage(payload.data, fallbackMessage),
        {
          status: response.status,
          details: payload.data,
          contentType: payload.contentType,
          bodyPreview: payload.rawText.slice(0, 200),
        },
      );
    }

    return payload.data;
  } catch (requestError) {
    if (requestError?.name === 'AbortError') {
      throw new ApiError(
        `Request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds. Make sure the backend is running and reachable at ${API_URL}.`,
      );
    }
    if (!(requestError instanceof ApiError)) {
      console.warn('API request failed:', requestError?.message || requestError);
    }
    throw requestError;
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export const api = {
  get: (path, options) => apiRequest('GET', path, null, options),
  post: (path, body, options) => apiRequest('POST', path, body, options),
  patch: (path, body, options) => apiRequest('PATCH', path, body, options),
  put: (path, body, options) => apiRequest('PUT', path, body, options),
  del: (path, options) => apiRequest('DELETE', path, null, options),
};
