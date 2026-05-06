import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../constants/theme';

const REQUEST_TIMEOUT_MS = 15000;

export async function apiRequest(method, path, body = null) {
  let timeout;
  try {
    const token = await AsyncStorage.getItem('accessToken');
    const headers = { 'Content-Type': 'application/json' };
    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    let data;
    try {
      data = await response.json();
    } catch (_parseError) {
      throw new Error('Invalid JSON response from server');
    }

    if (!response.ok) {
      throw new Error(data?.error?.message || data?.message || `HTTP ${response.status}`);
    }

    return data;
  } catch (requestError) {
    if (requestError?.name === 'AbortError') {
      throw new Error(
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
  get: (path) => apiRequest('GET', path),
  post: (path, body) => apiRequest('POST', path, body),
  patch: (path, body) => apiRequest('PATCH', path, body),
  put: (path, body) => apiRequest('PUT', path, body),
  del: (path) => apiRequest('DELETE', path),
};
