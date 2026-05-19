import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../constants/theme';

const REQUEST_TIMEOUT_MS = 15000;
const DEFAULT_SERVICE_ERROR = 'The service is temporarily unavailable. Please try again shortly.';

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

function extractErrorMessage(payload) {
  return payload?.error?.message || payload?.message || null;
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
    const headers = { 'Content-Type': 'application/json', ...extraHeaders };
    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    if (resolvedToken && !headers.Authorization) {
      headers.Authorization = `Bearer ${resolvedToken}`;
    }

    const response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
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
      throw new ApiError(
        extractErrorMessage(payload.data) || fallbackMessage,
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
        `Request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds. Check API reachability or mobile network connectivity.`,
      );
    }
    console.error('API ERROR:', requestError.message);
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
