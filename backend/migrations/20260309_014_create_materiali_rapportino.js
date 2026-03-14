/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function (knex) {
    await knex.schema.createTable('materiali_rapportino', (table) => {
        table.increments('id').primary();
        table
            .integer('riga_rapportino_id')
            .unsigned()
            .notNullable()
            .references('id')
            .inTable('righe_rapportino')
            .onDelete('CASCADE');
        table
            .integer('pezzo_id')
            .unsigned()
            .references('id')
            .inTable('pezzi_magazzino');
        table.string('nome_manuale');
        table.integer('quantita').notNullable().defaultTo(1);
        table.boolean('fuori_magazzino').notNullable().defaultTo(false);
        table.timestamp('created_at').defaultTo(knex.fn.now());

        table.index('riga_rapportino_id', 'idx_materiali_rapportino_riga');
        table.index('pezzo_id', 'idx_materiali_rapportino_pezzo');
    });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('materiali_rapportino');
};
