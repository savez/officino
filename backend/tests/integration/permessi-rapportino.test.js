'use strict';

const { getApp, getAuthToken, getAdminToken } = require('../helpers/setup');

let app;
let userToken;
let adminToken;
let clienteId;
let operaioId;
let adminId;

beforeAll(async () => {
  app = getApp();
  userToken = await getAuthToken();
  adminToken = await getAdminToken();
  operaioId = (await app.db('utenti').where({ email: 'operaio@officino.app' }).first()).id;
  adminId = (await app.db('utenti').where({ email: 'demo@officino.app' }).first()).id;
});

async function pulisci() {
  await app.db('materiali_lavorazione').del();
  await app.db('lavorazioni').del();
  await app.db('rapportini').del();
  await app.db('note_lavorazione').del();
  await app.db('clienti').del();
}

beforeEach(async () => {
  await pulisci();
  const [c] = await app.db('clienti').insert({ nome: 'Azienda Rossi' }).returning('*');
  clienteId = c.id;
});

afterEach(pulisci);

const auth = (token) => ({ authorization: `Bearer ${token}` });

/**
 * Crea un rapportino con una lavorazione, nello stato indicato.
 * @param {object} campi - valori da sovrascrivere sul rapportino
 * @returns {Promise<{rapportino: object, lavorazione: object}>}
 */
async function seed(campi = {}) {
  const [rapportino] = await app
    .db('rapportini')
    .insert({ utente_id: operaioId, cliente_id: clienteId, macchina: 'Trattore JD', ...campi })
    .returning('*');
  const [lavorazione] = await app
    .db('lavorazioni')
    .insert({ rapportino_id: rapportino.id, giorno: '2026-09-01', ore: 4, costo_orario_applicato: 35 })
    .returning('*');
  return { rapportino, lavorazione };
}

/**
 * Ogni endpoint che MODIFICA qualcosa. È l'elenco su cui si regge la regola:
 * una funzione condivisa chiamata da quattro endpoint su cinque è peggio di
 * nessuna funzione, perché sembra fatta.
 *
 * @param {object} rapportino
 * @param {object} lavorazione
 * @returns {Array<{nome: string, richiesta: object}>}
 */
