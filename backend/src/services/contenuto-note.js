'use strict';

/**
 * Caricamento del contenuto delle note di lavorazione.
 *
 * Il modulo non introduce comportamento nuovo: sposta
 * qui il caricatore che stava nella rotta e gli affianca una variante in
 * BLOCCO, per piu' note in una volta.
 *
 * Perche' la variante serve. Il totale di una nota non e' memorizzato: si
 * ricalcola ogni volta da lavorazioni, materiali e scostamenti imposti. La
 * dashboard deve sommare i totali di tutte le note di un periodo, e con tre
 * query per nota trenta note diventano novanta interrogazioni per aprire una
 * schermata.
 *
 * Perche' il caricatore singolo DELEGA a quello in blocco invece di stargli
 * accanto. Due funzioni che preparano l'ingresso di `calcolaTotaliNota`
 * possono divergere, e i totali divergerebbero con loro senza che nulla
 * fallisca: e' esattamente la forma del difetto che su questo progetto ha gia'
 * prodotto due letture diverse degli stessi scostamenti. Con la delega la
 * divergenza non e' rappresentabile.
 */

const { calcolaTotaliLavorazione } = require('./calcolo-totali-nota');
const { derivaStato } = require('./stato-rapportino');

const round2 = (v) => Math.round(Number(v) * 100) / 100;

/**
 * Carica i materiali di un insieme di lavorazioni, con i dati economici.
 * @param {import('knex').Knex} db
 * @param {number[]} lavorazioneIds
 * @returns {Promise<Record<number, object[]>>}
 */
async function caricaMaterialiPerLavorazione(db, lavorazioneIds) {
  const mappa = {};
  if (!lavorazioneIds || lavorazioneIds.length === 0) return mappa;

  const materiali = await db('materiali_lavorazione as m')
    .leftJoin('catalogo_prodotti as p', 'm.pezzo_id', 'p.id')
    .whereIn('m.lavorazione_id', lavorazioneIds)
    .select('m.*', 'p.nome as pezzo_nome');

  for (const mat of materiali) {
    if (!mappa[mat.lavorazione_id]) mappa[mat.lavorazione_id] = [];
    const prezzo = Number(mat.prezzo_unitario || 0);
    const quantita = Number(mat.quantita || 0);
    mappa[mat.lavorazione_id].push({
      id: mat.id,
      pezzo_id: mat.pezzo_id,
      nome: mat.fuori_catalogo ? mat.nome_manuale : mat.pezzo_nome,
      quantita,
      fuori_catalogo: mat.fuori_catalogo,
      prezzo_unitario: prezzo,
      totale_materiale: round2(prezzo * quantita),
    });
  }
  return mappa;
}

/**
 * Assembla il contenuto di UNA nota da righe gia' lette.
 *
 * Nessuna interrogazione: prende rapportini, lavorazioni e materiali e li
 * combina. E' il punto in cui il caricatore singolo e quello in blocco si
 * incontrano, cosi' producono per costruzione la stessa forma.
 * @param {object[]} rapportini
 * @param {object[]} righe - lavorazioni dei rapportini passati
 * @param {Record<number, object[]>} materialiMap
 * @returns {{rapportini: object[], lavorazioni: object[]}}
 */
