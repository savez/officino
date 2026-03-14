/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('impostazioni_officina', (table) => {
    table.text('logo_base64'); // data URI: "data:image/png;base64,..."
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function (knex) {
  await knex.schema.alterTable('impostazioni_officina', (table) => {
    table.dropColumn('logo_base64');
  });
};
