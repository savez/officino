/**
 * Stato di un rapportino e regole su chi può modificarlo.
 *
 * Servizio puro: nessuna dipendenza da database o da Fastify, così la regola si
 * verifica in isolamento invece che attraverso una richiesta HTTP.
 *
 * Lo stato NON è una colonna. Si deriva da `chiuso_il` e `nota_lavorazione_id`,
 * perché una colonna `stato` scritta accanto a `nota_lavorazione_id`
 * rappresenterebbe due volte lo stesso fatto: basterebbe un endpoint che
 * aggiorna l'una e non l'altra per avere un rapportino gestito senza nota, e
 * nulla lo segnalerebbe. Con la derivazione la contraddizione non è
 * rappresentabile.
 */

const APERTO = 'aperto';
const CHIUSO = 'chiuso';
const GESTITO = 'gestito';

const STATI = [APERTO, CHIUSO, GESTITO];

/**
 * @typedef {object} Rapportino
 * @property {number} id
 * @property {number} utente_id
 * @property {string|Date|null} [chiuso_il]
 * @property {number|null} [nota_lavorazione_id]
 */

/**
 * @typedef {object} Utente
 * @property {number} id
 * @property {string} ruolo - 'admin' oppure 'user'
 */

/**
 * @typedef {object} Esito
 * @property {boolean} consentito
 * @property {number} [codice] - stato HTTP da restituire quando non è consentito
 * @property {string} [messaggio] - spiegazione rivolta a chi legge, non al programmatore
 */

/**
 * Deriva lo stato dai due campi che lo determinano.
 * @param {Rapportino} rapportino
 * @returns {'aperto'|'chiuso'|'gestito'}
 */
function derivaStato(rapportino) {
  if (rapportino.nota_lavorazione_id) return GESTITO;
  if (rapportino.chiuso_il) return CHIUSO;
  return APERTO;
}

/**
 * La stessa derivazione, tradotta in condizione di ricerca.
 *
 * Sta QUI e non nelle rotte perche' `derivaStato` e questa funzione sono le due
 * meta' di una regola sola: come si legge lo stato e come lo si filtra. Scritte
 * in file diversi possono divergere — un endpoint che filtra «aperto» in un
 * modo e una schermata che lo etichetta in un altro — e nulla lo segnalerebbe.
 * Il test le confronta sugli stessi dati proprio per questo.
 * @param {import('knex').Knex.QueryBuilder} query
 * @param {'aperto'|'chiuso'|'gestito'} stato
 * @param {string} [alias] - alias della tabella rapportini nella query chiamante
 * @returns {import('knex').Knex.QueryBuilder}
 */
function applicaStato(query, stato, alias = 'r') {
  if (stato === APERTO) {
    return query.whereNull(`${alias}.chiuso_il`).whereNull(`${alias}.nota_lavorazione_id`);
  }
  if (stato === CHIUSO) {
    return query.whereNotNull(`${alias}.chiuso_il`).whereNull(`${alias}.nota_lavorazione_id`);
  }
  if (stato === GESTITO) {
    return query.whereNotNull(`${alias}.nota_lavorazione_id`);
  }
  // Uno stato sconosciuto non filtra nulla, com'era prima: la validazione dei
  // parametri sta a monte, e qui inventarsi un errore cambierebbe il
  // comportamento di rotte che questa estrazione non deve toccare.
  return query;
}

/**
 * Vero se l'utente è amministratore.
 * @param {Utente} utente
 * @returns {boolean}
 */
function isAmministratore(utente) {
  return utente && utente.ruolo === 'admin';
}

/**
 * Vero se l'utente può vedere il rapportino: l'autore, oppure un amministratore.
 * @param {Rapportino} rapportino
 * @param {Utente} utente
 * @returns {boolean}
 */
function puoVedere(rapportino, utente) {
  return isAmministratore(utente) || rapportino.utente_id === utente.id;
}

/**
 * Applica la regola unica: si modifica un rapportino SE E SOLO SE è aperto, e
 * chi lo modifica dev'essere l'autore oppure un amministratore.
 *
 * È un cambio rispetto al comportamento precedente, in cui l'amministratore
 * modificava le righe di chiunque senza vincolo di stato. Tenere una regola
 * sola invece di un'eccezione per ruolo significa poterla verificare in un
 * punto solo.
 * @param {Rapportino} rapportino
 * @param {Utente} utente
 * @returns {Esito}
 */
