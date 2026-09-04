/**
 * Servizio puro per il calcolo dei totali economici di lavorazioni e note di
 * lavorazione. Nessuna dipendenza da database o da Fastify: testabile in
 * isolamento e riusabile fra risposta API, endpoint degli avvisi e generazione
 * del PDF.
 *
 * Tutti gli importi sono in € con 2 decimali. Le ore sono un dato registrato,
 * non più una durata calcolata da una fascia oraria: la conversione
 * `ora_inizio`/`ora_fine` → ore decimali è sparita insieme alla fascia oraria
 * stessa (FR-004).
 */

const round2 = (value) => Math.round(Number(value) * 100) / 100;

/**
 * @typedef {object} MaterialeLavorazione
 * @property {number|null} id
 * @property {number|null} pezzo_id
 * @property {string} nome
 * @property {number} quantita
 * @property {boolean} fuori_catalogo
 * @property {number} prezzo_unitario
 */

/**
 * @typedef {object} LavorazioneInput
 * @property {number} id
 * @property {number} ore - numero di ore registrato, non calcolato
 * @property {number} costo_orario_applicato
 * @property {MaterialeLavorazione[]} materiali
 */

/**
 * @typedef {object} TotaliLavorazione
 * @property {number} ore_lavorate
 * @property {number} subtotale_materiali
 * @property {number} costo_manodopera
 * @property {number} totale_lavorazione
 * @property {boolean} flag_costo_orario_zero
 * @property {boolean} flag_materiali_senza_prezzo
 */

/**
 * Calcola i totali economici di una singola lavorazione.
 * @param {LavorazioneInput} lavorazione
 * @returns {TotaliLavorazione}
 */
function calcolaTotaliLavorazione(lavorazione) {
  const ore = round2(Number(lavorazione.ore || 0));
  const materiali = Array.isArray(lavorazione.materiali) ? lavorazione.materiali : [];
  const subtotale = round2(
    materiali.reduce((acc, m) => acc + Number(m.prezzo_unitario || 0) * Number(m.quantita || 0), 0)
  );
  const costoOrario = Number(lavorazione.costo_orario_applicato || 0);
  const manodopera = round2(ore * costoOrario);
  const totale = round2(subtotale + manodopera);
  const flagCostoZero = ore > 0 && costoOrario === 0;
  const flagMaterialiZero = materiali.some(
    (m) => Number(m.prezzo_unitario || 0) === 0 && Number(m.quantita || 0) > 0
  );
  return {
    ore_lavorate: ore,
    subtotale_materiali: subtotale,
    costo_manodopera: manodopera,
    totale_lavorazione: totale,
    flag_costo_orario_zero: flagCostoZero,
    flag_materiali_senza_prezzo: flagMaterialiZero,
  };
}

/**
 * @typedef {object} OverrideNota
 * @property {number|null} [materiali] - totale imposto ai materiali
 * @property {number|null} [manodopera] - totale imposto alla manodopera
 * @property {number|null} [complessivo] - totale imposto complessivo
 */

/**
 * @typedef {object} TotaliNota
 * @property {number} totale_materiali_calcolato - somma dei materiali, sempre
 * @property {number} totale_manodopera_calcolato - ore per costo orario, sempre
 * @property {number} totale_materiali - il calcolato, oppure quello imposto
 * @property {number} totale_manodopera - il calcolato, oppure quello imposto
 * @property {number} totale_calcolato - somma dei due calcolati
 * @property {number} totale_finale - cio' che il documento espone
 * @property {boolean} override_materiali_attivo
 * @property {boolean} override_manodopera_attivo
 * @property {boolean} override_attivo - riferito al totale complessivo
 * @property {boolean} override_discrepanza
 */

/**
 * Vero se il valore e' un totale imposto. `0` lo e'; `null` no.
 *
 * @param {number|null|undefined} v - valore da esaminare
 * @returns {boolean}
 */
function imposto(v) {
  return v !== null && v !== undefined && !Number.isNaN(Number(v));
}

/**
 * Aggrega i totali delle lavorazioni e applica gli eventuali valori imposti.
 *
 * La precedenza:
 *
 *   1. il totale imposto ai materiali sostituisce quello calcolato;
 *   2. il totale imposto alla manodopera sostituisce quello calcolato;
 *   3. il totale complessivo e' la somma dei due valori risultanti;
 *   4. il totale complessivo imposto, se presente, sostituisce quella somma.
 *
 * I valori **calcolati** restano esposti accanto a quelli imposti: servono a
 * mostrare da cosa ci si sta discostando, e a farli riapparire quando l'override
 * viene rimosso. Ne consegue che le correzioni sui singoli materiali, e quelle
 * sul costo orario di una lavorazione, continuano ad avere effetto sul valore
 * calcolato anche mentre un totale imposto lo copre — e tornano a determinare
 * il totale appena viene tolto.
 *
 * @param {LavorazioneInput[]} lavorazioni - lavorazioni della nota
 * @param {OverrideNota|number|null|undefined} override - i tre valori imposti, oppure il solo totale complessivo
 * @returns {TotaliNota}
 */
