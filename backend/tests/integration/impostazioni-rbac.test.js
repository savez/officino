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
// T010 — Regular user is DENIED access to impostazioni endpoints
// ----------------------------------------------------------------

describe('Impostazioni RBAC — utente normale negato (T010)', () => {
  it('GET /api/impostazioni should return 403 for regular user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/impostazioni',
      headers: { authorization: `Bearer ${userToken}` },
    });
    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('error');
  });

  it('PUT /api/impostazioni should return 403 for regular user', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/impostazioni',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { nome_officina: 'Test', aliquota_iva_default: 22 },
    });
    expect(res.statusCode).toBe(403);
  });

  it('POST /api/impostazioni/logo should return 403 for regular user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/impostazioni/logo',
      headers: { authorization: `Bearer ${userToken}` },
    });
    expect(res.statusCode).toBe(403);
  });
});

// ----------------------------------------------------------------
// T012 — Admin user is ALLOWED access to impostazioni endpoints
// ----------------------------------------------------------------

describe('Impostazioni RBAC — admin ammesso (T012)', () => {
  it('GET /api/impostazioni should return 200 for admin', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/impostazioni',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it('PUT /api/impostazioni should allow admin to update settings', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/impostazioni',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { nome: 'Officina Test', aliquota_iva_default: 22 },
    });
    expect([200, 201]).toContain(res.statusCode);
  });

  it('should return 401 without any token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/impostazioni',
    });
    expect(res.statusCode).toBe(401);
  });
});
