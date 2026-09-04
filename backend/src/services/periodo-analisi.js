/**
 * Risoluzione e validazione dell'intervallo di analisi della dashboard.
 *
 * Funzioni pure, senza accesso al database: l'"oggi" e' un parametro e non
 * `new Date()` interno, altrimenti i test delle scorciatoie fallirebbero a ogni
 * cambio di mese.
 */

/**
 * Ampiezza massima dell'intervallo, in giorni.
 *
 * L'aggregazione avviene in memoria applicativa (vedi la route dashboard):
 * il costo di un intervallo e' il numero di righe caricate, non il calcolo.
 * Senza questo limite un intervallo di anni caricherebbe l'intero storico.
 * Il valore copre un anno bisestile intero piu' un margine, cosi' la
 * scorciatoia "quest'anno" non puo' mai sbatterci contro.
 */
const AMPIEZZA_MASSIMA_GIORNI = 400;

const SCORCIATOIE = ['questo-mese', 'mese-scorso', 'ultimi-30-giorni', 'quest-anno'];

const MILLISECONDI_AL_GIORNO = 24 * 60 * 60 * 1000;

/**
 * Formatta una data come YYYY-MM-DD usando il fuso locale.
 *
 * Non si usa toISOString(): converte in UTC e in Italia farebbe slittare la
 * data al giorno precedente per tutta la sera.
 * @param {Date} data - data da formattare
 * @returns {string} data in formato YYYY-MM-DD
 */
function formatta(data) {
  const anno = data.getFullYear();
  const mese = String(data.getMonth() + 1).padStart(2, '0');
  const giorno = String(data.getDate()).padStart(2, '0');
  return `${anno}-${mese}-${giorno}`;
}

/**
 * Converte YYYY-MM-DD in Date, rifiutando le date inesistenti.
 *
 * `new Date('2026-02-30')` non fallisce: scivola al 2 marzo. Qui il
 * riformattato viene confrontato con l'originale proprio per intercettarlo.
 * @param {string} testo - data in formato YYYY-MM-DD
 * @param {string} nomeCampo - nome del campo, per il messaggio d'errore
 * @returns {Date} data interpretata nel fuso locale
 */
function interpreta(testo, nomeCampo) {
  if (typeof testo !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(testo)) {
    throw new Error(`Data ${nomeCampo} non valida: attesa nel formato AAAA-MM-GG.`);
  }

  const [anno, mese, giorno] = testo.split('-').map(Number);
  const data = new Date(anno, mese - 1, giorno);

  if (formatta(data) !== testo) {
    throw new Error(`Data ${nomeCampo} inesistente nel calendario: ${testo}.`);
  }
  return data;
}

/**
 * Numero di giorni compresi fra due date, estremi inclusi.
 * @param {Date} da - data di inizio
 * @param {Date} a - data di fine
 * @returns {number} giorni compresi
 */
function giorniCompresi(da, a) {
  return Math.round((a - da) / MILLISECONDI_AL_GIORNO) + 1;
}

/**
 * Risolve una scorciatoia in un intervallo concreto.
 * @param {string} nome - nome della scorciatoia
 * @param {Date} oggi - data di riferimento
 * @returns {{da: string, a: string}} intervallo risolto
 */
function risolviScorciatoia(nome, oggi) {
  const anno = oggi.getFullYear();
  const mese = oggi.getMonth();

  switch (nome) {
    case 'questo-mese':
      // Giorno 0 del mese successivo e' l'ultimo del mese corrente: evita di
      // dover conoscere la lunghezza dei mesi e gli anni bisestili.
      return { da: formatta(new Date(anno, mese, 1)), a: formatta(new Date(anno, mese + 1, 0)) };

    case 'mese-scorso':
      return { da: formatta(new Date(anno, mese - 1, 1)), a: formatta(new Date(anno, mese, 0)) };

    case 'ultimi-30-giorni': {
      const inizio = new Date(anno, mese, oggi.getDate() - 29);
      return { da: formatta(inizio), a: formatta(oggi) };
    }

    case 'quest-anno':
      return { da: formatta(new Date(anno, 0, 1)), a: formatta(oggi) };

    default:
      throw new Error(
        `Scorciatoia non riconosciuta: ${nome}. Valori ammessi: ${SCORCIATOIE.join(', ')}.`
      );
  }
}

/**
 * Intervallo proposto all'apertura della dashboard, senza che l'utente scelga
 * nulla (FR-004).
 * @param {Date} [oggi] - data di riferimento
 * @returns {{da: string, a: string}} intervallo predefinito
 */
function periodoPredefinito(oggi = new Date()) {
  return risolviScorciatoia('questo-mese', oggi);
}

/**
 * Risolve e valida l'intervallo di analisi.
 *
 * La scorciatoia ha la precedenza sull'intervallo esplicito: chi la seleziona
 * non deve anche ripulire i campi da e a.
 * @param {object} parametri - parametri della richiesta
 * @param {string} [parametri.da] - data di inizio, YYYY-MM-DD
 * @param {string} [parametri.a] - data di fine, YYYY-MM-DD
 * @param {string} [parametri.scorciatoia] - nome di una scorciatoia
 * @param {Date} [oggi] - data di riferimento, iniettabile nei test
 * @returns {{da: string, a: string}} intervallo validato, estremi inclusi
 */
function risolviPeriodo(parametri = {}, oggi = new Date()) {
  const { da, a, scorciatoia } = parametri;

  if (scorciatoia) {
    return risolviScorciatoia(scorciatoia, oggi);
  }

  if (!da && !a) {
    return periodoPredefinito(oggi);
  }

  if (!da || !a) {
    throw new Error('Intervallo incompleto: servono entrambe le date, da e a.');
  }

  const dataDa = interpreta(da, 'iniziale');
  const dataA = interpreta(a, 'finale');

  if (dataA < dataDa) {
    throw new Error('La data finale e\' precedente a quella iniziale.');
  }

  const ampiezza = giorniCompresi(dataDa, dataA);
  if (ampiezza > AMPIEZZA_MASSIMA_GIORNI) {
    throw new Error(
      `Intervallo troppo ampio: ${ampiezza} giorni, il massimo e' ${AMPIEZZA_MASSIMA_GIORNI}.`
    );
  }

  return { da, a };
}

module.exports = {
  risolviPeriodo,
  periodoPredefinito,
  risolviScorciatoia,
  formatta,
  interpreta,
  giorniCompresi,
  SCORCIATOIE,
  AMPIEZZA_MASSIMA_GIORNI,
};
