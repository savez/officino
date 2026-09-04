import api, { fetchPaginated } from './api'

// ── Rapportini ───────────────────────────────────────────────────────────────

/**
 * Elenco paginato dei rapportini.
 *
 * `da`/`a` selezionano i rapportini con ALMENO UNA lavorazione nell'intervallo:
 * uno che copre gennaio e marzo compare anche filtrando febbraio.
 * @param {object} params - { page, per_page, cliente_id, utente_id, da, a, stato }
 * @returns {Promise<object>} risposta paginata
 */
export function getRapportini(params = {}) {
  return fetchPaginated('/rapportini', params)
}

/**
 * Crea il contenitore, senza lavorazioni e in stato aperto.
 *
 * La risposta può contenere `avviso_duplicato` quando esiste già un rapportino
 * aperto dello stesso operaio, per lo stesso cliente, con macchinario
 * equivalente a meno di spazi e maiuscole. È un avviso, non un rifiuto.
 * @param {{cliente_id: number, macchina: string}} payload
 * @returns {Promise<object>} il rapportino creato
 */
export async function creaRapportino(payload) {
  const { data } = await api.post('/rapportini', payload)
  return data
}

/**
 * Dettaglio con le lavorazioni e i rispettivi materiali.
 * @param {number|string} id
 * @returns {Promise<object>}
 */
export async function getRapportino(id) {
  const { data } = await api.get(`/rapportini/${id}`)
  return data
}

/**
 * Elimina un rapportino. L'autore può solo se è aperto e vuoto;
 * l'amministratore anche se contiene lavorazioni.
 * @param {number|string} id
 * @returns {Promise<object>}
 */
export async function cancellaRapportino(id) {
  const { data } = await api.delete(`/rapportini/${id}`)
  return data
}

/**
 * Dichiara concluso un rapportino. Solo l'autore, e solo se ha almeno una
 * lavorazione.
 * @param {number|string} id
 * @returns {Promise<object>}
 */
export async function chiudiRapportino(id) {
  const { data } = await api.post(`/rapportini/${id}/chiudi`)
  return data
}

/**
 * Riapre un rapportino chiuso. Solo l'amministratore.
 * @param {number|string} id
 * @returns {Promise<object>}
 */
export async function riapriRapportino(id) {
  const { data } = await api.post(`/rapportini/${id}/riapri`)
  return data
}

// ── Lavorazioni ──────────────────────────────────────────────────────────────

/**
 * Aggiunge una lavorazione a un rapportino aperto.
 * @param {number|string} rapportinoId
 * @param {{giorno: string, ore: number, note?: string, materiali?: object[]}} payload
 * @returns {Promise<object>}
 */
export async function aggiungiLavorazione(rapportinoId, payload) {
  const { data } = await api.post(`/rapportini/${rapportinoId}/lavorazioni`, payload)
  return data
}

/**
 * Modifica una lavorazione di un rapportino aperto.
 * @param {number|string} rapportinoId
 * @param {number|string} lavorazioneId
 * @param {object} payload
 * @returns {Promise<object>}
 */
export async function modificaLavorazione(rapportinoId, lavorazioneId, payload) {
  const { data } = await api.put(
    `/rapportini/${rapportinoId}/lavorazioni/${lavorazioneId}`,
    payload,
  )
  return data
}

/**
 * Elimina una lavorazione. Il rapportino resta, e se rimane vuoto non è più
 * concludibile finché non se ne aggiunge un'altra.
 * @param {number|string} rapportinoId
 * @param {number|string} lavorazioneId
 * @returns {Promise<object>}
 */
export async function cancellaLavorazione(rapportinoId, lavorazioneId) {
  const { data } = await api.delete(`/rapportini/${rapportinoId}/lavorazioni/${lavorazioneId}`)
  return data
}

// ── Stampa ───────────────────────────────────────────────────────────────────

/**
 * Scarica i rapportini in PDF.
 *
 * Riceve gli stessi parametri dell'elenco di proposito: se i due divergessero,
 * si stamperebbe un periodo diverso da quello guardato senza alcun segnale.
 * @param {object} params - { da, a, cliente_id }
 * @returns {Promise<void>}
 */
export async function stampaRapportini(params = {}) {
  const query = new URLSearchParams(params).toString()
  const response = await api.get(`/rapportini/stampa?${query}`, { responseType: 'blob' })
  const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
  window.open(url, '_blank')
}
