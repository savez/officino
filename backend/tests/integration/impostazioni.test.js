const path = require('path');
const fs = require('fs/promises');
const FormData = require('form-data');
const { getApp, getAdminToken } = require('../helpers/setup');

const LOGO_DIR = path.join(__dirname, '..', '..', '..', 'uploads', 'logo');

let app;
let token;

beforeAll(async () => {
  app = getApp();
  token = await getAdminToken();
});

/**
 * Clean up uploaded logo files after each test
 */
afterEach(async () => {
  try {
    const files = await fs.readdir(LOGO_DIR);
    for (const f of files) {
      await fs.unlink(path.join(LOGO_DIR, f));
    }
    await fs.rmdir(LOGO_DIR);
  } catch {
    // Directory might not exist, ignore
  }
});

// ---------- GET ----------

describe('GET /api/impostazioni', () => {
  it('should return the settings object with default values', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/impostazioni',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('nome');
    expect(body).toHaveProperty('aliquota_iva_default');
    expect(body.nome).toBe('La Mia Officina');
    expect(Number(body.aliquota_iva_default)).toBe(22);
  });

  it('should have all expected fields', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/impostazioni',
      headers: { authorization: `Bearer ${token}` },
    });

    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('id');
    expect(body).toHaveProperty('nome');
    expect(body).toHaveProperty('partita_iva');
    expect(body).toHaveProperty('indirizzo');
    expect(body).toHaveProperty('telefono');
    expect(body).toHaveProperty('email');
    expect(body).toHaveProperty('logo_url');
    expect(body).toHaveProperty('aliquota_iva_default');
    expect(body).toHaveProperty('log_attivi');
  });
});

// ---------- PUT ----------

describe('PUT /api/impostazioni', () => {
  it('should update nome, partita_iva, etc.', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/impostazioni',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        nome: 'Officina Aggiornata',
        partita_iva: '01234567890',
        indirizzo: 'Via Test 1, Milano',
        telefono: '02123456',
        email: 'test@officino.app',
        aliquota_iva_default: 10,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.nome).toBe('Officina Aggiornata');
    expect(body.partita_iva).toBe('01234567890');
    expect(body.indirizzo).toBe('Via Test 1, Milano');
    expect(body.telefono).toBe('02123456');
    expect(body.email).toBe('test@officino.app');
    expect(Number(body.aliquota_iva_default)).toBe(10);
  });

  it('should return 400 for missing nome', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/impostazioni',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        partita_iva: '01234567890',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('error');
  });

  it('should normalize empty email to null', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/impostazioni',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        nome: 'Officina Test',
        email: '',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.email).toBeNull();
  });

  it('should persist changes across requests', async () => {
    await app.inject({
      method: 'PUT',
      url: '/api/impostazioni',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        nome: 'Officina Persistente',
        telefono: '9999999999',
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/impostazioni',
      headers: { authorization: `Bearer ${token}` },
    });

    const body = JSON.parse(res.body);
    expect(body.nome).toBe('Officina Persistente');
    expect(body.telefono).toBe('9999999999');
  });

  it('should update log_attivi field', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/impostazioni',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        nome: 'Officina Log OFF',
        log_attivi: false,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.log_attivi).toBe(false);
  });

  it('should return 400 for invalid email format', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/impostazioni',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        nome: 'Officina Test',
        email: 'not-a-valid-email',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('error');
  });
});

// ---------- POST /logo ----------

