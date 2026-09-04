/**
 * Regole di coerenza fra i totali imposti e i dettagli mostrati nel documento.
 *
 * Servizio puro: nessuna dipendenza da database o da Fastify.
 *
 * Esiste perché la stessa regola serve in tre punti — la validazione della
 * richiesta, la generazione del PDF e l'abilitazione degli interruttori
 * nell'interfaccia. Scritta tre volte, prima o poi due divergono, e la
 * divergenza produce un documento in cui un elenco non somma al totale che
 * espone.
 *
 * La regola in una riga: **un totale imposto spegne il dettaglio
 * corrispondente**, perché righe che non sommano a quel totale renderebbero il
 * documento contraddittorio.
 */

/**
 * Vero se il valore è un totale imposto.
 *
 * `0` è un totale imposto a tutti gli effetti — un intervento in garanzia — ed
 * è diverso da "nessun totale imposto". Confondere i due significherebbe
 * riaccendere un dettaglio che l'amministratore aveva spento.
 *
 * @param {number|null|undefined} valore
 * @returns {boolean}
 */
function eImposto(valore) {
  return valore !== null && valore !== undefined && !Number.isNaN(Number(valore));
}

/**
 * @typedef {object} Totali
 * @property {number|null} [totale_materiali_override]
 * @property {number|null} [totale_manodopera_override]
 * @property {number|null} [totale_override] - il totale complessivo
 * @property {number|null} [materiali] - forma breve, equivalente
 * @property {number|null} [manodopera] - forma breve, equivalente
 * @property {number|null} [complessivo] - forma breve, equivalente
 */

/**
 * Riconduce a una forma sola i due modi in cui gli stessi tre valori girano nel
 * codice: i nomi delle colonne (`totale_materiali_override`…) e la forma breve
 * (`materiali`…).
 *
 * Esiste perche' avere due forme per gli stessi tre valori ha gia' prodotto un
 * difetto: una chiamata passava la forma breve a una funzione che leggeva i
 * nomi delle colonne, e ogni override risultava assente. Nessun errore, solo un
 * documento che mostrava dettagli che avrebbe dovuto nascondere.
 *
 * @param {Totali} input - i valori in una delle due forme
 * @returns {{materiali: number|null, manodopera: number|null, complessivo: number|null}}
 */
function normalizza(input = {}) {
  const scegli = (a, b) => (a !== undefined ? a : b !== undefined ? b : null);
  return {
    materiali: scegli(input.totale_materiali_override, input.materiali),
    manodopera: scegli(input.totale_manodopera_override, input.manodopera),
    complessivo: scegli(input.totale_override, input.complessivo),
  };
}

/**
 * @typedef {object} DettagliAmmessi
 * @property {boolean} materiali
 * @property {boolean} manodopera
 */

/**
 * Dice quali dettagli è ammesso mostrare, dati i totali imposti.
 *
 * @param {Totali} totali
 * @returns {DettagliAmmessi}
 */
function dettagliAmmessi(totali = {}) {
  const v = normalizza(totali);
  // Il totale complessivo imposto spegne ENTRAMBI: se si decide a parte la
  // cifra finale, nessun elenco può sommare a quel valore.
  if (eImposto(v.complessivo)) {
    return { materiali: false, manodopera: false };
  }
  return {
    materiali: !eImposto(v.materiali),
    manodopera: !eImposto(v.manodopera),
  };
}

/**
 * Spiega perché un dettaglio non è ammesso, nominando quale totale imposto lo
 * impedisce.
 *
 * Il messaggio dice cosa togliere: un rifiuto che non lo dice manda a
 * indovinare.
 *
 * @param {'materiali'|'manodopera'} dettaglio
 * @param {Totali} totali
 * @returns {string|null} spiegazione, oppure null se il dettaglio è ammesso
 */
function motivoDelRifiuto(dettaglio, totali = {}) {
  if (dettagliAmmessi(totali)[dettaglio]) return null;

  if (eImposto(normalizza(totali).complessivo)) {
    return `Il totale complessivo è stato imposto a mano: nessun dettaglio può essere mostrato, perché le sue righe non sommerebbero a quel valore. Rimuovi il totale complessivo per mostrare il dettaglio ${dettaglio}.`;
  }

  const nome = dettaglio === 'materiali' ? 'dei materiali' : 'della manodopera';
  return `Il totale ${nome} è stato imposto a mano: il dettaglio ${nome} non può essere mostrato, perché le sue righe non sommerebbero a quel valore. Rimuovi il totale imposto per mostrarlo.`;
}

/**
 * Verifica una richiesta completa: quali dettagli si vogliono mostrare, dati i
 * totali imposti.
 *
 * @param {object} richiesta
 * @param {boolean} [richiesta.mostra_dettaglio_materiali]
 * @param {boolean} [richiesta.mostra_dettaglio_manodopera]
 * @param {number|null} [richiesta.totale_materiali_override]
 * @param {number|null} [richiesta.totale_manodopera_override]
 * @param {number|null} [richiesta.totale_override]
 * @returns {{valida: boolean, errore?: string}}
 */
function verificaRichiesta(richiesta = {}) {
  const ammessi = dettagliAmmessi(richiesta);

  if (richiesta.mostra_dettaglio_materiali && !ammessi.materiali) {
    return { valida: false, errore: motivoDelRifiuto('materiali', richiesta) };
  }
  if (richiesta.mostra_dettaglio_manodopera && !ammessi.manodopera) {
    return { valida: false, errore: motivoDelRifiuto('manodopera', richiesta) };
  }
  return { valida: true };
}

/**
 * Dice se gli avvisi pre-stampa di una voce vanno soppressi.
 *
 * Un avviso segnala un valore a zero che finirebbe nel documento. Con un totale
 * imposto quel valore non ci finisce, perché la cifra è decisa a parte:
 * lasciarlo manderebbe a correggere qualcosa che non cambia nulla, e un avviso
 * che sbaglia spesso viene ignorato anche quando ha ragione.
 *
 * @param {Totali} totali
 * @returns {{materiali: boolean, manodopera: boolean}} vero = soppressi
 */
function avvisiSoppressi(totali = {}) {
  const ammessi = dettagliAmmessi(totali);
  return { materiali: !ammessi.materiali, manodopera: !ammessi.manodopera };
}

module.exports = {
  eImposto,
  normalizza,
  dettagliAmmessi,
  motivoDelRifiuto,
  verificaRichiesta,
  avvisiSoppressi,
};
