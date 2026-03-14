const { getApp, getAuthToken, getAdminToken } = require('../helpers/setup');

let app;
let userToken;
let adminToken;

beforeAll(async () => {
  app = getApp();
  userToken = await getAuthToken();
  adminToken = await getAdminToken();
});

// ----------------------------------------------------------------
// T009 — Regular user is DENIED access to utenti endpoints
// ----------------------------------------------------------------

describe('Utenti RBAC — utente normale negato (T009)', () => {
  it('GET /api/utenti should return 403 for regular user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/utenti',
      headers: { authorization: `Bearer ${userToken}` },
    });
    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('error');
  });

  it('POST /api/utenti should return 403 for regular user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/utenti',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { nome: 'Test', email: 'x@x.com', password: 'pass123' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('GET /api/utenti/all should be accessible to regular users (dropdown)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/utenti/all',
      headers: { authorization: `Bearer ${userToken}` },
    });
    expect(res.statusCode).toBe(200);
  });
});

// ----------------------------------------------------------------
// T011 — Admin user is ALLOWED access to utenti endpoints
// ----------------------------------------------------------------

describe('Utenti RBAC — admin ammesso (T011)', () => {
  it('GET /api/utenti should return 200 for admin', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/utenti',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it('GET /api/utenti/all should return 200 for admin', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/utenti/all',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it('POST /api/utenti should allow admin to create user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/utenti',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        nome: 'Nuovo Operaio',
        email: `operaio-${Date.now()}@officina.it`,
        password: 'sicuro123',
        ruolo: 'user',
      },
    });
    expect(res.statusCode).toBe(201);
  });

  it('should return 401 without any token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/utenti',
    });
    expect(res.statusCode).toBe(401);
  });
});