describe('POST /api/impostazioni/logo', () => {
  // 1x1 transparent PNG
  const pngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  it('should upload a logo successfully', async () => {
    const formData = new FormData();
    formData.append('file', pngBuffer, { filename: 'test-logo.png', contentType: 'image/png' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/impostazioni/logo',
      headers: {
        ...formData.getHeaders(),
        authorization: `Bearer ${token}`,
      },
      payload: formData,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.logo_url).toMatch(/\/uploads\/logo\/logo\.png$/);
  });

  it('should return 400 for invalid file type', async () => {
    const textBuffer = Buffer.from('This is a text file, not an image');
    const formData = new FormData();
    formData.append('file', textBuffer, { filename: 'test.txt', contentType: 'text/plain' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/impostazioni/logo',
      headers: {
        ...formData.getHeaders(),
        authorization: `Bearer ${token}`,
      },
      payload: formData,
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toMatch(/tipo file/i);
  });

  it('should update logo_url in DB after upload', async () => {
    const formData = new FormData();
    formData.append('file', pngBuffer, { filename: 'logo.png', contentType: 'image/png' });

    await app.inject({
      method: 'POST',
      url: '/api/impostazioni/logo',
      headers: {
        ...formData.getHeaders(),
        authorization: `Bearer ${token}`,
      },
      payload: formData,
    });

    // Verify via GET
    const getRes = await app.inject({
      method: 'GET',
      url: '/api/impostazioni',
      headers: { authorization: `Bearer ${token}` },
    });

    const body = JSON.parse(getRes.body);
    expect(body.logo_url).toMatch(/\/uploads\/logo\/logo\.png$/);
  });

  it('should accept JPEG files', async () => {
    const formData = new FormData();
    formData.append('file', pngBuffer, { filename: 'test-logo.jpg', contentType: 'image/jpeg' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/impostazioni/logo',
      headers: {
        ...formData.getHeaders(),
        authorization: `Bearer ${token}`,
      },
      payload: formData,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.logo_url).toMatch(/\/uploads\/logo\/logo\.jpg$/);
  });
});

// ---------- DELETE /logo ----------

describe('DELETE /api/impostazioni/logo', () => {
  // 1x1 transparent PNG
  const pngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  it('should delete logo and set logo_url to null', async () => {
    // First upload a logo
    const formData = new FormData();
    formData.append('file', pngBuffer, { filename: 'test-logo.png', contentType: 'image/png' });

    await app.inject({
      method: 'POST',
      url: '/api/impostazioni/logo',
      headers: {
        ...formData.getHeaders(),
        authorization: `Bearer ${token}`,
      },
      payload: formData,
    });

    // Then delete it
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/impostazioni/logo',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.logo_url).toBeNull();
  });

  it('should return 404 when no logo exists', async () => {
    // Ensure no logo is set
    await app.db('impostazioni_officina').update({ logo_url: null });

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/impostazioni/logo',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toMatch(/logo/i);
  });
});

// ---------- GET /preventivi/:id/pdf ----------

describe('GET /api/preventivi/:id/pdf', () => {
  let testClienteId;

  beforeEach(async () => {
    await app.db('preventivo_pezzi').del();
    await app.db('preventivi').del();
    await app.db('pezzi_magazzino').del();
    await app.db('clienti').del();
    await app.db('categorie').del();

    await app.db('categorie').insert({ nome: 'Test Categoria' }).returning('*');

    const [cliente] = await app.db('clienti').insert({ nome: 'Cliente PDF' }).returning('*');
    testClienteId = cliente.id;
  });

  afterEach(async () => {
    await app.db('preventivo_pezzi').del();
    await app.db('preventivi').del();
    await app.db('pezzi_magazzino').del();
    await app.db('clienti').del();
    await app.db('categorie').del();
  });

  it('should return a PDF with correct Content-Type', async () => {
    // Create a preventivo via API
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/preventivi',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        cliente_id: testClienteId,
        data: '2026-01-15',
        manodopera_ore: 0,
        manodopera_costo_orario: 0,
        sconto_tipo: 'fisso',
        sconto_valore: 0,
        aliquota_iva: 22,
        pezzi: [],
      },
    });

    const created = JSON.parse(createRes.body);

    const res = await app.inject({
      method: 'GET',
      url: `/api/preventivi/${created.id}/pdf`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toMatch(/preventivo/i);
  });

  it('should return a valid PDF buffer', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/preventivi',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        cliente_id: testClienteId,
        data: '2026-01-15',
        manodopera_ore: 1,
        manodopera_costo_orario: 30,
        sconto_tipo: 'fisso',
        sconto_valore: 0,
        aliquota_iva: 22,
        pezzi: [],
      },
    });

    const created = JSON.parse(createRes.body);

    const res = await app.inject({
      method: 'GET',
      url: `/api/preventivi/${created.id}/pdf`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.rawPayload.length).toBeGreaterThan(0);

    // Check PDF header
    const header = res.rawPayload.subarray(0, 5).toString('ascii');
    expect(header).toBe('%PDF-');
  });

  it('should return 404 for non-existent preventivo', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/preventivi/99999/pdf',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toMatch(/non trovato/i);
  });
});

// ---------- AUTH ----------

describe('Auth', () => {
  it('should return 401 without token on GET /api/impostazioni', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/impostazioni',
    });

    expect(res.statusCode).toBe(401);
  });

  it('should return 401 without token on PUT /api/impostazioni', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/impostazioni',
      payload: { nome: 'Test' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('should return 401 without token on POST /api/impostazioni/logo', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/impostazioni/logo',
    });

    expect(res.statusCode).toBe(401);
  });

  it('should return 401 without token on DELETE /api/impostazioni/logo', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/impostazioni/logo',
    });

    expect(res.statusCode).toBe(401);
  });

  it('should return 401 without token on GET /api/preventivi/:id/pdf', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/preventivi/1/pdf',
    });

    expect(res.statusCode).toBe(401);
  });
});
