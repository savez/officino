'use strict';

const { getApp, getAuthToken, getAdminToken } = require('../helpers/setup');

let app;
let userToken;
let adminToken;
let clienteId;
let altroClienteId;
let operaioId;

beforeAll(async () => {
  app = getApp();
  userToken = await getAuthToken();
  adminToken = await getAdminToken();
  operaioId = (await app.db('utenti').where({ email: 'operaio@officino.app' }).first()).id;
});

async function pulisci() {
  await app.db('materiali_lavorazione').del();
  await app.db('lavorazioni').del();
  await app.db('rapportini').del();
  await app.db('note_lavorazione').del();
  await app.db('catalogo_prodotti').del();
  await app.db('clienti').del();
}

beforeEach(async () => {
  await pulisci();
  const [c1] = await app.db('clienti').insert({ nome: 'Azienda Rossi' }).returning('*');
  const [c2] = await app.db('clienti').insert({ nome: 'Azienda Bianchi' }).returning('*');
  clienteId = c1.id;
  altroClienteId = c2.id;
});

afterEach(pulisci);

const auth = (token) => ({ authorization: `Bearer ${token}` });

/**
 * Crea un rapportino con una lavorazione.
 * @param {object} opzioni - stato, cliente, ore, costo orario, materiali
 * @returns {Promise<{rapportino: object, lavorazione: object}>}
 */
async function seedRapportino({
  chiuso = true,
  cliente = null,
  ore = 4,
  costoOrario = 25,
  macchina = 'Trattore JD',
  materiali = [],
} = {}) {
  const [rapportino] = await app
    .db('rapportini')
    .insert({
      utente_id: operaioId,
      cliente_id: cliente ?? clienteId,
      macchina,
      chiuso_il: chiuso ? new Date().toISOString() : null,
    })
    .returning('*');
  const [lavorazione] = await app
    .db('lavorazioni')
    .insert({
      rapportino_id: rapportino.id,
      giorno: '2026-09-01',
      ore,
      costo_orario_applicato: costoOrario,
    })
    .returning('*');
  for (const m of materiali) {
    await app.db('materiali_lavorazione').insert({
      lavorazione_id: lavorazione.id,
      nome_manuale: m.nome,
      quantita: m.quantita,
      fuori_catalogo: true,
      prezzo_unitario: m.prezzo,
    });
  }
  return { rapportino, lavorazione };
}

async function creaNota(rapportiniIds, extra = {}) {
  return app.inject({
    method: 'POST',
    url: '/api/note-lavorazione',
    headers: auth(adminToken),
    payload: {
      cliente_id: clienteId,
      data_riferimento: '2026-09-03',
      rapportini_ids: rapportiniIds,
      ...extra,
    },
  });
}

