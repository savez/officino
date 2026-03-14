import api, { fetchPaginated } from './api'

// ── Utenti ──────────────────────────────────────────────────────────

/**
 * Fetches paginated utenti list
 * @param {object} params - { page, per_page }
 */
export function getUtenti(params = {}) {
  return fetchPaginated('/utenti', params)
}

/**
 * Fetches all utenti (no pagination, for dropdowns)
 */
export async function getAllUtenti() {
  const { data } = await api.get('/utenti/all')
  return data
}

/**
 * Get a single utente by id
 * @param {number|string} id
 */
export async function getUtente(id) {
  const { data } = await api.get(`/utenti/${id}`)
  return data
}

/**
 * Create a new utente
 * @param {object} payload - { nome, email, password, ruolo, costo_orario }
 */
export async function createUtente(payload) {
  const { data } = await api.post('/utenti', payload)
  return data
}

/**
 * Update an existing utente
 * @param {number|string} id
 * @param {object} payload - { nome, email, password?, ruolo, costo_orario }
 */
export async function updateUtente(id, payload) {
  const { data } = await api.put(`/utenti/${id}`, payload)
  return data
}

/**
 * Delete an utente
 * @param {number|string} id
 */
export async function deleteUtente(id) {
  const { data } = await api.delete(`/utenti/${id}`)
  return data
}
