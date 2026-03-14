'use strict';

const bcrypt = require('bcrypt');
const { getApp, getAuthToken, getAdminToken } = require('../helpers/setup');

let app;
let userToken;
let adminToken;
let testClienteId;
let testUtenteId; // user normale (marco@officina.it)
let testAdminId; // admin (admin@officina.it)

beforeAll(async () => {
  app = getApp();
  userToken = await getAuthToken();
  adminToken = await getAdminToken();

  testUtenteId = (await app.db('utenti').where({ email: 'marco@officina.it' }).first()).id;
  testAdminId = (await app.db('utenti').where({ email: 'admin@officina.it' }).first()).id;
});

beforeEach(async () => {
  // Pulizia in ordine FK-safe: materiali_rapportino (CASCADE), note_lavorazione, righe_rapportino, catalogo_prodotti, clienti
  await app.db('materiali_rapportino').del();
  await app.db('note_lavorazione').del();
  await app.db('righe_rapportino').del();
  await app.db('catalogo_prodotti').del();
  await app.db('clienti').del();

  const [cliente] = await app.db('clienti').insert({ nome: 'Cliente Test' }).returning('*');
  testClienteId = cliente.id;
});

afterEach(async () => {
  await app.db('materiali_rapportino').del();
  await app.db('note_lavorazione').del();
  await app.db('righe_rapportino').del();
  await app.db('catalogo_prodotti').del();
  await app.db('clienti').del();
});

// ── Helper: inserisce una riga rapportino direttamente nel DB ─────────────────
async function seedRigaRapportino(overrides = {}) {
  const [riga] = await app
    .db('righe_rapportino')
    .insert({
      utente_id: testUtenteId,
      cliente_id: testClienteId,
      giorno: '2026-03-10',
      ora_inizio: '08:00',
      ora_fine: '10:00',
      nota_lavorazione_id: null,
      ...overrides,
    })
    .returning('*');
  return riga;
}

// ── Helper: inserisce una nota di lavorazione ─────────────────────────────────
async function seedNota(clienteId) {
  const [nota] = await app
    .db('note_lavorazione')
    .insert({ cliente_id: clienteId, testo: 'Test' })
    .returning('*');
  return nota;
}