async function dettaglioNota(id) {
  const res = await app.inject({
    method: 'GET',
    url: `/api/note-lavorazione/${id}`,
    headers: auth(adminToken),
  });
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
describe('creazione della nota da rapportini conclusi', () => {
  it('due rapportini conclusi dello stesso cliente entrano nella nota', async () => {
    const a = await seedRapportino({ macchina: 'Trattore JD' });
    const b = await seedRapportino({ macchina: 'Mietitrebbia' });

    const res = await creaNota([a.rapportino.id, b.rapportino.id]);
    expect(res.statusCode).toBe(201);

    const aggiornati = await app.db('rapportini').whereIn('id', [a.rapportino.id, b.rapportino.id]);
    expect(aggiornati.every((r) => r.nota_lavorazione_id === res.json().id)).toBe(true);
  });

  // Un rapportino ancora aperto potrebbe ricevere altre ore dopo che la nota è
  // stata compilata, e la nota risulterebbe incompleta senza che nulla lo dica.
  it('un rapportino APERTO viene rifiutato', async () => {
    const { rapportino } = await seedRapportino({ chiuso: false });
    const res = await creaNota([rapportino.id]);
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/non è concluso/i);
  });

  it('rapportini di clienti diversi vengono rifiutati', async () => {
    const a = await seedRapportino();
    const b = await seedRapportino({ cliente: altroClienteId });
    const res = await creaNota([a.rapportino.id, b.rapportino.id]);
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/stesso cliente/i);
  });

  it('un rapportino già in un altra nota viene rifiutato', async () => {
    const { rapportino } = await seedRapportino();
    await creaNota([rapportino.id]);
    const res = await creaNota([rapportino.id]);
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/già associato/i);
  });

  it('un rapportino inesistente produce 404', async () => {
    const res = await creaNota([999999]);
    expect(res.statusCode).toBe(404);
  });

  it("un operaio non può creare note: sono riservate all'amministratore", async () => {
    const { rapportino } = await seedRapportino();
    const res = await app.inject({
      method: 'POST',
      url: '/api/note-lavorazione',
      headers: auth(userToken),
      payload: { cliente_id: clienteId, rapportini_ids: [rapportino.id] },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('il rapportino incluso risulta gestito', () => {
  it('lo stato passa a gestito', async () => {
    const { rapportino } = await seedRapportino();
    await creaNota([rapportino.id]);

    const res = await app.inject({
      method: 'GET',
      url: `/api/rapportini/${rapportino.id}`,
      headers: auth(adminToken),
    });
    expect(res.json().stato).toBe('gestito');
  });

  it('non è più riapribile finché è nella nota', async () => {
    const { rapportino } = await seedRapportino();
    await creaNota([rapportino.id]);

    const res = await app.inject({
      method: 'POST',
      url: `/api/rapportini/${rapportino.id}/riapri`,
      headers: auth(adminToken),
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('dissociazione: si torna a chiuso, non ad aperto', () => {
  it('rimuovendolo dalla nota il rapportino torna CHIUSO', async () => {
    const a = await seedRapportino({ macchina: 'Trattore JD' });
    const b = await seedRapportino({ macchina: 'Mietitrebbia' });
    const nota = (await creaNota([a.rapportino.id, b.rapportino.id])).json();

    const res = await app.inject({
      method: 'PUT',
      url: `/api/note-lavorazione/${nota.id}`,
      headers: auth(adminToken),
      payload: { data_riferimento: '2026-09-03', rapportini_ids: [a.rapportino.id] },
    });
    expect(res.statusCode).toBe(200);

    const dettaglio = await app.inject({
      method: 'GET',
      url: `/api/rapportini/${b.rapportino.id}`,
      headers: auth(adminToken),
    });
    // Non "aperto": tornare modificabile richiede una riapertura esplicita.
    expect(dettaglio.json().stato).toBe('chiuso');
  });

  it('eliminando la nota i rapportini tornano CHIUSI', async () => {
    const { rapportino } = await seedRapportino();
    const nota = (await creaNota([rapportino.id])).json();

    await app.inject({
      method: 'DELETE',
      url: `/api/note-lavorazione/${nota.id}`,
      headers: auth(adminToken),
    });

    const dettaglio = await app.inject({
      method: 'GET',
      url: `/api/rapportini/${rapportino.id}`,
      headers: auth(adminToken),
    });
    expect(dettaglio.json().stato).toBe('chiuso');
  });

  it('dopo la dissociazione il rapportino è di nuovo selezionabile per una nota', async () => {
    const { rapportino } = await seedRapportino();
    const nota = (await creaNota([rapportino.id])).json();
    await app.inject({
      method: 'DELETE',
      url: `/api/note-lavorazione/${nota.id}`,
      headers: auth(adminToken),
    });
    const res = await creaNota([rapportino.id]);
    expect(res.statusCode).toBe(201);
  });
});

describe('totali e dettaglio', () => {
  it('le ore della nota sono la somma delle lavorazioni dei rapportini inclusi', async () => {
    const a = await seedRapportino({ ore: 4, costoOrario: 25, macchina: 'Trattore' });
    await app.db('lavorazioni').insert({
      rapportino_id: a.rapportino.id,
      giorno: '2026-09-02',
      ore: 2,
      costo_orario_applicato: 25,
    });
    const nota = (await creaNota([a.rapportino.id])).json();

    const res = await app.inject({
      method: 'GET',
      url: `/api/note-lavorazione/${nota.id}`,
      headers: auth(adminToken),
    });
    expect(res.json().ore_totali).toBe(6);
    expect(res.json().totale_calcolato).toBe(150);
  });

  it('il dettaglio espone rapportini con le loro lavorazioni, non righe isolate', async () => {
    const { rapportino } = await seedRapportino({
      materiali: [{ nome: 'Filtro', quantita: 2, prezzo: 6 }],
    });
    const nota = (await creaNota([rapportino.id])).json();

    const res = await app.inject({
      method: 'GET',
      url: `/api/note-lavorazione/${nota.id}`,
      headers: auth(adminToken),
    });
    const body = res.json();
    expect(body.rapportini).toHaveLength(1);
    expect(body.rapportini[0].macchina).toBe('Trattore JD');
    expect(body.rapportini[0].lavorazioni).toHaveLength(1);
    expect(body.rapportini[0].lavorazioni[0].materiali[0].nome).toBe('Filtro');
    expect(body.totale_materiali).toBe(12);
  });

  it("l'elenco conta rapportini e lavorazioni", async () => {
    const { rapportino } = await seedRapportino();
    await creaNota([rapportino.id]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/note-lavorazione',
      headers: auth(adminToken),
    });
    expect(res.json().data[0].num_rapportini).toBe(1);
    expect(res.json().data[0].num_lavorazioni).toBe(1);
  });
});

describe('modifiche ai costi', () => {
  it("l'amministratore corregge il costo orario di una lavorazione", async () => {
    const { rapportino, lavorazione } = await seedRapportino({ ore: 4, costoOrario: 25 });
    const res = await creaNota([rapportino.id], {
      modifiche_costi: [
        { tipo: 'lavorazione_costo_orario', lavorazione_id: lavorazione.id, costo_orario_applicato: 40 },
      ],
    });
    expect(res.statusCode).toBe(201);

    const aggiornata = await app.db('lavorazioni').where({ id: lavorazione.id }).first();
    expect(Number(aggiornata.costo_orario_applicato)).toBe(40);
  });

  it('una lavorazione estranea alla nota viene rifiutata', async () => {
    const dentro = await seedRapportino({ macchina: 'Trattore' });
    const fuori = await seedRapportino({ macchina: 'Mietitrebbia' });

    const res = await creaNota([dentro.rapportino.id], {
      modifiche_costi: [
        {
          tipo: 'lavorazione_costo_orario',
          lavorazione_id: fuori.lavorazione.id,
          costo_orario_applicato: 40,
        },
      ],
    });
    expect(res.statusCode).toBe(422);
  });
});

describe('avvisi prima della stampa', () => {
  it('segnala una lavorazione con costo orario a zero', async () => {
    const { rapportino, lavorazione } = await seedRapportino({ costoOrario: 0 });
    const nota = (await creaNota([rapportino.id])).json();

    const res = await app.inject({
      method: 'GET',
      url: `/api/note-lavorazione/${nota.id}/pdf-warnings`,
      headers: auth(adminToken),
    });
    expect(res.json().has_warnings).toBe(true);
    expect(res.json().lavorazioni_costo_orario_zero[0].lavorazione_id).toBe(lavorazione.id);
  });

  it('segnala i materiali senza prezzo indicando la lavorazione', async () => {
    const { rapportino, lavorazione } = await seedRapportino({
      materiali: [{ nome: 'Bullone', quantita: 5, prezzo: 0 }],
    });
    const nota = (await creaNota([rapportino.id])).json();

    const res = await app.inject({
      method: 'GET',
      url: `/api/note-lavorazione/${nota.id}/pdf-warnings`,
      headers: auth(adminToken),
    });
    expect(res.json().materiali_prezzo_zero[0].lavorazione_id).toBe(lavorazione.id);
  });

  it('senza problemi non segnala nulla', async () => {
    const { rapportino } = await seedRapportino({ costoOrario: 30 });
    const nota = (await creaNota([rapportino.id])).json();
    const res = await app.inject({
      method: 'GET',
      url: `/api/note-lavorazione/${nota.id}/pdf-warnings`,
      headers: auth(adminToken),
    });
    expect(res.json().has_warnings).toBe(false);
  });
});

describe('stampa', () => {
  it('produce un PDF', async () => {
    const { rapportino } = await seedRapportino();
    const nota = (await creaNota([rapportino.id])).json();

    const res = await app.inject({
      method: 'GET',
      url: `/api/note-lavorazione/${nota.id}/stampa`,
      headers: auth(adminToken),
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.rawPayload.slice(0, 4).toString('ascii')).toBe('%PDF');
  });

  it('una nota inesistente produce 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/note-lavorazione/999999/stampa',
      headers: auth(adminToken),
    });
    expect(res.statusCode).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('data di riferimento', () => {
  it('e obbligatoria', async () => {
    const { rapportino } = await seedRapportino();
    const res = await app.inject({
      method: 'POST',
      url: '/api/note-lavorazione',
      headers: auth(adminToken),
      payload: { cliente_id: clienteId, rapportini_ids: [rapportino.id] },
    });
    expect(res.statusCode).toBe(400);
  });

  it('viene conservata come indicata, non come data di creazione', async () => {
    const { rapportino } = await seedRapportino();
    const nota = (await creaNota([rapportino.id], { data_riferimento: '2026-07-15' })).json();
    expect((await dettaglioNota(nota.id)).data_riferimento).toMatch(/2026-07-15/);
  });

  it('e modificabile dopo la creazione', async () => {
    const { rapportino } = await seedRapportino();
    const nota = (await creaNota([rapportino.id])).json();

    const res = await app.inject({
      method: 'PUT',
      url: `/api/note-lavorazione/${nota.id}`,
      headers: auth(adminToken),
      payload: { data_riferimento: '2026-01-10', rapportini_ids: [rapportino.id] },
    });
    expect(res.statusCode).toBe(200);
    expect((await dettaglioNota(nota.id)).data_riferimento).toMatch(/2026-01-10/);
  });

  it('un formato non valido viene rifiutato', async () => {
    const { rapportino } = await seedRapportino();
    const res = await creaNota([rapportino.id], { data_riferimento: '15/07/2026' });
    expect(res.statusCode).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('riassunto precompilato', () => {
  /**
   * Crea un rapportino con lavorazioni annotate nei giorni indicati.
   * @param {Array<[string, string|null]>} giorniENote - coppie giorno/nota
   * @returns {Promise<object>} il rapportino creato
   */
  async function seedConNote(giorniENote) {
    const [rapportino] = await app
      .db('rapportini')
      .insert({
        utente_id: operaioId,
        cliente_id: clienteId,
        macchina: 'Trattore JD',
        chiuso_il: new Date().toISOString(),
      })
      .returning('*');
    for (const [giorno, nota] of giorniENote) {
      await app.db('lavorazioni').insert({
        rapportino_id: rapportino.id,
        giorno,
        ore: 4,
        note: nota,
        costo_orario_applicato: 30,
      });
    }
    return rapportino;
  }

  it('raggruppa le note per giorno', async () => {
    const r = await seedConNote([
      ['2026-09-01', 'Sostituito filtro'],
      ['2026-09-02', 'Controllo impianto'],
    ]);
    const res = await app.inject({
      method: 'GET',
      url: `/api/note-lavorazione/riassunto?rapportini_ids=${r.id}`,
      headers: auth(adminToken),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().testo).toContain('01/09/2026');
    expect(res.json().testo).toContain('Sostituito filtro');
    expect(res.json().testo).toContain('02/09/2026');
  });

  it('le lavorazioni senza note non producono intestazioni vuote', async () => {
    const r = await seedConNote([
      ['2026-09-01', null],
      ['2026-09-02', 'Unica nota'],
    ]);
    const res = await app.inject({
      method: 'GET',
      url: `/api/note-lavorazione/riassunto?rapportini_ids=${r.id}`,
      headers: auth(adminToken),
    });
    expect(res.json().testo).not.toContain('01/09/2026');
    expect(res.json().testo).toContain('Unica nota');
  });

  it('senza rapportini restituisce testo vuoto', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/note-lavorazione/riassunto',
      headers: auth(adminToken),
    });
    expect(res.json().testo).toBe('');
  });

  // Il campo lo calcola il SERVER: se lo dichiarasse il client, un client che
  // sbaglia farebbe perdere all'utente il proprio testo in silenzio.
  it('un testo identico al generato NON risulta personalizzato', async () => {
    const r = await seedConNote([['2026-09-01', 'Sostituito filtro']]);
    const generato = (
      await app.inject({
        method: 'GET',
        url: `/api/note-lavorazione/riassunto?rapportini_ids=${r.id}`,
        headers: auth(adminToken),
      })
    ).json().testo;

    const nota = (await creaNota([r.id], { testo: generato })).json();
    expect(Boolean((await dettaglioNota(nota.id)).riassunto_personalizzato)).toBe(false);
  });

  it('un testo diverso risulta personalizzato', async () => {
    const r = await seedConNote([['2026-09-01', 'Sostituito filtro']]);
    const nota = (await creaNota([r.id], { testo: 'Testo mio' })).json();
    expect(Boolean((await dettaglioNota(nota.id)).riassunto_personalizzato)).toBe(true);
  });

  it('il valore inviato dal client viene ignorato', async () => {
    const r = await seedConNote([['2026-09-01', 'Sostituito filtro']]);
    const nota = (
      await creaNota([r.id], { testo: 'Testo mio', riassunto_personalizzato: false })
    ).json();
    expect(Boolean((await dettaglioNota(nota.id)).riassunto_personalizzato)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('totali imposti e dettagli', () => {
  it('un dettaglio richiesto sotto il proprio override viene respinto', async () => {
    const { rapportino } = await seedRapportino();
    const res = await creaNota([rapportino.id], {
      mostra_dettaglio_materiali: true,
      totale_materiali_override: 300,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/materiali/i);
  });

  it('il totale complessivo imposto respinge entrambi i dettagli', async () => {
    const { rapportino } = await seedRapportino();
    for (const campo of ['mostra_dettaglio_materiali', 'mostra_dettaglio_manodopera']) {
      const res = await creaNota([rapportino.id], { [campo]: true, totale_override: 900 });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatch(/complessivo/i);
    }
  });

  // Chi accende un dettaglio senza toccare un override gia' presente deve
  // essere respinto lo stesso: e' il caso piu' probabile.
  it('in modifica la verifica guarda lo stato RISULTANTE, non i soli campi inviati', async () => {
    const { rapportino } = await seedRapportino();
    const nota = (
      await creaNota([rapportino.id], { totale_materiali_override: 300 })
    ).json();

    const res = await app.inject({
      method: 'PUT',
      url: `/api/note-lavorazione/${nota.id}`,
      headers: auth(adminToken),
      payload: { rapportini_ids: [rapportino.id], mostra_dettaglio_materiali: true },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rimuovendo l override il dettaglio torna richiedibile', async () => {
    const { rapportino } = await seedRapportino();
    const nota = (
      await creaNota([rapportino.id], { totale_materiali_override: 300 })
    ).json();

    const res = await app.inject({
      method: 'PUT',
      url: `/api/note-lavorazione/${nota.id}`,
      headers: auth(adminToken),
      payload: {
        rapportini_ids: [rapportino.id],
        totale_materiali_override: null,
        mostra_dettaglio_materiali: true,
      },
    });
    expect(res.statusCode).toBe(200);
    expect((await dettaglioNota(nota.id)).dettagli_ammessi.materiali).toBe(true);
  });

  it('zero e un totale imposto, distinto da null', async () => {
    const { rapportino } = await seedRapportino();
    const nota = (await creaNota([rapportino.id], { totale_materiali_override: 0 })).json();
    const d = await dettaglioNota(nota.id);
    expect(Number(d.totale_materiali_override)).toBe(0);
    expect(d.dettagli_ammessi.materiali).toBe(false);
  });

  it('i totali calcolati restano esposti sotto un override', async () => {
    const { rapportino } = await seedRapportino({
      materiali: [{ nome: 'Filtro', quantita: 2, prezzo: 6 }],
    });
    const nota = (
      await creaNota([rapportino.id], { totale_materiali_override: 300 })
    ).json();
    const d = await dettaglioNota(nota.id);
    expect(d.totale_materiali_calcolato).toBe(12);
    expect(d.totale_materiali).toBe(300);
  });

  it('le ore restano quelle registrate anche con un importo imposto', async () => {
    const { rapportino } = await seedRapportino({ ore: 4 });
    const nota = (
      await creaNota([rapportino.id], { totale_manodopera_override: 999 })
    ).json();
    expect((await dettaglioNota(nota.id)).ore_totali).toBe(4);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('soppressione degli avvisi pre-stampa', () => {
  async function avvisi(notaId) {
    const res = await app.inject({
      method: 'GET',
      url: `/api/note-lavorazione/${notaId}/pdf-warnings`,
      headers: auth(adminToken),
    });
    return res.json();
  }

  it('senza override gli avvisi restano', async () => {
    const { rapportino } = await seedRapportino({ costoOrario: 0 });
    const nota = (await creaNota([rapportino.id])).json();
    expect((await avvisi(nota.id)).has_warnings).toBe(true);
  });

  // Un avviso su un valore che non finira' nel documento manda a correggere
  // qualcosa che non cambia nulla.
  it('il totale manodopera imposto sopprime gli avvisi sulla manodopera', async () => {
    const { rapportino } = await seedRapportino({ costoOrario: 0 });
    const nota = (
      await creaNota([rapportino.id], { totale_manodopera_override: 400 })
    ).json();
    const a = await avvisi(nota.id);
    expect(a.lavorazioni_costo_orario_zero).toHaveLength(0);
    expect(a.has_warnings).toBe(false);
  });

  it('il totale materiali imposto sopprime gli avvisi sui materiali', async () => {
    const { rapportino } = await seedRapportino({
      costoOrario: 30,
      materiali: [{ nome: 'Bullone', quantita: 5, prezzo: 0 }],
    });
    const nota = (
      await creaNota([rapportino.id], { totale_materiali_override: 300 })
    ).json();
    const a = await avvisi(nota.id);
    expect(a.materiali_prezzo_zero).toHaveLength(0);
    expect(a.has_warnings).toBe(false);
  });

  it('il totale complessivo imposto sopprime tutto', async () => {
    const { rapportino } = await seedRapportino({
      costoOrario: 0,
      materiali: [{ nome: 'Bullone', quantita: 5, prezzo: 0 }],
    });
    const nota = (await creaNota([rapportino.id], { totale_override: 900 })).json();
    expect((await avvisi(nota.id)).has_warnings).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('unione o divisione per macchinario', () => {
  it('la divisione viene conservata sulla nota', async () => {
    const a = await seedRapportino({ macchina: 'Trattore' });
    const b = await seedRapportino({ macchina: 'Mietitrebbia' });
    const nota = (
      await creaNota([a.rapportino.id, b.rapportino.id], { divisione: 'per_macchinario' })
    ).json();
    expect((await dettaglioNota(nota.id)).divisione).toBe('per_macchinario');
  });

  it('un valore non ammesso viene rifiutato', async () => {
    const { rapportino } = await seedRapportino();
    const res = await creaNota([rapportino.id], { divisione: 'per_rapportino' });
    expect(res.statusCode).toBe(400);
  });

  it('senza indicarla, il documento resta unito', async () => {
    const { rapportino } = await seedRapportino();
    const nota = (await creaNota([rapportino.id])).json();
    expect((await dettaglioNota(nota.id)).divisione).toBe('unita');
  });
});
