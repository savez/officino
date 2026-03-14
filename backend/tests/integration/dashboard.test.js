'use strict';

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
  // Pulizia in ordine FK-safe
  await app.db('righe_rapportino').del();
  await app.db('preventivo_pezzi').del();
  await app.db('preventivi').del();
  await app.db('note_lavorazione').del();
  await app.db('clienti').del();

  const [cliente] = await app.db('clienti').insert({ nome: 'Cliente Test' }).returning('*');
  testClienteId = cliente.id;
});

afterEach(async () => {
  await app.db('righe_rapportino').del();
  await app.db('preventivo_pezzi').del();
  await app.db('preventivi').del();
  await app.db('note_lavorazione').del();
  await app.db('clienti').del();
});

// ── Helper: inserisce un preventivo direttamente nel DB ───────────────────────
async function seedPreventivo(overrides = {}) {
  const [prev] = await app
    .db('preventivi')
    .insert({
      cliente_id: testClienteId,
      utente_id: testAdminId,
      numero: `2026/${String(Math.floor(Math.random() * 9000) + 1000)}`,
      data: '2026-03-15',
      stato: 'bozza',
      manodopera_ore: 0,
      manodopera_costo_orario: 0,
      manodopera_totale: 0,
      sconto_tipo: 'fisso',
      sconto_valore: 0,
      sconto_calcolato: 0,
      aliquota_iva: 22,
      imponibile: 0,
      imponibile_netto: 0,
      iva: 0,
      totale: 0,
      ...overrides,
    })
    .returning('*');
  return prev;
}

// ── Helper: inserisce una nota di lavorazione ─────────────────────────────────
async function seedNota(clienteId) {
  const [nota] = await app
    .db('note_lavorazione')
    .insert({ cliente_id: clienteId, testo: 'Test' })
    .returning('*');
  return nota;
}

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

