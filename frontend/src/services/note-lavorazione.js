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
 * @param {object} payload - { cliente_id, data_riferimento, testo, rapportini_ids, mostra_dettaglio_materiali, mostra_dettaglio_manodopera, divisione, totale_*_override }
 */
export async function creaNota(payload) {
    const { data } = await api.post('/note-lavorazione', payload);
    return data;
}

/**
 * Update an existing nota di lavorazione
 * @param {number|string} id
 * @param {object} payload - gli stessi campi della creazione, tutti modificabili
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
 * Pre-PDF warnings (FR-066/FR-067): elenco righe con costo orario 0 e
 * materiali con prezzo 0 sulla nota. Il frontend deve chiamarlo prima di
 * `stampaNota` e, in presenza di warning, chiedere conferma esplicita.
 *
 * @param {number|string} id
 * @returns {Promise<{ has_warnings: boolean,
 *  righe_costo_orario_zero: Array<object>,
 *  materiali_prezzo_zero: Array<object>
 * }>}
 */
/**
 * Chiede al server il riassunto precompilato per i rapportini indicati.
 *
 * Lo genera il server, non l'interfaccia: e' l'unico modo di riconoscere in
 * seguito un testo scritto a mano.
 * @param {Array<number>} rapportiniIds - rapportini selezionati
 * @returns {Promise<string>} il testo generato
 */
export async function getRiassunto(rapportiniIds = []) {
  const query = new URLSearchParams({ rapportini_ids: rapportiniIds.join(',') })
  const { data } = await api.get(`/note-lavorazione/riassunto?${query}`)
  return data.testo || ''
}

export async function getPdfWarnings(id) {
    const { data } = await api.get(`/note-lavorazione/${id}/pdf-warnings`);
    return data;
}

/**
 * Download nota di lavorazione as PDF. Accetta opzionalmente una modalità
 * di rendering on-the-fly (`dettaglio_materiali` o `solo_totale`); se
 * omessa usa quella salvata sulla nota.
 *
 * @param {number|string} id
 * @param {{ modalita?: 'dettaglio_materiali'|'solo_totale' }} [options]
 */
export async function stampaNota(id, options) {
    const params = {};
    if (options && options.modalita) params.modalita = options.modalita;
    const response = await api.get(`/note-lavorazione/${id}/stampa`, {
        responseType: 'blob',
        params,
    });
    const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    window.open(url, '_blank');
}
