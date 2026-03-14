/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function (knex) {
  await knex.schema.createTable('preventivo_pezzi', (table) => {
    table.increments('id').primary();
    table
      .integer('preventivo_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('preventivi')
      .onDelete('CASCADE');
    table
      .integer('pezzo_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('pezzi_magazzino');
    table.integer('quantita').notNullable();
    table.decimal('prezzo_unitario', 10, 2).notNullable();
    table.text('note');
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('preventivo_pezzi');
};
