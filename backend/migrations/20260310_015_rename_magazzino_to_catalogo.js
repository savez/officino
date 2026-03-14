/**
 * Rename pezzi_magazzino → catalogo_prodotti
 * Drop quantita and soglia_avviso columns
 * Rename fuori_magazzino → fuori_catalogo in materiali_rapportino
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async function (knex) {
  await knex.schema.renameTable('pezzi_magazzino', 'catalogo_prodotti');

  await knex.schema.alterTable('catalogo_prodotti', (table) => {
    table.dropColumn('quantita');
    table.dropColumn('soglia_avviso');
  });

  await knex.schema.alterTable('materiali_rapportino', (table) => {
    table.renameColumn('fuori_magazzino', 'fuori_catalogo');
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function (knex) {
  await knex.schema.alterTable('materiali_rapportino', (table) => {
    table.renameColumn('fuori_catalogo', 'fuori_magazzino');
  });

  await knex.schema.alterTable('catalogo_prodotti', (table) => {
    table.integer('quantita').notNullable().defaultTo(0);
    table.integer('soglia_avviso').notNullable().defaultTo(1);
  });

  await knex.schema.renameTable('catalogo_prodotti', 'pezzi_magazzino');
};
