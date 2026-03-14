/**
 * Add operaio_id to preventivi to track which user performs the work
 * (separate from utente_id which tracks who created the quote)
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('preventivi', (table) => {
    table
      .integer('operaio_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('utenti')
      .after('utente_id');
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function (knex) {
  await knex.schema.alterTable('preventivi', (table) => {
    table.dropColumn('operaio_id');
  });
};
