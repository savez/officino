/**
 * Riconoscimento del macchinario per l'avviso di rapportino duplicato.
 *
 * Il macchinario resta un testo libero per scelta esplicita: nessuna anagrafica.
 * La conseguenza accettata è che due scritture diverse producono due rapportini
 * distinti. L'avviso serve a rendere quella conseguenza visibile prima che si
 * verifichi, non a impedirla (FR-024).
 */

/**
 * Riduce un nome alla forma usata SOLO per il confronto: spazi ai bordi
 * rimossi, spazi multipli contratti, tutto minuscolo.
 *
 * Con il confronto esatto l'avviso scatterebbe solo riscrivendo il nome
 * identico, cioè quando l'operaio l'avrebbe già riconosciuto nell'elenco, e
 * tacerebbe proprio su "Trattore JD 6130R" contro "trattore jd 6130r" — che è
 * il caso da intercettare. Senza normalizzazione l'avviso sarebbe decorativo.
 *
 * Il nome resta memorizzato come l'operaio l'ha scritto: questa funzione non va
 * usata per costruire il valore da salvare (FR-024b).
 * @param {string} nome - nome del macchinario come inserito
 * @returns {string} forma normalizzata, adatta al solo confronto
 */
function normalizza(nome) {
  if (typeof nome !== 'string') return '';
  return nome.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Vero se due nomi indicano lo stesso macchinario a meno di spazi e maiuscole.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function stessoMacchinario(a, b) {
  const na = normalizza(a);
  return na !== '' && na === normalizza(b);
}

/**
 * Cerca un rapportino APERTO dello stesso operaio, per lo stesso cliente, il
 * cui macchinario coincida a meno di spazi e maiuscole.
 *
 * La restrizione al cliente è essenziale: lo stesso modello di macchina presso
 * due aziende sono due interventi distinti, e segnalarli come duplicati
 * produrrebbe falsi allarmi sistematici. Un avviso che sbaglia spesso viene
 * ignorato anche quando ha ragione (FR-024c).
 *
 * Sono esclusi anche i rapportini di altri operai: due operai sulla stessa
 * macchina hanno per forza due rapportini distinti, quindi non è un duplicato
 * da segnalare (FR-024d).
 *
 * Il confronto avviene in memoria e non in SQL perché la normalizzazione degli
 * spazi multipli non è esprimibile allo stesso modo su PostgreSQL e su SQLite,
 * e l'insieme filtrato per operaio, cliente e stato aperto è di poche righe.
 * @param {import('knex').Knex} db
 * @param {object} parametri
 * @param {number} parametri.utenteId
 * @param {number} parametri.clienteId
 * @param {string} parametri.macchina
 * @returns {Promise<{id: number, macchina: string}|null>} il rapportino trovato, o null
 */
async function trovaDuplicatoAperto(db, { utenteId, clienteId, macchina }) {
  const candidati = await db('rapportini')
    .select('id', 'macchina')
    .where({ utente_id: utenteId, cliente_id: clienteId })
    .whereNull('chiuso_il')
    .whereNull('nota_lavorazione_id');

  return candidati.find((c) => stessoMacchinario(c.macchina, macchina)) || null;
}

module.exports = { normalizza, stessoMacchinario, trovaDuplicatoAperto };
