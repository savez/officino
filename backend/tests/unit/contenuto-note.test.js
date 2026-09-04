'use strict';

const { getApp, getAuthToken } = require('../helpers/setup');
const {
  caricaContenutoNota,
  caricaContenutoNote,
} = require('../../src/services/contenuto-note');

// Il caricatore singolo DELEGA a quello in blocco. Questo test esiste perche'
// la delega resti tale: se qualcuno rimettesse due percorsi indipendenti, i
// totali delle note potrebbero divergere fra la schermata e la dashboard senza
// che nulla fallisca. E' la stessa forma del difetto che su questo progetto ha
// gia' prodotto due letture diverse degli stessi scostamenti.

let app;
let clienteId;
let utenteId;

beforeAll(async () => {
  app = getApp();
  await getAuthToken();
  utenteId = (await app.db('utenti').where({ email: 'operaio@officino.app' }).first()).id;
});

beforeEach(async () => {
  await app.db('materiali_lavorazione').del();
  await app.db('lavorazioni').del();
  await app.db('rapportini').del();
  await app.db('note_lavorazione').del();
  await app.db('clienti').del();
  const [cliente] = await app.db('clienti').insert({ nome: 'Cliente Note' }).returning('*');
  clienteId = cliente.id;
});

afterEach(async () => {
  await app.db('materiali_lavorazione').del();
  await app.db('lavorazioni').del();
  await app.db('rapportini').del();
  await app.db('note_lavorazione').del();
  await app.db('clienti').del();
});

/**
 * Crea una nota con un rapportino, due lavorazioni e un materiale.
 * @param {string} riferimento - data di riferimento
 * @returns {Promise<number>} id della nota
 */
async function creaNotaPiena(riferimento) {
  const [nota] = await app
    .db('note_lavorazione')
    .insert({ cliente_id: clienteId, testo: 'Manutenzione', data_riferimento: riferimento })
    .returning('*');

  const [r] = await app
    .db('rapportini')
    .insert({
      utente_id: utenteId,
      cliente_id: clienteId,
      macchina: 'Tornio',
      chiuso_il: new Date().toISOString(),
      nota_lavorazione_id: nota.id,
    })
    .returning('*');

  const [l1] = await app
    .db('lavorazioni')
    .insert({ rapportino_id: r.id, giorno: '2026-03-10', ore: 3, costo_orario_applicato: 30 })
    .returning('*');
  await app
    .db('lavorazioni')
    .insert({ rapportino_id: r.id, giorno: '2026-03-11', ore: 2, costo_orario_applicato: 30 });

  await app.db('materiali_lavorazione').insert({
    lavorazione_id: l1.id,
    nome_manuale: 'Filtro olio',
    fuori_catalogo: true,
    quantita: 2,
    prezzo_unitario: 12.5,
  });

  return nota.id;
}

describe('il caricamento in blocco e quello singolo non possono divergere', () => {
  it('producono lo stesso contenuto, nota per nota', async () => {
    const a = await creaNotaPiena('2026-03-15');
    const b = await creaNotaPiena('2026-03-20');

    const blocco = await caricaContenutoNote(app.db, [a, b]);
    const singoloA = await caricaContenutoNota(app.db, a);
    const singoloB = await caricaContenutoNota(app.db, b);

    expect(blocco[a]).toEqual(singoloA);
    expect(blocco[b]).toEqual(singoloB);
  });

  it('non mescola il contenuto di due note', async () => {
    const a = await creaNotaPiena('2026-03-15');
    const b = await creaNotaPiena('2026-03-20');

    const blocco = await caricaContenutoNote(app.db, [a, b]);
    const idsA = blocco[a].rapportini.map((r) => r.id);
    const idsB = blocco[b].rapportini.map((r) => r.id);

    expect(idsA).toHaveLength(1);
    expect(idsB).toHaveLength(1);
    expect(idsA).not.toEqual(idsB);
  });

  it('accetta gli id come stringhe, che e come arrivano dai parametri', async () => {
    // Il raggruppamento avviene in JavaScript, dove `'5' === 5` e' falso: senza
    // coercizione ogni nota tornerebbe vuota, e in silenzio.
    const a = await creaNotaPiena('2026-03-15');
    const daStringa = await caricaContenutoNota(app.db, String(a));
    expect(daStringa.rapportini).toHaveLength(1);
    expect(daStringa.lavorazioni).toHaveLength(2);
  });

  it('restituisce una voce vuota per una nota senza rapportini', async () => {
    const [nota] = await app
      .db('note_lavorazione')
      .insert({ cliente_id: clienteId, testo: 'Vuota', data_riferimento: '2026-03-01' })
      .returning('*');

    const blocco = await caricaContenutoNote(app.db, [nota.id]);
    expect(blocco[nota.id]).toEqual({ rapportini: [], lavorazioni: [] });
    expect(await caricaContenutoNota(app.db, nota.id)).toEqual({
      rapportini: [],
      lavorazioni: [],
    });
  });

  it('regge un elenco vuoto senza interrogare il database', async () => {
    expect(await caricaContenutoNote(app.db, [])).toEqual({});
  });

  it('porta i materiali, che concorrono al totale finale', async () => {
    const a = await creaNotaPiena('2026-03-15');
    const blocco = await caricaContenutoNote(app.db, [a]);
    const conMateriali = blocco[a].lavorazioni.filter((l) => l.materiali.length > 0);

    expect(conMateriali).toHaveLength(1);
    expect(conMateriali[0].subtotale_materiali).toBe(25);
  });
});
