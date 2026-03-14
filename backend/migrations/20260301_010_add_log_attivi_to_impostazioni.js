/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('impostazioni_officina', (table) => {
    table.boolean('log_attivi').notNullable().defaultTo(true);
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function (knex) {
  await knex.schema.alterTable('impostazioni_officina', (table) => {
    table.dropColumn('log_attivi');
  });
};
