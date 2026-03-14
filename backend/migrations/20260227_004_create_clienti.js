/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function (knex) {
  await knex.schema.createTable('clienti', (table) => {
    table.increments('id').primary();
    table.string('nome').notNullable();
    table.string('telefono');
    table.string('email');
    table.text('indirizzo');
    table.string('codice_fiscale');
    table.string('partita_iva');
    table.text('note');
    table.boolean('archiviato').notNullable().defaultTo(false);
    table.timestamps(true, true);
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('clienti');
};
