import api, { fetchPaginated } from './api';

// ── Note di Lavorazione ─────────────────────────────────────────────

/**
 * Fetches paginated note di lavorazione
 * @param {object} params - { page, per_page, cliente_id }
 */
export function getNote(params = {}) {
    return fetchPaginated('/note-lavorazione', params);
}

/**
 * Get a single nota di lavorazione by id (with righe details)
 * @param {number|string} id
 */
export async function getNota(id) {
    const { data } = await api.get(`/note-lavorazione/${id}`);
    return data;
}

/**
 * Create a new nota di lavorazione
 * @param {object} payload - { cliente_id, testo, mostra_dettagli, righe_ids }
 */
export async function creaNota(payload) {
    const { data } = await api.post('/note-lavorazione', payload);
    return data;
}

/**
 * Update an existing nota di lavorazione
 * @param {number|string} id
 * @param {object} payload - { testo, mostra_dettagli, righe_ids }
 */
export async function aggiornaNota(id, payload) {
    const { data } = await api.put(`/note-lavorazione/${id}`, payload);
    return data;
}

/**
 * Delete a nota di lavorazione
 * @param {number|string} id
 */
export async function cancellaNota(id) {
    const { data } = await api.delete(`/note-lavorazione/${id}`);
    return data;
}

/**
 * Download nota di lavorazione as PDF
 * @param {number|string} id
 */
export async function stampaNota(id) {
    const response = await api.get(`/note-lavorazione/${id}/stampa`, {
        responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    window.open(url, '_blank');
}
