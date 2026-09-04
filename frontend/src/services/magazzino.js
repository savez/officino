import api, { fetchPaginated } from './api';

// ── Magazzino (Pezzi) ──────────────────────────────────────────────

/**
 * Fetches paginated magazzino list
 * @param {object} params - { page, per_page, categoria_id, sotto_soglia }
 */
export function fetchMagazzino(params = {}) {
  return fetchPaginated('/magazzino', params);
}

/**
 * Search magazzino by term
 * @param {string} q - search term
 * @param {object} params - { page, per_page, categoria_id }
 */
export function searchMagazzino(q, params = {}) {
  return fetchPaginated('/magazzino/search', { q, ...params });
}

/**
 * Get a single pezzo by id
 * @param {number|string} id
 */
export async function getMagazzinoById(id) {
  const { data } = await api.get(`/magazzino/${id}`);
  return data;
}

/**
 * Get a single pezzo by barcode
 * @param {string} barcode
 */
export async function getMagazzinoByBarcode(barcode) {
  const { data } = await api.get(`/magazzino/barcode/${encodeURIComponent(barcode)}`);
  return data;
}

/**
 * Create a new pezzo
 * @param {object} payload
 */
export async function createPezzo(payload) {
  const { data } = await api.post('/magazzino', payload);
  return data;
}

/**
 * Update an existing pezzo
 * @param {number|string} id
 * @param {object} payload
 */
export async function updatePezzo(id, payload) {
  const { data } = await api.put(`/magazzino/${id}`, payload);
  return data;
}

/**
 * Delete a pezzo
 * @param {number|string} id
 */
export async function deletePezzo(id) {
  const { data } = await api.delete(`/magazzino/${id}`);
  return data;
}

/**
 * Export magazzino to Excel and trigger browser download
 */
export async function exportExcel() {
  const response = await api.get('/magazzino/export/excel', {
    responseType: 'blob',
  });

  const blob = new Blob([response.data], {
    type: response.headers['content-type'] || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;

  // Try to get filename from Content-Disposition header
  const disposition = response.headers['content-disposition'];
  let filename = 'magazzino.xlsx';
  if (disposition) {
    const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (match && match[1]) {
      filename = match[1].replace(/['"]/g, '');
    }
  }

  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

// ── Categorie ──────────────────────────────────────────────────────

/**
 * Fetches paginated categorie list
 * @param {object} params - { page, per_page }
 */
export function fetchCategorie(params = {}) {
  return fetchPaginated('/categorie', params);
}

/**
 * Fetches all categorie (no pagination, for dropdowns)
 * @returns {Promise<Array<{ id, nome }>>}
 */
export async function fetchAllCategorie() {
  const { data } = await api.get('/categorie/all');
  return data;
}

/**
 * Create a new categoria
 * @param {object} payload - { nome, descrizione }
 */
export async function createCategoria(payload) {
  const { data } = await api.post('/categorie', payload);
  return data;
}

/**
 * Update an existing categoria
 * @param {number|string} id
 * @param {object} payload - { nome, descrizione }
 */
export async function updateCategoria(id, payload) {
  const { data } = await api.put(`/categorie/${id}`, payload);
  return data;
}

/**
 * Delete a categoria
 * @param {number|string} id
 */
export async function deleteCategoria(id) {
  const { data } = await api.delete(`/categorie/${id}`);
  return data;
}