// ── Helper: chiama l'endpoint ─────────────────────────────────────────────────
async function getStats(params = { mese: 3, anno: 2026 }, token = userToken) {
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
    const { res } = await getStats({ mese: 3, anno: 2026 }, null);
    expect(res.statusCode).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDAZIONE PARAMETRI
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/dashboard/stats - Validazione parametri', () => {
  it('2. senza parametri → 400', async () => {
    const { res } = await getStats({}, userToken);
    expect(res.statusCode).toBe(400);
  });

  it('3. mese=0 → 400', async () => {
    const { res } = await getStats({ mese: 0, anno: 2026 }, userToken);
    expect(res.statusCode).toBe(400);
  });

  it('4. mese=13 → 400', async () => {
    const { res } = await getStats({ mese: 13, anno: 2026 }, userToken);
    expect(res.statusCode).toBe(400);
  });

  it('5. anno=1999 → 400', async () => {
    const { res } = await getStats({ mese: 3, anno: 1999 }, userToken);
    expect(res.statusCode).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PREVENTIVI – PERIODO VUOTO
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/dashboard/stats - Preventivi periodo vuoto', () => {
  it('6. periodo senza dati → totale=0, tutti gli stati a 0, aperti=0, chiusi=0', async () => {
    const { res, body } = await getStats({ mese: 3, anno: 2026 });
    expect(res.statusCode).toBe(200);

    const p = body.preventivi;
    expect(p.totale).toBe(0);
    expect(p.aperti).toBe(0);
    expect(p.chiusi).toBe(0);
    expect(p.per_stato.bozza).toBe(0);
    expect(p.per_stato.approvato).toBe(0);
    expect(p.per_stato.rifiutato).toBe(0);
    expect(p.per_stato.scaduto).toBe(0);
    expect(p.per_stato.fatturato).toBe(0);
    expect(p.per_stato.cancellato).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PREVENTIVI – CONTEGGI CORRETTI
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/dashboard/stats - Preventivi conteggi', () => {
  it('7. 2 bozza + 1 approvato → totale=3, aperti=3, chiusi=0', async () => {
    await seedPreventivo({ stato: 'bozza', data: '2026-03-01' });
    await seedPreventivo({ stato: 'bozza', data: '2026-03-15' });
    await seedPreventivo({ stato: 'approvato', data: '2026-03-20' });

    const { res, body } = await getStats({ mese: 3, anno: 2026 });
    expect(res.statusCode).toBe(200);

    const p = body.preventivi;
    expect(p.totale).toBe(3);
    expect(p.per_stato.bozza).toBe(2);
    expect(p.per_stato.approvato).toBe(1);
    expect(p.aperti).toBe(3);
    expect(p.chiusi).toBe(0);
  });

  it('8. stati misti chiusi → chiusi=3, aperti=0', async () => {
    await seedPreventivo({ stato: 'fatturato', data: '2026-03-05' });
    await seedPreventivo({ stato: 'rifiutato', data: '2026-03-10' });
    await seedPreventivo({ stato: 'scaduto', data: '2026-03-25' });

    const { res, body } = await getStats({ mese: 3, anno: 2026 });
    expect(res.statusCode).toBe(200);

    const p = body.preventivi;
    expect(p.totale).toBe(3);
    expect(p.chiusi).toBe(3);
    expect(p.aperti).toBe(0);
    expect(p.per_stato.fatturato).toBe(1);
    expect(p.per_stato.rifiutato).toBe(1);
    expect(p.per_stato.scaduto).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PREVENTIVI – FILTRO PERIODO
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/dashboard/stats - Preventivi filtro periodo', () => {
  it('9. preventivi di febbraio 2026 non appaiono nella richiesta per marzo 2026', async () => {
    // Inserisci in febbraio
    await seedPreventivo({ stato: 'bozza', data: '2026-02-15' });
    // Inserisci in marzo
    await seedPreventivo({ stato: 'bozza', data: '2026-03-10' });

    const { res, body } = await getStats({ mese: 3, anno: 2026 });
    expect(res.statusCode).toBe(200);

    // Solo quello di marzo deve comparire
    expect(body.preventivi.totale).toBe(1);
    expect(body.preventivi.per_stato.bozza).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ORE – PERIODO VUOTO
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/dashboard/stats - Ore periodo vuoto', () => {
  it('10. nessuna riga rapportino → ore.per_cliente=[]', async () => {
    const { res, body } = await getStats({ mese: 3, anno: 2026 });
    expect(res.statusCode).toBe(200);
    expect(body.ore.per_cliente).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ORE – CALCOLO BASE
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/dashboard/stats - Ore calcolo base', () => {
  it('11. 1 riga 08:00-10:00 → ore_totali=2.0', async () => {
    await seedRigaRapportino({ ora_inizio: '08:00', ora_fine: '10:00' });

    const { res, body } = await getStats({ mese: 3, anno: 2026 });
    expect(res.statusCode).toBe(200);

    expect(body.ore.per_cliente).toHaveLength(1);
    expect(body.ore.per_cliente[0].ore_totali).toBe(2.0);
  });

  it('12. 1 riga 09:00-10:30 → ore_totali=1.5', async () => {
    await seedRigaRapportino({ ora_inizio: '09:00', ora_fine: '10:30' });

    const { res, body } = await getStats({ mese: 3, anno: 2026 });
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
      ora_inizio: '08:00',
      ora_fine: '10:00',
      nota_lavorazione_id: nota.id,
    });
    // Riga non gestita: 14:00-15:30 → 1.5h
    await seedRigaRapportino({
      ora_inizio: '14:00',
      ora_fine: '15:30',
      nota_lavorazione_id: null,
    });

    const { res, body } = await getStats({ mese: 3, anno: 2026 });
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
      ora_inizio: '08:00',
      ora_fine: '10:00',
    });
    // Riga dell'admin (altro utente)
    await seedRigaRapportino({
      utente_id: testAdminId,
      ora_inizio: '11:00',
      ora_fine: '14:00',
    });

    const { res, body } = await getStats({ mese: 3, anno: 2026 }, userToken);
    expect(res.statusCode).toBe(200);

    // L'utente normale vede solo le proprie 2 ore
    expect(body.ore.per_cliente).toHaveLength(1);
    expect(body.ore.per_cliente[0].ore_totali).toBe(2.0);
  });

  it('15. admin vede le ore di tutti gli utenti aggregate per cliente', async () => {
    // Riga dell'utente normale (marco)
    await seedRigaRapportino({
      utente_id: testUtenteId,
      ora_inizio: '08:00',
      ora_fine: '10:00',
    });
    // Riga dell'admin
    await seedRigaRapportino({
      utente_id: testAdminId,
      ora_inizio: '11:00',
      ora_fine: '14:00',
    });

    const { res, body } = await getStats({ mese: 3, anno: 2026 }, adminToken);
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
    const { res, body } = await getStats({ mese: 3, anno: 2026 });
    expect(res.statusCode).toBe(200);

    // Chiavi di primo livello
    expect(body).toHaveProperty('preventivi');
    expect(body).toHaveProperty('ore');

    // Chiavi preventivi
    expect(body.preventivi).toHaveProperty('totale');
    expect(body.preventivi).toHaveProperty('per_stato');
    expect(body.preventivi).toHaveProperty('aperti');
    expect(body.preventivi).toHaveProperty('chiusi');

    // Chiavi per_stato
    const stati = ['bozza', 'approvato', 'rifiutato', 'scaduto', 'fatturato', 'cancellato'];
    for (const stato of stati) {
      expect(body.preventivi.per_stato).toHaveProperty(stato);
    }

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
      ora_inizio: '08:00',
      ora_fine: '10:00'
    });

    const { res, body } = await getStats({ mese: 3, anno: 2026 }, adminToken);
    expect(res.statusCode).toBe(200);
    expect(body.ore).toHaveProperty('per_operaio');
    expect(Array.isArray(body.ore.per_operaio)).toBe(true);
    expect(body.ore.per_operaio.length).toBeGreaterThan(0);
  });

  it('18. per_operaio non è presente nella risposta per utente normale', async () => {
    // Crea una riga rapportino
    await seedRigaRapportino({
      utente_id: testUtenteId,
      ora_inizio: '08:00',
      ora_fine: '10:00'
    });

    const { res, body } = await getStats({ mese: 3, anno: 2026 }, userToken);
    expect(res.statusCode).toBe(200);
    // per_operaio esiste ma è array vuoto per non-admin
    expect(body.ore.per_operaio).toEqual([]);
  });

  it('19. ore per operaio calcola correttamente ore_totali, ore_in_nota, ore_non_gestite', async () => {
    const nota = await seedNota(testClienteId);

    // Riga gestita: 2h
    await seedRigaRapportino({
      utente_id: testUtenteId,
      ora_inizio: '08:00',
      ora_fine: '10:00',
      nota_lavorazione_id: nota.id,
    });

    // Riga non gestita: 1.5h
    await seedRigaRapportino({
      utente_id: testUtenteId,
      ora_inizio: '14:00',
      ora_fine: '15:30',
      nota_lavorazione_id: null,
    });

    const { res, body } = await getStats({ mese: 3, anno: 2026 }, adminToken);
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

describe('GET /api/dashboard/export-ore - Export Excel (admin only)', () => {
  it('20. senza parametri → 400', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/dashboard/export-ore',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(400);
  });

  it('21. non-admin → 403', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/dashboard/export-ore?mese=3&anno=2026',
      headers: { authorization: `Bearer ${userToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('22. admin con parametri validi → 200 + xlsx file', async () => {
    // Crea una riga per avere dati nel file
    await seedRigaRapportino({
      utente_id: testUtenteId,
      ora_inizio: '08:00',
      ora_fine: '10:00',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/dashboard/export-ore?mese=3&anno=2026',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['content-disposition']).toContain('ore_2026_03.xlsx');
    expect(res.rawPayload).toBeTruthy();
    expect(res.rawPayload.length).toBeGreaterThan(0);
  });
});
