const { getApp, getAuthToken } = require('../helpers/setup');

let app;
let token;
let testClienteId;
let testCategoriaId;

beforeAll(async () => {
  app = getApp();
  token = await getAuthToken();
});

/**
 * Before each test, clean tables in FK-safe order and seed fresh test data.
 */
beforeEach(async () => {
  await app.db('preventivo_pezzi').del();
  await app.db('preventivi').del();
  await app.db('pezzi_magazzino').del();
  await app.db('clienti').del();
  await app.db('categorie').del();

  const [cat] = await app.db('categorie').insert({ nome: 'Test Categoria' }).returning('*');
  testCategoriaId = cat.id;

  const [cliente] = await app.db('clienti').insert({ nome: 'Cliente Test' }).returning('*');
  testClienteId = cliente.id;
});

afterEach(async () => {
  await app.db('preventivo_pezzi').del();
  await app.db('preventivi').del();
  await app.db('pezzi_magazzino').del();
  await app.db('clienti').del();
  await app.db('categorie').del();
});

/**
 * Helper: insert a pezzo directly into the DB
 */
async function createPezzo(overrides = {}) {
  const [pezzo] = await app
    .db('pezzi_magazzino')
    .insert({
      nome: 'Vite M5',
      prezzo_vendita: 1.5,
      quantita: 100,
      soglia_avviso: 5,
      categoria_id: testCategoriaId,
      ...overrides,
    })
    .returning('*');
  return pezzo;
}

/**
 * Helper: create a preventivo through the API
 */
async function createPreventivo(overrides = {}) {
  const payload = {
    cliente_id: testClienteId,
    data: '2026-01-15',
    manodopera_ore: 0,
    manodopera_costo_orario: 0,
    sconto_tipo: 'fisso',
    sconto_valore: 0,
    aliquota_iva: 22,
    pezzi: [],
    ...overrides,
  };

  const res = await app.inject({
    method: 'POST',
    url: '/api/preventivi',
    headers: { authorization: `Bearer ${token}` },
    payload,
  });

  return { res, body: JSON.parse(res.body) };
}

// ---------- CREATE ----------

