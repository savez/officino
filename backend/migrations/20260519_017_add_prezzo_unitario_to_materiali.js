/**
 * Aggiunge il campo prezzo_unitario alla tabella materiali_rapportino come snapshot
 * del prezzo applicato al momento della riga. Backfill iniziale dal prezzo_vendita
 * del catalogo per i materiali a catalogo; i fuori catalogo restano a 0 di default.
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('materiali_rapportino', (t) => {
    t.decimal('prezzo_unitario', 10, 2).notNullable().defaultTo(0);
  });

  // Backfill cross-dialect: UPDATE...FROM è PostgreSQL-specific. Per SQLite
  // si usa una subquery correlata. Knex client.config.client distingue.
  if (knex.client.config.client === 'pg') {
    await knex.raw(`
      UPDATE materiali_rapportino AS m
      SET prezzo_unitario = c.prezzo_vendita
      FROM catalogo_prodotti AS c
      WHERE m.pezzo_id = c.id
    `);
  } else {
    await knex.raw(`
      UPDATE materiali_rapportino
      SET prezzo_unitario = (
        SELECT prezzo_vendita FROM catalogo_prodotti WHERE catalogo_prodotti.id = materiali_rapportino.pezzo_id
      )
      WHERE pezzo_id IS NOT NULL
    `);
  }
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function (knex) {
  await knex.schema.alterTable('materiali_rapportino', (t) => {
    t.dropColumn('prezzo_unitario');
  });
};
