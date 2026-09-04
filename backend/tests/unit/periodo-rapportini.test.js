'use strict';

const { getApp, getAuthToken } = require('../helpers/setup');
const {
  applicaPeriodoElenco,
  applicaPeriodoConteggio,
  applicaSenzaLavorazioni,
} = require('../../src/services/periodo-rapportini');

// Il modulo esiste per una ragione sola: la dashboard deve contare gli stessi
// rapportini che l'elenco mostra. Finche' la regola era scritta due volte,
// quella coincidenza era una speranza. Qui si verifica che le due varianti
// differiscano ESATTAMENTE nel punto voluto, e in nessun altro.

let app;
let clienteId;
let utenteId;

const PERIODO = { da: '2026-03-01', a: '2026-03-31' };

beforeAll(async () => {
  app = getApp();
  // `getAuthToken` innesca la creazione degli utenti di prova: senza, la
  // tabella e' vuota e la query sotto non trova nulla.
  await getAuthToken();
  utenteId = (await app.db('utenti').where({ email: 'operaio@officino.app' }).first()).id;
});

beforeEach(async () => {
  await app.db('materiali_lavorazione').del();
  await app.db('lavorazioni').del();
  await app.db('rapportini').del();
  await app.db('clienti').del();
  const [cliente] = await app.db('clienti').insert({ nome: 'Cliente Periodo' }).returning('*');
  clienteId = cliente.id;
});

afterEach(async () => {
  await app.db('materiali_lavorazione').del();
  await app.db('lavorazioni').del();
  await app.db('rapportini').del();
  await app.db('clienti').del();
});

/**
 * Crea un rapportino, con o senza lavorazioni.
 * @param {string[]} giorni - giorni delle lavorazioni; vuoto = rapportino vuoto
 * @returns {Promise<number>} id del rapportino
 */
async function creaRapportino(giorni = []) {
  const [r] = await app
    .db('rapportini')
    .insert({ utente_id: utenteId, cliente_id: clienteId, macchina: 'Tornio' })
    .returning('*');
  for (const giorno of giorni) {
    await app
      .db('lavorazioni')
      .insert({ rapportino_id: r.id, giorno, ore: 2, costo_orario_applicato: 30 });
  }
  return r.id;
}

/**
 * Esegue una variante del predicato e restituisce gli id trovati.
 * @param {(q: import('knex').Knex.QueryBuilder) => import('knex').Knex.QueryBuilder} applica
 * @returns {Promise<number[]>}
 */
async function idsCon(applica) {
  const query = applica(app.db('rapportini as r'));
  const righe = await query.select('r.id').orderBy('r.id');
  return righe.map((x) => x.id);
}

describe('le due varianti del criterio di periodo', () => {
  it('entrambe includono un rapportino con lavorazioni dentro il periodo', async () => {
    const id = await creaRapportino(['2026-03-15']);
    expect(await idsCon((q) => applicaPeriodoElenco(q, PERIODO))).toEqual([id]);
    expect(await idsCon((q) => applicaPeriodoConteggio(q, PERIODO))).toEqual([id]);
  });

  it('entrambe escludono un rapportino le cui lavorazioni cadono fuori', async () => {
    await creaRapportino(['2026-02-10']);
    expect(await idsCon((q) => applicaPeriodoElenco(q, PERIODO))).toEqual([]);
    expect(await idsCon((q) => applicaPeriodoConteggio(q, PERIODO))).toEqual([]);
  });

  it('entrambe includono un rapportino a cavallo del periodo', async () => {
    // Gennaio-marzo compare anche filtrando febbraio: e' la lettura scelta da
    // FR-021, e vale per la misura come per l'elenco.
    const id = await creaRapportino(['2026-01-20', '2026-03-05', '2026-05-01']);
    expect(await idsCon((q) => applicaPeriodoElenco(q, PERIODO))).toEqual([id]);
    expect(await idsCon((q) => applicaPeriodoConteggio(q, PERIODO))).toEqual([id]);
  });

  it('DIVERGONO sul rapportino senza lavorazioni, ed e la sola divergenza', async () => {
    // E' il punto per cui il modulo esiste. L'elenco deve mostrarlo — altrimenti
    // un rapportino appena creato sarebbe irraggiungibile — mentre il conteggio
    // deve escluderlo, o lo conterebbe in ogni periodo per sempre.
    const vuoto = await creaRapportino([]);
    expect(await idsCon((q) => applicaPeriodoElenco(q, PERIODO))).toEqual([vuoto]);
    expect(await idsCon((q) => applicaPeriodoConteggio(q, PERIODO))).toEqual([]);
  });

  it('il rapportino vuoto non entra nel conteggio di NESSUN periodo', async () => {
    await creaRapportino([]);
    for (const p of [
      { da: '2020-01-01', a: '2020-12-31' },
      { da: '2026-03-01', a: '2026-03-31' },
      { da: '2099-01-01', a: '2099-12-31' },
    ]) {
      expect(await idsCon((q) => applicaPeriodoConteggio(q, p))).toEqual([]);
    }
  });
});

