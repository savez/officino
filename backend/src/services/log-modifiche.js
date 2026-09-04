/**
 * Centralized logging service for audit trail.
 * Records significant operations on entities.
 * @module services/log-modifiche
 */

/**
 * Logs a modification to the audit trail.
 * @param {import('knex').Knex} db - Knex instance (or transaction)
 * @param {object} params
 * @param {number} params.utente_id - User who performed the action
 * @param {string} params.entita - Entity type ('preventivo'|'pezzo_magazzino'|'cliente'|'impostazioni')
 * @param {number} params.entita_id - ID of the modified record
 * @param {string} params.azione - Action type ('creazione'|'modifica'|'eliminazione'|'cambio_stato'|'scalatura')
 * @param {object} [params.dettaglio] - Optional details (before/after values, etc.)
 * @returns {Promise<void>}
 */
// eslint-disable-next-line no-unused-vars
async function logModifica(db, { utente_id, entita, entita_id, azione, dettaglio = null }) {
  // REGISTRO DISATTIVATO — non viene scritta alcuna riga.
  //
  // La firma resta perche' otto file di rotte la invocano: toglierla vorrebbe
  // dire toccarli tutti per riaggiungerla quando il registro torna attivo.
  // Il corpo che leggeva `impostazioni_officina.log_attivi` e inseriva in
  // `log_modifiche` e' stato rimosso: stava dopo questo return, quindi non
  // poteva eseguire, e faceva fallire il lint su una variabile inesistente.
}

/**
 * Computes the diff between two objects (only changed fields).
 * @param {object} before - Previous values
 * @param {object} after - New values
 * @param {string[]} [fields] - Optional list of fields to compare (all if omitted)
 * @returns {object} Object with { campo: { prima, dopo } } for each changed field
 */
function computeDiff(before, after, fields) {
  const keys = fields || [...new Set([...Object.keys(before), ...Object.keys(after)])];
  const diff = {};

  for (const key of keys) {
    const prima = before[key];
    const dopo = after[key];

    // Compare as strings to handle numeric/string mismatches from DB
    if (String(prima ?? '') !== String(dopo ?? '')) {
      diff[key] = { prima: prima ?? null, dopo: dopo ?? null };
    }
  }

  return Object.keys(diff).length > 0 ? diff : null;
}

module.exports = { logModifica, computeDiff };