describe('POST /api/preventivi', () => {
  it('should create a preventivo with pezzi and verify calculated fields', async () => {
    const pezzo = await createPezzo({ nome: 'Bullone', prezzo_vendita: 10, quantita: 50 });

    const { res, body } = await createPreventivo({
      pezzi: [{ pezzo_id: pezzo.id, quantita: 3, prezzo_unitario: 10 }],
      aliquota_iva: 22,
    });

    expect(res.statusCode).toBe(201);
    expect(body).toHaveProperty('id');
    expect(body.stato).toBe('bozza');
    expect(body.cliente_id).toBe(testClienteId);
    expect(Number(body.imponibile)).toBe(30);
    expect(Number(body.imponibile_netto)).toBe(30);
    expect(Number(body.iva)).toBe(6.6);
    expect(Number(body.totale)).toBe(36.6);
    expect(body.pezzi).toHaveLength(1);
    expect(body.pezzi[0].pezzo_id).toBe(pezzo.id);
  });

  it('should create a preventivo with just labor (no pezzi)', async () => {
    const { res, body } = await createPreventivo({
      manodopera_ore: 2,
      manodopera_costo_orario: 30,
      pezzi: [],
    });

    expect(res.statusCode).toBe(201);
    expect(Number(body.manodopera_totale)).toBe(60);
    expect(Number(body.imponibile)).toBe(60);
    expect(Number(body.imponibile_netto)).toBe(60);
    expect(body.pezzi).toHaveLength(0);
  });

  it('should create a preventivo with sconto fisso', async () => {
    const pezzo = await createPezzo({ nome: 'Pezzo Sconto', prezzo_vendita: 100 });

    const { res, body } = await createPreventivo({
      pezzi: [{ pezzo_id: pezzo.id, quantita: 1, prezzo_unitario: 100 }],
      sconto_tipo: 'fisso',
      sconto_valore: 20,
      aliquota_iva: 22,
    });

    expect(res.statusCode).toBe(201);
    expect(Number(body.imponibile)).toBe(100);
    expect(Number(body.sconto_calcolato)).toBe(20);
    expect(Number(body.imponibile_netto)).toBe(80);
    expect(Number(body.iva)).toBe(17.6);
    expect(Number(body.totale)).toBe(97.6);
  });

  it('should create a preventivo with sconto percentuale', async () => {
    const pezzo = await createPezzo({ nome: 'Pezzo Perc', prezzo_vendita: 200 });

    const { res, body } = await createPreventivo({
      pezzi: [{ pezzo_id: pezzo.id, quantita: 1, prezzo_unitario: 200 }],
      sconto_tipo: 'percentuale',
      sconto_valore: 10,
      aliquota_iva: 22,
    });

    expect(res.statusCode).toBe(201);
    expect(Number(body.imponibile)).toBe(200);
    expect(Number(body.sconto_calcolato)).toBe(20);
    expect(Number(body.imponibile_netto)).toBe(180);
    expect(Number(body.iva)).toBe(39.6);
    expect(Number(body.totale)).toBe(219.6);
  });

  it('should return 400 for missing required fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/preventivi',
      headers: { authorization: `Bearer ${token}` },
      payload: { manodopera_ore: 1 }, // missing cliente_id, data
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('error');
  });

  it('should return 400 for non-existent cliente', async () => {
    const { res, body } = await createPreventivo({
      cliente_id: 99999,
    });

    expect(res.statusCode).toBe(400);
    expect(body.error).toMatch(/cliente/i);
  });

  it('should return 400 for archived cliente', async () => {
    await app.db('clienti').where({ id: testClienteId }).update({ archiviato: true });

    const { res, body } = await createPreventivo({
      cliente_id: testClienteId,
    });

    expect(res.statusCode).toBe(400);
    expect(body.error).toMatch(/archiviato/i);
  });

  it('should return 400 for non-existent pezzo_id', async () => {
    const { res, body } = await createPreventivo({
      pezzi: [{ pezzo_id: 99999, quantita: 1, prezzo_unitario: 10 }],
    });

    expect(res.statusCode).toBe(400);
    expect(body.error).toMatch(/pezzo/i);
  });

  it('should auto-generate numero in format ANNO/NNNN', async () => {
    const { body } = await createPreventivo({
      data: '2026-03-01',
    });

    expect(body.numero).toMatch(/^2026\/\d{4}$/);
    expect(body.numero).toBe('2026/0001');
  });

  it('should increment numero sequentially', async () => {
    const { body: first } = await createPreventivo({ data: '2026-03-01' });
    const { body: second } = await createPreventivo({ data: '2026-06-15' });
    const { body: third } = await createPreventivo({ data: '2026-12-31' });

    expect(first.numero).toBe('2026/0001');
    expect(second.numero).toBe('2026/0002');
    expect(third.numero).toBe('2026/0003');
  });
});

// ---------- LIST ----------

describe('GET /api/preventivi', () => {
  it('should return paginated list', async () => {
    await createPreventivo();
    await createPreventivo();

    const res = await app.inject({
      method: 'GET',
      url: '/api/preventivi',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('pagination');
    expect(body.data).toHaveLength(2);
    expect(body.pagination.total).toBe(2);
  });

  it('should filter by stato', async () => {
    await createPreventivo();
    const { body: second } = await createPreventivo();

    // Approve the second one (need pezzi for stock deduction or no pezzi is fine)
    await app.inject({
      method: 'PATCH',
      url: `/api/preventivi/${second.id}/stato`,
      headers: { authorization: `Bearer ${token}` },
      payload: { stato: 'approvato' },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/preventivi?stato=bozza',
      headers: { authorization: `Bearer ${token}` },
    });

    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].stato).toBe('bozza');
  });

  it('should filter by cliente_id', async () => {
    const [otherCliente] = await app
      .db('clienti')
      .insert({ nome: 'Altro Cliente' })
      .returning('*');

    await createPreventivo({ cliente_id: testClienteId });
    await createPreventivo({ cliente_id: otherCliente.id });

    const res = await app.inject({
      method: 'GET',
      url: `/api/preventivi?cliente_id=${testClienteId}`,
      headers: { authorization: `Bearer ${token}` },
    });

    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].cliente_id).toBe(testClienteId);
  });

  it('should order by created_at desc', async () => {
    const { body: first } = await createPreventivo();
    // Small delay to ensure different created_at timestamps
    await new Promise((resolve) => setTimeout(resolve, 50));
    const { body: second } = await createPreventivo();

    const res = await app.inject({
      method: 'GET',
      url: '/api/preventivi',
      headers: { authorization: `Bearer ${token}` },
    });

    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(2);
    // Most recent first
    expect(body.data[0].id).toBe(second.id);
    expect(body.data[1].id).toBe(first.id);
  });
});

