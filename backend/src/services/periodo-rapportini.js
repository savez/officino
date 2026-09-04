'use strict';

/**
 * L'unica definizione di «rapportino del periodo».
 *
 * Un rapportino non ha una data propria: le date stanno sulle lavorazioni che
 * contiene. «I rapportini di febbraio» ha quindi piu' letture ragionevoli, e
 * questo modulo esiste perche' l'applicazione ne usi una sola.
 *
 * Le varianti sono DUE, e la differenza non e' un dettaglio implementativo ma
 * una scelta fra due scopi diversi:
 *
 *   elenco    -> «almeno una lavorazione nel periodo OPPURE nessuna lavorazione»
 *   conteggio -> «almeno una lavorazione nel periodo», e basta
 *
 * La seconda meta' del criterio dell'elenco serve alla RAGGIUNGIBILITA': un
 * rapportino appena creato non ha lavorazioni, quindi nessun filtro sulle date
 * potrebbe includerlo. Escluderlo lo renderebbe invisibile per sempre — non ci
 * si potrebbe piu' aggiungere la prima lavorazione ne' eliminarlo. E' un bug
 * gia' arrivato in produzione una volta.
 *
 * Su una METRICA quella stessa regola mente: un guscio vuoto creato a marzo
 * verrebbe contato a giugno, a settembre e per sempre, e «12 rapportini aperti
 * nel periodo» comprenderebbe cose in cui nel periodo non e' successo nulla.
 *
 * La dashboard usa percio' la variante «conteggio» e conta i vuoti a parte.
 * Sommando le due si torna al numero dell'elenco: lo scarto e' dichiarato
 * invece che silenzioso.
 */

/**
 * Sotto-query «esiste una lavorazione nell'intervallo».
 * @param {{da: string, a: string}} periodo
 * @param {string} alias - alias della tabella rapportini nella query chiamante
 * @returns {(this: import('knex').Knex.QueryBuilder) => void} callback per whereExists
 */
function esisteLavorazioneNelPeriodo(periodo, alias) {
  return function () {
    this.select(1)
      .from('lavorazioni as l')
      .whereRaw(`l.rapportino_id = ${alias}.id`)
      .whereBetween('l.giorno', [periodo.da, periodo.a]);
  };
}

/**
 * Sotto-query «esiste una qualsiasi lavorazione».
 * @param {string} alias
 * @returns {(this: import('knex').Knex.QueryBuilder) => void} callback per whereNotExists
 */
function esisteQualcheLavorazione(alias) {
  return function () {
    this.select(1).from('lavorazioni as vuote').whereRaw(`vuote.rapportino_id = ${alias}.id`);
  };
}

/**
 * Criterio dell'ELENCO: nel periodo, OPPURE vuoto.
 *
 * Da usare dove conta poter raggiungere un rapportino, non misurarlo.
 * @param {import('knex').Knex.QueryBuilder} query
 * @param {{da: string, a: string}} periodo
 * @param {string} [alias]
 * @returns {import('knex').Knex.QueryBuilder}
 */
function applicaPeriodoElenco(query, periodo, alias = 'r') {
  return query.where(function () {
    this.whereExists(esisteLavorazioneNelPeriodo(periodo, alias)).orWhereNotExists(
      esisteQualcheLavorazione(alias)
    );
  });
}

/**
 * Criterio del CONTEGGIO: solo chi ha lavorazioni nel periodo.
 *
 * Da usare dove il numero deve descrivere cosa e' successo in quel periodo.
 * @param {import('knex').Knex.QueryBuilder} query
 * @param {{da: string, a: string}} periodo
 * @param {string} [alias]
 * @returns {import('knex').Knex.QueryBuilder}
 */
function applicaPeriodoConteggio(query, periodo, alias = 'r') {
  return query.whereExists(esisteLavorazioneNelPeriodo(periodo, alias));
}

/**
 * Restringe ai soli rapportini privi di lavorazioni.
 *
 * Non accetta un periodo, e non e' una dimenticanza: senza lavorazioni non ci
 * sono date da confrontare, quindi questo insieme e' lo stesso per ogni
 * intervallo.
 * @param {import('knex').Knex.QueryBuilder} query
 * @param {string} [alias]
 * @returns {import('knex').Knex.QueryBuilder}
 */
function applicaSenzaLavorazioni(query, alias = 'r') {
  return query.whereNotExists(esisteQualcheLavorazione(alias));
}

module.exports = {
  applicaPeriodoElenco,
  applicaPeriodoConteggio,
  applicaSenzaLavorazioni,
};
