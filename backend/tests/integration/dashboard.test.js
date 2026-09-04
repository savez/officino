'use strict';

const { getApp, getAuthToken, getAdminToken } = require('../helpers/setup');

let app;
let userToken;
let adminToken;
let testClienteId;
let testUtenteId; // user normale (operaio@officino.app)
let testAdminId; // admin (demo@officino.app)

beforeAll(async () => {
  app = getApp();
  userToken = await getAuthToken();
  adminToken = await getAdminToken();

  testUtenteId = (await app.db('utenti').where({ email: 'operaio@officino.app' }).first()).id;
  testAdminId = (await app.db('utenti').where({ email: 'demo@officino.app' }).first()).id;
});

beforeEach(async () => {
  // Pulizia in ordine FK-safe
  await app.db('materiali_lavorazione').del();
  await app.db('lavorazioni').del();
  await app.db('rapportini').del();
  await app.db('preventivo_pezzi').del();
  await app.db('preventivi').del();
  await app.db('note_lavorazione').del();
  await app.db('clienti').del();

  const [cliente] = await app.db('clienti').insert({ nome: 'Cliente Test' }).returning('*');
  testClienteId = cliente.id;
});

afterEach(async () => {
  await app.db('materiali_lavorazione').del();
  await app.db('lavorazioni').del();
  await app.db('rapportini').del();
  await app.db('preventivo_pezzi').del();
  await app.db('preventivi').del();
  await app.db('note_lavorazione').del();
  await app.db('clienti').del();
});

// ── Helper: inserisce una nota di lavorazione ─────────────────────────────────
async function seedNota(clienteId) {
  const [nota] = await app
    .db('note_lavorazione')
    .insert({ cliente_id: clienteId, testo: 'Test' })
    .returning('*');
  return nota;
}

// ── Helper: crea un rapportino con una lavorazione ───────────────────────────
//
// Conserva la firma dei test precedenti: cliente, operaio, giorno e legame con
// la nota restano parametri, ma la durata si esprime in ORE invece che con una
// fascia oraria. Cliente e operaio salgono sul rapportino, giorno e ore restano
// sulla lavorazione.
async function seedRigaRapportino(overrides = {}) {
  const {
    utente_id: utenteId = testUtenteId,
    cliente_id: clienteId = testClienteId,
    giorno = '2026-03-10',
    ore = 2,
    macchina = 'Trattore JD',
    nota_lavorazione_id: notaId = null,
    note = null,
  } = overrides;

  const [rapportino] = await app
    .db('rapportini')
    .insert({
      utente_id: utenteId,
      cliente_id: clienteId,
      macchina,
      chiuso_il: notaId ? new Date().toISOString() : null,
      nota_lavorazione_id: notaId,
    })
    .returning('*');

  const [lavorazione] = await app
    .db('lavorazioni')
    .insert({ rapportino_id: rapportino.id, giorno, ore, note, costo_orario_applicato: 30 })
    .returning('*');

  return { ...lavorazione, rapportino_id: rapportino.id, utente_id: utenteId, cliente_id: clienteId };
}