function endpointCheModificano(rapportino, lavorazione) {
  return [
    {
      nome: 'aggiunta di una lavorazione',
      richiesta: {
        method: 'POST',
        url: `/api/rapportini/${rapportino.id}/lavorazioni`,
        payload: { giorno: '2026-09-02', ore: 2 },
      },
    },
    {
      nome: 'modifica di una lavorazione',
      richiesta: {
        method: 'PUT',
        url: `/api/rapportini/${rapportino.id}/lavorazioni/${lavorazione.id}`,
        payload: { giorno: '2026-09-01', ore: 5 },
      },
    },
    {
      nome: 'eliminazione di una lavorazione',
      richiesta: {
        method: 'DELETE',
        url: `/api/rapportini/${rapportino.id}/lavorazioni/${lavorazione.id}`,
      },
    },
    {
      nome: 'eliminazione del rapportino',
      richiesta: { method: 'DELETE', url: `/api/rapportini/${rapportino.id}` },
    },
    {
      nome: 'chiusura del rapportino',
      richiesta: { method: 'POST', url: `/api/rapportini/${rapportino.id}/chiudi` },
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// È il test portante di questa feature. Prima, in rapportini.js:368 e :488, il
// controllo era `if (!isAdmin && riga.utente_id !== request.user.id)`: la
// scorciatoia `!isAdmin` lasciava passare l'amministratore su qualunque riga in
// qualunque stato. Ora vale una regola sola — aperto se e solo se modificabile —
// e questo test la verifica su OGNI endpoint, uno per uno, invece di fidarsi
// che tutti chiamino la funzione condivisa.
describe('nessun endpoint modifica un rapportino CHIUSO', () => {
  it("neppure l'amministratore, che deve prima riaprirlo", async () => {
    const { rapportino, lavorazione } = await seed({ chiuso_il: new Date().toISOString() });
    const esiti = [];
    for (const { nome, richiesta } of endpointCheModificano(rapportino, lavorazione)) {
      const res = await app.inject({ ...richiesta, headers: auth(adminToken) });
      esiti.push({ nome, codice: res.statusCode });
    }
    expect(esiti).toEqual([
      { nome: 'aggiunta di una lavorazione', codice: 403 },
      { nome: 'modifica di una lavorazione', codice: 403 },
      { nome: 'eliminazione di una lavorazione', codice: 403 },
      { nome: 'eliminazione del rapportino', codice: 403 },
      { nome: 'chiusura del rapportino', codice: 403 },
    ]);
  });

  it("neppure l'operaio che l'ha compilato", async () => {
    const { rapportino, lavorazione } = await seed({ chiuso_il: new Date().toISOString() });
    for (const { nome, richiesta } of endpointCheModificano(rapportino, lavorazione)) {
      const res = await app.inject({ ...richiesta, headers: auth(userToken) });
      expect({ nome, codice: res.statusCode }).toEqual({ nome, codice: 403 });
    }
  });

  it("il messaggio all'amministratore dice di riaprire, quello all'operaio di chiedere", async () => {
    const { rapportino } = await seed({ chiuso_il: new Date().toISOString() });
    const perAdmin = await app.inject({
      method: 'POST',
      url: `/api/rapportini/${rapportino.id}/lavorazioni`,
      headers: auth(adminToken),
      payload: { giorno: '2026-09-02', ore: 2 },
    });
    const perOperaio = await app.inject({
      method: 'POST',
      url: `/api/rapportini/${rapportino.id}/lavorazioni`,
      headers: auth(userToken),
      payload: { giorno: '2026-09-02', ore: 2 },
    });
    expect(perAdmin.json().error).toMatch(/riapri/i);
    expect(perOperaio.json().error).toMatch(/amministratore/i);
  });
});

describe('nessun endpoint modifica un rapportino GESTITO', () => {
  it('va prima dissociato dalla nota di lavorazione', async () => {
    const [nota] = await app
      .db('note_lavorazione')
      .insert({ cliente_id: clienteId, testo: 'nota' })
      .returning('*');
    const { rapportino, lavorazione } = await seed({
      chiuso_il: new Date().toISOString(),
      nota_lavorazione_id: nota.id,
    });

    for (const { nome, richiesta } of endpointCheModificano(rapportino, lavorazione)) {
      const res = await app.inject({ ...richiesta, headers: auth(adminToken) });
      expect({ nome, codice: res.statusCode }).toEqual({ nome, codice: 403 });
      expect(res.json().error).toMatch(/nota/i);
    }
  });
});

describe('su un rapportino APERTO gli endpoint funzionano', () => {
  // Il contrario del test precedente. Senza, la regola potrebbe essere
  // soddisfatta rifiutando sempre tutto.
  it("l'autore aggiunge e modifica", async () => {
    const { rapportino, lavorazione } = await seed();

    const aggiunta = await app.inject({
      method: 'POST',
      url: `/api/rapportini/${rapportino.id}/lavorazioni`,
      headers: auth(userToken),
      payload: { giorno: '2026-09-02', ore: 2 },
    });
    expect(aggiunta.statusCode).toBe(201);

    const modifica = await app.inject({
      method: 'PUT',
      url: `/api/rapportini/${rapportino.id}/lavorazioni/${lavorazione.id}`,
      headers: auth(userToken),
      payload: { giorno: '2026-09-01', ore: 5 },
    });
    expect(modifica.statusCode).toBe(200);
  });

  it("l'amministratore può intervenire su un rapportino altrui purché aperto", async () => {
    const { rapportino } = await seed();
    const res = await app.inject({
      method: 'POST',
      url: `/api/rapportini/${rapportino.id}/lavorazioni`,
      headers: auth(adminToken),
      payload: { giorno: '2026-09-02', ore: 2 },
    });
    expect(res.statusCode).toBe(201);
  });
});

describe('rapportini di altri operai', () => {
  it('un operaio non li modifica in alcun modo', async () => {
    const { rapportino, lavorazione } = await seed({ utente_id: adminId });
    for (const { nome, richiesta } of endpointCheModificano(rapportino, lavorazione)) {
      const res = await app.inject({ ...richiesta, headers: auth(userToken) });
      expect({ nome, codice: res.statusCode }).toEqual({ nome, codice: 403 });
    }
  });

  it('un operaio non li vede nemmeno in elenco', async () => {
    await seed({ utente_id: adminId });
    const res = await app.inject({
      method: 'GET',
      url: '/api/rapportini',
      headers: auth(userToken),
    });
    expect(res.json().data).toHaveLength(0);
  });
});

describe('transizioni di stato', () => {
  it("solo l'autore conclude", async () => {
    const { rapportino } = await seed();
    const daAdmin = await app.inject({
      method: 'POST',
      url: `/api/rapportini/${rapportino.id}/chiudi`,
      headers: auth(adminToken),
    });
    expect(daAdmin.statusCode).toBe(403);

    const daAutore = await app.inject({
      method: 'POST',
      url: `/api/rapportini/${rapportino.id}/chiudi`,
      headers: auth(userToken),
    });
    expect(daAutore.statusCode).toBe(200);
  });

  it('un rapportino vuoto non si conclude: 400, non 403', async () => {
    const [rapportino] = await app
      .db('rapportini')
      .insert({ utente_id: operaioId, cliente_id: clienteId, macchina: 'Vuoto' })
      .returning('*');
    const res = await app.inject({
      method: 'POST',
      url: `/api/rapportini/${rapportino.id}/chiudi`,
      headers: auth(userToken),
    });
    expect(res.statusCode).toBe(400);
  });

  it("solo l'amministratore riapre", async () => {
    const { rapportino } = await seed({ chiuso_il: new Date().toISOString() });

    const daOperaio = await app.inject({
      method: 'POST',
      url: `/api/rapportini/${rapportino.id}/riapri`,
      headers: auth(userToken),
    });
    expect(daOperaio.statusCode).toBe(403);

    const daAdmin = await app.inject({
      method: 'POST',
      url: `/api/rapportini/${rapportino.id}/riapri`,
      headers: auth(adminToken),
    });
    expect(daAdmin.statusCode).toBe(200);
  });

  it('dopo la riapertura il rapportino torna modificabile', async () => {
    const { rapportino } = await seed({ chiuso_il: new Date().toISOString() });
    await app.inject({
      method: 'POST',
      url: `/api/rapportini/${rapportino.id}/riapri`,
      headers: auth(adminToken),
    });
    const res = await app.inject({
      method: 'POST',
      url: `/api/rapportini/${rapportino.id}/lavorazioni`,
      headers: auth(userToken),
      payload: { giorno: '2026-09-03', ore: 1 },
    });
    expect(res.statusCode).toBe(201);
  });

  it('un rapportino gestito non si riapre finché è nella nota', async () => {
    const [nota] = await app
      .db('note_lavorazione')
      .insert({ cliente_id: clienteId, testo: 'nota' })
      .returning('*');
    const { rapportino } = await seed({
      chiuso_il: new Date().toISOString(),
      nota_lavorazione_id: nota.id,
    });
    const res = await app.inject({
      method: 'POST',
      url: `/api/rapportini/${rapportino.id}/riapri`,
      headers: auth(adminToken),
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toMatch(/nota/i);
  });
});