function assembla(rapportini, righe, materialiMap) {
  const perRapportino = {};
  const piatte = [];

  for (const l of righe) {
    const rapportino = rapportini.find((r) => r.id === l.rapportino_id);
    const materiali = materialiMap[l.id] || [];
    const totali = calcolaTotaliLavorazione({
      ore: Number(l.ore),
      costo_orario_applicato: Number(l.costo_orario_applicato || 0),
      materiali,
    });
    const arricchita = {
      ...l,
      ore: round2(l.ore),
      costo_orario_applicato: Number(l.costo_orario_applicato || 0),
      materiali,
      ore_lavorate: totali.ore_lavorate,
      subtotale_materiali: totali.subtotale_materiali,
      costo_manodopera: totali.costo_manodopera,
      totale_lavorazione: totali.totale_lavorazione,
      // Il macchinario e l'operaio stanno sul rapportino: qui vengono portati
      // sulla lavorazione perche' il PDF e gli avvisi ne hanno bisogno riga per
      // riga, e ricavarli ogni volta dal padre sarebbe una fonte di sviste.
      macchina: rapportino ? rapportino.macchina : null,
      utente_nome: rapportino ? rapportino.utente_nome : null,
    };
    piatte.push(arricchita);
    if (!perRapportino[l.rapportino_id]) perRapportino[l.rapportino_id] = [];
    perRapportino[l.rapportino_id].push(arricchita);
  }

  const conLavorazioni = rapportini.map((r) => {
    const lavorazioni = perRapportino[r.id] || [];
    return {
      id: r.id,
      macchina: r.macchina,
      utente_id: r.utente_id,
      utente_nome: r.utente_nome,
      stato: derivaStato(r),
      lavorazioni,
      totale_ore: round2(lavorazioni.reduce((acc, l) => acc + l.ore_lavorate, 0)),
      totale_rapportino: round2(lavorazioni.reduce((acc, l) => acc + l.totale_lavorazione, 0)),
    };
  });

  return { rapportini: conLavorazioni, lavorazioni: piatte };
}

/**
 * Carica i rapportini di UNA nota con le loro lavorazioni e i materiali.
 *
 * DELEGA alla variante in blocco. Non e' un giro inutile: e' cio' che impedisce
 * a due caricatori di divergere in silenzio (vedi l'intestazione del modulo).
 * @param {import('knex').Knex} db
 * @param {number} notaId
 * @returns {Promise<{rapportini: object[], lavorazioni: object[]}>}
 */
async function caricaContenutoNota(db, notaId) {
  const perNota = await caricaContenutoNote(db, [notaId]);
  return perNota[Number(notaId)];
}

/**
 * Carica il contenuto di PIU' note in un numero fisso di interrogazioni.
 *
 * Tre letture in tutto — rapportini, lavorazioni, materiali — invece di tre per
 * nota. Il raggruppamento avviene in memoria, come gia' fa la dashboard per le
 * ore: e' anche l'unico modo di restare portabili fra PostgreSQL e SQLite, che
 * su questo progetto e' un vincolo e non una preferenza.
 * @param {import('knex').Knex} db
 * @param {number[]} notaIds
 * @returns {Promise<Record<number, {rapportini: object[], lavorazioni: object[]}>>}
 */
async function caricaContenutoNote(db, notaIds) {
  // Gli id arrivano anche dai parametri di una richiesta, quindi come stringhe.
  // In SQL la coercizione avveniva da sola; qui il raggruppamento e' in
  // JavaScript, dove `'5' === 5` e' falso e ogni nota tornerebbe vuota.
  const ids = (notaIds || []).map(Number).filter((n) => Number.isFinite(n));

  const vuoto = {};
  for (const id of ids) vuoto[id] = { rapportini: [], lavorazioni: [] };
  if (ids.length === 0) return vuoto;

  const rapportini = await db('rapportini as r')
    .leftJoin('utenti as u', 'r.utente_id', 'u.id')
    .whereIn('r.nota_lavorazione_id', ids)
    .select('r.*', 'u.nome as utente_nome')
    .orderBy('r.id', 'asc');

  if (rapportini.length === 0) return vuoto;

  const righe = await db('lavorazioni')
    .whereIn(
      'rapportino_id',
      rapportini.map((r) => r.id)
    )
    .orderBy('giorno', 'asc')
    .orderBy('id', 'asc');

  const materialiMap = await caricaMaterialiPerLavorazione(
    db,
    righe.map((l) => l.id)
  );

  for (const nota of ids) {
    const suoi = rapportini.filter((r) => Number(r.nota_lavorazione_id) === nota);
    const sueRighe = righe.filter((l) => suoi.some((r) => r.id === l.rapportino_id));
    vuoto[nota] = assembla(suoi, sueRighe, materialiMap);
  }
  return vuoto;
}

module.exports = {
  caricaContenutoNota,
  caricaContenutoNote,
  round2,
};
