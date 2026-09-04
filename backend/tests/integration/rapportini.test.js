'use strict';

const { getApp, getAuthToken, getAdminToken } = require('../helpers/setup');

let app;
let userToken;
let adminToken;
let clienteId;
let altroClienteId;
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

async function creaRapportino(token = userToken, corpo = {}) {
  return app.inject({
    method: 'POST',
    url: '/api/rapportini',
    headers: auth(token),
    payload: { cliente_id: clienteId, macchina: 'Trattore JD 6130R', ...corpo },
  });
}

async function aggiungiLavorazione(id, token = userToken, corpo = {}) {
  return app.inject({
    method: 'POST',
    url: `/api/rapportini/${id}/lavorazioni`,
    headers: auth(token),
    payload: { giorno: '2026-09-01', ore: 4, ...corpo },
  });
}

/**
 * Crea un rapportino direttamente nel database, saltando le rotte.
 * @param {object} campi - valori da sovrascrivere
 * @returns {Promise<object>} il rapportino creato
 */
async function seedRapportino(campi = {}) {
  const [r] = await app
    .db('rapportini')
    .insert({ utente_id: operaioId, cliente_id: clienteId, macchina: 'Trattore JD', ...campi })
    .returning('*');
  return r;
}

// ─────────────────────────────────────────────────────────────────────────────
describe('creazione del contenitore e aggiunta di lavorazioni', () => {
  it('crea un rapportino aperto, senza lavorazioni', async () => {
    const res = await creaRapportino();
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.stato).toBe('aperto');
    expect(body.avviso_duplicato).toBeUndefined();
  });

  it('rifiuta un macchinario vuoto: è l\'unica cosa che distingue due rapportini', async () => {
    const res = await creaRapportino(userToken, { macchina: '   ' });
    expect(res.statusCode).toBe(400);
  });

  it('rifiuta un cliente inesistente', async () => {
    const res = await creaRapportino(userToken, { cliente_id: 999999 });
    expect(res.statusCode).toBe(404);
  });

  it('due lavorazioni in giorni diversi danno UNA riga con periodo e somma delle ore', async () => {
    const { id } = (await creaRapportino()).json();
    await aggiungiLavorazione(id, userToken, { giorno: '2026-08-31', ore: 4.5 });
    await aggiungiLavorazione(id, userToken, { giorno: '2026-09-02', ore: 3 });

    const res = await app.inject({ method: 'GET', url: '/api/rapportini', headers: auth(userToken) });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].totale_ore).toBe(7.5);
    expect(body.data[0].numero_lavorazioni).toBe(2);
    expect(body.data[0].periodo).toEqual({ da: '2026-08-31', a: '2026-09-02' });
  });

  it('un rapportino senza lavorazioni espone periodo null, non un intervallo inventato', async () => {
    await creaRapportino();
    const res = await app.inject({ method: 'GET', url: '/api/rapportini', headers: auth(userToken) });
    expect(res.json().data[0].periodo).toBeNull();
    expect(res.json().data[0].totale_ore).toBe(0);
  });

  it('il dettaglio elenca le lavorazioni con i materiali', async () => {
    const [pezzo] = await app
      .db('catalogo_prodotti')
      .insert({ nome: 'Filtro olio', prezzo_vendita: 12.5 })
      .returning('*');
    const { id } = (await creaRapportino()).json();
    await aggiungiLavorazione(id, userToken, {
      materiali: [{ pezzo_id: pezzo.id, quantita: 2, fuori_catalogo: false }],
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/rapportini/${id}`,
      headers: auth(userToken),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.lavorazioni).toHaveLength(1);
    expect(body.lavorazioni[0].materiali[0].nome).toBe('Filtro olio');
    expect(body.totale_ore).toBe(4);
  });

  it('la modifica di una lavorazione aggiorna il totale', async () => {
    const { id } = (await creaRapportino()).json();
    const lav = (await aggiungiLavorazione(id, userToken, { ore: 4 })).json();

    const res = await app.inject({
      method: 'PUT',
      url: `/api/rapportini/${id}/lavorazioni/${lav.id}`,
      headers: auth(userToken),
      payload: { giorno: '2026-09-01', ore: 6.25 },
    });
    expect(res.statusCode).toBe(200);

    const dettaglio = await app.inject({
      method: 'GET',
      url: `/api/rapportini/${id}`,
      headers: auth(userToken),
    });
    expect(dettaglio.json().totale_ore).toBe(6.25);
  });

  it("l'eliminazione dell'ultima lavorazione lascia il rapportino vuoto e aperto", async () => {
    const { id } = (await creaRapportino()).json();
    const lav = (await aggiungiLavorazione(id)).json();

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/rapportini/${id}/lavorazioni/${lav.id}`,
      headers: auth(userToken),
    });
    expect(res.statusCode).toBe(200);

    const dettaglio = await app.inject({
      method: 'GET',
      url: `/api/rapportini/${id}`,
      headers: auth(userToken),
    });
    expect(dettaglio.json().lavorazioni).toHaveLength(0);
    expect(dettaglio.json().stato).toBe('aperto');
  });

  it('un operaio vede soltanto i propri rapportini', async () => {
    await seedRapportino({ utente_id: adminId, macchina: 'Mietitrebbia' });
    await creaRapportino();

    const res = await app.inject({ method: 'GET', url: '/api/rapportini', headers: auth(userToken) });
    expect(res.json().data).toHaveLength(1);
    expect(res.json().data[0].macchina).toBe('Trattore JD 6130R');
  });

  it('un operaio non apre il dettaglio di un rapportino altrui', async () => {
    const altrui = await seedRapportino({ utente_id: adminId });
    const res = await app.inject({
      method: 'GET',
      url: `/api/rapportini/${altrui.id}`,
      headers: auth(userToken),
    });
    expect(res.statusCode).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('filtro per periodo', () => {
  // È la lettura scelta: un rapportino che copre gennaio e marzo compare
  // filtrando febbraio. Senza spiegazione a schermo sembra un errore, ma il
  // comportamento è voluto.
  it('mostra i rapportini con ALMENO UNA lavorazione nell\'intervallo', async () => {
    const { id } = (await creaRapportino()).json();
    await aggiungiLavorazione(id, userToken, { giorno: '2026-01-15', ore: 4 });
    await aggiungiLavorazione(id, userToken, { giorno: '2026-03-15', ore: 4 });

    const dentro = await app.inject({
      method: 'GET',
      url: '/api/rapportini?da=2026-01-01&a=2026-01-31',
      headers: auth(userToken),
    });
    expect(dentro.json().data).toHaveLength(1);
  });

  it('esclude i rapportini senza lavorazioni nell\'intervallo', async () => {
    const { id } = (await creaRapportino()).json();
    await aggiungiLavorazione(id, userToken, { giorno: '2026-01-15', ore: 4 });

    const fuori = await app.inject({
      method: 'GET',
      url: '/api/rapportini?da=2026-06-01&a=2026-06-30',
      headers: auth(userToken),
    });
    expect(fuori.json().data).toHaveLength(0);
  });

  // Difetto trovato in produzione il 2026-09-03: la pagina applica sempre un
  // periodo all'apertura, e un rapportino appena creato non ha lavorazioni.
  // Veniva quindi escluso subito dopo la creazione, e restava irraggiungibile:
  // non ci si poteva aggiungere la prima lavorazione ne' eliminarlo.
  it('un rapportino SENZA lavorazioni compare comunque, qualunque sia il periodo', async () => {
    await creaRapportino();

    const settembre = await app.inject({
      method: 'GET',
      url: '/api/rapportini?da=2026-09-01&a=2026-09-30',
      headers: auth(userToken),
    });
    expect(settembre.json().data).toHaveLength(1);

    // Un rapportino senza lavorazioni non ha una data: nessun intervallo puo'
    // escluderlo, nemmeno uno lontanissimo.
    const annoScorso = await app.inject({
      method: 'GET',
      url: '/api/rapportini?da=2020-01-01&a=2020-12-31',
      headers: auth(userToken),
    });
    expect(annoScorso.json().data).toHaveLength(1);
  });

  it('appena aggiunta una lavorazione, il rapportino segue le date di quella', async () => {
    const { id } = (await creaRapportino()).json();
    await aggiungiLavorazione(id, userToken, { giorno: '2026-09-15', ore: 4 });

    const dentro = await app.inject({
      method: 'GET',
      url: '/api/rapportini?da=2026-09-01&a=2026-09-30',
      headers: auth(userToken),
    });
    expect(dentro.json().data).toHaveLength(1);

    // Ora ha una data, quindi puo' essere escluso.
    const fuori = await app.inject({
      method: 'GET',
      url: '/api/rapportini?da=2020-01-01&a=2020-12-31',
      headers: auth(userToken),
    });
    expect(fuori.json().data).toHaveLength(0);
  });

  it('svuotato di nuovo, torna a comparire sempre', async () => {
    const { id } = (await creaRapportino()).json();
    const lav = (await aggiungiLavorazione(id, userToken, { giorno: '2026-09-15', ore: 4 })).json();
    await app.inject({
      method: 'DELETE',
      url: `/api/rapportini/${id}/lavorazioni/${lav.id}`,
      headers: auth(userToken),
    });

    const fuori = await app.inject({
      method: 'GET',
      url: '/api/rapportini?da=2020-01-01&a=2020-12-31',
      headers: auth(userToken),
    });
    expect(fuori.json().data).toHaveLength(1);
  });

  it('senza date non applica alcun filtro temporale', async () => {
    const { id } = (await creaRapportino()).json();
    await aggiungiLavorazione(id, userToken, { giorno: '2020-01-01', ore: 2 });
    const res = await app.inject({ method: 'GET', url: '/api/rapportini', headers: auth(userToken) });
    expect(res.json().data).toHaveLength(1);
  });

  it('un intervallo non valido produce 400 e non 500', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/rapportini?da=2026-02-30&a=2026-03-01',
      headers: auth(userToken),
    });
    expect(res.statusCode).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('avviso di rapportino duplicato', () => {
  it('avvisa a parità di nome esatto, senza impedire', async () => {
    await creaRapportino();
    const res = await creaRapportino();
    expect(res.statusCode).toBe(201);
    expect(res.json().avviso_duplicato).toBeDefined();
  });

  // È il caso che rende l'avviso utile invece che decorativo: con il confronto
  // esatto resterebbe muto proprio qui.
  it('avvisa anche se cambiano maiuscole e spazi', async () => {
    await creaRapportino();
    const res = await creaRapportino(userToken, { macchina: '  trattore   jd 6130r ' });
    expect(res.json().avviso_duplicato).toBeDefined();
  });

  // Senza questa restrizione l'avviso sbaglierebbe di continuo, e verrebbe
  // ignorato anche quando ha ragione.
  it('NON avvisa per un cliente diverso', async () => {
    await creaRapportino();
    const res = await creaRapportino(userToken, { cliente_id: altroClienteId });
    expect(res.json().avviso_duplicato).toBeUndefined();
  });

  it('NON avvisa per rapportini di altri operai', async () => {
    await seedRapportino({ utente_id: adminId, macchina: 'Trattore JD 6130R' });
    const res = await creaRapportino();
    expect(res.json().avviso_duplicato).toBeUndefined();
  });

  it('NON avvisa se il rapportino esistente è chiuso', async () => {
    await seedRapportino({ macchina: 'Trattore JD 6130R', chiuso_il: new Date().toISOString() });
    const res = await creaRapportino();
    expect(res.json().avviso_duplicato).toBeUndefined();
  });

  it('il macchinario resta memorizzato come è stato scritto', async () => {
    const res = await creaRapportino(userToken, { macchina: 'Trattore   JD' });
    expect(res.json().macchina).toBe('Trattore   JD');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('validazione delle ore', () => {
  let rapportinoId;
  beforeEach(async () => {
    rapportinoId = (await creaRapportino()).json().id;
  });

  it.each([
    ['zero', 0, 400],
    ['negative', -2, 400],
    ['quarti d\'ora', 4.25, 201],
    ['mezz\'ora', 0.5, 201],
    ['non multiplo di 0,25', 4.3, 400],
    ['oltre le 12: accettate, l\'avviso è nell\'interfaccia', 14, 201],
    ['oltre la capienza della colonna', 1000, 400],
  ])('%s -> %i', async (_nome, ore, atteso) => {
    const res = await aggiungiLavorazione(rapportinoId, userToken, { ore });
    expect(res.statusCode).toBe(atteso);
  });

  it('il messaggio sul tetto è leggibile, non un errore del driver', async () => {
    const res = await aggiungiLavorazione(rapportinoId, userToken, { ore: 5000 });
    expect(res.statusCode).toBe(400);
    expect(JSON.stringify(res.json())).toMatch(/999,99/);
  });

  it('un giorno mal formato viene rifiutato', async () => {
    const res = await aggiungiLavorazione(rapportinoId, userToken, { giorno: '01-09-2026' });
    expect(res.statusCode).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('costo orario', () => {
  it("l'operaio non può imporlo: il valore inviato viene ignorato senza errore", async () => {
    const { id } = (await creaRapportino()).json();
    const res = await aggiungiLavorazione(id, userToken, { costo_orario_applicato: 999 });
    expect(res.statusCode).toBe(201);

    const lav = await app.db('lavorazioni').where({ id: res.json().id }).first();
    expect(Number(lav.costo_orario_applicato)).toBe(35); // profilo di operaio@officino.app
  });

  it("l'amministratore può imporlo", async () => {
    const rapportino = await seedRapportino({ utente_id: adminId });
    const res = await aggiungiLavorazione(rapportino.id, adminToken, {
      costo_orario_applicato: 60,
    });
    const lav = await app.db('lavorazioni').where({ id: res.json().id }).first();
    expect(Number(lav.costo_orario_applicato)).toBe(60);
  });

  it("l'operaio non vede i campi economici nel dettaglio", async () => {
    const { id } = (await creaRapportino()).json();
    await aggiungiLavorazione(id);
    const res = await app.inject({
      method: 'GET',
      url: `/api/rapportini/${id}`,
      headers: auth(userToken),
    });
    const lav = res.json().lavorazioni[0];
    expect(lav.costo_orario_applicato).toBeUndefined();
    expect(lav.totale_lavorazione).toBeUndefined();
    expect(lav.costo_manodopera).toBeUndefined();
  });

  it("l'amministratore vede i campi economici", async () => {
    const rapportino = await seedRapportino({ utente_id: adminId });
    await aggiungiLavorazione(rapportino.id, adminToken, { ore: 2, costo_orario_applicato: 50 });
    const res = await app.inject({
      method: 'GET',
      url: `/api/rapportini/${rapportino.id}`,
      headers: auth(adminToken),
    });
    expect(res.json().lavorazioni[0].totale_lavorazione).toBe(100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('eliminazione del rapportino', () => {
  // Senza questa via d'uscita un macchinario scritto male lascerebbe un
  // contenitore né concludibile né rimovibile.
  it("l'autore elimina un rapportino aperto e vuoto", async () => {
    const { id } = (await creaRapportino()).json();
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/rapportini/${id}`,
      headers: auth(userToken),
    });
    expect(res.statusCode).toBe(200);
    expect(await app.db('rapportini').where({ id }).first()).toBeUndefined();
  });

  it("l'autore NON elimina un rapportino con lavorazioni", async () => {
    const { id } = (await creaRapportino()).json();
    await aggiungiLavorazione(id);
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/rapportini/${id}`,
      headers: auth(userToken),
    });
    expect(res.statusCode).toBe(403);
  });

  it("l'amministratore elimina anche un rapportino pieno, e la risposta dice quante lavorazioni sono andate perse", async () => {
    const { id } = (await creaRapportino()).json();
    await aggiungiLavorazione(id);
    await aggiungiLavorazione(id, userToken, { giorno: '2026-09-02' });
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/rapportini/${id}`,
      headers: auth(adminToken),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().lavorazioni_eliminate).toBe(2);
  });

  it('eliminando il rapportino spariscono anche le lavorazioni', async () => {
    const { id } = (await creaRapportino()).json();
    await aggiungiLavorazione(id);
    await app.inject({
      method: 'DELETE',
      url: `/api/rapportini/${id}`,
      headers: auth(adminToken),
    });
    const rimaste = await app.db('lavorazioni').where({ rapportino_id: id });
    expect(rimaste).toHaveLength(0);
  });

  it('un rapportino chiuso non si elimina: va prima riaperto', async () => {
    const r = await seedRapportino({ chiuso_il: new Date().toISOString() });
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/rapportini/${r.id}`,
      headers: auth(adminToken),
    });
    expect(res.statusCode).toBe(403);
  });
});
