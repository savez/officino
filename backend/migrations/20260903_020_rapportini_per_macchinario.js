/**
 * Feature 019 — Il rapportino diventa il contenitore delle lavorazioni svolte da
 * un operaio su un solo macchinario per un solo cliente.
 *
 * È una modifica non retrocompatibile e i dati esistenti vengono ELIMINATI, per
 * scelta esplicita dell'utente (FR-031). Non esiste un percorso di conversione:
 * le righe di rapportino odierne non vengono ricondotte a rapportini.
 *
 * Le tre azioni sono tenute separate e ciascuna dichiara quante righe ha
 * toccato (FR-032, FR-037). I conteggi sono letti PRIMA delle cancellazioni:
 * letti dopo restituirebbero zero, e il registro direbbe "eliminate 0 righe"
 * mentre il database si svuota — il requisito rispettato alla lettera e inutile
 * nei fatti.
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async function (knex) {
  // ── Conteggi, prima di qualunque cancellazione ────────────────────────────
  const conta = async (tabella) => {
    if (!(await knex.schema.hasTable(tabella))) return 0;
    const [riga] = await knex(tabella).count('* as n');
    return Number(riga.n);
  };

  const materialiPrima = await conta('materiali_rapportino');
  const righePrima = await conta('righe_rapportino');
  const notePrima = await conta('note_lavorazione');

  // ── Azione 1: le tabelle delle righe e dei materiali vengono distrutte ────
  await knex.schema.dropTableIfExists('materiali_rapportino');
  await knex.schema.dropTableIfExists('righe_rapportino');
  console.log(
    `[019] Tabelle distrutte: righe_rapportino (${righePrima} righe), ` +
      `materiali_rapportino (${materialiPrima} righe).`,
  );

  // ── Azione 2: di note_lavorazione si cancellano le RIGHE, non la tabella ──
  // La sua forma non cambia: mostra_dettagli e le opzioni PDF della migrazione
  // 019 restano. FR-031 la elenca accanto alle altre due e sembra chiedere lo
  // stesso trattamento; non è così.
  if (notePrima > 0) {
    await knex('note_lavorazione').del();
  }
  console.log(`[019] Note di lavorazione: eliminate ${notePrima} righe, tabella conservata.`);

  // ── Azione 3: la struttura nuova ──────────────────────────────────────────
  await knex.schema.createTable('rapportini', (table) => {
    table.increments('id').primary();
    table.integer('utente_id').unsigned().notNullable().references('id').inTable('utenti');
    table.integer('cliente_id').unsigned().notNullable().references('id').inTable('clienti');

    // Testo libero per scelta esplicita: nessuna anagrafica macchinari.
    // Conservato come l'operaio l'ha scritto — la normalizzazione serve al
    // confronto per l'avviso duplicati, non alla memorizzazione (FR-024b).
    table.string('macchina').notNullable();

    // Lo stato NON è una colonna. Si deriva da questi due campi:
    //   nota_lavorazione_id valorizzato -> gestito
    //   chiuso_il valorizzato           -> chiuso
    //   nessuno dei due                 -> aperto
    // Una colonna `stato` accanto a nota_lavorazione_id rappresenterebbe due
    // volte lo stesso fatto, e basterebbe un endpoint distratto per farli
    // divergere senza che nulla lo segnali.
    table.timestamp('chiuso_il').nullable();
    table
      .integer('nota_lavorazione_id')
      .unsigned()
      .references('id')
      .inTable('note_lavorazione')
      .onDelete('SET NULL');
    table.timestamps(true, true);

    table.index('utente_id', 'idx_rapportini_utente');
    table.index('cliente_id', 'idx_rapportini_cliente');
    table.index('nota_lavorazione_id', 'idx_rapportini_nota');
    table.index(['cliente_id', 'utente_id'], 'idx_rapportini_cliente_utente');
  });

  await knex.schema.createTable('lavorazioni', (table) => {
    table.increments('id').primary();
    table
      .integer('rapportino_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('rapportini')
      .onDelete('CASCADE');
    table.date('giorno').notNullable();

    // Numero di ore al posto della fascia oraria (FR-004). decimal(5,2) regge
    // fino a 999,99: è un tetto di memorizzazione, e come tale va respinto in
    // validazione con un 400 leggibile invece di arrivare qui e fallire con un
    // errore del driver.
    table.decimal('ore', 5, 2).notNullable();
    table.text('note');

    // Fotografia del costo orario al momento della registrazione, sulla singola
    // lavorazione e non sul rapportino: un intervento può durare settimane, e
    // congelarlo alla creazione prezzerebbe tutto con la tariffa del primo
    // giorno (FR-006a).
    table.decimal('costo_orario_applicato', 10, 2).notNullable().defaultTo(0);
    table.timestamps(true, true);

    table.index('rapportino_id', 'idx_lavorazioni_rapportino');
    table.index('giorno', 'idx_lavorazioni_giorno');
  });

  await knex.schema.createTable('materiali_lavorazione', (table) => {
    table.increments('id').primary();
    table
      .integer('lavorazione_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('lavorazioni')
      .onDelete('CASCADE');
    // catalogo_prodotti, non pezzi_magazzino: la tabella e' stata rinominata
    // dalla migrazione 015. La 014 la chiamava ancora col nome vecchio.
    table.integer('pezzo_id').unsigned().references('id').inTable('catalogo_prodotti');
    table.string('nome_manuale');
    table.integer('quantita').notNullable().defaultTo(1);
    // fuori_catalogo, non fuori_magazzino: rinominato dalla migrazione 015
    // insieme alla tabella. Il nome vecchio sopravviveva solo nella 014.
    table.boolean('fuori_catalogo').notNullable().defaultTo(false);
    table.decimal('prezzo_unitario', 10, 2).notNullable().defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('lavorazione_id', 'idx_materiali_lavorazione_lavorazione');
    table.index('pezzo_id', 'idx_materiali_lavorazione_pezzo');
  });

  console.log('[019] Create: rapportini, lavorazioni, materiali_lavorazione.');
};

/**
 * Riporta lo SCHEMA allo stato precedente: distrugge le tre tabelle nuove e
 * ricostruisce `righe_rapportino` e `materiali_rapportino` nella forma che
 * avevano dopo le migrazioni 014, 015, 017 e 018.
 *
 * ATTENZIONE: ricostruisce la STRUTTURA, non i DATI. Le righe di rapportino e
 * le note di lavorazione eliminate dalla `up` sono perse in via definitiva.
 * Le tabelle tornano, vuote.
 *
 * La ricostruzione non è un vezzo: senza, il rollback delle migrazioni
 * precedenti fallirebbe. La 018 elimina una colonna da `righe_rapportino` e la
 * 017 da `materiali_rapportino`, e non possono farlo su tabelle che non
 * esistono più. È esattamente ciò che accadeva prima di questa correzione, con
 * l'intera suite di integrazione che falliva in fase di smontaggio pur avendo
 * tutti i test verdi.
 *
 * @param {import('knex').Knex} knex
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('materiali_lavorazione');
  await knex.schema.dropTableIfExists('lavorazioni');
  await knex.schema.dropTableIfExists('rapportini');

  await knex.schema.createTable('righe_rapportino', (table) => {
    table.increments('id').primary();
    table.integer('utente_id').unsigned().notNullable().references('id').inTable('utenti');
    table.integer('cliente_id').unsigned().notNullable().references('id').inTable('clienti');
    table.date('giorno').notNullable();
    table.time('ora_inizio').notNullable();
    table.time('ora_fine').notNullable();
    table.string('macchina');
    table.text('note');
    table
      .integer('nota_lavorazione_id')
      .unsigned()
      .references('id')
      .inTable('note_lavorazione')
      .onDelete('SET NULL');
    // Aggiunta dalla migrazione 018: dev'esserci, altrimenti il suo rollback
    // non trova la colonna da eliminare.
    table.decimal('costo_orario_applicato', 10, 2).notNullable().defaultTo(0);
    table.timestamps(true, true);

    table.index('utente_id', 'idx_righe_rapportino_utente');
    table.index('cliente_id', 'idx_righe_rapportino_cliente');
    table.index('giorno', 'idx_righe_rapportino_giorno');
    table.index('nota_lavorazione_id', 'idx_righe_rapportino_nota');
  });

  await knex.schema.createTable('materiali_rapportino', (table) => {
    table.increments('id').primary();
    table
      .integer('riga_rapportino_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('righe_rapportino')
      .onDelete('CASCADE');
    table.integer('pezzo_id').unsigned().references('id').inTable('catalogo_prodotti');
    table.string('nome_manuale');
    table.integer('quantita').notNullable().defaultTo(1);
    // Rinominata dalla 015, e la sua `down` la riporta a fuori_magazzino.
    table.boolean('fuori_catalogo').notNullable().defaultTo(false);
    // Aggiunta dalla 017.
    table.decimal('prezzo_unitario', 10, 2).notNullable().defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('riga_rapportino_id', 'idx_materiali_rapportino_riga');
    table.index('pezzo_id', 'idx_materiali_rapportino_pezzo');
  });
};
