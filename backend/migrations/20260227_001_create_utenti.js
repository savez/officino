/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function (knex) {
  await knex.schema.createTable('utenti', (table) => {
    table.increments('id').primary();
    table.string('nome').notNullable();
    table.string('email').notNullable().unique();
    table.string('password_hash').notNullable();
    table.string('ruolo').notNullable().defaultTo('user');
    table.decimal('costo_orario', 10, 2).notNullable().defaultTo(0);
    table.timestamps(true, true);
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('utenti');
};
