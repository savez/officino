/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function (knex) {
    await knex.schema.createTable('note_lavorazione', (table) => {
        table.increments('id').primary();
        table
            .integer('cliente_id')
            .unsigned()
            .notNullable()
            .references('id')
            .inTable('clienti');
        table.text('testo');
        table.boolean('mostra_dettagli').notNullable().defaultTo(true);
        table.timestamps(true, true);

        table.index('cliente_id', 'idx_note_lavorazione_cliente');
    });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('note_lavorazione');
};
