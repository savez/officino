const { getApp, getAuthToken } = require('../helpers/setup');

let app;
let token;
let testCategoriaId;

beforeAll(async () => {
  app = getApp();
  token = await getAuthToken();
});

/**
 * Before each test, seed a fresh categoria and clean up pezzi.
 */
beforeEach(async () => {
  await app.db('pezzi_magazzino').del();
  await app.db('categorie').del();

  const [cat] = await app.db('categorie').insert({ nome: 'Test Categoria' }).returning('*');
  testCategoriaId = cat.id;
});

afterEach(async () => {
  await app.db('pezzi_magazzino').del();
  await app.db('categorie').del();
});

/**
 * Helper to create a pezzo through the API
 */
async function createPezzo(overrides = {}) {
  const payload = {
    nome: 'Vite M5',
    prezzo_vendita: 1.5,
    quantita: 10,
    soglia_avviso: 5,
    categoria_id: testCategoriaId,
    ...overrides,
  };

  const res = await app.inject({
    method: 'POST',
    url: '/api/magazzino',
    headers: { authorization: `Bearer ${token}` },
    payload,
  });

  return { res, body: JSON.parse(res.body) };
}

// ---------- CREATE ----------

describe('POST /api/magazzino', () => {
  it('should create a new pezzo', async () => {
    const { res, body } = await createPezzo({
      nome: 'Bullone M8',
      barcode: '1234567890123',
      marca: 'BoltCo',
      modello: 'BM8',
      prezzo_vendita: 2.5,
      prezzo_acquisto: 1.0,
    });

    expect(res.statusCode).toBe(201);
    expect(body).toHaveProperty('id');
    expect(body.nome).toBe('Bullone M8');
    expect(body.barcode).toBe('1234567890123');
    expect(body.marca).toBe('BoltCo');
    expect(body.modello).toBe('BM8');
    expect(body.categoria_id).toBe(testCategoriaId);
    expect(body).toHaveProperty('sotto_soglia');
  });

  it('should return 400 when nome is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/magazzino',
      headers: { authorization: `Bearer ${token}` },
      payload: { prezzo_vendita: 1.0 },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('error');
  });

  it('should return 400 when prezzo_vendita is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/magazzino',
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: 'Senza prezzo' },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('error');
  });

  it('should return 409 for duplicate barcode', async () => {
    await createPezzo({ barcode: 'DUP123', nome: 'Pezzo A' });

    const { res } = await createPezzo({ barcode: 'DUP123', nome: 'Pezzo B' });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body);
    expect(body.error).toMatch(/barcode/i);
  });

  it('should return 400 for non-existent categoria_id', async () => {
    const { res } = await createPezzo({ categoria_id: 99999 });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toMatch(/categoria/i);
  });

  it('should return 401 without auth token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/magazzino',
      payload: { nome: 'No auth', prezzo_vendita: 1.0 },
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------- READ ----------

describe('GET /api/magazzino', () => {
  it('should return paginated list of pezzi', async () => {
    await createPezzo({ nome: 'Pezzo 1' });
    await createPezzo({ nome: 'Pezzo 2' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/magazzino',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('pagination');
    expect(body.data).toHaveLength(2);
    expect(body.pagination.total).toBe(2);
  });

  it('should include sotto_soglia flag in results', async () => {
    await createPezzo({ nome: 'Sotto', quantita: 1, soglia_avviso: 5 });

    const res = await app.inject({
      method: 'GET',
      url: '/api/magazzino',
      headers: { authorization: `Bearer ${token}` },
    });

    const body = JSON.parse(res.body);
    expect(body.data[0]).toHaveProperty('sotto_soglia');
    expect(body.data[0].sotto_soglia).toBe(true);
  });

  it('should include categoria_nome from join', async () => {
    await createPezzo({ nome: 'Joined' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/magazzino',
      headers: { authorization: `Bearer ${token}` },
    });

    const body = JSON.parse(res.body);
    expect(body.data[0]).toHaveProperty('categoria_nome');
    expect(body.data[0].categoria_nome).toBe('Test Categoria');
  });

  it('should filter by categoria_id', async () => {
    const [otherCat] = await app.db('categorie').insert({ nome: 'Altra Categoria' }).returning('*');

    await createPezzo({ nome: 'In Cat A', categoria_id: testCategoriaId });
    await createPezzo({ nome: 'In Cat B', categoria_id: otherCat.id });

    const res = await app.inject({
      method: 'GET',
      url: `/api/magazzino?categoria_id=${testCategoriaId}`,
      headers: { authorization: `Bearer ${token}` },
    });

    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].nome).toBe('In Cat A');
  });

  it('should filter by sotto_soglia=true', async () => {
    await createPezzo({ nome: 'Basso', quantita: 1, soglia_avviso: 5 });
    await createPezzo({ nome: 'Alto', quantita: 100, soglia_avviso: 5 });

    const res = await app.inject({
      method: 'GET',
      url: '/api/magazzino?sotto_soglia=true',
      headers: { authorization: `Bearer ${token}` },
    });

    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].nome).toBe('Basso');
  });

  it('should respect pagination params', async () => {
    for (let i = 1; i <= 5; i++) {
      await createPezzo({ nome: `Pezzo ${i}` });
    }

    const res = await app.inject({
      method: 'GET',
      url: '/api/magazzino?page=1&per_page=2',
      headers: { authorization: `Bearer ${token}` },
    });

    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(2);
    expect(body.pagination.total).toBe(5);
    expect(body.pagination.totalPages).toBe(3);
  });
});

