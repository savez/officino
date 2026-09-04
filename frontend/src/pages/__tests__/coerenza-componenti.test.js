import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const qui = dirname(fileURLToPath(import.meta.url));

/**
 * Divide un componente a file singolo nelle sue due sezioni.
 * @param {string} percorso - percorso relativo del file .vue
 * @returns {{script: string, template: string}} le due sezioni
 */
function leggiComponente(percorso) {
  const testo = readFileSync(resolve(qui, percorso), 'utf8');
  const script = testo.slice(testo.indexOf('<script'), testo.indexOf('</script>'));
  const template = testo.slice(testo.indexOf('<template>'), testo.lastIndexOf('</template>'));
  return { script, template };
}

/**
 * Verifica che un nome usato nel template sia dichiarato nello script.
 * @param {object} sezioni - le due sezioni del componente
 * @param {string} nome - identificatore da controllare
 * @returns {object} esito confrontabile
 */
function coerenza({ script, template }, nome) {
  return {
    nome,
    usatoNelTemplate: new RegExp(`[^a-zA-Z]${nome}[^a-zA-Z]`).test(template),
    dichiaratoNelloScript: new RegExp(`(const|let|function)\\s+${nome}\\b`).test(script),
  };
}

const atteso = (nome) => ({ nome, usatoNelTemplate: true, dichiaratoNelloScript: true });

// Questi test esistono per un difetto reale gia' capitato: le
// modifiche allo <script> di DashboardPage non erano mai state applicate,
// mentre quelle al <template> sì. Il risultato era un v-for su una variabile
// inesistente, quindi una tendina degli operai sempre vuota.
//
// Né `vite build` né ESLint lo segnalavano: Vue non verifica che i riferimenti
// del template esistano nello script, e un template che cicla su `undefined`
// semplicemente non produce righe.
describe('DashboardPage: coerenza fra template e script', () => {
  const sezioni = leggiComponente('../DashboardPage.vue');

  for (const nome of [
    'operai',
    'operaioSelezionato',
    'oreMancanti',
    'onOperaioChange',
    'onPeriodoChange',
    'periodo',
    'stats',
    'admin',
    'loading',
  ]) {
    it(`${nome} è dichiarato`, () => {
      expect(coerenza(sezioni, nome)).toEqual(atteso(nome));
    });
  }

  it('il filtro operaio viene inoltrato al server', () => {
    expect(sezioni.script).toMatch(/parametri\.operaio_id\s*=\s*operaioSelezionato\.value/);
  });

  it("l'export usa gli stessi parametri del caricamento", () => {
    // Uno nel caricamento e uno nell'export: se ne mancasse uno, si
    // esporterebbe un insieme diverso da quello mostrato, senza alcun segnale.
    const occorrenze = sezioni.script.match(/parametri\.operaio_id/g) || [];
    expect(occorrenze.length).toBe(2);
  });
});

describe('RapportiniPage: coerenza fra template e script', () => {
  const sezioni = leggiComponente('../RapportiniPage.vue');

  for (const nome of [
    'periodo',
    'onPeriodoChange',
    'stampa',
    'azzeraFiltri',
    'applicaFiltri',
    'rapportini',
    'periodoLeggibile',
    'puoAggiungere',
    'puoConcludere',
    'puoRiaprire',
    'puoEliminare',
    'apriDettaglio',
    'apriAggiungiLavorazione',
    'concludi',
    'riapri',
    'elimina',
    'selezionabile',
    'puoCreareNota',
  ]) {
    it(`${nome} è dichiarato`, () => {
      expect(coerenza(sezioni, nome)).toEqual(atteso(nome));
    });
  }

  it('non restano riferimenti al vecchio filtro per giorno singolo', () => {
    expect(sezioni.script).not.toMatch(/filtroGiorno/);
    expect(sezioni.template).not.toMatch(/filtroGiorno/);
  });

  it('non restano riferimenti alla fascia oraria', () => {
    expect(sezioni.script).not.toMatch(/ora_inizio|ora_fine/);
    expect(sezioni.template).not.toMatch(/ora_inizio|ora_fine/);
  });

  it('la stampa usa lo stesso periodo dell elenco', () => {
    expect(sezioni.script).toMatch(/params\.da = periodo\.value\.da/);
  });

  // FR-021: il filtro seleziona i rapportini con almeno una lavorazione nel
  // periodo. Senza la spiegazione a schermo, un rapportino lungo che compare in
  // un mese "sbagliato" si legge come un difetto.
  it('il significato del filtro per periodo è spiegato accanto al filtro', () => {
    expect(sezioni.template).toMatch(/almeno una lavorazione/i);
  });
});

// I tre componenti nati con questa feature. Stessa verifica: un riferimento del
// template che non esiste nello script non fa fallire né il build né ESLint.
describe('componenti dei rapportini: coerenza fra template e script', () => {
  const casi = [
    [
      '../../components/RapportinoFormModal.vue',
      ['form', 'salva', 'errore', 'clienti', 'avvisoDuplicato', 'salvataggio'],
    ],
    [
      '../../components/LavorazioneFormModal.vue',
      ['form', 'salva', 'errore', 'titolo', 'oreDaConfermare', 'aggiornaMateriali'],
    ],
    [
      '../../components/RapportinoDettaglioModal.vue',
      ['dettaglio', 'caricamento', 'errore', 'modificabile', 'elimina', 'formattaGiorno', 'formattaOre'],
    ],
  ];

  for (const [percorso, nomi] of casi) {
    describe(percorso.split('/').pop(), () => {
      const sezioni = leggiComponente(percorso);
      for (const nome of nomi) {
        it(`${nome} è dichiarato`, () => {
          expect(coerenza(sezioni, nome)).toEqual(atteso(nome));
        });
      }
    });
  }
});
