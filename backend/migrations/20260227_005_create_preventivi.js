/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function (knex) {
  await knex.schema.createTable('preventivi', (table) => {
    table.increments('id').primary();
    table.string('numero').unique().notNullable(); // formato ANNO/NUM
    table
      .integer('cliente_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('clienti');
    table
      .integer('utente_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('utenti');
    table.date('data').notNullable();
    table.string('stato').notNullable().defaultTo('bozza'); // bozza | approvato | rifiutato | scaduto | fatturato
    table.decimal('manodopera_ore', 10, 2).defaultTo(0);
    table.decimal('manodopera_costo_orario', 10, 2).defaultTo(0);
    table.decimal('manodopera_totale', 10, 2).defaultTo(0);
    table.string('sconto_tipo').defaultTo('fisso'); // 'fisso' | 'percentuale'
    table.decimal('sconto_valore', 10, 2).defaultTo(0);
    table.decimal('sconto_calcolato', 10, 2).defaultTo(0);
    table.decimal('aliquota_iva', 5, 2).defaultTo(22);
    table.decimal('imponibile', 10, 2).defaultTo(0);
    table.decimal('imponibile_netto', 10, 2).defaultTo(0);
    table.decimal('iva', 10, 2).defaultTo(0);
    table.decimal('totale', 10, 2).defaultTo(0);
    table.text('note');
    table.timestamps(true, true);
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('preventivi');
};
