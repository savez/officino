/**
 * Add fuori_catalogo support to preventivo_pezzi
 * - Make pezzo_id nullable
 * - Add nome_manuale column
 * - Add fuori_catalogo boolean column
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('preventivo_pezzi', (table) => {
    table.integer('pezzo_id').unsigned().nullable().alter();
    table.string('nome_manuale').nullable();
    table.boolean('fuori_catalogo').notNullable().defaultTo(false);
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function (knex) {
  await knex.schema.alterTable('preventivo_pezzi', (table) => {
    table.dropColumn('fuori_catalogo');
    table.dropColumn('nome_manuale');
    table.integer('pezzo_id').unsigned().notNullable().alter();
  });
};