function calcolaTotaliNota(lavorazioni, override) {
  const rows = Array.isArray(lavorazioni) ? lavorazioni : [];
  let materiali = 0;
  let manodopera = 0;
  for (const l of rows) {
    const t = calcolaTotaliLavorazione(l);
    materiali += t.subtotale_materiali;
    manodopera += t.costo_manodopera;
  }

  const materialiCalcolato = round2(materiali);
  const manodoperaCalcolato = round2(manodopera);
  const totaleCalcolato = round2(materialiCalcolato + manodoperaCalcolato);

  // Accetta anche il solo numero, che era la forma precedente: chiamarla con un
  // importo continua a significare "totale complessivo imposto".
  let ov = {};
  if (override !== null && override !== undefined) {
    ov = typeof override === 'object' ? override : { complessivo: override };
  }

  const overrideMateriali = imposto(ov.materiali);
  const overrideManodopera = imposto(ov.manodopera);
  const overrideComplessivo = imposto(ov.complessivo);

  const materialiFinale = overrideMateriali ? round2(ov.materiali) : materialiCalcolato;
  const manodoperaFinale = overrideManodopera ? round2(ov.manodopera) : manodoperaCalcolato;
  const somma = round2(materialiFinale + manodoperaFinale);
  const totaleFinale = overrideComplessivo ? round2(ov.complessivo) : somma;

  return {
    totale_materiali_calcolato: materialiCalcolato,
    totale_manodopera_calcolato: manodoperaCalcolato,
    totale_materiali: materialiFinale,
    totale_manodopera: manodoperaFinale,
    totale_calcolato: totaleCalcolato,
    totale_finale: totaleFinale,
    override_materiali_attivo: overrideMateriali,
    override_manodopera_attivo: overrideManodopera,
    override_attivo: overrideComplessivo,
    override_discrepanza:
      (overrideComplessivo || overrideMateriali || overrideManodopera) &&
      totaleFinale !== totaleCalcolato,
  };
}

/**
 * @typedef {object} PdfWarnings
 * @property {boolean} has_warnings
 * @property {Array<{lavorazione_id:number, giorno?:string, ore?:number, utente_nome?:string, macchina?:string}>} lavorazioni_costo_orario_zero
 * @property {Array<{lavorazione_id:number, materiale_id:number|null, nome:string, fuori_catalogo:boolean}>} materiali_prezzo_zero
 */

/**
 * Rileva lavorazioni e materiali con valori a zero che meritano un avviso prima
 * di generare il PDF: un documento che espone un costo a zero senza averlo
 * segnalato è indistinguibile da uno corretto.
 * @param {LavorazioneInput[]} lavorazioni
 * @returns {PdfWarnings}
 */
function rilevaWarningPdf(lavorazioni) {
  const rows = Array.isArray(lavorazioni) ? lavorazioni : [];
  const lavorazioniZero = [];
  const materialiZero = [];
  for (const l of rows) {
    const ore = round2(Number(l.ore || 0));
    if (ore > 0 && Number(l.costo_orario_applicato || 0) === 0) {
      lavorazioniZero.push({
        lavorazione_id: l.id,
        giorno: l.giorno,
        ore,
        utente_nome: l.utente_nome,
        macchina: l.macchina,
      });
    }
    const materiali = Array.isArray(l.materiali) ? l.materiali : [];
    for (const m of materiali) {
      if (Number(m.prezzo_unitario || 0) === 0 && Number(m.quantita || 0) > 0) {
        materialiZero.push({
          lavorazione_id: l.id,
          materiale_id: m.id ?? null,
          nome: m.nome,
          fuori_catalogo: !!m.fuori_catalogo,
        });
      }
    }
  }
  return {
    has_warnings: lavorazioniZero.length > 0 || materialiZero.length > 0,
    lavorazioni_costo_orario_zero: lavorazioniZero,
    materiali_prezzo_zero: materialiZero,
  };
}

/**
 * Estrae dalla riga della nota i tre scostamenti, nella forma che
 * `calcolaTotaliNota` si aspetta.
 *
 * Sta QUI, accanto alla funzione che li consuma, e non nella rotta: gli stessi
 * tre valori erano gia' stati letti in due forme diverse — una chiamata passava
 * un contenitore che l'altra funzione non sapeva leggere, e ogni scostamento
 * risultava assente senza che nulla fallisse. Con una sola estrazione quel
 * disallineamento non e' rappresentabile.
 * @param {object} nota - riga della tabella note_lavorazione
 * @returns {{materiali: number|null, manodopera: number|null, complessivo: number|null}}
 */
function overrideDi(nota) {
  const valore = (v) => (v === null || v === undefined ? null : Number(v));
  return {
    materiali: valore(nota.totale_materiali_override),
    manodopera: valore(nota.totale_manodopera_override),
    complessivo: valore(nota.totale_override),
  };
}

module.exports = {
  overrideDi,
  calcolaTotaliLavorazione,
  calcolaTotaliNota,
  rilevaWarningPdf,
};
