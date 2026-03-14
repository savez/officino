/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function (knex) {
  await knex.schema.createTable('pezzi_magazzino', (table) => {
    table.increments('id').primary();
    table.string('barcode').unique(); // EAN-13 o codice manuale, nullable
    table.string('nome').notNullable();
    table.string('marca');
    table.string('modello');
    table
      .integer('categoria_id')
      .unsigned()
      .references('id')
      .inTable('categorie')
      .onDelete('SET NULL');
    table.integer('quantita').notNullable().defaultTo(0);
    table.integer('soglia_avviso').notNullable().defaultTo(1);
    table.decimal('prezzo_vendita', 10, 2).notNullable();
    table.decimal('prezzo_acquisto', 10, 2); // opzionale
    table.timestamps(true, true);
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('pezzi_magazzino');
};
