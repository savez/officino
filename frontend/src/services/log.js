import api, { fetchPaginated } from './api';

/**
 * Fetches paginated log entries with optional filters
 * @param {object} params - { page, per_page, entita, entita_id, utente_id, azione, data_da, data_a }
 * @returns {Promise<{ data: Array, pagination: object }>}
 */
export function getLogs(params = {}) {
  return fetchPaginated('/log', params);
}

/**
 * Fetches paginated log entries for a specific entity
 * @param {string} entita - Entity type (e.g. 'pezzo_magazzino', 'cliente', 'preventivo')
 * @param {number|string} entitaId - ID of the entity
 * @param {object} params - { page, per_page }
 * @returns {Promise<{ data: Array, pagination: object }>}
 */
export function getEntityLogs(entita, entitaId, params = {}) {
  return fetchPaginated(
    `/log/${encodeURIComponent(entita)}/${encodeURIComponent(entitaId)}`,
    params
  );
}

/**
 * Counts log entries before a given date
 * @param {string} data - Date in YYYY-MM-DD format
 * @returns {Promise<{ count: number }>}
 */
export async function countLogsBefore(data) {
  const { data: response } = await api.get('/log/count-before', { params: { data } });
  return response;
}

/**
 * Deletes log entries before a given date
 * @param {string} data - Date in YYYY-MM-DD format
 * @returns {Promise<{ deleted: number }>}
 */
export async function purgeLogsBefore(data) {
  const { data: response } = await api.delete('/log/before', { params: { data } });
  return response;
}