// ---------- SEARCH ----------

describe('GET /api/preventivi/search', () => {
  it('should search by numero', async () => {
    const { body: created } = await createPreventivo({ data: '2026-01-01' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/preventivi/search?q=${encodeURIComponent(created.numero)}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].numero).toBe(created.numero);
  });

  it('should search by cliente nome', async () => {
    await createPreventivo();

    const res = await app.inject({
      method: 'GET',
      url: '/api/preventivi/search?q=Cliente Test',
      headers: { authorization: `Bearer ${token}` },
    });

    const body = JSON.parse(res.body);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.data[0].cliente_nome).toBe('Cliente Test');
  });

  it('should return empty for empty q', async () => {
    await createPreventivo();

    const res = await app.inject({
      method: 'GET',
      url: '/api/preventivi/search?q=',
      headers: { authorization: `Bearer ${token}` },
    });

    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(0);
    expect(body.pagination.total).toBe(0);
  });

  it('should filter by stato in search', async () => {
    await createPreventivo();
    const { body: second } = await createPreventivo();

    // Transition second to rifiutato
    await app.inject({
      method: 'PATCH',
      url: `/api/preventivi/${second.id}/stato`,
      headers: { authorization: `Bearer ${token}` },
      payload: { stato: 'rifiutato' },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/preventivi/search?q=Cliente&stato=rifiutato',
      headers: { authorization: `Bearer ${token}` },
    });

    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].stato).toBe('rifiutato');
  });
});

// ---------- GET BY ID ----------

describe('GET /api/preventivi/:id', () => {
  it('should return full preventivo with pezzi array and names', async () => {
    const pezzo = await createPezzo({ nome: 'Pezzo Dettaglio', prezzo_vendita: 25 });

    const { body: created } = await createPreventivo({
      pezzi: [{ pezzo_id: pezzo.id, quantita: 2, prezzo_unitario: 25 }],
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/preventivi/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.id).toBe(created.id);
    expect(body).toHaveProperty('cliente_nome');
    expect(body).toHaveProperty('utente_nome');
    expect(body.pezzi).toHaveLength(1);
    expect(body.pezzi[0]).toHaveProperty('pezzo_nome');
    expect(body.pezzi[0].pezzo_nome).toBe('Pezzo Dettaglio');
  });

  it('should return 404 for non-existent id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/preventivi/99999',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toMatch(/non trovato/i);
  });
});

// ---------- UPDATE ----------

describe('PUT /api/preventivi/:id', () => {
  it('should update a bozza preventivo and recalculate fields', async () => {
    const pezzo1 = await createPezzo({ nome: 'Pezzo A', prezzo_vendita: 10, quantita: 50 });
    const pezzo2 = await createPezzo({ nome: 'Pezzo B', prezzo_vendita: 20, quantita: 30 });

    // Create with pezzo1
    const { body: created } = await createPreventivo({
      pezzi: [{ pezzo_id: pezzo1.id, quantita: 2, prezzo_unitario: 10 }],
    });

    expect(Number(created.imponibile)).toBe(20);

    // Update to pezzo2 with labor and discount
    const res = await app.inject({
      method: 'PUT',
      url: `/api/preventivi/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        cliente_id: testClienteId,
        data: '2026-02-01',
        pezzi: [{ pezzo_id: pezzo2.id, quantita: 3, prezzo_unitario: 20 }],
        manodopera_ore: 1,
        manodopera_costo_orario: 50,
        sconto_tipo: 'fisso',
        sconto_valore: 10,
        aliquota_iva: 22,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    // Parts: 3*20 = 60, Labor: 1*50 = 50, Imponibile = 110
    // Sconto: 10, Netto: 100, IVA: 22, Totale: 122
    expect(Number(body.imponibile)).toBe(110);
    expect(Number(body.sconto_calcolato)).toBe(10);
    expect(Number(body.imponibile_netto)).toBe(100);
    expect(Number(body.iva)).toBe(22);
    expect(Number(body.totale)).toBe(122);
    expect(body.pezzi).toHaveLength(1);
    expect(body.pezzi[0].pezzo_id).toBe(pezzo2.id);
  });

  it('should return 403 if preventivo is not in bozza', async () => {
    const { body: created } = await createPreventivo();

    // Transition to approvato
    await app.inject({
      method: 'PATCH',
      url: `/api/preventivi/${created.id}/stato`,
      headers: { authorization: `Bearer ${token}` },
      payload: { stato: 'approvato' },
    });

    const res = await app.inject({
      method: 'PUT',
      url: `/api/preventivi/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        cliente_id: testClienteId,
        data: '2026-02-01',
        pezzi: [],
      },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.error).toMatch(/bozza/i);
  });

  it('should return 404 for non-existent preventivo', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/preventivi/99999',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        cliente_id: testClienteId,
        data: '2026-02-01',
        pezzi: [],
      },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toMatch(/non trovato/i);
  });
});

