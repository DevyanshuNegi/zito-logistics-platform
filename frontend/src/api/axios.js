import axios from 'axios';

/* -------------------------------------------------------------------------- */
/* AXIOS INSTANCE                                                             */
/* -------------------------------------------------------------------------- */

const API_PREFIX = '/api/v1';

const fallbackOrigin =
  (typeof window !== 'undefined' ? window.location.origin : null)
  || 'http://localhost:5000';

const stripApiPrefix = (value = '') => value
  .replace(/\/+$/, '')
  .replace(/\/api\/v1$/i, '');

const normalizeApiUrl = (url = '') => {
  if (!url || /^https?:\/\//i.test(url)) return url;

  const normalizedUrl = url.startsWith('/') ? url : `/${url}`;
  return normalizedUrl.startsWith(API_PREFIX)
    ? normalizedUrl
    : `${API_PREFIX}${normalizedUrl}`;
};

const api = axios.create({
  baseURL: stripApiPrefix(import.meta.env.VITE_API_URL || fallbackOrigin) || fallbackOrigin,
  timeout: 15000,
});

/* -------------------------------------------------------------------------- */
/* REQUEST INTERCEPTOR                                                        */
/* -------------------------------------------------------------------------- */

api.interceptors.request.use(

  (config) => {
    config.url = normalizeApiUrl(config.url || '');

    const token = localStorage.getItem('accessToken');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;

  },

  (error) => {
    return Promise.reject(error);
  }

);

/* -------------------------------------------------------------------------- */
/* RESPONSE INTERCEPTOR                                                       */
/* -------------------------------------------------------------------------- */

api.interceptors.response.use(

  (response) => response,

  (error) => {

    if (error.response) {

      if (error.response.status === 401) {
        console.warn('Unauthorized request');
      }

      if (error.response.status === 429) {
        console.warn('Too many requests (rate limit)');
      }

    }

    return Promise.reject(error);

  }

);

export default api;
