const buildApp = require('../../src/app');
const bcrypt = require('bcrypt');

let app;
let authToken;
let adminToken;

async function ensureTestUsers() {
  const passwordHash = await bcrypt.hash('admin123', 10);

  const admin = await app.db('utenti').where({ email: 'admin@officina.it' }).first();
  if (!admin) {
    await app.db('utenti').insert({
      nome: 'Test Admin',
      email: 'admin@officina.it',
      password_hash: passwordHash,
      ruolo: 'admin',
      costo_orario: 40,
    });
  }

  const user = await app.db('utenti').where({ email: 'marco@officina.it' }).first();
  if (!user) {
    await app.db('utenti').insert({
      nome: 'Test User',
      email: 'marco@officina.it',
      password_hash: passwordHash,
      ruolo: 'user',
      costo_orario: 35,
    });
  }
}

/**
 * Returns a JWT token for seeded user role='user'.
 * @returns {Promise<string>} JWT bearer token
 */
async function getAuthToken() {
  if (authToken) return authToken;

  await ensureTestUsers();

  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: {
      email: 'marco@officina.it',
      password: 'admin123',
    },
  });

  const body = JSON.parse(res.body);
  authToken = body.token;
  return authToken;
}

/**
 * Returns a JWT token for seeded user role='admin'.
 * @returns {Promise<string>} JWT bearer token for an admin user
 */
async function getAdminToken() {
  if (adminToken) return adminToken;

  await ensureTestUsers();

  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'admin@officina.it', password: 'admin123' },
  });

  const loginBody = JSON.parse(loginRes.body);
  adminToken = loginBody.token;
  return adminToken;
}

beforeAll(async () => {
  app = await buildApp({ logger: false, skipRateLimit: true });
  await app.ready();
  await app.db.migrate.latest();
});

afterAll(async () => {
  await app.db.migrate.rollback(undefined, true);
  await app.close();
});

module.exports = {
  getApp: () => app,
  getAuthToken,
  getAdminToken,
};
