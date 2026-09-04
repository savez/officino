/**
 * La nota di lavorazione diventa un documento con una propria
 * data di riferimento, due dettagli indipendenti, totali imponibili per sezione
 * e la possibilità di dividere per macchinario.
 *
 * Le colonne `modalita_pdf` e `mostra_dettagli` spariscono: due valori non sanno
 * esprimere "manodopera sì, materiali no", e tenere `mostra_dettagli` accanto a
 * due booleani darebbe tre campi per due decisioni.
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('note_lavorazione', (t) => {
    // Nullable in creazione: viene riempita subito dopo per le note esistenti,
    // e resa obbligatoria a valle. Aggiungerla NOT NULL su una tabella popolata
    // fallirebbe.
    t.date('data_riferimento').nullable();
    t.boolean('mostra_dettaglio_materiali').notNullable().defaultTo(false);
    t.boolean('mostra_dettaglio_manodopera').notNullable().defaultTo(false);
    t.decimal('totale_materiali_override', 12, 2).nullable();
    t.decimal('totale_manodopera_override', 12, 2).nullable();
    t.string('divisione', 20).notNullable().defaultTo('unita');
    t.boolean('riassunto_personalizzato').notNullable().defaultTo(false);
  });

  // ── Conversione delle note esistenti ──────────────────────────────────────
  //
  // Non basta che restino stampabili: il documento NON DEVE CAMBIARE ASPETTO. Le tre scelte che contano sono qui sotto, e vanno lette
  // PRIMA di eliminare le colonne vecchie.
  const esistenti = await knex('note_lavorazione').select(
    'id',
    'created_at',
    'mostra_dettagli',
    'modalita_pdf',
    'testo',
  );

  for (const nota of esistenti) {
    await knex('note_lavorazione')
      .where({ id: nota.id })
      .update({
        // Il documento vecchio stampava gia' created_at nel sottotitolo: usarla
        // fa cambiare la forma del titolo, non la data.
        data_riferimento: nota.created_at,

        // Riproduce esattamente cio' che si vedeva prima.
        mostra_dettaglio_materiali: Boolean(
          nota.mostra_dettagli && nota.modalita_pdf === 'dettaglio_materiali',
        ),

        // SEMPRE falso. Nel documento vecchio la manodopera non compariva mai
        // come voce propria: accenderla farebbe dire a una ristampa qualcosa
        // che l'originale non diceva.
        mostra_dettaglio_manodopera: false,

        divisione: 'unita',

        // VERO, ed e' la riga meno ovvia. Il testo delle note esistenti e' stato
        // scritto a mano: marcarlo automatico lo esporrebbe a essere
        // rigenerato al primo cambio di selezione, che e' esattamente cio'
        // che si vuole impedire.
        riassunto_personalizzato: true,
      });
  }

  console.log(`[022] Convertite ${esistenti.length} note di lavorazione.`);

  // ── Eliminazione delle colonne superate, DOPO la conversione ──────────────
  await knex.schema.alterTable('note_lavorazione', (t) => {
    t.dropColumn('modalita_pdf');
    t.dropColumn('mostra_dettagli');
  });

  // Ora che ogni riga ha un valore, la data puo' diventare obbligatoria.
  if (knex.client.config.client === 'pg') {
    await knex.raw('ALTER TABLE note_lavorazione ALTER COLUMN data_riferimento SET NOT NULL');
  }
  // Su SQLite l'obbligatorieta' resta affidata agli schemi Zod, come gia'
  // avviene per gli altri vincoli: un ALTER COLUMN non e' disponibile e
  // ricostruire la tabella per questo non varrebbe il rischio.
};

/**
 * Ripristina lo schema precedente, riconvertendo i due booleani nella scelta a
 * due valori.
 *
 * ATTENZIONE: la conversione a ritroso PERDE informazione. `mostra_dettaglio_manodopera`
 * non ha alcun corrispondente nel modello vecchio, quindi una nota che mostrava
 * la manodopera torna indietro come se non l'avesse mai mostrata. Perdono anche
 * i due totali imposti di sezione, la divisione per macchinario e la data di
 * riferimento, che tornera' a essere la data di creazione.
 *
 * @param {import('knex').Knex} knex
 */
exports.down = async function (knex) {
  await knex.schema.alterTable('note_lavorazione', (t) => {
    t.string('modalita_pdf', 32).notNullable().defaultTo('dettaglio_materiali');
    t.boolean('mostra_dettagli').notNullable().defaultTo(true);
  });

  const esistenti = await knex('note_lavorazione').select(
    'id',
    'mostra_dettaglio_materiali',
  );

  for (const nota of esistenti) {
    await knex('note_lavorazione')
      .where({ id: nota.id })
      .update({
        modalita_pdf: nota.mostra_dettaglio_materiali ? 'dettaglio_materiali' : 'solo_totale',
        mostra_dettagli: Boolean(nota.mostra_dettaglio_materiali),
      });
  }

  await knex.schema.alterTable('note_lavorazione', (t) => {
    t.dropColumn('data_riferimento');
    t.dropColumn('mostra_dettaglio_materiali');
    t.dropColumn('mostra_dettaglio_manodopera');
    t.dropColumn('totale_materiali_override');
    t.dropColumn('totale_manodopera_override');
    t.dropColumn('divisione');
    t.dropColumn('riassunto_personalizzato');
  });
};
