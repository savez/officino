const { z } = require('zod');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const XLSX = require('xlsx');

const prodottoSchema = z.object({
  barcode: z.string().optional().nullable(),
  nome: z.string().min(1, 'Nome obbligatorio'),
  marca: z.string().optional().nullable(),
  modello: z.string().optional().nullable(),
  categoria_id: z.number().int().positive().optional().nullable(),
  prezzo_vendita: z.number().min(0, 'Prezzo vendita obbligatorio'),
  prezzo_acquisto: z.number().min(0).optional().nullable(),
});

/**
 * Catalogo Prodotti routes - CRUD + search + export
 * @param {import('fastify').FastifyInstance} app
 */
async function catalogoRoutes(app) {
  // List (paginated, with categoria join)
  app.get('/', { preHandler: [app.authenticate] }, async (request) => {
    const { page, perPage, offset } = parsePagination(request.query);
    const { categoria_id } = request.query;

    let query = app
      .db('catalogo_prodotti as p')
      .leftJoin('categorie as c', 'p.categoria_id', 'c.id')
      .select(
        'p.*',
        'c.nome as categoria_nome'
      );

    if (categoria_id) {
      query = query.where('p.categoria_id', categoria_id);
    }

    // Count
    const countQuery = query.clone().clearSelect().count('p.id as count').first();
    const { count } = await countQuery;

    // Data
    const rows = await query
      .clearOrder()
      .orderBy('p.nome', 'asc')
      .limit(perPage)
      .offset(offset);

    return paginatedResponse(rows, Number(count), page, perPage);
  });

  // Search
  app.get('/search', { preHandler: [app.authenticate] }, async (request) => {
    const { q, categoria_id } = request.query;
    const { page, perPage, offset } = parsePagination(request.query);

    if (!q || q.trim().length < 1) {
      return paginatedResponse([], 0, page, perPage);
    }

    const term = `%${q.trim()}%`;

    let query = app
      .db('catalogo_prodotti as p')
      .leftJoin('categorie as c', 'p.categoria_id', 'c.id')
      .select('p.*', 'c.nome as categoria_nome')
      .where(function () {
        this.whereILike('p.nome', term)
          .orWhereILike('p.marca', term)
          .orWhereILike('p.modello', term)
          .orWhereILike('p.barcode', term);
      });

    if (categoria_id) {
      query = query.andWhere('p.categoria_id', categoria_id);
    }

    const countQuery = query.clone().clearSelect().count('p.id as count').first();
    const { count } = await countQuery;

    const rows = await query
      .clearOrder()
      .orderBy('p.nome', 'asc')
      .limit(perPage)
      .offset(offset);

    return paginatedResponse(rows, Number(count), page, perPage);
  });

  // Get by barcode (for scanner)
  app.get('/barcode/:barcode', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { barcode } = request.params;
    const prodotto = await app
      .db('catalogo_prodotti as p')
      .leftJoin('categorie as c', 'p.categoria_id', 'c.id')
      .select('p.*', 'c.nome as categoria_nome')
      .where('p.barcode', barcode)
      .first();

    if (!prodotto) {
      return reply.status(404).send({ error: 'Prodotto non trovato con questo barcode' });
    }
    return prodotto;
  });

  // Get by ID
  app.get('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    const prodotto = await app
      .db('catalogo_prodotti as p')
      .leftJoin('categorie as c', 'p.categoria_id', 'c.id')
      .select('p.*', 'c.nome as categoria_nome')
      .where('p.id', id)
      .first();

    if (!prodotto) {
      return reply.status(404).send({ error: 'Prodotto non trovato' });
    }
    return prodotto;
  });

  // Create
  app.post('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = prodottoSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dati non validi', details: parsed.error.flatten() });
    }

    // Check barcode uniqueness
    if (parsed.data.barcode) {
      const existing = await app
        .db('catalogo_prodotti')
        .where({ barcode: parsed.data.barcode })
        .first();
      if (existing) {
        return reply.status(409).send({ error: 'Barcode già esistente nel catalogo' });
      }
    }

    // Check categoria exists
    if (parsed.data.categoria_id) {
      const cat = await app.db('categorie').where({ id: parsed.data.categoria_id }).first();
      if (!cat) {
        return reply.status(400).send({ error: 'Categoria non trovata' });
      }
    }

    const [prodotto] = await app.db('catalogo_prodotti').insert(parsed.data).returning('*');

    // Audit log: creazione prodotto
    try {
      await app.logModifica(app.db, {
        utente_id: request.user.id,
        entita: 'prodotto_catalogo',
        entita_id: prodotto.id,
        azione: 'creazione',
        dettaglio: { nome: prodotto.nome, barcode: prodotto.barcode },
      });
    } catch (logErr) {
      app.log.error({ err: logErr }, 'Failed to log modification');
    }

    return reply.status(201).send(prodotto);
  });

  // Update
  app.put('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    const parsed = prodottoSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dati non validi', details: parsed.error.flatten() });
    }

    const existing = await app.db('catalogo_prodotti').where({ id }).first();
    if (!existing) {
      return reply.status(404).send({ error: 'Prodotto non trovato' });
    }

    // Check barcode uniqueness (excluding current)
    if (parsed.data.barcode) {
      const duplicate = await app
        .db('catalogo_prodotti')
        .where({ barcode: parsed.data.barcode })
        .whereNot({ id })
        .first();
      if (duplicate) {
        return reply.status(409).send({ error: 'Barcode già esistente nel catalogo' });
      }
    }

    const [updated] = await app
      .db('catalogo_prodotti')
      .where({ id })
      .update({ ...parsed.data, updated_at: app.db.fn.now() })
      .returning('*');

    // Audit log: modifica prodotto
    try {
      const diff = app.computeDiff(existing, updated, ['nome', 'marca', 'modello', 'prezzo_vendita', 'prezzo_acquisto', 'categoria_id', 'barcode']);
      if (diff) {
        await app.logModifica(app.db, {
          utente_id: request.user.id,
          entita: 'prodotto_catalogo',
          entita_id: id,
          azione: 'modifica',
          dettaglio: diff,
        });
      }
    } catch (logErr) {
      app.log.error({ err: logErr }, 'Failed to log modification');
    }

    return updated;
  });

  // Delete
  app.delete('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    const existing = await app.db('catalogo_prodotti').where({ id }).first();
    if (!existing) {
      return reply.status(404).send({ error: 'Prodotto non trovato' });
    }

    // Audit log: eliminazione prodotto (before delete)
    try {
      await app.logModifica(app.db, {
        utente_id: request.user.id,
        entita: 'prodotto_catalogo',
        entita_id: id,
        azione: 'eliminazione',
        dettaglio: { nome: existing.nome, barcode: existing.barcode },
      });
    } catch (logErr) {
      app.log.error({ err: logErr }, 'Failed to log modification');
    }

    await app.db('catalogo_prodotti').where({ id }).del();
    return { message: 'Prodotto eliminato' };
  });

  // Export Excel
  app.get('/export/excel', { preHandler: [app.authenticate] }, async (request, reply) => {
    const rows = await app
      .db('catalogo_prodotti as p')
      .leftJoin('categorie as c', 'p.categoria_id', 'c.id')
      .select(
        'p.barcode',
        'p.nome',
        'p.marca',
        'p.modello',
        'c.nome as categoria',
        'p.prezzo_vendita',
        'p.prezzo_acquisto'
      )
      .orderBy('p.nome', 'asc');

    const data = rows.map((r) => ({
      Barcode: r.barcode || '',
      Nome: r.nome,
      Marca: r.marca || '',
      Modello: r.modello || '',
      Categoria: r.categoria || '',
      'Prezzo Vendita (€)': Number(r.prezzo_vendita).toFixed(2),
      'Prezzo Acquisto (€)': r.prezzo_acquisto ? Number(r.prezzo_acquisto).toFixed(2) : '',
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Catalogo Prodotti');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    reply.header('Content-Disposition', 'attachment; filename="catalogo_prodotti.xlsx"');
    return reply.send(buffer);
  });
}

module.exports = catalogoRoutes;
