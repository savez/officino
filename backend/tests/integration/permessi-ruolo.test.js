const { getApp, getAuthToken, getAdminToken } = require('../helpers/setup');

let app;
let userToken;
let adminToken;
let clienteId;

beforeAll(async () => {
  app = getApp();
  userToken = await getAuthToken();
  adminToken = await getAdminToken();
});

beforeEach(async () => {
  const [cliente] = await app.db('clienti').insert({ nome: 'Cliente Permessi' }).returning('*');
  clienteId = cliente.id ?? cliente;
});

afterEach(async () => {
  // Ordine imposto dalle chiavi esterne: le righe referenziano note e clienti,
  // le note referenziano i clienti.
  await app.db('materiali_lavorazione').del();
  await app.db('lavorazioni').del();
  await app.db('rapportini').del();
  await app.db('note_lavorazione').del();
  await app.db('clienti').del();
  await app.db('categorie').del();
});

/**
 * Esegue una richiesta con il token indicato.
 * @param {string} metodo - metodo HTTP
 * @param {string} url - percorso
 * @param {string} token - token JWT
 * @param {object} [payload] - corpo della richiesta
 * @returns {Promise<object>} risposta
 */
function chiama(metodo, url, token, payload) {
  return app.inject({
    method: metodo,
    url,
    headers: { authorization: `Bearer ${token}` },
    ...(payload ? { payload } : {}),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// CLIENTI — scrittura riservata all'amministratore
// ═══════════════════════════════════════════════════════════════════════════

describe('Clienti: scrittura riservata all amministratore', () => {
  it('1. utente NON puo creare un cliente', async () => {
    const res = await chiama('POST', '/api/clienti', userToken, { nome: 'Nuovo' });
    expect(res.statusCode).toBe(403);
  });

  it('2. utente NON puo modificare un cliente', async () => {
    const res = await chiama('PUT', `/api/clienti/${clienteId}`, userToken, { nome: 'Cambiato' });
    expect(res.statusCode).toBe(403);
  });

  it('3. utente NON puo archiviare un cliente', async () => {
    const res = await chiama('PATCH', `/api/clienti/${clienteId}/archivia`, userToken);
    expect(res.statusCode).toBe(403);
  });

  it('4. utente NON puo ripristinare un cliente', async () => {
    const res = await chiama('PATCH', `/api/clienti/${clienteId}/ripristina`, userToken);
    expect(res.statusCode).toBe(403);
  });

  it('5. utente NON puo cancellare un cliente', async () => {
    const res = await chiama('DELETE', `/api/clienti/${clienteId}`, userToken);
    expect(res.statusCode).toBe(403);
  });

  it('6. il rifiuto non modifica nulla', async () => {
    await chiama('PUT', `/api/clienti/${clienteId}`, userToken, { nome: 'Cambiato' });

    const cliente = await app.db('clienti').where({ id: clienteId }).first();
    expect(cliente.nome).toBe('Cliente Permessi');
  });

  it('7. admin continua a poter creare un cliente', async () => {
    const res = await chiama('POST', '/api/clienti', adminToken, { nome: 'Da admin' });
    expect(res.statusCode).toBe(201);
  });

  it('8. admin continua a poter modificare un cliente', async () => {
    const res = await chiama('PUT', `/api/clienti/${clienteId}`, adminToken, { nome: 'Modificato' });
    expect(res.statusCode).toBe(200);
  });
});

// Una restrizione di troppo e' un guasto tanto quanto una mancante, e
// senza questi test passerebbe inosservata finche' un operaio non riesce piu'
// a compilare un rapportino.
describe('Clienti: la lettura resta aperta, serve ai rapportini', () => {
  it('9. utente puo leggere l elenco', async () => {
    const res = await chiama('GET', '/api/clienti', userToken);
    expect(res.statusCode).toBe(200);
  });

  it('10. utente puo leggere l elenco completo per la tendina', async () => {
    const res = await chiama('GET', '/api/clienti/all', userToken);
    expect(res.statusCode).toBe(200);
  });

  it('11. la ricerca clienti non e vietata all utente', async () => {
    const res = await chiama('GET', '/api/clienti/search?q=Cliente', userToken);

    // Non si asserisce 200: whereILike non e' supportato da SQLite e questo
    // endpoint fallisce gia' nell'ambiente di test, indipendentemente dai
    // permessi. Quello che conta qui e' che non venga respinto per ruolo.
    expect(res.statusCode).not.toBe(403);
  });

  it('12. utente puo leggere il dettaglio di un cliente', async () => {
    const res = await chiama('GET', `/api/clienti/${clienteId}`, userToken);
    expect(res.statusCode).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CATALOGO E CATEGORIE — restano pienamente modificabili
// ═══════════════════════════════════════════════════════════════════════════

describe('Catalogo e categorie: l utente puo modificarli', () => {
  it('13. utente puo creare una categoria', async () => {
    const res = await chiama('POST', '/api/categorie', userToken, { nome: 'Da utente' });
    expect(res.statusCode).toBe(201);
  });

  it('14. utente puo modificare ed eliminare una categoria', async () => {
    const creata = await chiama('POST', '/api/categorie', userToken, { nome: 'Temporanea' });
    const id = JSON.parse(creata.body).id;

    const modifica = await chiama('PUT', `/api/categorie/${id}`, userToken, { nome: 'Rinominata' });
    expect(modifica.statusCode).toBe(200);

    const cancella = await chiama('DELETE', `/api/categorie/${id}`, userToken);
    expect([200, 204]).toContain(cancella.statusCode);
  });

  it('15. utente puo leggere e creare articoli di catalogo', async () => {
    const lettura = await chiama('GET', '/api/catalogo', userToken);
    expect(lettura.statusCode).toBe(200);

    const creazione = await chiama('POST', '/api/catalogo', userToken, {
      nome: 'Articolo da utente',
      quantita: 1,
      prezzo_acquisto: 10,
      prezzo_vendita: 20,
    });
    expect([200, 201]).toContain(creazione.statusCode);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// NOTE DI LAVORAZIONE — interamente riservate
// ═══════════════════════════════════════════════════════════════════════════

describe('Note di lavorazione: riservate all amministratore', () => {
  it('16. utente NON puo leggere l elenco', async () => {
    const res = await chiama('GET', '/api/note-lavorazione', userToken);
    expect(res.statusCode).toBe(403);
  });

  it('17. utente NON puo crearne una', async () => {
    const res = await chiama('POST', '/api/note-lavorazione', userToken, { cliente_id: clienteId });
    expect(res.statusCode).toBe(403);
  });

  it('18. admin puo leggere l elenco', async () => {
    const res = await chiama('GET', '/api/note-lavorazione', adminToken);
    expect(res.statusCode).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// RAPPORTINI — vincoli già esistenti, qui fissati da test
// ═══════════════════════════════════════════════════════════════════════════

describe('Rapportini: l utente lavora solo sulle proprie righe', () => {
  let utenteId;
  let adminId;

  beforeEach(async () => {
    utenteId = (await app.db('utenti').where({ email: 'operaio@officino.app' }).first()).id;
    adminId = (await app.db('utenti').where({ email: 'demo@officino.app' }).first()).id;
  });

  it('19. un rapportino creato da un utente risulta intestato a lui, non a chi indica', async () => {
    const res = await chiama('POST', '/api/rapportini', userToken, {
      cliente_id: clienteId,
      macchina: 'Trattore JD',
      utente_id: adminId,
    });

    expect([200, 201]).toContain(res.statusCode);

    // L'autore si verifica su cio' che e' stato scritto davvero, non su cio'
    // che la richiesta chiedeva.
    const { id } = JSON.parse(res.body);
    const rapportino = await app.db('rapportini').where({ id }).first();
    expect(rapportino.utente_id).toBe(utenteId);
    expect(rapportino.utente_id).not.toBe(adminId);
  });

  it('20. utente NON puo modificare il rapportino di un collega', async () => {
    const [rapportino] = await app
      .db('rapportini')
      .insert({ utente_id: adminId, cliente_id: clienteId, macchina: 'Mietitrebbia' })
      .returning('*');

    const res = await chiama(
      'POST',
      `/api/rapportini/${rapportino.id ?? rapportino}/lavorazioni`,
      userToken,
      { giorno: '2026-03-04', ore: 4 }
    );

    expect([403, 404]).toContain(res.statusCode);
  });

  it('21. un rapportino gia gestito non e modificabile, nemmeno dall autore', async () => {
    const [nota] = await app
      .db('note_lavorazione')
      .insert({ cliente_id: clienteId, testo: 'Nota di prova' })
      .returning('*');
    const [rapportino] = await app
      .db('rapportini')
      .insert({
        utente_id: utenteId,
        cliente_id: clienteId,
        macchina: 'Trattore JD',
        chiuso_il: new Date().toISOString(),
        nota_lavorazione_id: nota.id ?? nota,
      })
      .returning('*');

    const res = await chiama(
      'POST',
      `/api/rapportini/${rapportino.id ?? rapportino}/lavorazioni`,
      userToken,
      { giorno: '2026-03-04', ore: 4 }
    );

    expect(res.statusCode).toBe(403);
    // Il messaggio deve indicare la strada giusta, non limitarsi a negare: chi
    // lo legge deve capire che si passa dalla nota di lavorazione.
    expect(JSON.parse(res.body).error).toMatch(/nota di lavorazione/i);
  });

  it('22. l elenco mostra all utente soltanto i propri rapportini', async () => {
    await app.db('rapportini').insert([
      { utente_id: utenteId, cliente_id: clienteId, macchina: 'Trattore JD' },
      { utente_id: adminId, cliente_id: clienteId, macchina: 'Mietitrebbia' },
    ]);

    const res = await chiama('GET', '/api/rapportini', userToken);
    const body = JSON.parse(res.body);
    const righe = body.data ?? body;

    expect(righe.length).toBeGreaterThan(0);
    expect(righe.every((r) => r.utente_id === utenteId)).toBe(true);
  });
});
