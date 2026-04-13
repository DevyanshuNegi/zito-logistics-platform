// src/api/client.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../constants/theme';

export async function apiRequest(method, path, body = null) {
  const token = await AsyncStorage.getItem('accessToken');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || data?.message || 'Request failed');
  }
  return data;
}

export const api = {
  get:   (path)       => apiRequest('GET',   path),
  post:  (path, body) => apiRequest('POST',  path, body),
  patch: (path, body) => apiRequest('PATCH', path, body),
  put:   (path, body) => apiRequest('PUT',   path, body),
  del:   (path)       => apiRequest('DELETE',path),
};