function verificaModificabile(rapportino, utente) {
  if (!puoVedere(rapportino, utente)) {
    return {
      consentito: false,
      codice: 403,
      messaggio: 'Non puoi intervenire sui rapportini di altri operai',
    };
  }

  const stato = derivaStato(rapportino);

  if (stato === GESTITO) {
    return {
      consentito: false,
      codice: 403,
      messaggio: 'Rapportino incluso in una nota di lavorazione. Va prima dissociato dalla nota.',
    };
  }

  if (stato === CHIUSO) {
    return {
      consentito: false,
      codice: 403,
      messaggio: isAmministratore(utente)
        ? 'Rapportino concluso. Riaprilo prima di modificarlo.'
        : 'Rapportino concluso. Chiedi a un amministratore di riaprirlo.',
    };
  }

  return { consentito: true };
}

/**
 * Regole di eliminazione del rapportino.
 *
 * L'autore elimina solo un rapportino aperto e vuoto: serve a rimuovere un
 * contenitore creato per errore — un macchinario scritto male, che l'avviso
 * segnala ma non impedisce — che altrimenti resterebbe nell'elenco per sempre,
 * non concludibile perché vuoto e non rimovibile.
 *
 * L'amministratore elimina anche un rapportino pieno, ma sta all'interfaccia
 * chiedere conferma dichiarando quante lavorazioni verranno perse.
 * @param {Rapportino} rapportino
 * @param {Utente} utente
 * @param {number} numeroLavorazioni
 * @returns {Esito}
 */
function verificaEliminabile(rapportino, utente, numeroLavorazioni) {
  const modificabile = verificaModificabile(rapportino, utente);
  if (!modificabile.consentito) {
    return modificabile;
  }

  if (numeroLavorazioni > 0 && !isAmministratore(utente)) {
    return {
      consentito: false,
      codice: 403,
      messaggio:
        'Il rapportino contiene lavorazioni. Eliminale prima, oppure chiedi a un amministratore.',
    };
  }

  return { consentito: true };
}

/**
 * Verifica la possibilità di dichiarare concluso un rapportino.
 *
 * Solo l'autore chiude: un amministratore che volesse farlo starebbe decidendo
 * al posto dell'operaio che il lavoro è finito.
 * @param {Rapportino} rapportino
 * @param {Utente} utente
 * @param {number} numeroLavorazioni
 * @returns {Esito}
 */
function verificaChiudibile(rapportino, utente, numeroLavorazioni) {
  // Lo stato si controlla PRIMA dell'autore. Su un rapportino gia' chiuso o
  // gestito lo stato e' la ragione saliente chiunque stia chiedendo: rispondere
  // "solo chi l'ha compilato puo' concluderlo" a un amministratore che agisce su
  // un rapportino gia' in nota sarebbe vero ma fuorviante, e lo manderebbe a
  // cercare il problema dalla parte sbagliata.
  const stato = derivaStato(rapportino);
  if (stato === GESTITO) {
    return {
      consentito: false,
      codice: 403,
      messaggio: 'Rapportino incluso in una nota di lavorazione. Va prima dissociato dalla nota.',
    };
  }
  if (stato === CHIUSO) {
    return { consentito: false, codice: 403, messaggio: 'Il rapportino è già concluso' };
  }

  if (rapportino.utente_id !== utente.id) {
    return {
      consentito: false,
      codice: 403,
      messaggio: 'Solo chi ha compilato il rapportino può dichiararlo concluso',
    };
  }

  if (numeroLavorazioni === 0) {
    return {
      consentito: false,
      codice: 400,
      messaggio: 'Un rapportino senza lavorazioni non può essere concluso',
    };
  }

  return { consentito: true };
}

/**
 * Verifica la possibilità di riaprire un rapportino chiuso.
 * @param {Rapportino} rapportino
 * @param {Utente} utente
 * @returns {Esito}
 */
function verificaRiapribile(rapportino, utente) {
  if (!isAmministratore(utente)) {
    return {
      consentito: false,
      codice: 403,
      messaggio: 'Solo un amministratore può riaprire un rapportino',
    };
  }

  const stato = derivaStato(rapportino);

  if (stato === GESTITO) {
    return {
      consentito: false,
      codice: 403,
      messaggio:
        'Rapportino incluso in una nota di lavorazione. Dissocialo dalla nota prima di riaprirlo.',
    };
  }

  if (stato === APERTO) {
    return { consentito: false, codice: 400, messaggio: 'Il rapportino è già aperto' };
  }

  return { consentito: true };
}

module.exports = {
  APERTO,
  CHIUSO,
  GESTITO,
  STATI,
  derivaStato,
  applicaStato,
  isAmministratore,
  puoVedere,
  verificaModificabile,
  verificaEliminabile,
  verificaChiudibile,
  verificaRiapribile,
};
