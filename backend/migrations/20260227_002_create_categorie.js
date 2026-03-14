/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function (knex) {
  await knex.schema.createTable('categorie', (table) => {
    table.increments('id').primary();
    table.string('nome').notNullable().unique();
    table.text('descrizione');
    table.timestamps(true, true);
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('categorie');
};
