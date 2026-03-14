/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function (knex) {
  await knex.schema.createTable('impostazioni_officina', (table) => {
    table.increments('id').primary();
    table.string('nome').notNullable();
    table.string('partita_iva');
    table.text('indirizzo');
    table.string('telefono');
    table.string('email');
    table.string('logo_url'); // path to uploaded logo file
    table.decimal('aliquota_iva_default', 5, 2).defaultTo(22);
    table.timestamps(true, true);
  });

  // Insert default row
  await knex('impostazioni_officina').insert({
    nome: 'La Mia Officina',
    aliquota_iva_default: 22,
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('impostazioni_officina');
};
