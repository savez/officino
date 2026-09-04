'use strict';

const { getApp, getAdminToken } = require('../helpers/setup');
const { buildPdfModel } = require('../../src/services/pdf-nota-lavorazione');

let app;
let adminToken;
let clienteId;
let operaioId;

beforeAll(async () => {
  app = getApp();
  adminToken = await getAdminToken();
  operaioId = (await app.db('utenti').where({ email: 'operaio@officino.app' }).first()).id;
});

async function pulisci() {
  await app.db('materiali_lavorazione').del();
  await app.db('lavorazioni').del();
  await app.db('rapportini').del();
  await app.db('note_lavorazione').del();
  await app.db('clienti').del();
}

beforeEach(async () => {
  await pulisci();
  const [c] = await app.db('clienti').insert({ nome: 'Azienda Rossi' }).returning('*');
  clienteId = c.id;
});

afterEach(pulisci);

const auth = () => ({ authorization: `Bearer ${adminToken}` });

/**
 * Crea un rapportino concluso con una lavorazione.
 * @returns {Promise<object>} il rapportino
 */
async function seedRapportino() {
  const [r] = await app
    .db('rapportini')
    .insert({
      utente_id: operaioId,
      cliente_id: clienteId,
      macchina: 'Trattore JD',
      chiuso_il: new Date().toISOString(),
    })
    .returning('*');
  await app.db('lavorazioni').insert({
    rapportino_id: r.id,
    giorno: '2026-09-01',
    ore: 4,
    costo_orario_applicato: 30,
  });
  return r;
}

// Le tre combinazioni: quale override impedisce quale dettaglio.
const CASI = [
  {
    nome: 'totale materiali imposto',
    override: { totale_materiali_override: 300 },
    dettaglio: 'mostra_dettaglio_materiali',
    messaggio: /materiali/i,
  },
  {
    nome: 'totale manodopera imposto',
    override: { totale_manodopera_override: 400 },
    dettaglio: 'mostra_dettaglio_manodopera',
    messaggio: /manodopera/i,
  },
  {
    nome: 'totale complessivo imposto, dettaglio materiali',
    override: { totale_override: 900 },
    dettaglio: 'mostra_dettaglio_materiali',
    messaggio: /complessivo/i,
  },
  {
    nome: 'totale complessivo imposto, dettaglio manodopera',
    override: { totale_override: 900 },
    dettaglio: 'mostra_dettaglio_manodopera',
    messaggio: /complessivo/i,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// La regola "un totale imposto spegne il dettaglio corrispondente" vive in un
// servizio solo, ma serve in TRE punti: creazione, modifica e generazione del
// documento. Questo test li enumera e verifica che ciascuno la applichi.
//
// Senza l'enumerazione, una funzione condivisa chiamata da due chiamanti su tre
// sarebbe peggio di nessuna funzione: sembrerebbe fatta, e il terzo punto
// produrrebbe in silenzio un documento in cui un elenco non somma al totale che
// espone.
describe('la regola sui dettagli vale su OGNI punto d ingresso', () => {
  it.each(CASI)('creazione — $nome', async ({ override, dettaglio, messaggio }) => {
    const r = await seedRapportino();
    const res = await app.inject({
      method: 'POST',
      url: '/api/note-lavorazione',
      headers: auth(),
      payload: {
        cliente_id: clienteId,
        data_riferimento: '2026-09-03',
        rapportini_ids: [r.id],
        [dettaglio]: true,
        ...override,
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(messaggio);
  });

  it.each(CASI)('modifica — $nome', async ({ override, dettaglio, messaggio }) => {
    const r = await seedRapportino();
    const creata = await app.inject({
      method: 'POST',
      url: '/api/note-lavorazione',
      headers: auth(),
      payload: {
        cliente_id: clienteId,
        data_riferimento: '2026-09-03',
        rapportini_ids: [r.id],
      },
    });
    const notaId = creata.json().id;

    const res = await app.inject({
      method: 'PUT',
      url: `/api/note-lavorazione/${notaId}`,
      headers: auth(),
      payload: { rapportini_ids: [r.id], [dettaglio]: true, ...override },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(messaggio);
  });

  // Il terzo punto d'ingresso. Il documento non passa dalla validazione della
  // richiesta: se la regola vivesse solo lì, una nota manomessa direttamente
  // sul database stamperebbe un dettaglio che non doveva esistere.
  it.each(CASI)('generazione del documento — $nome', async ({ override, dettaglio }) => {
    const modello = buildPdfModel(
      {
        cliente_nome: 'Azienda Rossi',
        data_riferimento: '2026-09-03',
        divisione: 'unita',
        [dettaglio]: true,
        ...override,
      },
      [
        {
          id: 1,
          macchina: 'Trattore JD',
          lavorazioni: [
            {
              id: 1,
              giorno: '2026-09-01',
              ore: 4,
              costo_orario_applicato: 30,
              materiali: [{ id: 1, nome: 'Filtro', quantita: 1, prezzo_unitario: 10 }],
            },
          ],
        },
      ],
    );
    expect(modello[dettaglio]).toBe(false);
  });
});

describe('senza totali imposti tutti i punti accettano i dettagli', () => {
  // Il contrario del test precedente. Senza, la regola potrebbe essere
  // soddisfatta rifiutando sempre tutto.
  it('creazione', async () => {
    const r = await seedRapportino();
    const res = await app.inject({
      method: 'POST',
      url: '/api/note-lavorazione',
      headers: auth(),
      payload: {
        cliente_id: clienteId,
        data_riferimento: '2026-09-03',
        rapportini_ids: [r.id],
        mostra_dettaglio_materiali: true,
        mostra_dettaglio_manodopera: true,
      },
    });
    expect(res.statusCode).toBe(201);
  });

  it('generazione del documento', () => {
    const modello = buildPdfModel(
      {
        cliente_nome: 'Azienda Rossi',
        data_riferimento: '2026-09-03',
        divisione: 'unita',
        mostra_dettaglio_materiali: true,
        mostra_dettaglio_manodopera: true,
      },
      [
        {
          id: 1,
          macchina: 'Trattore JD',
          lavorazioni: [
            { id: 1, giorno: '2026-09-01', ore: 4, costo_orario_applicato: 30, materiali: [] },
          ],
        },
      ],
    );
    expect(modello.mostra_dettaglio_materiali).toBe(true);
    expect(modello.mostra_dettaglio_manodopera).toBe(true);
  });
});