describe('GET /api/magazzino/:id', () => {
  it('should return a single pezzo by id', async () => {
    const { body: created } = await createPezzo({ nome: 'Singolo' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/magazzino/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.id).toBe(created.id);
    expect(body.nome).toBe('Singolo');
    expect(body).toHaveProperty('sotto_soglia');
    expect(body).toHaveProperty('categoria_nome');
  });

  it('should return 404 for non-existent id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/magazzino/99999',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toMatch(/non trovato/i);
  });
});

describe('GET /api/magazzino/barcode/:barcode', () => {
  it('should return pezzo by barcode', async () => {
    await createPezzo({ nome: 'Scannabile', barcode: 'BC999' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/magazzino/barcode/BC999',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.nome).toBe('Scannabile');
    expect(body.barcode).toBe('BC999');
    expect(body).toHaveProperty('sotto_soglia');
  });

  it('should return 404 for non-existent barcode', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/magazzino/barcode/NONEXIST',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toMatch(/barcode/i);
  });
});

// ---------- SEARCH ----------

describe('GET /api/magazzino/search', () => {
  it('should search by nome', async () => {
    await createPezzo({ nome: 'Vite speciale' });
    await createPezzo({ nome: 'Bullone grande' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/magazzino/search?q=vite',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].nome).toBe('Vite speciale');
  });

  it('should search by barcode', async () => {
    await createPezzo({ nome: 'Con Barcode', barcode: 'SEARCH123' });
    await createPezzo({ nome: 'Senza Barcode' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/magazzino/search?q=SEARCH123',
      headers: { authorization: `Bearer ${token}` },
    });

    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].barcode).toBe('SEARCH123');
  });

  it('should return empty results for empty query', async () => {
    await createPezzo({ nome: 'Whatever' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/magazzino/search?q=',
      headers: { authorization: `Bearer ${token}` },
    });

    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(0);
    expect(body.pagination.total).toBe(0);
  });

  it('should return empty results when no q param', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/magazzino/search',
      headers: { authorization: `Bearer ${token}` },
    });

    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(0);
  });

  it('should filter search results by categoria_id', async () => {
    const [otherCat] = await app.db('categorie').insert({ nome: 'Altra Search' }).returning('*');

    await createPezzo({ nome: 'Vite cat A', categoria_id: testCategoriaId });
    await createPezzo({ nome: 'Vite cat B', categoria_id: otherCat.id });

    const res = await app.inject({
      method: 'GET',
      url: `/api/magazzino/search?q=Vite&categoria_id=${testCategoriaId}`,
      headers: { authorization: `Bearer ${token}` },
    });

    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].nome).toBe('Vite cat A');
  });
});

