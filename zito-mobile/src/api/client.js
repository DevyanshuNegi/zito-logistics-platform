// src/api/client.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../constants/theme';

export async function apiRequest(method, path, body = null) {
  try {
    const token = await AsyncStorage.getItem('accessToken');

    const headers = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = `${API_URL}${path}`;
    console.log('API CALL:', method, url);

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
    });

    // 👉 handle non-JSON safely
    let data;
    try {
      data = await res.json();
    } catch (e) {
      throw new Error('Invalid JSON response from server');
    }

    if (!res.ok) {
      throw new Error(
        data?.error?.message ||
        data?.message ||
        `HTTP ${res.status}`
      );
    }

    return data;

  } catch (error) {
    console.error('API ERROR:', error.message);
    throw error;
  }
}

export const api = {
  get:   (path)       => apiRequest('GET', path),
  post:  (path, body) => apiRequest('POST', path, body),
  patch: (path, body) => apiRequest('PATCH', path, body),
  put:   (path, body) => apiRequest('PUT', path, body),
  del:   (path)       => apiRequest('DELETE', path),
};