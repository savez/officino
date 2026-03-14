import api, { fetchPaginated } from './api';

// ── Preventivi ──────────────────────────────────────────────────────

/**
 * Fetches paginated preventivi list
 * @param {object} params - { page, per_page, stato, cliente_id }
 */
export function getPreventivi(params = {}) {
  return fetchPaginated('/preventivi', params);
}

/**
 * Search preventivi by term
 * @param {object} params - { q, stato, page, per_page }
 */
export function searchPreventivi(params = {}) {
  return fetchPaginated('/preventivi/search', params);
}

/**
 * Get a single preventivo by id (returns full object with pezzi[])
 * @param {number|string} id
 */
export async function getPreventivo(id) {
  const { data } = await api.get(`/preventivi/${id}`);
  return data;
}

/**
 * Create a new preventivo
 * @param {object} payload
 */
export async function createPreventivo(payload) {
  const { data } = await api.post('/preventivi', payload);
  return data;
}

/**
 * Update an existing preventivo
 * @param {number|string} id
 * @param {object} payload
 */
export async function updatePreventivo(id, payload) {
  const { data } = await api.put(`/preventivi/${id}`, payload);
  return data;
}

/**
 * Change the stato of a preventivo
 * @param {number|string} id
 * @param {string} stato - 'bozza'|'approvato'|'rifiutato'|'scaduto'|'fatturato'
 */
export async function cambiaStato(id, stato) {
  const { data } = await api.patch(`/preventivi/${id}/stato`, { stato });
  return data;
}

/**
 * Delete a preventivo
 * @param {number|string} id
 */
export async function deletePreventivo(id) {
  const { data } = await api.delete(`/preventivi/${id}`);
  return data;
}

/**
 * Download preventivo as PDF
 * @param {number|string} id
 */
export async function downloadPdf(id) {
  const response = await api.get(`/preventivi/${id}/pdf`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `preventivo_${id}.pdf`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

/**
 * Export preventivo as JSON file (triggers download)
 * @param {number|string} id
 */
export async function exportPreventivo(id) {
  const response = await api.get(`/preventivi/${id}/export`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `preventivo_${id}.json`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

/**
 * Duplicate a preventivo as a new bozza
 * @param {number|string} id
 */
export async function duplicaPreventivo(id) {
  const { data } = await api.post(`/preventivi/${id}/duplica`);
  return data;
}

/**
 * Import a preventivo from JSON data
 * @param {object} jsonData - The parsed JSON data to import
 */
export async function importPreventivo(jsonData) {
  const { data } = await api.post('/preventivi/import', jsonData);
  return data;
}
