const { getApp, getAuthToken, getAdminToken } = require('../helpers/setup');

let app;
let adminToken;
let userToken;
let testUserId;

beforeAll(async () => {
  app = getApp();
  userToken = await getAuthToken();
  adminToken = await getAdminToken();

  // Decode admin JWT to get user ID for seeded log entries
  const decoded = app.jwt.decode(adminToken);
  testUserId = decoded.id;
});

/**
 * Before each test, clean log_modifiche and seed fresh data as needed.
 */
beforeEach(async () => {
  await app.db('log_modifiche').del();
});

afterEach(async () => {
  await app.db('log_modifiche').del();
});

/**
 * Helper to insert a log entry directly into the database
 * @param overrides
 */
async function insertLog(overrides = {}) {
  const entry = {
    utente_id: testUserId,
    entita: 'pezzo_magazzino',
    entita_id: 1,
    azione: 'creazione',
    dettaglio: null,
    ...overrides,
  };

  if (entry.dettaglio && typeof entry.dettaglio === 'object') {
    entry.dettaglio = JSON.stringify(entry.dettaglio);
  }

  const [row] = await app.db('log_modifiche').insert(entry).returning('*');
  return row;
}

// ---------- GET /api/log ----------

describe('GET /api/log', () => {
  it('should return paginated log entries', async () => {
    await insertLog({ entita: 'pezzo_magazzino', entita_id: 1, azione: 'creazione' });
    await insertLog({ entita: 'cliente', entita_id: 2, azione: 'modifica' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/log',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('pagination');
    expect(body.data).toHaveLength(2);
    expect(body.pagination.total).toBe(2);
  });

  it('should return entries ordered by created_at desc', async () => {
    await insertLog({ entita_id: 1, azione: 'creazione' });
    // Insert a second entry with a slight delay to ensure ordering
    await insertLog({ entita_id: 2, azione: 'modifica' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/log',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(2);
    // Most recent entry should be first
    expect(body.data[0].entita_id).toBe(2);
    expect(body.data[1].entita_id).toBe(1);
  });

  it('should include utente_nome from join', async () => {
    await insertLog({ azione: 'creazione' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/log',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    const body = JSON.parse(res.body);
    expect(body.data[0]).toHaveProperty('utente_nome');
    expect(body.data[0].utente_nome).toBe('Test Admin');
  });

  it('should parse dettaglio JSON', async () => {
    const dettaglio = { nome: { prima: 'Vecchio', dopo: 'Nuovo' } };
    await insertLog({ azione: 'modifica', dettaglio });

    const res = await app.inject({
      method: 'GET',
      url: '/api/log',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    const body = JSON.parse(res.body);
    expect(body.data[0].dettaglio).toEqual(dettaglio);
  });

  it('should return empty results when no logs exist', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/log',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(0);
    expect(body.pagination.total).toBe(0);
  });

  it('should return 401 without auth token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/log',
    });

    expect(res.statusCode).toBe(401);
  });

  it('should respect pagination params', async () => {
    for (let i = 1; i <= 5; i++) {
      await insertLog({ entita_id: i, azione: 'creazione' });
    }

    const res = await app.inject({
      method: 'GET',
      url: '/api/log?page=1&per_page=2',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(2);
    expect(body.pagination.total).toBe(5);
    expect(body.pagination.totalPages).toBe(3);
  });
});

// ---------- GET /api/log with filters ----------

describe('GET /api/log with filters', () => {
  it('should filter by entita', async () => {
    await insertLog({ entita: 'pezzo_magazzino', entita_id: 1 });
    await insertLog({ entita: 'cliente', entita_id: 2 });

    const res = await app.inject({
      method: 'GET',
      url: '/api/log?entita=pezzo_magazzino',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].entita).toBe('pezzo_magazzino');
  });

  it('should filter by azione', async () => {
    await insertLog({ azione: 'creazione' });
    await insertLog({ azione: 'modifica' });
    await insertLog({ azione: 'eliminazione' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/log?azione=modifica',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].azione).toBe('modifica');
  });

  it('should filter by date range', async () => {
    // Insert a log entry with a specific date
    await app.db('log_modifiche').insert({
      utente_id: testUserId,
      entita: 'pezzo_magazzino',
      entita_id: 1,
      azione: 'creazione',
      created_at: '2025-06-15 10:00:00',
    });

    await app.db('log_modifiche').insert({
      utente_id: testUserId,
      entita: 'pezzo_magazzino',
      entita_id: 2,
      azione: 'modifica',
      created_at: '2025-07-20 10:00:00',
    });

    await app.db('log_modifiche').insert({
      utente_id: testUserId,
      entita: 'pezzo_magazzino',
      entita_id: 3,
      azione: 'eliminazione',
      created_at: '2025-08-25 10:00:00',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/log?data_da=2025-07-01&data_a=2025-07-31',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].entita_id).toBe(2);
  });

  it('should combine multiple filters', async () => {
    await insertLog({ entita: 'pezzo_magazzino', azione: 'creazione' });
    await insertLog({ entita: 'pezzo_magazzino', azione: 'modifica' });
    await insertLog({ entita: 'cliente', azione: 'creazione' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/log?entita=pezzo_magazzino&azione=creazione',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].entita).toBe('pezzo_magazzino');
    expect(body.data[0].azione).toBe('creazione');
  });
});

// ---------- GET /api/log/:entita/:entita_id ----------

describe('GET /api/log/:entita/:entita_id', () => {
  it('should return logs for a specific entity', async () => {
    await insertLog({ entita: 'pezzo_magazzino', entita_id: 42, azione: 'creazione' });
    await insertLog({ entita: 'pezzo_magazzino', entita_id: 42, azione: 'modifica' });
    await insertLog({ entita: 'pezzo_magazzino', entita_id: 99, azione: 'creazione' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/log/pezzo_magazzino/42',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(2);
    body.data.forEach((entry) => {
      expect(entry.entita).toBe('pezzo_magazzino');
      expect(entry.entita_id).toBe(42);
    });
  });

  it('should return empty results for entity with no logs', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/log/cliente/9999',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(0);
    expect(body.pagination.total).toBe(0);
  });

  it('should include utente_nome in entity logs', async () => {
    await insertLog({ entita: 'preventivo', entita_id: 10, azione: 'creazione' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/log/preventivo/10',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    const body = JSON.parse(res.body);
    expect(body.data[0]).toHaveProperty('utente_nome');
    expect(body.data[0].utente_nome).toBe('Test Admin');
  });

  it('should return 401 without auth token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/log/pezzo_magazzino/1',
    });

    expect(res.statusCode).toBe(401);
  });

  it('should respect pagination for entity logs', async () => {
    for (let i = 0; i < 5; i++) {
      await insertLog({ entita: 'cliente', entita_id: 7, azione: 'modifica' });
    }

    const res = await app.inject({
      method: 'GET',
      url: '/api/log/cliente/7?page=1&per_page=2',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(2);
    expect(body.pagination.total).toBe(5);
    expect(body.pagination.totalPages).toBe(3);
  });
});

// ---------- GET /api/log/count-before ----------

describe('GET /api/log/count-before', () => {
  it('should count logs before the provided date', async () => {
    await insertLog({ entita_id: 1, created_at: '2025-01-10 10:00:00' });
    await insertLog({ entita_id: 2, created_at: '2025-02-15 10:00:00' });
    await insertLog({ entita_id: 3, created_at: '2025-03-20 10:00:00' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/log/count-before?data=2025-03-01',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toEqual({ count: 2 });
  });

  it('should return 400 without data parameter', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/log/count-before',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(400);
  });
});

// ---------- DELETE /api/log/before ----------

describe('DELETE /api/log/before', () => {
  it('should delete logs before provided date and preserve recent ones', async () => {
    await insertLog({ entita_id: 1, created_at: '2025-01-10 10:00:00' });
    await insertLog({ entita_id: 2, created_at: '2025-02-15 10:00:00' });
    await insertLog({ entita_id: 3, created_at: '2025-03-20 10:00:00' });

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/log/before?data=2025-03-01',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toEqual({ deleted: 2 });

    const remaining = await app.db('log_modifiche').count('id as count').first();
    expect(Number(remaining.count)).toBe(1);
  });

  it('should return 400 with invalid date format', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/log/before?data=03-01-2025',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(400);
  });
});

// ---------- AUTHORIZATION ----------

describe('Authorization', () => {
  it('should return 403 for non-admin on GET /api/log', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/log',
      headers: { authorization: `Bearer ${userToken}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('should return 403 for non-admin on GET /api/log/:entita/:entita_id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/log/cliente/1',
      headers: { authorization: `Bearer ${userToken}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('should return 403 for non-admin on GET /api/log/count-before', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/log/count-before?data=2025-03-01',
      headers: { authorization: `Bearer ${userToken}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('should return 403 for non-admin on DELETE /api/log/before', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/log/before?data=2025-03-01',
      headers: { authorization: `Bearer ${userToken}` },
    });

    expect(res.statusCode).toBe(403);
  });
});
