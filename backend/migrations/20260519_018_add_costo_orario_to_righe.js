/**
 * Aggiunge il campo costo_orario_applicato alle righe di rapportino come snapshot
 * del costo orario dell'operaio al momento della creazione/modifica della riga.
 * Backfill iniziale dal costo_orario dell'utente autore.
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('righe_rapportino', (t) => {
    t.decimal('costo_orario_applicato', 10, 2).notNullable().defaultTo(0);
  });

  if (knex.client.config.client === 'pg') {
    await knex.raw(`
      UPDATE righe_rapportino AS r
      SET costo_orario_applicato = u.costo_orario
      FROM utenti AS u
      WHERE r.utente_id = u.id
    `);
  } else {
    await knex.raw(`
      UPDATE righe_rapportino
      SET costo_orario_applicato = (
        SELECT costo_orario FROM utenti WHERE utenti.id = righe_rapportino.utente_id
      )
    `);
  }
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function (knex) {
  await knex.schema.alterTable('righe_rapportino', (t) => {
    t.dropColumn('costo_orario_applicato');
  });
};
