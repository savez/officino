const buildApp = require('../../src/app');
const { version } = require('../../package.json');

let app;

beforeAll(async () => {
  app = await buildApp({ logger: false, skipRateLimit: true });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('endpoint di salute', () => {
  // Su Render backend e frontend sono servizi separati: il badge
  // nell'interfaccia dice quale FRONTEND e' online, non quale API risponde.
  it('dichiara la versione del backend', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    const body = JSON.parse(res.body);

    expect(body.version).toBe(version);
    expect(body.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('resta pubblico, senza autenticazione', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });

    expect(res.statusCode).toBe(200);
  });
});
