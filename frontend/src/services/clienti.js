import api, { fetchPaginated } from './api';

// ── Clienti ────────────────────────────────────────────────────────

/**
 * Fetches paginated clienti list
 * @param {object} params - { page, per_page, archiviati }
 *   archiviati: undefined/missing = active only, 'true' = all, 'only' = archived only
 */
export function getClienti(params = {}) {
  return fetchPaginated('/clienti', params);
}

/**
 * Fetches all clienti (no pagination, for dropdowns)
 * Returns active clients only
 * @returns {Promise<Array>}
 */
export async function getAllClienti() {
  const { data } = await api.get('/clienti/all');
  return data;
}

/**
 * Search clienti by term
 * @param {object} params - { q, page, per_page, archiviati }
 */
export function searchClienti(params = {}) {
  return fetchPaginated('/clienti/search', params);
}

/**
 * Get a single cliente by id
 * @param {number|string} id
 */
export async function getCliente(id) {
  const { data } = await api.get(`/clienti/${id}`);
  return data;
}

/**
 * Create a new cliente
 * @param {object} payload
 */
export async function createCliente(payload) {
  const { data } = await api.post('/clienti', payload);
  return data;
}

/**
 * Update an existing cliente
 * @param {number|string} id
 * @param {object} payload
 */
export async function updateCliente(id, payload) {
  const { data } = await api.put(`/clienti/${id}`, payload);
  return data;
}

/**
 * Archive a cliente (soft delete)
 * @param {number|string} id
 */
export async function archiviaCliente(id) {
  const { data } = await api.patch(`/clienti/${id}/archivia`);
  return data;
}

/**
 * Restore an archived cliente
 * @param {number|string} id
 */
export async function ripristinaCliente(id) {
  const { data } = await api.patch(`/clienti/${id}/ripristina`);
  return data;
}

/**
 * Delete a cliente permanently
 * @param {number|string} id
 */
export async function deleteCliente(id) {
  const { data } = await api.delete(`/clienti/${id}`);
  return data;
}
