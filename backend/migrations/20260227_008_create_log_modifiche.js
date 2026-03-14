/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function (knex) {
  await knex.schema.createTable('log_modifiche', (table) => {
    table.increments('id').primary();
    table
      .integer('utente_id')
      .unsigned()
      .references('id')
      .inTable('utenti');
    table.string('entita').notNullable(); // 'preventivo' | 'pezzo_magazzino' | 'cliente' | 'impostazioni'
    table.integer('entita_id').notNullable(); // ID of the modified record
    table.string('azione').notNullable(); // 'creazione' | 'modifica' | 'eliminazione' | 'cambio_stato' | 'scalatura'
    table.jsonb('dettaglio'); // details of the change (before/after values)
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });

  // Index for fast lookups
  await knex.schema.raw(
    'CREATE INDEX idx_log_modifiche_entita ON log_modifiche (entita, entita_id)'
  );
  await knex.schema.raw(
    'CREATE INDEX idx_log_modifiche_utente ON log_modifiche (utente_id)'
  );
  await knex.schema.raw(
    'CREATE INDEX idx_log_modifiche_created ON log_modifiche (created_at DESC)'
  );
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('log_modifiche');
};
