/**
 * Estende note_lavorazione con le opzioni di rendering PDF:
 * - modalita_pdf: 'dettaglio_materiali' (default) | 'solo_totale' (CHECK constraint)
 * - totale_override: importo che, se non NULL, sovrascrive il totale calcolato
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('note_lavorazione', (t) => {
    t.string('modalita_pdf', 32).notNullable().defaultTo('dettaglio_materiali');
    t.decimal('totale_override', 12, 2).nullable();
  });

  // CHECK constraint via knex API: cross-dialect (PostgreSQL + SQLite).
  if (knex.client.config.client === 'pg') {
    await knex.raw(`
      ALTER TABLE note_lavorazione
      ADD CONSTRAINT note_lavorazione_modalita_pdf_check
      CHECK (modalita_pdf IN ('dettaglio_materiali','solo_totale'))
    `);
  }
  // SQLite cannot ADD CHECK constraints via ALTER TABLE; validation lives
  // in the Zod schemas at the API layer, which is sufficient for tests.
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function (knex) {
  if (knex.client.config.client === 'pg') {
    await knex.raw(`
      ALTER TABLE note_lavorazione
      DROP CONSTRAINT IF EXISTS note_lavorazione_modalita_pdf_check
    `);
  }
  await knex.schema.alterTable('note_lavorazione', (t) => {
    t.dropColumn('totale_override');
    t.dropColumn('modalita_pdf');
  });
};
