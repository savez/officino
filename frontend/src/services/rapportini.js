import api, { fetchPaginated } from './api';

// ── Rapportini ──────────────────────────────────────────────────────

/**
 * Fetches paginated righe rapportino
 * @param {object} params - { page, per_page, cliente_id, utente_id, giorno, gestita }
 */
export function getRighe(params = {}) {
    return fetchPaginated('/rapportini', params);
}

/**
 * Create a new riga rapportino
 * @param {object} payload - { cliente_id, giorno, ora_inizio, ora_fine, macchina, note, materiali }
 */
export async function creaRiga(payload) {
    const { data } = await api.post('/rapportini', payload);
    return data;
}

/**
 * Delete a riga rapportino
 * @param {number|string} id
 */
export async function cancellaRiga(id) {
    const { data } = await api.delete(`/rapportini/${id}`);
    return data;
}

/**
 * Download rapportini as PDF (filtered by giorno or cliente_id)
 * @param {object} params - { giorno, cliente_id }
 */
export async function stampaRapportini(params = {}) {
    const query = new URLSearchParams(params).toString();
    const response = await api.get(`/rapportini/stampa?${query}`, {
        responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    window.open(url, '_blank');
}
