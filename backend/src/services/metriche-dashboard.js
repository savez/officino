'use strict';

/**
 * Le metriche della dashboard riservate all'amministratore: quanti rapportini
 * e in quale stato, quante note di lavorazione e per quale importo.
 *
 * Due scelte attraversano tutto il modulo.
 *
 * 1. SI AGGREGA IN JAVASCRIPT, non in SQL. Una lettura piatta e poi il
 *    raggruppamento in memoria, come gia' fa la rotta per le ore. Un
 *    `COUNT(...) FILTER` sarebbe piu' corto e non portabile su SQLite, che qui
 *    e' il database dei test: i 107 rossi preesistenti del backend nascono
 *    tutti da divergenze fra i due motori, e non e' un elenco da allungare.
 *
 * 2. NON SI RICALCOLA NULLA che sia gia' definito altrove. Lo stato viene da
 *    `derivaStato`, il periodo da `periodo-rapportini`, il totale della nota da
 *    `calcolaTotaliNota`. Ogni seconda definizione e' un modo di dire una cosa
 *    diversa senza che nulla fallisca.
 */

const { applicaPeriodoConteggio, applicaSenzaLavorazioni } = require('./periodo-rapportini');
const { derivaStato, APERTO, CHIUSO, GESTITO } = require('./stato-rapportino');
const { calcolaTotaliNota, overrideDi } = require('./calcolo-totali-nota');
const { caricaContenutoNote } = require('./contenuto-note');

const round2 = (v) => Math.round(Number(v) * 100) / 100;

/**
 * @typedef {object} ConteggiRapportini
 * @property {number} aperti - con lavorazioni nel periodo, non conclusi
 * @property {number} chiusi - conclusi, non ancora in una nota
 * @property {number} gestiti - confluiti in una nota di lavorazione
 * @property {number} senza_lavorazioni - non appartengono a nessun periodo
 */

/**
 * Conta i rapportini del periodo, per stato, piu' quelli privi di lavorazioni.
 *
 * I due insiemi sono disgiunti e la loro unione e' cio' che l'elenco dei
 * rapportini mostra per lo stesso periodo. E' l'invariante che tiene insieme
 * le due viste, ed e' il motivo per cui i predicati stanno in un modulo
 * condiviso invece che qui.
 * @param {import('knex').Knex} db
 * @param {{periodo: {da: string, a: string}, utenteId: number|null}} opzioni
 * @returns {Promise<ConteggiRapportini>}
 */
async function contaRapportini(db, { periodo, utenteId }) {
  let nelPeriodo = applicaPeriodoConteggio(db('rapportini as r'), periodo, 'r');
  let vuoti = applicaSenzaLavorazioni(db('rapportini as r'), 'r');
  if (utenteId) {
    nelPeriodo = nelPeriodo.where('r.utente_id', utenteId);
    vuoti = vuoti.where('r.utente_id', utenteId);
  }

  // Si leggono i due campi da cui lo stato deriva, non lo stato: quello lo
  // decide `derivaStato`, cosi' la dashboard e il resto dell'applicazione non
  // possono chiamare «aperto» due cose diverse.
  const [righe, righeVuote] = await Promise.all([
    nelPeriodo.select('r.chiuso_il', 'r.nota_lavorazione_id'),
    vuoti.select('r.id'),
  ]);

  const conteggi = { [APERTO]: 0, [CHIUSO]: 0, [GESTITO]: 0 };
  for (const r of righe) conteggi[derivaStato(r)] += 1;

  return {
    aperti: conteggi[APERTO],
    chiusi: conteggi[CHIUSO],
    gestiti: conteggi[GESTITO],
    senza_lavorazioni: righeVuote.length,
  };
}

/**
 * @typedef {object} MisuraNote
 * @property {number} numero - note del periodo
 * @property {number|null} importo - `null` quando c'e' un filtro per operaio
 */

/**
 * Conta le note del periodo e ne somma gli importi.
 *
 * L'importo e' `null` quando il filtro per operaio e' attivo, e non e' una
 * semplificazione: una nota raccoglie i rapportini di UN CLIENTE e puo'
 * contenere il lavoro di piu' persone. Il totale del documento non e' la quota
 * di chi lo ha in parte prodotto, e mostrarlo sotto il nome di un operaio gli
 * attribuirebbe una cifra che non e' sua.
 * @param {import('knex').Knex} db
 * @param {{periodo: {da: string, a: string}, utenteId: number|null}} opzioni
 * @returns {Promise<MisuraNote>}
 */
async function misuraNote(db, { periodo, utenteId }) {
  let query = db('note_lavorazione as n')
    // `whereNotNull` e' ESPLICITO e non ridondante. In esercizio la colonna e'
    // obbligatoria, ma su SQLite il vincolo non esiste — quel motore non
    // consente di aggiungerlo a una tabella esistente — quindi nei test una
    // nota senza data puo' esistere. Senza questa riga sarebbe `whereBetween` a
    // escluderla di rimbalzo, e l'esclusione sarebbe un effetto collaterale
    // invece di una decisione.
    .whereNotNull('n.data_riferimento')
    .whereBetween('n.data_riferimento', [periodo.da, periodo.a]);

  if (utenteId) {
    query = query.whereExists(function () {
      this.select(1)
        .from('rapportini as rn')
        .whereRaw('rn.nota_lavorazione_id = n.id')
        .where('rn.utente_id', utenteId);
    });
  }

  const note = await query.select('n.*').orderBy('n.id');

  if (note.length === 0) return { numero: 0, importo: utenteId ? null : 0 };
  if (utenteId) return { numero: note.length, importo: null };

  // Il totale della nota non e' memorizzato: si ricalcola. Lo fa la stessa
  // funzione che produce la cifra stampata sul documento, perche' l'importo
  // deve essere cio' che il cliente ha visto — scostamenti imposti compresi —
  // e non una somma dei dettagli che quegli scostamenti ignorerebbe.
  const contenuti = await caricaContenutoNote(
    db,
    note.map((n) => n.id)
  );

  let importo = 0;
  for (const n of note) {
    const { lavorazioni } = contenuti[n.id] || { lavorazioni: [] };
    importo += calcolaTotaliNota(lavorazioni, overrideDi(n)).totale_finale;
  }

  return { numero: note.length, importo: round2(importo) };
}

module.exports = { contaRapportini, misuraNote };