describe('i rapportini senza lavorazioni', () => {
  it('sono selezionati a parte, indipendentemente dal periodo', async () => {
    const vuoto = await creaRapportino([]);
    await creaRapportino(['2026-03-10']);
    expect(await idsCon(applicaSenzaLavorazioni)).toEqual([vuoto]);
  });

  it('smettono di esserlo appena ricevono una lavorazione', async () => {
    const id = await creaRapportino([]);
    expect(await idsCon(applicaSenzaLavorazioni)).toEqual([id]);
    await app
      .db('lavorazioni')
      .insert({ rapportino_id: id, giorno: '2026-03-10', ore: 1, costo_orario_applicato: 30 });
    expect(await idsCon(applicaSenzaLavorazioni)).toEqual([]);
  });
});

describe("l'invariante che tiene insieme dashboard ed elenco (FR-014c)", () => {
  it('conteggio + senza lavorazioni = elenco, su un insieme misto', async () => {
    await creaRapportino(['2026-03-05']); // dentro
    await creaRapportino(['2026-03-20']); // dentro
    await creaRapportino(['2026-01-15']); // fuori
    await creaRapportino([]); // vuoto
    await creaRapportino([]); // vuoto

    const elenco = await idsCon((q) => applicaPeriodoElenco(q, PERIODO));
    const conteggio = await idsCon((q) => applicaPeriodoConteggio(q, PERIODO));
    const vuoti = await idsCon(applicaSenzaLavorazioni);

    expect(conteggio.length + vuoti.length).toBe(elenco.length);
    expect([...conteggio, ...vuoti].sort()).toEqual([...elenco].sort());
  });

  it('regge anche quando non c e nulla nel periodo', async () => {
    await creaRapportino(['2026-01-15']);
    await creaRapportino([]);

    const elenco = await idsCon((q) => applicaPeriodoElenco(q, PERIODO));
    const conteggio = await idsCon((q) => applicaPeriodoConteggio(q, PERIODO));
    const vuoti = await idsCon(applicaSenzaLavorazioni);

    expect(conteggio.length).toBe(0);
    expect(conteggio.length + vuoti.length).toBe(elenco.length);
  });
});

// ── Le due meta' della regola sugli stati ────────────────────────────────────
//
// `derivaStato` dice come si LEGGE lo stato di un rapportino; `applicaStato`
// dice come lo si FILTRA. Sono la stessa regola scritta in due linguaggi, e
// finche' vivevano in file diversi potevano divergere senza che nulla lo
// segnalasse: una rotta che filtra «aperto» in un modo e una schermata che lo
// etichetta in un altro. Qui si confrontano sugli stessi dati.
const { derivaStato, applicaStato, STATI } = require('../../src/services/stato-rapportino');

describe('filtrare per stato e leggere lo stato dicono la stessa cosa', () => {
  /**
   * Crea un rapportino nello stato voluto.
   * @param {'aperto'|'chiuso'|'gestito'} stato
   * @returns {Promise<number>}
   */
  async function creaNelloStato(stato) {
    let notaId = null;
    if (stato === 'gestito') {
      const [nota] = await app
        .db('note_lavorazione')
        .insert({ cliente_id: clienteId, testo: 'x', data_riferimento: '2026-03-15' })
        .returning('*');
      notaId = nota.id;
    }
    const [r] = await app
      .db('rapportini')
      .insert({
        utente_id: utenteId,
        cliente_id: clienteId,
        macchina: 'Fresa',
        chiuso_il: stato === 'aperto' ? null : new Date().toISOString(),
        nota_lavorazione_id: notaId,
      })
      .returning('*');
    return r.id;
  }

  afterEach(async () => {
    await app.db('note_lavorazione').del();
  });

  it.each(STATI)('per lo stato «%s» i due percorsi selezionano le stesse righe', async (stato) => {
    const attesi = [];
    for (const s of STATI) {
      const id = await creaNelloStato(s);
      if (s === stato) attesi.push(id);
    }

    // Percorso 1: la condizione di ricerca.
    const filtrati = (
      await applicaStato(app.db('rapportini as r'), stato).select('r.id').orderBy('r.id')
    ).map((x) => x.id);

    // Percorso 2: leggere tutte le righe e derivarne lo stato.
    const tutte = await app.db('rapportini as r').select('r.*').orderBy('r.id');
    const derivati = tutte.filter((r) => derivaStato(r) === stato).map((r) => r.id);

    expect(filtrati).toEqual(attesi);
    expect(derivati).toEqual(attesi);
  });
});
