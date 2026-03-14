const { getApp, getAuthToken } = require('../helpers/setup');

let app;
let token;

beforeAll(async () => {
  app = getApp();
  token = await getAuthToken();
});

/**
 * Clean up categorie table between tests to avoid state leaks.
 */
afterEach(async () => {
  await app.db('categorie').del();
});

describe('POST /api/categorie', () => {
  it('should create a new categoria', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/categorie',
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: 'Elettronica', descrizione: 'Componenti elettronici' },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('id');
    expect(body.nome).toBe('Elettronica');
    expect(body.descrizione).toBe('Componenti elettronici');
  });

  it('should return 400 when nome is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/categorie',
      headers: { authorization: `Bearer ${token}` },
      payload: { descrizione: 'Senza nome' },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('error');
  });

  it('should return 400 when nome is empty string', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/categorie',
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: '' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('should return 409 for duplicate nome', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/categorie',
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: 'Duplicata' },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/categorie',
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: 'Duplicata' },
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body);
    expect(body.error).toMatch(/già esistente/i);
  });
});

describe('GET /api/categorie', () => {
  it('should return paginated list of categorie', async () => {
    // Seed two categories
    await app.inject({
      method: 'POST',
      url: '/api/categorie',
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: 'Cat A' },
    });
    await app.inject({
      method: 'POST',
      url: '/api/categorie',
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: 'Cat B' },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/categorie',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('pagination');
    expect(body.data).toHaveLength(2);
    expect(body.pagination.total).toBe(2);
    expect(body.pagination.page).toBe(1);
  });

  it('should respect pagination params', async () => {
    // Seed 3 categories
    for (const nome of ['Cat 1', 'Cat 2', 'Cat 3']) {
      await app.inject({
        method: 'POST',
        url: '/api/categorie',
        headers: { authorization: `Bearer ${token}` },
        payload: { nome },
      });
    }

    const res = await app.inject({
      method: 'GET',
      url: '/api/categorie?page=1&per_page=2',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(2);
    expect(body.pagination.total).toBe(3);
    expect(body.pagination.totalPages).toBe(2);
  });

  it('should return 401 without auth token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/categorie',
    });

    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/categorie/all', () => {
  it('should return all categorie without pagination', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/categorie',
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: 'All Cat 1' },
    });
    await app.inject({
      method: 'POST',
      url: '/api/categorie',
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: 'All Cat 2' },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/categorie/all',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2);
    // Should contain only id and nome
    expect(body[0]).toHaveProperty('id');
    expect(body[0]).toHaveProperty('nome');
    expect(body[0]).not.toHaveProperty('descrizione');
  });
});

describe('GET /api/categorie/:id', () => {
  it('should return a single categoria by id', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/categorie',
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: 'Singola', descrizione: 'Desc' },
    });
    const created = JSON.parse(createRes.body);

    const res = await app.inject({
      method: 'GET',
      url: `/api/categorie/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.id).toBe(created.id);
    expect(body.nome).toBe('Singola');
  });

  it('should return 404 for non-existent id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/categorie/99999',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
  });
});

describe('PUT /api/categorie/:id', () => {
  it('should update an existing categoria', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/categorie',
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: 'Originale' },
    });
    const created = JSON.parse(createRes.body);

    const res = await app.inject({
      method: 'PUT',
      url: `/api/categorie/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: 'Aggiornata', descrizione: 'Nuova desc' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.nome).toBe('Aggiornata');
    expect(body.descrizione).toBe('Nuova desc');
  });

  it('should return 404 when updating non-existent categoria', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/categorie/99999',
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: 'Nope' },
    });

    expect(res.statusCode).toBe(404);
  });

  it('should return 409 when updating to a duplicate nome', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/categorie',
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: 'Esistente' },
    });
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/categorie',
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: 'Altra' },
    });
    const created = JSON.parse(createRes.body);

    const res = await app.inject({
      method: 'PUT',
      url: `/api/categorie/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: 'Esistente' },
    });

    expect(res.statusCode).toBe(409);
  });
});

describe('DELETE /api/categorie/:id', () => {
  it('should delete an existing categoria', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/categorie',
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: 'Da eliminare' },
    });
    const created = JSON.parse(createRes.body);

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/categorie/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.message).toMatch(/eliminata/i);

    // Verify it's gone
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/categorie/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(getRes.statusCode).toBe(404);
  });

  it('should return 404 when deleting non-existent categoria', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/categorie/99999',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
  });
});