// ---------- UPDATE ----------

describe('PUT /api/magazzino/:id', () => {
  it('should update an existing pezzo', async () => {
    const { body: created } = await createPezzo({ nome: 'Prima' });

    const res = await app.inject({
      method: 'PUT',
      url: `/api/magazzino/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        nome: 'Dopo',
        prezzo_vendita: 9.99,
        quantita: 20,
        soglia_avviso: 3,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.nome).toBe('Dopo');
    expect(Number(body.prezzo_vendita)).toBeCloseTo(9.99);
    expect(body).toHaveProperty('sotto_soglia');
  });

  it('should return 404 when updating non-existent pezzo', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/magazzino/99999',
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: 'Ghost', prezzo_vendita: 1 },
    });

    expect(res.statusCode).toBe(404);
  });

  it('should return 409 when updating to a duplicate barcode', async () => {
    await createPezzo({ nome: 'Pezzo A', barcode: 'EXISTING' });
    const { body: pezzoB } = await createPezzo({ nome: 'Pezzo B', barcode: 'OTHER' });

    const res = await app.inject({
      method: 'PUT',
      url: `/api/magazzino/${pezzoB.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        nome: 'Pezzo B Updated',
        prezzo_vendita: 1,
        barcode: 'EXISTING',
      },
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body);
    expect(body.error).toMatch(/barcode/i);
  });

  it('should allow keeping the same barcode on update', async () => {
    const { body: created } = await createPezzo({ nome: 'Same BC', barcode: 'KEEPME' });

    const res = await app.inject({
      method: 'PUT',
      url: `/api/magazzino/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        nome: 'Same BC Updated',
        prezzo_vendita: 2,
        barcode: 'KEEPME',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.barcode).toBe('KEEPME');
  });
});

// ---------- DELETE ----------

describe('DELETE /api/magazzino/:id', () => {
  it('should delete an existing pezzo', async () => {
    const { body: created } = await createPezzo({ nome: 'Da eliminare' });

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/magazzino/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.message).toMatch(/eliminato/i);

    // Verify it's gone
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/magazzino/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(getRes.statusCode).toBe(404);
  });

  it('should return 404 when deleting non-existent pezzo', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/magazzino/99999',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
  });
});

// ---------- EXPORT ----------

describe('GET /api/magazzino/export/excel', () => {
  it('should return an Excel file with correct content-type', async () => {
    await createPezzo({ nome: 'Export Test', barcode: 'EXP001' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/magazzino/export/excel',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    expect(res.headers['content-disposition']).toMatch(/magazzino\.xlsx/);
    // Verify body is non-empty buffer
    expect(res.rawPayload.length).toBeGreaterThan(0);
  });

  it('should return an Excel file even when no data exists', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/magazzino/export/excel',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
  });
});

// ---------- SOTTO SOGLIA FLAG ----------

describe('sotto_soglia flag', () => {
  it('should be true when quantita <= soglia_avviso', async () => {
    const { body } = await createPezzo({ quantita: 3, soglia_avviso: 5 });
    expect(body.sotto_soglia).toBe(true);
  });

  it('should be true when quantita equals soglia_avviso', async () => {
    const { body } = await createPezzo({ quantita: 5, soglia_avviso: 5 });
    expect(body.sotto_soglia).toBe(true);
  });

  it('should be false when quantita > soglia_avviso', async () => {
    const { body } = await createPezzo({ quantita: 10, soglia_avviso: 5 });
    expect(body.sotto_soglia).toBe(false);
  });
});