// ── Helper: chiama l'endpoint ─────────────────────────────────────────────────
async function getRighe(params = {}, token = userToken) {
  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  const res = await app.inject({
    method: 'GET',
    url: `/api/rapportini${qs ? '?' + qs : ''}`,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  return { res, body: JSON.parse(res.body) };
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTENTICAZIONE
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/rapportini - Autenticazione', () => {
  it('1. senza token → 401', async () => {
    const { res } = await getRighe({}, null);
    expect(res.statusCode).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PAGINAZIONE
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/rapportini - Paginazione', () => {
  it('2. lista con paginazione ritorna pagination object con page, perPage, total, totalPages', async () => {
    // Crea 5 righe
    for (let i = 0; i < 5; i++) {
      await seedRigaRapportino({ giorno: `2026-03-${10 + i}` });
    }

    const { res, body } = await getRighe({ page: 1, per_page: 2 });
    expect(res.statusCode).toBe(200);

    expect(body).toHaveProperty('pagination');
    expect(body.pagination).toHaveProperty('page');
    expect(body.pagination).toHaveProperty('perPage');
    expect(body.pagination).toHaveProperty('total');
    expect(body.pagination).toHaveProperty('totalPages');

    expect(body.pagination.page).toBe(1);
    expect(body.pagination.perPage).toBe(2);
    expect(body.pagination.total).toBe(5);
    expect(body.pagination.totalPages).toBe(3);
  });

  it('3. con 20+ righe totalPages > 1', async () => {
    // Crea 26 righe (default perPage=25 → con 26 righe, totalPages=2)
    for (let i = 0; i < 26; i++) {
      await seedRigaRapportino({ giorno: `2026-03-${(i % 20) + 1}` });
    }

    const { res, body } = await getRighe({ page: 1 });
    expect(res.statusCode).toBe(200);

    expect(body.pagination.total).toBe(26);
    expect(body.pagination.totalPages).toBeGreaterThan(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ORE TOTALI FILTRATE
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/rapportini - Ore totali filtrate', () => {
  it('4. 3 righe di 2h ciascuna → ore_totali_filtrate=6.0', async () => {
    // 3 righe: 08:00-10:00 (2h), 10:00-12:00 (2h), 14:00-16:00 (2h)
    await seedRigaRapportino({ ora_inizio: '08:00', ora_fine: '10:00' });
    await seedRigaRapportino({ ora_inizio: '10:00', ora_fine: '12:00', giorno: '2026-03-11' });
    await seedRigaRapportino({ ora_inizio: '14:00', ora_fine: '16:00', giorno: '2026-03-12' });

    const { res, body } = await getRighe({});
    expect(res.statusCode).toBe(200);

    expect(body).toHaveProperty('ore_totali_filtrate');
    expect(body.ore_totali_filtrate).toBe(6.0);
  });

  it('5. ore_totali_filtrate presente indipendentemente dalla paginazione', async () => {
    // Crea 25 righe di 1.5h ciascuna
    for (let i = 0; i < 25; i++) {
      await seedRigaRapportino({
        giorno: `2026-03-${(i % 20) + 1}`,
        ora_inizio: '08:00',
        ora_fine: '09:30',
      });
    }

    // Richiesta con paginazione
    const { res, body } = await getRighe({ page: 1, per_page: 5 });
    expect(res.statusCode).toBe(200);

    expect(body).toHaveProperty('ore_totali_filtrate');
    // 25 righe × 1.5h = 37.5h
    expect(body.ore_totali_filtrate).toBe(37.5);
  });

  it('6. ore_totali_filtrate ignora paginazione (somma tutte le righe filtrate)', async () => {
    // Crea 10 righe: 5 di 2h e 5 di 1h
    for (let i = 0; i < 5; i++) {
      await seedRigaRapportino({
        giorno: `2026-03-${10 + (i % 20)}`,
        ora_inizio: '08:00',
        ora_fine: '10:00',
      });
    }
    for (let i = 5; i < 10; i++) {
      await seedRigaRapportino({
        giorno: `2026-03-${10 + (i % 20)}`,
        ora_inizio: '13:00',
        ora_fine: '14:00',
      });
    }

    // Pagina 1 con 3 righe per pagina
    const { body } = await getRighe({ page: 1, per_page: 3 });

    // Ore totali deve essere (5×2) + (5×1) = 15, non solo quelle della pagina
    expect(body.ore_totali_filtrate).toBe(15.0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FILTRI
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/rapportini - Filtri', () => {
  it('7. filtro cliente_id: filtra le righe del cliente specificato', async () => {
    // Crea 2 clienti
    const [c1] = await app.db('clienti').insert({ nome: 'Cliente 1' }).returning('*');
    const [c2] = await app.db('clienti').insert({ nome: 'Cliente 2' }).returning('*');

    // 2 righe per cliente 1, 1 riga per cliente 2
    await seedRigaRapportino({ cliente_id: c1.id });
    await seedRigaRapportino({ cliente_id: c1.id, giorno: '2026-03-11' });
    await seedRigaRapportino({ cliente_id: c2.id, giorno: '2026-03-12' });

    const { res, body } = await getRighe({ cliente_id: c1.id });
    expect(res.statusCode).toBe(200);

    expect(body.data).toHaveLength(2);
    expect(body.pagination.total).toBe(2);
    expect(body.data.every((r) => r.cliente_id === c1.id)).toBe(true);
  });

  it('8. filtro giorno: filtra le righe del giorno specificato', async () => {
    // 2 righe il 10 marzo, 1 riga l'11 marzo
    await seedRigaRapportino({ giorno: '2026-03-10' });
    await seedRigaRapportino({ giorno: '2026-03-10', ora_inizio: '10:00', ora_fine: '12:00' });
    await seedRigaRapportino({ giorno: '2026-03-11' });

    const { res, body } = await getRighe({ giorno: '2026-03-10' });
    expect(res.statusCode).toBe(200);

    expect(body.data).toHaveLength(2);
    expect(body.pagination.total).toBe(2);
    expect(body.data.every((r) => r.giorno === '2026-03-10')).toBe(true);
  });

  it('9. filtro gestita=true: mostra solo righe con nota_lavorazione_id NOT NULL', async () => {
    const nota = await seedNota(testClienteId);

    // Righe con nota (gestite)
    await seedRigaRapportino({ nota_lavorazione_id: nota.id });
    await seedRigaRapportino({ nota_lavorazione_id: nota.id, giorno: '2026-03-11' });

    // Riga senza nota (non gestita)
    await seedRigaRapportino({ nota_lavorazione_id: null, giorno: '2026-03-12' });

    const { res, body } = await getRighe({ gestita: 'true' });
    expect(res.statusCode).toBe(200);

    expect(body.data).toHaveLength(2);
    expect(body.pagination.total).toBe(2);
    expect(body.data.every((r) => r.nota_lavorazione_id !== null)).toBe(true);
  });

  it('10. filtro gestita=false: mostra solo righe con nota_lavorazione_id NULL', async () => {
    const nota = await seedNota(testClienteId);

    // Righe con nota (gestite)
    await seedRigaRapportino({ nota_lavorazione_id: nota.id });

    // Righe senza nota (non gestite)
    await seedRigaRapportino({ nota_lavorazione_id: null, giorno: '2026-03-11' });
    await seedRigaRapportino({ nota_lavorazione_id: null, giorno: '2026-03-12' });

    const { res, body } = await getRighe({ gestita: 'false' });
    expect(res.statusCode).toBe(200);

    expect(body.data).toHaveLength(2);
    expect(body.pagination.total).toBe(2);
    expect(body.data.every((r) => r.nota_lavorazione_id === null)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// RBAC
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/rapportini - RBAC', () => {
  it('11. operaio non vede righe di altri operai', async () => {
    // Crea un secondo utente con email unica
    const passwordHash = await bcrypt.hash('admin123', 10);
    const emailUnico = `secondo-${Date.now()}@officina.it`;
    const utente2Exists = await app.db('utenti').where({ email: emailUnico }).first();
    if (utente2Exists) {
      await app.db('righe_rapportino').where({ utente_id: utente2Exists.id }).del();
      await app.db('utenti').where({ id: utente2Exists.id }).del();
    }
    const [utente2] = await app.db('utenti').insert({
      email: emailUnico,
      password_hash: passwordHash,
      nome: 'Secondo',
      ruolo: 'operaio',
    }).returning('*');

    // Righe del primo operaio (marco)
    await seedRigaRapportino({ utente_id: testUtenteId, giorno: '2026-03-10' });
    await seedRigaRapportino({ utente_id: testUtenteId, giorno: '2026-03-11' });

    // Righe del secondo operaio
    await seedRigaRapportino({ utente_id: utente2.id, giorno: '2026-03-12' });

    // Richiesta con token del primo operaio
    const { res, body } = await getRighe({}, userToken);
    expect(res.statusCode).toBe(200);

    // Deve vedere solo le proprie 2 righe
    expect(body.pagination.total).toBe(2);
    expect(body.data.every((r) => r.utente_id === testUtenteId)).toBe(true);

    // Cleanup
    await app.db('righe_rapportino').where({ utente_id: utente2.id }).del();
    await app.db('utenti').where({ id: utente2.id }).del();
  });

  it('12. admin vede tutte le righe', async () => {
    // Crea un secondo utente con email unica
    const passwordHash = await bcrypt.hash('admin123', 10);
    const emailUnico = `secondo-${Date.now()}@officina.it`;
    const utente2Exists = await app.db('utenti').where({ email: emailUnico }).first();
    if (utente2Exists) {
      await app.db('righe_rapportino').where({ utente_id: utente2Exists.id }).del();
      await app.db('utenti').where({ id: utente2Exists.id }).del();
    }
    const [utente2] = await app.db('utenti').insert({
      email: emailUnico,
      password_hash: passwordHash,
      nome: 'Secondo',
      ruolo: 'operaio',
    }).returning('*');

    // Righe del primo operaio
    await seedRigaRapportino({ utente_id: testUtenteId, giorno: '2026-03-10' });

    // Righe del secondo operaio
    await seedRigaRapportino({ utente_id: utente2.id, giorno: '2026-03-11' });

    // Righe dell'admin
    await seedRigaRapportino({ utente_id: testAdminId, giorno: '2026-03-12' });

    // Richiesta con token admin
    const { res, body } = await getRighe({}, adminToken);
    expect(res.statusCode).toBe(200);

    // L'admin deve vedere tutte e 3 le righe
    expect(body.pagination.total).toBe(3);

    // Cleanup
    await app.db('righe_rapportino').where({ utente_id: utente2.id }).del();
    await app.db('utenti').where({ id: utente2.id }).del();
  });

  it('13. admin vede tutte le righe anche con filtri per altri operai', async () => {
    // Crea un secondo utente con email unica
    const passwordHash = await bcrypt.hash('admin123', 10);
    const emailUnico = `secondo-${Date.now()}@officina.it`;
    const utente2Exists = await app.db('utenti').where({ email: emailUnico }).first();
    if (utente2Exists) {
      await app.db('righe_rapportino').where({ utente_id: utente2Exists.id }).del();
      await app.db('utenti').where({ id: utente2Exists.id }).del();
    }
    const [utente2] = await app.db('utenti').insert({
      email: emailUnico,
      password_hash: passwordHash,
      nome: 'Secondo',
      ruolo: 'operaio',
    }).returning('*');

    // Righe del primo operaio
    await seedRigaRapportino({ utente_id: testUtenteId, giorno: '2026-03-10' });
    await seedRigaRapportino({ utente_id: testUtenteId, giorno: '2026-03-11' });

    // Righe del secondo operaio
    await seedRigaRapportino({ utente_id: utente2.id, giorno: '2026-03-12' });
    await seedRigaRapportino({ utente_id: utente2.id, giorno: '2026-03-13' });

    // Admin filtra per utente2
    const { res, body } = await getRighe({ utente_id: utente2.id }, adminToken);
    expect(res.statusCode).toBe(200);

    // Deve vedere solo le 2 righe dell'utente2
    expect(body.pagination.total).toBe(2);
    expect(body.data.every((r) => r.utente_id === utente2.id)).toBe(true);

    // Cleanup
    await app.db('righe_rapportino').where({ utente_id: utente2.id }).del();
    await app.db('utenti').where({ id: utente2.id }).del();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ORE TOTALI FILTRATE CON FILTRI
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/rapportini - Ore totali filtrate con filtri', () => {
  it('14. con filtro cliente_id, ore_totali_filtrate somma solo le righe filtrate', async () => {
    // Crea 2 clienti
    const [c1] = await app.db('clienti').insert({ nome: 'Cliente 1' }).returning('*');
    const [c2] = await app.db('clienti').insert({ nome: 'Cliente 2' }).returning('*');

    // 3 righe di 2h per cliente 1 → 6h totali
    await seedRigaRapportino({ cliente_id: c1.id, ora_inizio: '08:00', ora_fine: '10:00' });
    await seedRigaRapportino({ cliente_id: c1.id, ora_inizio: '10:00', ora_fine: '12:00', giorno: '2026-03-11' });
    await seedRigaRapportino({ cliente_id: c1.id, ora_inizio: '14:00', ora_fine: '16:00', giorno: '2026-03-12' });

    // 2 righe di 3h per cliente 2 → 6h totali (non devono contare)
    await seedRigaRapportino({ cliente_id: c2.id, ora_inizio: '08:00', ora_fine: '11:00', giorno: '2026-03-13' });
    await seedRigaRapportino({ cliente_id: c2.id, ora_inizio: '11:00', ora_fine: '14:00', giorno: '2026-03-14' });

    // Filtra per cliente 1
    const { body } = await getRighe({ cliente_id: c1.id });

    // Deve sommare solo le 3 righe del cliente 1 (6h), non quelle del cliente 2
    expect(body.ore_totali_filtrate).toBe(6.0);
  });

  it('15. con filtro giorno, ore_totali_filtrate somma solo le righe del giorno', async () => {
    // 3 righe il 10 marzo di 2h ciascuna → 6h
    await seedRigaRapportino({ giorno: '2026-03-10', ora_inizio: '08:00', ora_fine: '10:00' });
    await seedRigaRapportino({ giorno: '2026-03-10', ora_inizio: '10:00', ora_fine: '12:00' });
    await seedRigaRapportino({ giorno: '2026-03-10', ora_inizio: '14:00', ora_fine: '16:00' });

    // 2 righe l'11 marzo di 1.5h ciascuna → 3h (non devono contare)
    await seedRigaRapportino({ giorno: '2026-03-11', ora_inizio: '08:00', ora_fine: '09:30' });
    await seedRigaRapportino({ giorno: '2026-03-11', ora_inizio: '10:00', ora_fine: '11:30' });

    // Filtra per giorno 10 marzo
    const { body } = await getRighe({ giorno: '2026-03-10' });

    // Deve sommare solo le 3 righe del 10 marzo (6h)
    expect(body.ore_totali_filtrate).toBe(6.0);
  });

  it('16. con filtro gestita=true, ore_totali_filtrate somma solo righe con nota', async () => {
    const nota = await seedNota(testClienteId);

    // 2 righe gestite (con nota) di 2h ciascuna → 4h
    await seedRigaRapportino({
      nota_lavorazione_id: nota.id,
      ora_inizio: '08:00',
      ora_fine: '10:00',
    });
    await seedRigaRapportino({
      nota_lavorazione_id: nota.id,
      giorno: '2026-03-11',
      ora_inizio: '10:00',
      ora_fine: '12:00',
    });

    // 2 righe non gestite (senza nota) di 1.5h ciascuna → 3h (non devono contare)
    await seedRigaRapportino({
      nota_lavorazione_id: null,
      giorno: '2026-03-12',
      ora_inizio: '08:00',
      ora_fine: '09:30',
    });
    await seedRigaRapportino({
      nota_lavorazione_id: null,
      giorno: '2026-03-13',
      ora_inizio: '10:00',
      ora_fine: '11:30',
    });

    // Filtra per gestita=true
    const { body } = await getRighe({ gestita: 'true' });

    // Deve sommare solo le 2 righe gestite (4h)
    expect(body.ore_totali_filtrate).toBe(4.0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// STRUTTURA RISPOSTA
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/rapportini - Struttura risposta', () => {
  it('17. la risposta contiene tutte le chiavi attese', async () => {
    await seedRigaRapportino();

    const { res, body } = await getRighe({});
    expect(res.statusCode).toBe(200);

    // Chiavi di primo livello
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('pagination');
    expect(body).toHaveProperty('ore_totali_filtrate');

    // Chiavi pagination
    expect(body.pagination).toHaveProperty('page');
    expect(body.pagination).toHaveProperty('perPage');
    expect(body.pagination).toHaveProperty('total');
    expect(body.pagination).toHaveProperty('totalPages');

    // Data è un array
    expect(Array.isArray(body.data)).toBe(true);

    // Ogni riga deve avere le proprietà attese
    if (body.data.length > 0) {
      const riga = body.data[0];
      expect(riga).toHaveProperty('id');
      expect(riga).toHaveProperty('utente_id');
      expect(riga).toHaveProperty('cliente_id');
      expect(riga).toHaveProperty('giorno');
      expect(riga).toHaveProperty('ora_inizio');
      expect(riga).toHaveProperty('ora_fine');
      expect(riga).toHaveProperty('nota_lavorazione_id');
      expect(riga).toHaveProperty('materiali');
    }
  });

  it('18. ore_totali_filtrate è un numero', async () => {
    await seedRigaRapportino();

    const { body } = await getRighe({});

    expect(typeof body.ore_totali_filtrate).toBe('number');
  });
});
