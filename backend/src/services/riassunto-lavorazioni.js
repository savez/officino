/**
 * Compone il riassunto precompilato di una nota di lavorazione a partire dalle
 * note che gli operai hanno scritto nelle singole lavorazioni.
 *
 * **Lo compone il server, non l'interfaccia.** FR-011 chiede di distinguere un
 * testo automatico da uno scritto a mano, per non sovrascrivere il secondo. Se
 * il testo lo generasse il client, il server saprebbe quale dei due ha in mano
 * solo perché il client glielo dice — e un client che sbaglia farebbe perdere
 * all'utente il proprio testo in silenzio. Generandolo qui, la distinzione si
 * ottiene confrontando.
 */

/**
 * Formatta un giorno come gg/mm/aaaa.
 * @param {string|Date} valore
 * @returns {string}
 */
function formattaGiorno(valore) {
  const d = new Date(valore);
  const gg = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${gg}/${mm}/${d.getFullYear()}`;
}

/**
 * Riduce un giorno alla sua forma ordinabile, AAAA-MM-GG.
 * @param {string|Date} valore
 * @returns {string}
 */
function chiaveGiorno(valore) {
  if (typeof valore === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valore)) {
    return valore.slice(0, 10);
  }
  const d = new Date(valore);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const gg = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${gg}`;
}

/**
 * Compone il testo dalle lavorazioni, raggruppate per giorno.
 *
 * Funzione pura: prende le lavorazioni già caricate e restituisce il testo.
 *
 * @param {Array<{giorno: string|Date, note: string|null}>} lavorazioni
 * @returns {string} il riassunto, oppure stringa vuota se nessuna nota
 */
function componiRiassunto(lavorazioni = []) {
  const perGiorno = new Map();

  for (const l of lavorazioni) {
    const nota = (l.note || '').trim();
    // Le lavorazioni senza note non producono righe NÉ intestazioni: un giorno
    // con la sola data e nulla sotto sembrerebbe un errore di compilazione.
    if (!nota) continue;

    const chiave = chiaveGiorno(l.giorno);
    if (!perGiorno.has(chiave)) perGiorno.set(chiave, []);
    // Note identiche in giorni diversi compaiono entrambe, sotto i rispettivi
    // giorni: sono due giornate di lavoro, non un duplicato da eliminare.
    perGiorno.get(chiave).push(nota);
  }

  if (perGiorno.size === 0) return '';

  return [...perGiorno.keys()]
    .sort()
    .map((chiave) => [formattaGiorno(chiave), ...perGiorno.get(chiave)].join('\n'))
    .join('\n\n');
}

/**
 * Carica le lavorazioni dei rapportini indicati e ne compone il riassunto.
 *
 * @param {import('knex').Knex} db
 * @param {number[]} rapportiniIds
 * @returns {Promise<string>}
 */
async function generaRiassunto(db, rapportiniIds = []) {
  if (!Array.isArray(rapportiniIds) || rapportiniIds.length === 0) return '';

  const lavorazioni = await db('lavorazioni')
    .whereIn('rapportino_id', rapportiniIds)
    .orderBy('giorno', 'asc')
    .orderBy('id', 'asc')
    .select('giorno', 'note');

  return componiRiassunto(lavorazioni);
}

/**
 * Vero se il testo coincide con quello che si genererebbe dalla selezione:
 * significa che nessuno l'ha toccato.
 *
 * È il modo in cui `riassunto_personalizzato` si determina lato server, senza
 * doversi fidare di un valore inviato dal client.
 *
 * @param {string|null} testo - il testo ricevuto
 * @param {string} generato - quello che il server produrrebbe
 * @returns {boolean}
 */
function eStatoModificato(testo, generato) {
  return (testo || '').trim() !== (generato || '').trim();
}

module.exports = { componiRiassunto, generaRiassunto, eStatoModificato, formattaGiorno };
