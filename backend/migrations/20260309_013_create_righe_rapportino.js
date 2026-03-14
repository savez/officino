/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function (knex) {
    await knex.schema.createTable('righe_rapportino', (table) => {
        table.increments('id').primary();
        table
            .integer('utente_id')
            .unsigned()
            .notNullable()
            .references('id')
            .inTable('utenti');
        table
            .integer('cliente_id')
            .unsigned()
            .notNullable()
            .references('id')
            .inTable('clienti');
        table.date('giorno').notNullable();
        table.time('ora_inizio').notNullable();
        table.time('ora_fine').notNullable();
        table.string('macchina');
        table.text('note');
        table
            .integer('nota_lavorazione_id')
            .unsigned()
            .references('id')
            .inTable('note_lavorazione')
            .onDelete('SET NULL');
        table.timestamps(true, true);

        table.index('utente_id', 'idx_righe_rapportino_utente');
        table.index('cliente_id', 'idx_righe_rapportino_cliente');
        table.index('giorno', 'idx_righe_rapportino_giorno');
        table.index('nota_lavorazione_id', 'idx_righe_rapportino_nota');
    });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('righe_rapportino');
};