// ---------- STATE CHANGE ----------

describe('PATCH /api/preventivi/:id/stato', () => {
  it('should transition bozza -> approvato and deduct stock', async () => {
    const pezzo = await createPezzo({ nome: 'Pezzo Stock', prezzo_vendita: 10, quantita: 20 });

    const { body: created } = await createPreventivo({
      pezzi: [{ pezzo_id: pezzo.id, quantita: 5, prezzo_unitario: 10 }],
    });

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/preventivi/${created.id}/stato`,
      headers: { authorization: `Bearer ${token}` },
      payload: { stato: 'approvato' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.stato).toBe('approvato');

    // Verify stock was deducted
    const updatedPezzo = await app.db('pezzi_magazzino').where({ id: pezzo.id }).first();
    expect(updatedPezzo.quantita).toBe(15); // 20 - 5
  });

  it('should transition bozza -> rifiutato without stock change', async () => {
    const pezzo = await createPezzo({ nome: 'Pezzo Rifiuto', prezzo_vendita: 10, quantita: 20 });

    const { body: created } = await createPreventivo({
      pezzi: [{ pezzo_id: pezzo.id, quantita: 5, prezzo_unitario: 10 }],
    });

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/preventivi/${created.id}/stato`,
      headers: { authorization: `Bearer ${token}` },
      payload: { stato: 'rifiutato' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.stato).toBe('rifiutato');

    // Verify stock was NOT deducted
    const updatedPezzo = await app.db('pezzi_magazzino').where({ id: pezzo.id }).first();
    expect(updatedPezzo.quantita).toBe(20);
  });

  it('should transition bozza -> scaduto', async () => {
    const { body: created } = await createPreventivo();

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/preventivi/${created.id}/stato`,
      headers: { authorization: `Bearer ${token}` },
      payload: { stato: 'scaduto' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.stato).toBe('scaduto');
  });

  it('should transition approvato -> fatturato', async () => {
    const { body: created } = await createPreventivo();

    // First approve
    await app.inject({
      method: 'PATCH',
      url: `/api/preventivi/${created.id}/stato`,
      headers: { authorization: `Bearer ${token}` },
      payload: { stato: 'approvato' },
    });

    // Then invoice
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/preventivi/${created.id}/stato`,
      headers: { authorization: `Bearer ${token}` },
      payload: { stato: 'fatturato' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.stato).toBe('fatturato');
  });

  it('should return 400 for invalid transition (rifiutato -> approvato)', async () => {
    const { body: created } = await createPreventivo();

    // Transition to rifiutato
    await app.inject({
      method: 'PATCH',
      url: `/api/preventivi/${created.id}/stato`,
      headers: { authorization: `Bearer ${token}` },
      payload: { stato: 'rifiutato' },
    });

    // Try invalid transition
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/preventivi/${created.id}/stato`,
      headers: { authorization: `Bearer ${token}` },
      payload: { stato: 'approvato' },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toMatch(/transizione/i);
  });

  it('should return 409 when approving with insufficient stock', async () => {
    const pezzo = await createPezzo({ nome: 'Pezzo Scarso', prezzo_vendita: 10, quantita: 2 });

    const { body: created } = await createPreventivo({
      pezzi: [{ pezzo_id: pezzo.id, quantita: 5, prezzo_unitario: 10 }], // need 5, have 2
    });

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/preventivi/${created.id}/stato`,
      headers: { authorization: `Bearer ${token}` },
      payload: { stato: 'approvato' },
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body);
    expect(body.error).toMatch(/insufficiente/i);
  });

  it('should return 404 for non-existent preventivo', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/preventivi/99999/stato',
      headers: { authorization: `Bearer ${token}` },
      payload: { stato: 'approvato' },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toMatch(/non trovato/i);
  });

  it('should return 400 when stato is missing from body', async () => {
    const { body: created } = await createPreventivo();

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/preventivi/${created.id}/stato`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toMatch(/stato/i);
  });
});

// ---------- DELETE ----------

describe('DELETE /api/preventivi/:id', () => {
  it('should delete a bozza preventivo and cascade delete pezzi lines', async () => {
    const pezzo = await createPezzo({ nome: 'Pezzo Delete', prezzo_vendita: 10 });

    const { body: created } = await createPreventivo({
      pezzi: [{ pezzo_id: pezzo.id, quantita: 1, prezzo_unitario: 10 }],
    });

    // Verify pezzi lines exist
    const linesBefore = await app.db('preventivo_pezzi').where({ preventivo_id: created.id });
    expect(linesBefore).toHaveLength(1);

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/preventivi/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.message).toMatch(/eliminato/i);

    // Verify preventivo is gone
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/preventivi/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(getRes.statusCode).toBe(404);

    // Verify cascade deleted pezzi lines
    const linesAfter = await app.db('preventivo_pezzi').where({ preventivo_id: created.id });
    expect(linesAfter).toHaveLength(0);
  });

  it('should return 403 for non-bozza preventivo', async () => {
    const { body: created } = await createPreventivo();

    // Transition to approvato
    await app.inject({
      method: 'PATCH',
      url: `/api/preventivi/${created.id}/stato`,
      headers: { authorization: `Bearer ${token}` },
      payload: { stato: 'approvato' },
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/preventivi/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.error).toMatch(/bozza/i);
  });

  it('should return 404 for non-existent preventivo', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/preventivi/99999',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toMatch(/non trovato/i);
  });
});

// ---------- EXPORT ----------

describe('GET /api/preventivi/:id/export', () => {
  it('should export a preventivo as JSON with all expected fields', async () => {
    const pezzo = await createPezzo({
      nome: 'Pezzo Export',
      prezzo_vendita: 15,
      quantita: 40,
      barcode: 'EAN1234567890',
      marca: 'MarcaTest',
      modello: 'ModelloTest',
    });

    const { body: created } = await createPreventivo({
      pezzi: [{ pezzo_id: pezzo.id, quantita: 2, prezzo_unitario: 15 }],
      manodopera_ore: 1,
      manodopera_costo_orario: 30,
      sconto_tipo: 'fisso',
      sconto_valore: 5,
      aliquota_iva: 22,
      note: 'Nota di test',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/preventivi/${created.id}/export`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    // Verify all top-level export fields
    expect(body).toHaveProperty('_export_version', 1);
    expect(body).toHaveProperty('_exported_at');
    expect(body).toHaveProperty('numero', created.numero);
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('stato');
    expect(body).toHaveProperty('cliente');
    expect(body.cliente).toHaveProperty('nome', 'Cliente Test');
    expect(body).toHaveProperty('manodopera_ore');
    expect(body).toHaveProperty('manodopera_costo_orario');
    expect(body).toHaveProperty('manodopera_totale');
    expect(body).toHaveProperty('sconto_tipo');
    expect(body).toHaveProperty('sconto_valore');
    expect(body).toHaveProperty('sconto_calcolato');
    expect(body).toHaveProperty('aliquota_iva');
    expect(body).toHaveProperty('imponibile');
    expect(body).toHaveProperty('imponibile_netto');
    expect(body).toHaveProperty('iva');
    expect(body).toHaveProperty('totale');
    expect(body).toHaveProperty('note', 'Nota di test');
    expect(body).toHaveProperty('pezzi');
    expect(body.pezzi).toHaveLength(1);
  });

  it('should return Content-Type application/json', async () => {
    const { body: created } = await createPreventivo();

    const res = await app.inject({
      method: 'GET',
      url: `/api/preventivi/${created.id}/export`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  it('should return Content-Disposition header with filename', async () => {
    const { body: created } = await createPreventivo({ data: '2026-01-15' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/preventivi/${created.id}/export`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="preventivo_.+\.json"/);
  });

  it('should return 404 for non-existent preventivo', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/preventivi/99999/export',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toMatch(/non trovato/i);
  });

  it('should export pezzi with nome, barcode, marca, modello, quantita, prezzo_unitario', async () => {
    const pezzo = await createPezzo({
      nome: 'Pezzo Completo',
      prezzo_vendita: 25,
      quantita: 30,
      barcode: 'BC123456',
      marca: 'BrandX',
      modello: 'Model42',
    });

    const { body: created } = await createPreventivo({
      pezzi: [{ pezzo_id: pezzo.id, quantita: 3, prezzo_unitario: 25 }],
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/preventivi/${created.id}/export`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.pezzi).toHaveLength(1);

    const exportedPezzo = body.pezzi[0];
    expect(exportedPezzo).toHaveProperty('nome', 'Pezzo Completo');
    expect(exportedPezzo).toHaveProperty('barcode', 'BC123456');
    expect(exportedPezzo).toHaveProperty('marca', 'BrandX');
    expect(exportedPezzo).toHaveProperty('modello', 'Model42');
    expect(exportedPezzo).toHaveProperty('quantita', 3);
    expect(Number(exportedPezzo.prezzo_unitario)).toBe(25);
  });
});

// ---------- IMPORT ----------

describe('POST /api/preventivi/import', () => {
  /**
   * Helper: export a preventivo and return the parsed JSON
   */
  async function exportPreventivo(id) {
    const res = await app.inject({
      method: 'GET',
      url: `/api/preventivi/${id}/export`,
      headers: { authorization: `Bearer ${token}` },
    });
    return JSON.parse(res.body);
  }

  it('should successfully import a valid export JSON and create a new bozza', async () => {
    const pezzo = await createPezzo({
      nome: 'Pezzo Import',
      prezzo_vendita: 20,
      quantita: 50,
      barcode: 'IMP0001',
    });

    const { body: original } = await createPreventivo({
      pezzi: [{ pezzo_id: pezzo.id, quantita: 2, prezzo_unitario: 20 }],
      manodopera_ore: 1,
      manodopera_costo_orario: 30,
      sconto_tipo: 'fisso',
      sconto_valore: 5,
      aliquota_iva: 22,
    });

    const exportData = await exportPreventivo(original.id);

    const res = await app.inject({
      method: 'POST',
      url: '/api/preventivi/import',
      headers: { authorization: `Bearer ${token}` },
      payload: exportData,
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);

    expect(body).toHaveProperty('id');
    expect(body.id).not.toBe(original.id);
    expect(body.stato).toBe('bozza');
    // The imported preventivo gets a new numero
    expect(body.numero).toBeDefined();
    expect(body.numero).not.toBe(original.numero);
    expect(body.pezzi).toHaveLength(1);
    expect(body.pezzi[0].pezzo_id).toBe(pezzo.id);
  });

  it('should have correct calculated fields after import', async () => {
    const pezzo = await createPezzo({
      nome: 'Pezzo Calcoli',
      prezzo_vendita: 50,
      quantita: 100,
      barcode: 'CALC001',
    });

    const { body: original } = await createPreventivo({
      pezzi: [{ pezzo_id: pezzo.id, quantita: 3, prezzo_unitario: 50 }],
      manodopera_ore: 2,
      manodopera_costo_orario: 40,
      sconto_tipo: 'percentuale',
      sconto_valore: 10,
      aliquota_iva: 22,
    });

    const exportData = await exportPreventivo(original.id);

    const res = await app.inject({
      method: 'POST',
      url: '/api/preventivi/import',
      headers: { authorization: `Bearer ${token}` },
      payload: exportData,
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);

    // Parts: 3*50=150, Labor: 2*40=80 => Imponibile: 230
    // Sconto 10% of 230 = 23 => Netto: 207
    // IVA 22% of 207 = 45.54 => Totale: 252.54
    expect(Number(body.imponibile)).toBe(230);
    expect(Number(body.sconto_calcolato)).toBe(23);
    expect(Number(body.imponibile_netto)).toBe(207);
    expect(Number(body.iva)).toBe(45.54);
    expect(Number(body.totale)).toBe(252.54);
  });

  it('should return 400 for invalid format (missing _export_version)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/preventivi/import',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        numero: '2026/0001',
        cliente: { nome: 'Cliente Test' },
        pezzi: [],
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toMatch(/formato/i);
  });

  it('should return 400 when client not found', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/preventivi/import',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        _export_version: 1,
        numero: '2026/0001',
        data: '2026-01-15',
        cliente: { nome: 'Cliente Inesistente' },
        manodopera_ore: 0,
        manodopera_costo_orario: 0,
        sconto_tipo: 'fisso',
        sconto_valore: 0,
        aliquota_iva: 22,
        pezzi: [],
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toMatch(/cliente/i);
  });

  it('should return 400 when pezzo not found', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/preventivi/import',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        _export_version: 1,
        numero: '2026/0001',
        data: '2026-01-15',
        cliente: { nome: 'Cliente Test' },
        manodopera_ore: 0,
        manodopera_costo_orario: 0,
        sconto_tipo: 'fisso',
        sconto_valore: 0,
        aliquota_iva: 22,
        pezzi: [
          {
            nome: 'Pezzo Fantasma',
            barcode: 'NOEXIST999',
            quantita: 1,
            prezzo_unitario: 10,
          },
        ],
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toMatch(/pezzo/i);
  });

  it('should resolve pezzi by barcode match', async () => {
    const pezzo = await createPezzo({
      nome: 'Pezzo Barcode Match',
      prezzo_vendita: 12,
      quantita: 60,
      barcode: 'BARCODE999',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/preventivi/import',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        _export_version: 1,
        data: '2026-01-15',
        cliente: { nome: 'Cliente Test' },
        manodopera_ore: 0,
        manodopera_costo_orario: 0,
        sconto_tipo: 'fisso',
        sconto_valore: 0,
        aliquota_iva: 22,
        pezzi: [
          {
            nome: 'Nome Diverso',
            barcode: 'BARCODE999',
            quantita: 2,
            prezzo_unitario: 12,
          },
        ],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.pezzi).toHaveLength(1);
    expect(body.pezzi[0].pezzo_id).toBe(pezzo.id);
  });

  it('should resolve pezzi by name match when barcode is null', async () => {
    const pezzo = await createPezzo({
      nome: 'Pezzo Nome Match',
      prezzo_vendita: 8,
      quantita: 70,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/preventivi/import',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        _export_version: 1,
        data: '2026-01-15',
        cliente: { nome: 'Cliente Test' },
        manodopera_ore: 0,
        manodopera_costo_orario: 0,
        sconto_tipo: 'fisso',
        sconto_valore: 0,
        aliquota_iva: 22,
        pezzi: [
          {
            nome: 'Pezzo Nome Match',
            barcode: null,
            quantita: 4,
            prezzo_unitario: 8,
          },
        ],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.pezzi).toHaveLength(1);
    expect(body.pezzi[0].pezzo_id).toBe(pezzo.id);
  });

  it('should always import with stato=bozza regardless of original stato', async () => {
    const pezzo = await createPezzo({
      nome: 'Pezzo Stato',
      prezzo_vendita: 10,
      quantita: 100,
      barcode: 'STATO001',
    });

    const { body: original } = await createPreventivo({
      pezzi: [{ pezzo_id: pezzo.id, quantita: 1, prezzo_unitario: 10 }],
    });

    // Transition to approvato
    await app.inject({
      method: 'PATCH',
      url: `/api/preventivi/${original.id}/stato`,
      headers: { authorization: `Bearer ${token}` },
      payload: { stato: 'approvato' },
    });

    const exportData = await exportPreventivo(original.id);
    expect(exportData.stato).toBe('approvato');

    const res = await app.inject({
      method: 'POST',
      url: '/api/preventivi/import',
      headers: { authorization: `Bearer ${token}` },
      payload: exportData,
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.stato).toBe('bozza');
  });
});

// ---------- AUTH ----------

describe('Auth', () => {
  it('should return 401 without token on GET /', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/preventivi',
    });

    expect(res.statusCode).toBe(401);
  });

  it('should return 401 without token on POST /', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/preventivi',
      payload: { cliente_id: 1, data: '2026-01-01' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('should return 401 without token on GET /:id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/preventivi/1',
    });

    expect(res.statusCode).toBe(401);
  });

  it('should return 401 without token on GET /search', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/preventivi/search?q=test',
    });

    expect(res.statusCode).toBe(401);
  });

  it('should return 401 without token on PUT /:id', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/preventivi/1',
      payload: { cliente_id: 1, data: '2026-01-01' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('should return 401 without token on PATCH /:id/stato', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/preventivi/1/stato',
      payload: { stato: 'approvato' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('should return 401 without token on DELETE /:id', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/preventivi/1',
    });

    expect(res.statusCode).toBe(401);
  });
});
