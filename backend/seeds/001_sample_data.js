const bcrypt = require('bcrypt');

/**
 * Seed: sample data for development
 *
 * Default credentials:
 *   - demo@officino.app  / admin123  (Admin Demo, costo orario 40€)
 *   - operaio@officino.app  / admin123  (Marco, costo orario 35€)
 *
 * @param {import('knex').Knex} knex
 */
exports.seed = async function (knex) {
  // ── 1. Clean tables in FK order ────────────────────────────────────
  await knex('log_modifiche').del();
  await knex('materiali_rapportino').del();
  await knex('righe_rapportino').del();
  await knex('note_lavorazione').del();
  await knex('preventivo_pezzi').del();
  await knex('preventivi').del();
  await knex('pezzi_magazzino').del();
  await knex('clienti').del();
  await knex('categorie').del();
  await knex('utenti').del();

  // ── 1b. Utenti demo ──────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('admin123', 10);
  await knex('utenti').insert([
    {
      nome: 'Admin Demo',
      email: 'demo@officino.app',
      password_hash: passwordHash,
      ruolo: 'admin',
      costo_orario: 40,
    },
    {
      nome: 'Marco',
      email: 'operaio@officino.app',
      password_hash: passwordHash,
      ruolo: 'user',
      costo_orario: 35,
    },
  ]);

  // ── 2. Categorie ───────────────────────────────────────────────────
  const categorie = await knex('categorie')
    .insert([
      { nome: 'Freni', descrizione: 'Pastiglie, dischi, liquidi freni' },
      { nome: 'Elettrico', descrizione: 'Batterie, alternatori, lampadine' },
      { nome: 'Carrozzeria', descrizione: 'Paraurti, specchietti, vetri' },
      { nome: 'Motore', descrizione: 'Cinghie, pompe, candele' },
      { nome: 'Sospensioni', descrizione: 'Ammortizzatori, molle, bracci' },
      { nome: 'Lubrificanti', descrizione: 'Oli motore, liquidi raffreddamento' },
      { nome: 'Filtri', descrizione: 'Filtri olio, aria, abitacolo' },
    ])
    .returning('*');

  // Build a lookup { nome: id }
  const catMap = {};
  for (const c of categorie) {
    catMap[c.nome] = c.id;
  }

  // ── 3. Pezzi magazzino ─────────────────────────────────────────────
  await knex('pezzi_magazzino').insert([
    {
      nome: 'Pastiglie freno anteriori',
      marca: 'Brembo',
      barcode: '8001234567890',
      categoria_id: catMap['Freni'],
      quantita: 12,
      prezzo_vendita: 45.0,
      prezzo_acquisto: 28.0,
      soglia_avviso: 3,
    },
    {
      nome: 'Disco freno ventilato',
      marca: 'Brembo',
      barcode: '8001234567891',
      categoria_id: catMap['Freni'],
      quantita: 8,
      prezzo_vendita: 85.0,
      soglia_avviso: 2,
    },
    {
      nome: 'Alternatore 12V',
      marca: 'Bosch',
      categoria_id: catMap['Elettrico'],
      quantita: 3,
      prezzo_vendita: 180.0,
      soglia_avviso: 1,
    },
    {
      nome: 'Batteria 60Ah',
      marca: 'Varta',
      barcode: '8001234567893',
      categoria_id: catMap['Elettrico'],
      quantita: 5,
      prezzo_vendita: 95.0,
      prezzo_acquisto: 65.0,
      soglia_avviso: 2,
    },
    {
      nome: 'Paraurti anteriore',
      categoria_id: catMap['Carrozzeria'],
      quantita: 2,
      prezzo_vendita: 250.0,
      soglia_avviso: 1,
    },
    {
      nome: 'Cinghia distribuzione',
      marca: 'Gates',
      categoria_id: catMap['Motore'],
      quantita: 6,
      prezzo_vendita: 35.0,
      soglia_avviso: 2,
    },
    {
      nome: 'Ammortizzatore anteriore',
      marca: 'Monroe',
      categoria_id: catMap['Sospensioni'],
      quantita: 4,
      prezzo_vendita: 120.0,
      soglia_avviso: 2,
    },
    {
      nome: 'Olio motore 5W30 1L',
      marca: 'Castrol',
      barcode: '8001234567897',
      categoria_id: catMap['Lubrificanti'],
      quantita: 25,
      prezzo_vendita: 12.0,
      prezzo_acquisto: 7.5,
      soglia_avviso: 5,
    },
    {
      nome: 'Filtro olio',
      marca: 'Mann',
      barcode: '8001234567898',
      categoria_id: catMap['Filtri'],
      quantita: 1,
      prezzo_vendita: 8.0,
      soglia_avviso: 3,
    },
    {
      nome: 'Filtro aria',
      marca: 'Mann',
      categoria_id: catMap['Filtri'],
      quantita: 10,
      prezzo_vendita: 15.0,
      soglia_avviso: 3,
    },
    {
      nome: 'Candela accensione',
      marca: 'NGK',
      barcode: '8001234567900',
      categoria_id: catMap['Motore'],
      quantita: 30,
      prezzo_vendita: 6.0,
      prezzo_acquisto: 3.5,
      soglia_avviso: 10,
    },
    {
      nome: 'Pompa acqua',
      categoria_id: catMap['Motore'],
      quantita: 2,
      prezzo_vendita: 95.0,
      soglia_avviso: 1,
    },
    {
      nome: 'Lampadina H7',
      marca: 'Philips',
      barcode: '8001234567902',
      categoria_id: catMap['Elettrico'],
      quantita: 15,
      prezzo_vendita: 8.5,
      soglia_avviso: 5,
    },
    {
      nome: 'Tergicristallo 600mm',
      marca: 'Bosch',
      categoria_id: catMap['Carrozzeria'],
      quantita: 8,
      prezzo_vendita: 18.0,
      soglia_avviso: 3,
    },
    {
      nome: 'Liquido freni DOT4 0.5L',
      categoria_id: catMap['Freni'],
      quantita: 0,
      prezzo_vendita: 9.0,
      soglia_avviso: 2,
    },
  ]);

  // ── 4. Clienti ─────────────────────────────────────────────────────
  await knex('clienti').insert([
    {
      nome: 'Mario Rossi',
      telefono: '02 123456',
      email: 'mario.rossi@email.it',
      codice_fiscale: 'RSSMRA80A01L378X',
      indirizzo: 'Via Roma 1, Milano',
    },
    {
      nome: 'Laura Bianchi',
      telefono: '02 234567',
      email: 'laura.bianchi@email.it',
      partita_iva: '01234567890',
      indirizzo: 'Via Mazzini 15, Roma',
    },
    {
      nome: 'Giuseppe Verdi',
      telefono: '02 345678',
      codice_fiscale: 'VRDGPP75B02L378Y',
      indirizzo: 'Corso Italia 22, Torino',
    },
    {
      nome: 'Anna Neri',
      telefono: '02 456789',
      email: 'anna.neri@email.it',
    },
    {
      nome: 'Meccanica Rossi SRL',
      telefono: '02 567890',
      partita_iva: '02345678901',
      email: 'info@meccanicarossi.it',
      indirizzo: 'Zona Industriale 5, Brescia',
    },
  ]);

  // ── 5. Update impostazioni_officina ────────────────────────────────
  await knex('impostazioni_officina')
    .update({
      nome: 'Officina Demo SRL',
      partita_iva: '01234567890',
      indirizzo: 'Via dell\'Artigianato 12, 20100 Milano (MI)',
      telefono: '02 999888',
      email: 'info@officinademo.it',
      aliquota_iva_default: 22,
    });

  // ── 6. Rapportini e Note di Lavorazione ──────────────────────────
  const utenti = await knex('utenti').select('id', 'nome');
  const clientiAll = await knex('clienti').select('id', 'nome');
  const pezzi = await knex('pezzi_magazzino').select('id', 'nome');

  const admin = utenti.find((u) => u.nome === 'Admin Demo');
  const marco = utenti.find((u) => u.nome === 'Marco');
  const cliente1 = clientiAll[0];
  const cliente2 = clientiAll[1];

  // Create a nota di lavorazione for cliente1
  const [nota] = await knex('note_lavorazione')
    .insert({
      cliente_id: cliente1.id,
      testo: 'Sostituzione freni anteriori e controllo impianto elettrico',
      mostra_dettagli: true,
    })
    .returning('*');

  // Righe rapportino — 3 gestite (associate alla nota), 2 aperte
  const righeData = [
    {
      utente_id: admin.id,
      cliente_id: cliente1.id,
      giorno: '2026-03-07',
      ora_inizio: '08:00',
      ora_fine: '12:00',
      macchina: 'Trattore John Deere 6130',
      note: 'Sostituzione pastiglie freno anteriori',
      nota_lavorazione_id: nota.id,
    },
    {
      utente_id: marco.id,
      cliente_id: cliente1.id,
      giorno: '2026-03-07',
      ora_inizio: '08:30',
      ora_fine: '11:30',
      macchina: 'Trattore John Deere 6130',
      note: 'Controllo alternatore e batteria',
      nota_lavorazione_id: nota.id,
    },
    {
      utente_id: admin.id,
      cliente_id: cliente1.id,
      giorno: '2026-03-08',
      ora_inizio: '14:00',
      ora_fine: '17:00',
      macchina: 'Sollevatore CAT TH407',
      note: 'Sostituzione cinghia distribuzione',
      nota_lavorazione_id: nota.id,
    },
    {
      utente_id: marco.id,
      cliente_id: cliente2.id,
      giorno: '2026-03-08',
      ora_inizio: '08:00',
      ora_fine: '13:00',
      macchina: 'Escavatore Komatsu PC55',
      note: 'Tagliando completo',
      nota_lavorazione_id: null,
    },
    {
      utente_id: admin.id,
      cliente_id: cliente2.id,
      giorno: '2026-03-09',
      ora_inizio: '09:00',
      ora_fine: '12:30',
      macchina: null,
      note: 'Controllo generale impianto idraulico',
      nota_lavorazione_id: null,
    },
  ];

  const righeInserite = await knex('righe_rapportino').insert(righeData).returning('*');

  // Materiali per le prime righe (da magazzino)
  if (pezzi.length >= 2) {
    await knex('materiali_rapportino').insert([
      {
        riga_rapportino_id: righeInserite[0].id,
        pezzo_id: pezzi[0].id,
        quantita: 2,
        fuori_magazzino: false,
      },
      {
        riga_rapportino_id: righeInserite[1].id,
        pezzo_id: pezzi[2]?.id || pezzi[1].id,
        quantita: 1,
        fuori_magazzino: false,
      },
      {
        riga_rapportino_id: righeInserite[3].id,
        nome_manuale: 'Tubo idraulico 3/4"',
        quantita: 3,
        fuori_magazzino: true,
      },
    ]);
  }
};
