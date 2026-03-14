import api, { fetchPaginated } from './api';

// ── Catalogo Prodotti ──────────────────────────────────────────────

/**
 * Fetches paginated catalogo list
 * @param {object} params - { page, per_page, categoria_id }
 */
export function fetchCatalogo(params = {}) {
  return fetchPaginated('/catalogo', params);
}

/**
 * Search catalogo by term
 * @param {string} q - search term
 * @param {object} params - { page, per_page, categoria_id }
 */
export function searchCatalogo(q, params = {}) {
  return fetchPaginated('/catalogo/search', { q, ...params });
}

/**
 * Get a single prodotto by id
 * @param {number|string} id
 */
export async function getCatalogoById(id) {
  const { data } = await api.get(`/catalogo/${id}`);
  return data;
}

/**
 * Get a single prodotto by barcode
 * @param {string} barcode
 */
export async function getCatalogoByBarcode(barcode) {
  const { data } = await api.get(`/catalogo/barcode/${encodeURIComponent(barcode)}`);
  return data;
}

/**
 * Create a new prodotto
 * @param {object} payload
 */
export async function createProdotto(payload) {
  const { data } = await api.post('/catalogo', payload);
  return data;
}

/**
 * Update an existing prodotto
 * @param {number|string} id
 * @param {object} payload
 */
export async function updateProdotto(id, payload) {
  const { data } = await api.put(`/catalogo/${id}`, payload);
  return data;
}

/**
 * Delete a prodotto
 * @param {number|string} id
 */
export async function deleteProdotto(id) {
  const { data } = await api.delete(`/catalogo/${id}`);
  return data;
}

/**
 * Export catalogo to Excel and trigger browser download
 */
export async function exportExcel() {
  const response = await api.get('/catalogo/export/excel', {
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
  let filename = 'catalogo_prodotti.xlsx';
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