// ── Helper: chiama l'endpoint ─────────────────────────────────────────────────
async function getStats(params = { da: '2026-03-01', a: '2026-03-31' }, token = userToken) {
  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  const res = await app.inject({
    method: 'GET',
    url: `/api/dashboard/stats${qs ? '?' + qs : ''}`,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  return { res, body: JSON.parse(res.body) };
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTENTICAZIONE
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/dashboard/stats - Autenticazione', () => {
  it('1. senza token → 401', async () => {
    const { res } = await getStats({ da: '2026-03-01', a: '2026-03-31' }, null);
    expect(res.statusCode).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDAZIONE PARAMETRI
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/dashboard/stats - Validazione parametri', () => {
  // FR-004: senza parametri la dashboard mostra il periodo predefinito invece
  // di rifiutare. Prima dei filtri per intervallo qui ci si aspettava un 400.
  it('2. senza parametri → 200 con il periodo predefinito', async () => {
    const { res, body } = await getStats({}, userToken);
    expect(res.statusCode).toBe(200);
    expect(body.periodo).toEqual({
      da: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      a: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
  });

  it('3. fine precedente all inizio → 400', async () => {
    const { res } = await getStats({ da: '2026-03-31', a: '2026-03-01' }, userToken);
    expect(res.statusCode).toBe(400);
  });

  it('4. formato data non valido → 400', async () => {
    const { res } = await getStats({ da: '01-03-2026', a: '2026-03-31' }, userToken);
    expect(res.statusCode).toBe(400);
  });

  it('5. data inesistente nel calendario → 400', async () => {
    const { res } = await getStats({ da: '2026-02-30', a: '2026-03-31' }, userToken);
    expect(res.statusCode).toBe(400);
  });

  it('6. intervallo con un solo estremo → 400', async () => {
    const { res } = await getStats({ da: '2026-03-01' }, userToken);
    expect(res.statusCode).toBe(400);
  });

  // FR-006: senza limite un intervallo di anni caricherebbe tutto lo storico
  // in memoria, perche' l'aggregazione avviene lato applicazione.
  it('7. intervallo troppo ampio → 400', async () => {
    const { res } = await getStats({ da: '2020-01-01', a: '2026-12-31' }, userToken);
    expect(res.statusCode).toBe(400);
  });

  it('8. scorciatoia riconosciuta → 200', async () => {
    const { res, body } = await getStats({ scorciatoia: 'questo-mese' }, userToken);
    expect(res.statusCode).toBe(200);
    expect(body.periodo.da).toMatch(/-01$/);
  });

  it('9. scorciatoia sconosciuta → 400', async () => {
    const { res } = await getStats({ scorciatoia: 'ultimo-decennio' }, userToken);
    expect(res.statusCode).toBe(400);
  });
});

// I tre gruppi che contavano i preventivi sono stati rimossi con la feature
// 024: la dashboard non li misura piu'. La prova che la chiave sia sparita sta
// piu' sotto, fra le verifiche di struttura — senza, la rimozione non sarebbe
// protetta da un ritorno indietro.

// ═══════════════════════════════════════════════════════════════════════════════
// ORE – PERIODO VUOTO
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/dashboard/stats - Ore periodo vuoto', () => {
  it('10. nessuna riga rapportino → ore.per_cliente=[]', async () => {
    const { res, body } = await getStats({ da: '2026-03-01', a: '2026-03-31' });
    expect(res.statusCode).toBe(200);
    expect(body.ore.per_cliente).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ORE – CALCOLO BASE
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/dashboard/stats - Ore calcolo base', () => {
  it('11. 1 riga 08:00-10:00 → ore_totali=2.0', async () => {
    await seedRigaRapportino({ ore: 2 });

    const { res, body } = await getStats({ da: '2026-03-01', a: '2026-03-31' });
    expect(res.statusCode).toBe(200);

    expect(body.ore.per_cliente).toHaveLength(1);
    expect(body.ore.per_cliente[0].ore_totali).toBe(2.0);
  });

  it('12. 1 riga 09:00-10:30 → ore_totali=1.5', async () => {
    await seedRigaRapportino({ ore: 1.5 });

    const { res, body } = await getStats({ da: '2026-03-01', a: '2026-03-31' });
    expect(res.statusCode).toBe(200);

    expect(body.ore.per_cliente).toHaveLength(1);
    expect(body.ore.per_cliente[0].ore_totali).toBe(1.5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ORE – GESTITE vs NON GESTITE
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/dashboard/stats - Ore gestite vs non gestite', () => {
  it('13. 2 righe stesso cliente: una gestita (nota NOT NULL) e una non gestita (nota NULL)', async () => {
    const nota = await seedNota(testClienteId);

    // Riga gestita: 08:00-10:00 → 2h
    await seedRigaRapportino({
      ore: 2,
      nota_lavorazione_id: nota.id,
    });
    // Riga non gestita: 14:00-15:30 → 1.5h
    await seedRigaRapportino({
      ore: 1.5,
      nota_lavorazione_id: null,
    });

    const { res, body } = await getStats({ da: '2026-03-01', a: '2026-03-31' });
    expect(res.statusCode).toBe(200);

    expect(body.ore.per_cliente).toHaveLength(1);
    const row = body.ore.per_cliente[0];
    expect(row.ore_totali).toBe(3.5);
    expect(row.ore_in_nota).toBe(2.0);
    expect(row.ore_non_gestite).toBe(1.5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// RBAC ORE
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/dashboard/stats - RBAC ore', () => {
  it('14. utente normale vede solo le proprie ore, non quelle di altri utenti', async () => {
    // Riga dell'utente normale (marco)
    await seedRigaRapportino({
      utente_id: testUtenteId,
      ore: 2,
    });
    // Riga dell'admin (altro utente)
    await seedRigaRapportino({
      utente_id: testAdminId,
      ore: 3,
    });

    const { res, body } = await getStats({ da: '2026-03-01', a: '2026-03-31' }, userToken);
    expect(res.statusCode).toBe(200);

    // L'utente normale vede solo le proprie 2 ore
    expect(body.ore.per_cliente).toHaveLength(1);
    expect(body.ore.per_cliente[0].ore_totali).toBe(2.0);
  });

  it('15. admin vede le ore di tutti gli utenti aggregate per cliente', async () => {
    // Riga dell'utente normale (marco)
    await seedRigaRapportino({
      utente_id: testUtenteId,
      ore: 2,
    });
    // Riga dell'admin
    await seedRigaRapportino({
      utente_id: testAdminId,
      ore: 3,
    });

    const { res, body } = await getStats({ da: '2026-03-01', a: '2026-03-31' }, adminToken);
    expect(res.statusCode).toBe(200);

    // Admin vede tutte le ore (2 + 3 = 5) aggregate per lo stesso cliente
    expect(body.ore.per_cliente).toHaveLength(1);
    expect(body.ore.per_cliente[0].ore_totali).toBe(5.0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// STRUTTURA RISPOSTA
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/dashboard/stats - Struttura risposta', () => {
  it('16. la risposta contiene tutte le chiavi attese', async () => {
    const { res, body } = await getStats({ da: '2026-03-01', a: '2026-03-31' });
    expect(res.statusCode).toBe(200);

    // Chiavi di primo livello
    expect(body).toHaveProperty('ore');

    // La dashboard non misura piu' i preventivi (FR-001..FR-004): la chiave non
    // deve esserci. Non basta averla tolta dalla schermata — finche' la rotta la
    // produce, il sistema paga una lettura che nessuno mostra.
    expect(body).not.toHaveProperty('preventivi');

    // Chiavi ore
    expect(body.ore).toHaveProperty('per_cliente');
    expect(Array.isArray(body.ore.per_cliente)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ORE PER OPERAIO
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/dashboard/stats - Ore per operaio (admin only)', () => {
  it('17. per_operaio è presente nella risposta per admin', async () => {
    // Crea una riga rapportino
    await seedRigaRapportino({
      utente_id: testUtenteId,
      ore: 2,
    });

    const { res, body } = await getStats({ da: '2026-03-01', a: '2026-03-31' }, adminToken);
    expect(res.statusCode).toBe(200);
    expect(body.ore).toHaveProperty('per_operaio');
    expect(Array.isArray(body.ore.per_operaio)).toBe(true);
    expect(body.ore.per_operaio.length).toBeGreaterThan(0);
  });

  it('18. per_operaio non è presente nella risposta per utente normale', async () => {
    // Crea una riga rapportino
    await seedRigaRapportino({
      utente_id: testUtenteId,
      ore: 2,
    });

    const { res, body } = await getStats({ da: '2026-03-01', a: '2026-03-31' }, userToken);
    expect(res.statusCode).toBe(200);
    // per_operaio esiste ma è array vuoto per non-admin
    expect(body.ore.per_operaio).toEqual([]);
  });

  it('19. ore per operaio calcola correttamente ore_totali, ore_in_nota, ore_non_gestite', async () => {
    const nota = await seedNota(testClienteId);

    // Riga gestita: 2h
    await seedRigaRapportino({
      utente_id: testUtenteId,
      ore: 2,
      nota_lavorazione_id: nota.id,
    });

    // Riga non gestita: 1.5h
    await seedRigaRapportino({
      utente_id: testUtenteId,
      ore: 1.5,
      nota_lavorazione_id: null,
    });

    const { res, body } = await getStats({ da: '2026-03-01', a: '2026-03-31' }, adminToken);
    expect(res.statusCode).toBe(200);

    expect(body.ore.per_operaio).toHaveLength(1);
    const operaio = body.ore.per_operaio[0];
    expect(operaio.ore_totali).toBe(3.5);
    expect(operaio.ore_in_nota).toBe(2.0);
    expect(operaio.ore_non_gestite).toBe(1.5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT ORE
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// INTERVALLO DI DATE — casi che il filtro per mese non poteva esprimere
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/dashboard/stats - Intervallo di date', () => {
  it('A1. un intervallo a cavallo di due mesi comprende le righe di entrambi', async () => {
    await seedRigaRapportino({
      utente_id: testUtenteId,
      giorno: '2026-03-30',
      ore: 2,
    });
    await seedRigaRapportino({
      utente_id: testUtenteId,
      giorno: '2026-04-02',
      ore: 3,
    });

    const { res, body } = await getStats({ da: '2026-03-25', a: '2026-04-05' }, adminToken);

    expect(res.statusCode).toBe(200);
    const totale = body.ore.per_cliente.reduce((somma, c) => somma + c.ore_totali, 0);
    expect(totale).toBe(5);
  });

  it('A2. gli estremi sono inclusi', async () => {
    await seedRigaRapportino({
      utente_id: testUtenteId,
      giorno: '2026-03-10',
      ore: 4,
    });

    const { body } = await getStats({ da: '2026-03-10', a: '2026-03-10' }, adminToken);

    const totale = body.ore.per_cliente.reduce((somma, c) => somma + c.ore_totali, 0);
    expect(totale).toBe(4);
  });

  it('A3. un intervallo senza rapportini restituisce zero espliciti', async () => {
    const { res, body } = await getStats({ da: '2025-01-01', a: '2025-01-31' }, adminToken);

    expect(res.statusCode).toBe(200);
    expect(body.ore.per_cliente).toEqual([]);
  });

  it('A4. la risposta dichiara il periodo effettivamente usato', async () => {
    const { body } = await getStats({ da: '2026-03-05', a: '2026-03-20' }, adminToken);

    expect(body.periodo).toEqual({ da: '2026-03-05', a: '2026-03-20' });
  });

  it('A5. con una scorciatoia la risposta dichiara le date risolte', async () => {
    const { body } = await getStats({ scorciatoia: 'quest-anno' }, adminToken);

    expect(body.periodo.da).toMatch(/^\d{4}-01-01$/);
    expect(body.periodo.a).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FILTRO OPERAIO E PRIVACY
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/dashboard/stats - Filtro operaio', () => {
  it('B1. admin: i dati si restringono all operaio scelto', async () => {
    await seedRigaRapportino({
      utente_id: testUtenteId,
      giorno: '2026-03-05',
      ore: 4,
    });
    await seedRigaRapportino({
      utente_id: testAdminId,
      giorno: '2026-03-05',
      ore: 2,
    });

    const { body: tutti } = await getStats({ da: '2026-03-01', a: '2026-03-31' }, adminToken);
    const rigaOperaio = tutti.ore.per_operaio.find((o) => o.utente_id === testUtenteId);

    const { res, body } = await getStats(
      { da: '2026-03-01', a: '2026-03-31', operaio_id: testUtenteId },
      adminToken
    );

    expect(res.statusCode).toBe(200);
    const totale = body.ore.per_cliente.reduce((somma, c) => somma + c.ore_totali, 0);
    expect(totale).toBe(rigaOperaio.ore_totali);
    expect(body.ore.per_operaio).toHaveLength(1);
    expect(body.ore.per_operaio[0].utente_id).toBe(testUtenteId);
  });

  it('B2. admin: senza operaio_id torna la vista complessiva', async () => {
    await seedRigaRapportino({ utente_id: testUtenteId, giorno: '2026-03-05' });
    await seedRigaRapportino({ utente_id: testAdminId, giorno: '2026-03-05' });

    const { body } = await getStats({ da: '2026-03-01', a: '2026-03-31' }, adminToken);

    expect(body.ore.per_operaio.length).toBeGreaterThan(1);
  });

  it('B3. la risposta elenca gli operai selezionabili', async () => {
    await seedRigaRapportino({ utente_id: testUtenteId, giorno: '2026-03-05' });

    const { body } = await getStats({ da: '2026-03-01', a: '2026-03-31' }, adminToken);

    expect(Array.isArray(body.operai)).toBe(true);
    expect(body.operai.some((o) => o.id === testUtenteId)).toBe(true);
  });

  it('B4. admin: operaio senza righe nel periodo restituisce zero, non errore', async () => {
    const { res, body } = await getStats(
      { da: '2026-03-01', a: '2026-03-31', operaio_id: testAdminId },
      adminToken
    );

    expect(res.statusCode).toBe(200);
    expect(body.ore.per_cliente).toEqual([]);
  });
});

// FR-013: e' il test che distingue un controllo reale dal nascondere un menu
// nell'interfaccia. Il parametro non viene respinto, viene SOVRASCRITTO: un
// parametro ignorato non puo' diventare una fuga di dati per una dimenticanza
// in un ramo condizionale.
describe('GET /api/dashboard/stats - Privacy operaio', () => {
  beforeEach(async () => {
    await seedRigaRapportino({
      utente_id: testUtenteId,
      giorno: '2026-03-05',
      ore: 4,
    });
    await seedRigaRapportino({
      utente_id: testAdminId,
      giorno: '2026-03-05',
      ore: 10,
    });
  });

  it('B5. non-admin che chiede i dati di un collega riceve i PROPRI', async () => {
    const { res, body } = await getStats(
      { da: '2026-03-01', a: '2026-03-31', operaio_id: testAdminId },
      userToken
    );

    expect(res.statusCode).toBe(200);
    const totale = body.ore.per_cliente.reduce((somma, c) => somma + c.ore_totali, 0);
    // 4 ore proprie, non le 10 del collega.
    expect(totale).toBe(4);
  });

  it('B6. non-admin: nessun dato aggregato per operaio nel payload', async () => {
    const { body } = await getStats(
      { da: '2026-03-01', a: '2026-03-31', operaio_id: testAdminId },
      userToken
    );

    expect(body.ore.per_operaio).toEqual([]);
  });

  it('B7. non-admin: nessun elenco di operai selezionabili', async () => {
    const { body } = await getStats({ da: '2026-03-01', a: '2026-03-31' }, userToken);

    expect(body.operai ?? []).toEqual([]);
  });

  it('B8. non-admin che chiede il PROPRIO operaio_id riceve i propri dati', async () => {
    const { res, body } = await getStats(
      { da: '2026-03-01', a: '2026-03-31', operaio_id: testUtenteId },
      userToken
    );

    expect(res.statusCode).toBe(200);
    const totale = body.ore.per_cliente.reduce((somma, c) => somma + c.ore_totali, 0);
    expect(totale).toBe(4);
  });

  it('B9. non-admin: un operaio_id inesistente non fa trapelare nulla', async () => {
    const { res, body } = await getStats(
      { da: '2026-03-01', a: '2026-03-31', operaio_id: 999999 },
      userToken
    );

    expect(res.statusCode).toBe(200);
    const totale = body.ore.per_cliente.reduce((somma, c) => somma + c.ore_totali, 0);
    expect(totale).toBe(4);
  });

  it('B9b. export-ore filtrato per operaio contiene solo i suoi dati', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/dashboard/export-ore?da=2026-03-01&a=2026-03-31&operaio_id=${testUtenteId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(200);
    // Il nome del file dichiara il filtro: e' il segnale che export e schermo
    // guardano lo stesso sottoinsieme.
    expect(res.headers['content-disposition']).toContain(`operaio-${testUtenteId}`);
  });

  it('B10. export-ore resta vietato ai non-admin anche con operaio_id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/dashboard/export-ore?da=2026-03-01&a=2026-03-31&operaio_id=${testUtenteId}`,
      headers: { authorization: `Bearer ${userToken}` },
    });

    expect(res.statusCode).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ORE MANCANTI
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/dashboard/stats - Ore mancanti', () => {
  // Mercoledi' 4 marzo 2026, sabato 7 marzo.
  it('C1. un giorno feriale con 5 ore compare con 3 mancanti', async () => {
    await seedRigaRapportino({
      utente_id: testUtenteId,
      giorno: '2026-03-04',
      ore: 5,
    });

    const { res, body } = await getStats({ da: '2026-03-04', a: '2026-03-04' }, adminToken);

    expect(res.statusCode).toBe(200);
    const operaio = body.ore_mancanti.find((o) => o.utente_id === testUtenteId);
    expect(operaio).toBeDefined();
    expect(operaio.giorni).toContainEqual({
      giorno: '2026-03-04',
      ore_caricate: 5,
      ore_mancanti: 3,
      vuoto: false,
    });
  });

  it('C2. un giorno con 8 ore non compare', async () => {
    await seedRigaRapportino({
      utente_id: testUtenteId,
      giorno: '2026-03-04',
      ore: 8,
    });

    const { body } = await getStats({ da: '2026-03-04', a: '2026-03-04' }, adminToken);

    const operaio = body.ore_mancanti.find((o) => o.utente_id === testUtenteId);
    expect(operaio).toBeUndefined();
  });

  it('C3. il sabato non e mai segnalato', async () => {
    await seedRigaRapportino({
      utente_id: testUtenteId,
      giorno: '2026-03-07',
      ore: 2,
    });

    const { body } = await getStats({ da: '2026-03-07', a: '2026-03-07' }, adminToken);

    expect(body.ore_mancanti).toEqual([]);
  });

  it('C4. il pannello rispetta il filtro operaio', async () => {
    await seedRigaRapportino({
      utente_id: testUtenteId,
      giorno: '2026-03-04',
      ore: 4,
    });
    await seedRigaRapportino({
      utente_id: testAdminId,
      giorno: '2026-03-04',
      ore: 3,
    });

    const { body } = await getStats(
      { da: '2026-03-04', a: '2026-03-04', operaio_id: testUtenteId },
      adminToken
    );

    expect(body.ore_mancanti.map((o) => o.utente_id)).toEqual([testUtenteId]);
  });

  // FR-021: l'operaio vede i propri giorni come promemoria, mai quelli dei
  // colleghi.
  it('C5. il non-admin vede solo se stesso', async () => {
    await seedRigaRapportino({
      utente_id: testUtenteId,
      giorno: '2026-03-04',
      ore: 4,
    });
    await seedRigaRapportino({
      utente_id: testAdminId,
      giorno: '2026-03-04',
      ore: 1,
    });

    const { body } = await getStats({ da: '2026-03-04', a: '2026-03-04' }, userToken);

    // Il confronto e' sugli id, non sulla stringa serializzata: cercare "1"
    // dentro il JSON trova anche "giorni_parziali":1.
    expect(body.ore_mancanti.map((o) => o.utente_id)).toEqual([testUtenteId]);
    expect(body.ore_mancanti.some((o) => o.utente_id === testAdminId)).toBe(false);
  });

  it('C6. distingue il giorno vuoto da quello parziale', async () => {
    await seedRigaRapportino({
      utente_id: testUtenteId,
      giorno: '2026-03-04',
      ore: 5,
    });

    const { body } = await getStats({ da: '2026-03-04', a: '2026-03-05' }, adminToken);

    const operaio = body.ore_mancanti.find((o) => o.utente_id === testUtenteId);
    expect(operaio.giorni_parziali).toBe(1);
    expect(operaio.giorni_vuoti).toBe(1);
  });

  it('C7. senza nulla da segnalare restituisce un elenco vuoto, non un errore', async () => {
    const { res, body } = await getStats({ da: '2026-03-07', a: '2026-03-08' }, adminToken);

    expect(res.statusCode).toBe(200);
    expect(body.ore_mancanti).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ELENCO OPERAI — segnalato dall'utente il 2026-09-02: tendina vuota
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/dashboard/stats - Elenco operai selezionabili', () => {
  // Il difetto: l'elenco veniva ricavato dalle righe del periodo, quindi in un
  // periodo senza rapportini era vuoto e il filtro diventava inutilizzabile.
  it('D1. l elenco c e anche quando nel periodo non ci sono rapportini', async () => {
    const { res, body } = await getStats({ da: '2025-01-01', a: '2025-01-31' }, adminToken);

    expect(res.statusCode).toBe(200);
    expect(body.operai.length).toBeGreaterThan(0);
  });

  it('D2. comprende tutti gli utenti con ruolo utente', async () => {
    const attesi = await app.db('utenti').where({ ruolo: 'user' }).select('id');

    const { body } = await getStats({ da: '2025-01-01', a: '2025-01-31' }, adminToken);

    for (const u of attesi) {
      expect(body.operai.some((o) => o.id === u.id)).toBe(true);
    }
  });

  it('D3. comprende anche chi ha rapportini nel periodo pur non essendo un operaio', async () => {
    // L'amministratore puo' caricare righe: se lo ha fatto, deve poter essere
    // selezionato, altrimenti le sue ore sarebbero irraggiungibili dal filtro.
    await seedRigaRapportino({ utente_id: testAdminId, giorno: '2026-03-04' });

    const { body } = await getStats({ da: '2026-03-01', a: '2026-03-31' }, adminToken);

    expect(body.operai.some((o) => o.id === testAdminId)).toBe(true);
  });

  it('D4. nessun duplicato quando un operaio ha anche rapportini', async () => {
    await seedRigaRapportino({ utente_id: testUtenteId, giorno: '2026-03-04' });

    const { body } = await getStats({ da: '2026-03-01', a: '2026-03-31' }, adminToken);

    const ids = body.operai.map((o) => o.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  it('D5. l elenco e ordinato per nome', async () => {
    const { body } = await getStats({ da: '2026-03-01', a: '2026-03-31' }, adminToken);
    const nomi = body.operai.map((o) => o.nome);

    expect(nomi).toEqual([...nomi].sort((a, b) => a.localeCompare(b)));
  });
});

// La conseguenza piu' seria dello stesso difetto: l'elenco alimenta anche il
// pannello delle ore mancanti. Un operaio che non ha caricato NULLA nel periodo
// non compariva — cioe' proprio la persona che si vorrebbe vedere per prima.
describe('GET /api/dashboard/stats - Ore mancanti di chi non ha caricato nulla', () => {
  it('D6. un operaio senza alcun rapportino compare fra le ore mancanti', async () => {
    // Mercoledi' 4 e giovedi' 5 marzo 2026, nessuna riga per nessuno.
    const { body } = await getStats({ da: '2026-03-04', a: '2026-03-05' }, adminToken);

    const operaio = body.ore_mancanti.find((o) => o.utente_id === testUtenteId);
    expect(operaio).toBeDefined();
    expect(operaio.giorni_vuoti).toBe(2);
    expect(operaio.ore_mancanti_totali).toBe(16);
  });
});

describe("GET /api/dashboard/export-ore - contenuto del foglio", () => {
  const XLSX = require('xlsx');

  /**
   * Scarica l'esportazione e restituisce il foglio Dettaglio come oggetti.
   * @returns {Promise<object[]>} righe del foglio
   */
  async function scaricaDettaglio() {
    const res = await app.inject({
      method: 'GET',
      url: '/api/dashboard/export-ore?da=2026-03-01&a=2026-03-31',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const wb = XLSX.read(res.rawPayload, { type: 'buffer' });
    return XLSX.utils.sheet_to_json(wb.Sheets.Dettaglio);
  }

  // FR-029: e' un cambio visibile a chi usa il foglio, non un adeguamento
  // interno. La fascia oraria non viene piu' registrata.
  it('il foglio Dettaglio ha Ore al posto di Ora Inizio e Ora Fine', async () => {
    await seedRigaRapportino({ giorno: '2026-03-10', ore: 4.5 });
    const righe = await scaricaDettaglio();

    expect(righe).toHaveLength(1);
    expect(Object.keys(righe[0])).not.toContain('Ora Inizio');
    expect(Object.keys(righe[0])).not.toContain('Ora Fine');
    expect(righe[0].Ore).toBe(4.5);
  });

  it('il foglio Dettaglio riporta il macchinario', async () => {
    await seedRigaRapportino({ macchina: 'Mietitrebbia CX', ore: 3 });
    const righe = await scaricaDettaglio();
    expect(righe[0].Macchina).toBe('Mietitrebbia CX');
  });

  // Senza un secondo criterio stabile, le lavorazioni dello stesso giorno
  // cambierebbero posto a ogni esportazione, e due file dello stesso periodo
  // risulterebbero diversi senza motivo apparente.
  it('due esportazioni dello stesso periodo hanno lo stesso ordine', async () => {
    for (const ore of [1, 2, 3, 4]) {
      await seedRigaRapportino({ giorno: '2026-03-10', ore });
    }

    const prima = await scaricaDettaglio();
    const seconda = await scaricaDettaglio();

    expect(prima.map((r) => r.Ore)).toEqual(seconda.map((r) => r.Ore));
    expect(prima).toHaveLength(4);
  });
});

describe('GET /api/dashboard/export-ore - Export Excel (admin only)', () => {
  it('20. senza parametri → 200 con il periodo predefinito', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/dashboard/export-ore',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it('20b. intervallo non valido → 400', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/dashboard/export-ore?da=2026-03-31&a=2026-03-01',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(400);
  });

  it('21. non-admin → 403', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/dashboard/export-ore?da=2026-03-01&a=2026-03-31',
      headers: { authorization: `Bearer ${userToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('22. admin con parametri validi → 200 + xlsx file', async () => {
    // Crea una riga per avere dati nel file
    await seedRigaRapportino({
      utente_id: testUtenteId,
      ore: 2,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/dashboard/export-ore?da=2026-03-01&a=2026-03-31',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['content-disposition']).toContain('ore_2026-03-01_2026-03-31.xlsx');
    expect(res.rawPayload).toBeTruthy();
    expect(res.rawPayload.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// METRICHE DEL LAVORO (feature 024)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Crea un rapportino senza alcuna lavorazione.
 * @param {object} [overrides]
 * @returns {Promise<object>}
 */
async function seedRapportinoVuoto(overrides = {}) {
  const [r] = await app
    .db('rapportini')
    .insert({
      utente_id: overrides.utente_id ?? testUtenteId,
      cliente_id: testClienteId,
      macchina: overrides.macchina ?? 'Muletto',
    })
    .returning('*');
  return r;
}

/**
 * Interroga l'elenco dei rapportini con gli stessi parametri della dashboard.
 * @param {object} params
 * @returns {Promise<number>} totale dichiarato dall'elenco
 */
async function totaleElencoRapportini(params) {
  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  const res = await app.inject({
    method: 'GET',
    url: `/api/rapportini?${qs}`,
    headers: { authorization: `Bearer ${adminToken}` },
  });
  const body = JSON.parse(res.body);
  return body.pagination ? body.pagination.total : body.total;
}

describe('Metriche: conteggi dei rapportini', () => {
  it('M1. conta i rapportini del periodo distinti per stato', async () => {
    await seedRigaRapportino({ giorno: '2026-03-05' }); // aperto
    const nota = await seedNota(testClienteId);
    await seedRigaRapportino({ giorno: '2026-03-06', nota_lavorazione_id: nota.id }); // gestito

    const { body } = await getStats({ da: '2026-03-01', a: '2026-03-31' }, adminToken);

    expect(body.rapportini.aperti).toBe(1);
    expect(body.rapportini.gestiti).toBe(1);
    expect(body.rapportini.chiusi).toBe(0);
  });

  it('M2. un rapportino senza lavorazioni resta fuori dai conteggi per stato', async () => {
    await seedRapportinoVuoto();

    const { body } = await getStats({ da: '2026-03-01', a: '2026-03-31' }, adminToken);

    expect(body.rapportini.aperti).toBe(0);
    expect(body.rapportini.senza_lavorazioni).toBe(1);
  });

  it('M3. il rapportino vuoto compare in QUALUNQUE periodo, anche remoto', async () => {
    // Non ha date: nessun intervallo puo' escluderlo. Contarlo fra gli aperti
    // significherebbe contare, ogni mese e per sempre, lavoro mai svolto.
    await seedRapportinoVuoto();

    for (const p of [
      { da: '2020-01-01', a: '2020-12-31' },
      { da: '2026-03-01', a: '2026-03-31' },
      { da: '2099-01-01', a: '2099-12-31' },
    ]) {
      const { body } = await getStats(p, adminToken);
      expect(body.rapportini.senza_lavorazioni).toBe(1);
      expect(body.rapportini.aperti).toBe(0);
    }
  });

  it('M4. la voce «senza lavorazioni» compare anche quando vale zero', async () => {
    await seedRigaRapportino({ giorno: '2026-03-05' });

    const { body } = await getStats({ da: '2026-03-01', a: '2026-03-31' }, adminToken);

    expect(body.rapportini).toHaveProperty('senza_lavorazioni');
    expect(body.rapportini.senza_lavorazioni).toBe(0);
  });

  it('M5. INVARIANTE FR-014c: la somma coincide con il totale dell elenco', async () => {
    // E' la sola cosa di questa feature che puo' rompersi senza produrre alcun
    // errore: due numeri diversi in due schermate, e chi guarda non sa quale
    // credere. Regge perche' dashboard ed elenco condividono il predicato.
    await seedRigaRapportino({ giorno: '2026-03-05' });
    await seedRigaRapportino({ giorno: '2026-03-20' });
    await seedRigaRapportino({ giorno: '2026-01-15' }); // fuori periodo
    await seedRapportinoVuoto();
    await seedRapportinoVuoto({ macchina: 'Ape' });

    const periodo = { da: '2026-03-01', a: '2026-03-31' };
    const { body } = await getStats(periodo, adminToken);
    const somma =
      body.rapportini.aperti +
      body.rapportini.chiusi +
      body.rapportini.gestiti +
      body.rapportini.senza_lavorazioni;

    expect(somma).toBe(await totaleElencoRapportini(periodo));
  });

  it('M6. l invariante regge anche con il filtro per operaio', async () => {
    await seedRigaRapportino({ giorno: '2026-03-05', utente_id: testUtenteId });
    await seedRigaRapportino({ giorno: '2026-03-06', utente_id: testAdminId });
    await seedRapportinoVuoto({ utente_id: testUtenteId });

    const periodo = { da: '2026-03-01', a: '2026-03-31', utente_id: testUtenteId };
    const { body } = await getStats(
      { da: '2026-03-01', a: '2026-03-31', operaio_id: testUtenteId },
      adminToken,
    );
    const somma =
      body.rapportini.aperti +
      body.rapportini.chiusi +
      body.rapportini.gestiti +
      body.rapportini.senza_lavorazioni;

    expect(somma).toBe(await totaleElencoRapportini(periodo));
  });

  it('M7. le metriche non compaiono a chi non e amministratore', async () => {
    await seedRigaRapportino({ giorno: '2026-03-05' });

    const { body } = await getStats({ da: '2026-03-01', a: '2026-03-31' }, userToken);

    expect(body).not.toHaveProperty('rapportini');
    expect(body).not.toHaveProperty('note');
  });
});

describe('Metriche: note di lavorazione', () => {
  /**
   * Crea una nota con data di riferimento e un rapportino concluso dentro.
   * @param {object} [opzioni]
   * @param {string} [opzioni.riferimento] - data stampata sul documento
   * @param {number} [opzioni.ore] - ore della lavorazione inclusa
   * @param {number} [opzioni.costoOrario] - tariffa applicata alla lavorazione
   * @param {number} [opzioni.utenteId] - operaio a cui appartiene il rapportino
   * @param {object} [opzioni.override] - colonne di scostamento da imporre
   * @returns {Promise<object>} la nota
   */
  async function seedNotaCon({
    riferimento = '2026-03-15',
    ore = 4,
    costoOrario = 30,
    utenteId = testUtenteId,
    override = {},
  } = {}) {
    const [nota] = await app
      .db('note_lavorazione')
      .insert({
        cliente_id: testClienteId,
        testo: 'Manutenzione',
        data_riferimento: riferimento,
        ...override,
      })
      .returning('*');

    const [r] = await app
      .db('rapportini')
      .insert({
        utente_id: utenteId,
        cliente_id: testClienteId,
        macchina: 'Tornio',
        chiuso_il: new Date().toISOString(),
        nota_lavorazione_id: nota.id,
      })
      .returning('*');

    await app.db('lavorazioni').insert({
      rapportino_id: r.id,
      giorno: riferimento,
      ore,
      costo_orario_applicato: costoOrario,
    });

    return nota;
  }

  it('N1. conta le note del periodo e ne somma gli importi', async () => {
    await seedNotaCon({ riferimento: '2026-03-10', ore: 4 }); // 120
    await seedNotaCon({ riferimento: '2026-03-20', ore: 2 }); // 60

    const { body } = await getStats({ da: '2026-03-01', a: '2026-03-31' }, adminToken);

    expect(body.note.numero).toBe(2);
    expect(body.note.importo).toBe(180);
  });

  it('N2. una nota fuori periodo non entra', async () => {
    await seedNotaCon({ riferimento: '2026-01-10' });

    const { body } = await getStats({ da: '2026-03-01', a: '2026-03-31' }, adminToken);

    expect(body.note.numero).toBe(0);
    expect(body.note.importo).toBe(0);
  });

  it('N3. l importo e quello IMPOSTO, non il ricalcolo dai dettagli', async () => {
    // E' il controllo che coglie il difetto piu' insidioso: una somma
    // ricalcolata dai dettagli darebbe 120, cioe' una cifra che il cliente non
    // ha mai visto, perche' sul documento e' stampato l'importo imposto.
    await seedNotaCon({ riferimento: '2026-03-10', ore: 4, override: { totale_override: 95.5 } });

    const { body } = await getStats({ da: '2026-03-01', a: '2026-03-31' }, adminToken);

    expect(body.note.importo).toBe(95.5);
  });

  it('N4. con il filtro per operaio l importo NON compare', async () => {
    // Una nota raccoglie i rapportini di un cliente e puo' contenere il lavoro
    // di piu' persone: il totale del documento non e' la quota di chi lo ha in
    // parte prodotto. `null` e non chiave assente, cosi' chi consuma distingue
    // «non mostrabile» da «zero euro».
    await seedNotaCon({ riferimento: '2026-03-10', utenteId: testUtenteId });

    const { body } = await getStats(
      { da: '2026-03-01', a: '2026-03-31', operaio_id: testUtenteId },
      adminToken,
    );

    expect(body.note.numero).toBe(1);
    expect(body.note).toHaveProperty('importo');
    expect(body.note.importo).toBeNull();
  });

  it('N5. con il filtro per operaio conta le note a cui ha contribuito', async () => {
    await seedNotaCon({ riferimento: '2026-03-10', utenteId: testUtenteId });
    await seedNotaCon({ riferimento: '2026-03-12', utenteId: testAdminId });

    const { body } = await getStats(
      { da: '2026-03-01', a: '2026-03-31', operaio_id: testUtenteId },
      adminToken,
    );

    expect(body.note.numero).toBe(1);
  });

  it('N6. FR-017a: una nota senza data di riferimento e esclusa per SCELTA', async () => {
    // In esercizio la colonna e' obbligatoria, ma su SQLite il vincolo non
    // esiste e questo caso e' costruibile. L'esclusione dev'essere una
    // decisione dichiarata — `whereNotNull` esplicito — e non l'effetto
    // collaterale di un confronto fra date con un valore nullo.
    await seedNota(testClienteId); // senza data_riferimento
    await seedNotaCon({ riferimento: '2026-03-10' });

    const { body } = await getStats({ da: '2026-03-01', a: '2026-03-31' }, adminToken);

    expect(body.note.numero).toBe(1);
  });

  it('N7. un periodo senza note dichiara zero, non tace', async () => {
    const { body } = await getStats({ da: '2026-03-01', a: '2026-03-31' }, adminToken);

    expect(body.note.numero).toBe(0);
    expect(body.note.importo).toBe(0);
  });
});
