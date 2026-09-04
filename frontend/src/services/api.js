import axios from 'axios';
import { ref } from 'vue';
import router from '../router';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

/** Messaggio reattivo visibile durante il cold start del server */
export const coldStartMessage = ref('');

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 240_000, // 4 minuti — il piano free di Render ha cold start ~60s
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Cold-start retry: su errori di rete/timeout ritenta una volta
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isNetworkOrTimeout =
      !error.response && (error.code === 'ECONNABORTED' || error.message === 'Network Error');

    if (isNetworkOrTimeout && !originalRequest._coldRetry) {
      originalRequest._coldRetry = true;
      coldStartMessage.value = 'Il server si sta avviando, attendere...';
      try {
        const result = await api(originalRequest);
        coldStartMessage.value = '';
        return result;
      } catch (retryError) {
        coldStartMessage.value = '';
        return Promise.reject(retryError);
      }
    }

    coldStartMessage.value = '';
    return Promise.reject(error);
  },
);

// Handle 401 - try refresh, then redirect to login
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken });
          localStorage.setItem('token', data.token);
          localStorage.setItem('refreshToken', data.refreshToken);
          originalRequest.headers.Authorization = `Bearer ${data.token}`;
          return api(originalRequest);
        } catch {
          // Refresh failed
        }
      }

      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      router.push('/login');
    }

    return Promise.reject(error);
  }
);

/**
 * Fetches a paginated list
 * @param {string} url - API endpoint
 * @param {object} [params] - Query params (page, per_page, filters...)
 * @returns {Promise<{ data: Array, pagination: object }>}
 */
export async function fetchPaginated(url, params = {}) {
  const { data } = await api.get(url, { params });
  return data;
}

/**
 * Input shape for a single materiale inside a riga di rapportino payload
 * (feature 010 — costi materiali). Mirror of `MaterialeInput` in
 * `specs/010-rapportini-note-costi/contracts/rapportini.openapi.yml`.
 *
 * @typedef {Object} MaterialeInput
 * @property {number} [pezzo_id]        Catalogo product id (omit when fuori_catalogo)
 * @property {string} [nome_manuale]    Free-text name (required when fuori_catalogo)
 * @property {number} quantita          Integer >= 1
 * @property {boolean} fuori_catalogo   true = manual / off-catalog
 * @property {number} [prezzo_unitario] Snapshot price per unit (>= 0, 2 decimals).
 *                                     For catalogo items: prefilled by frontend from
 *                                     `catalogo_prodotti.prezzo_vendita` (editable).
 *                                     For fuori catalogo: editable, default 0.
 */

export default api;
