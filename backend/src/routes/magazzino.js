const { z } = require('zod');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const XLSX = require('xlsx');

const pezzoSchema = z.object({
  barcode: z.string().optional().nullable(),
  nome: z.string().min(1, 'Nome obbligatorio'),
  marca: z.string().optional().nullable(),
  modello: z.string().optional().nullable(),
  categoria_id: z.number().int().positive().optional().nullable(),
  quantita: z.number().int().min(0).default(0),
  soglia_avviso: z.number().int().min(0).default(1),
  prezzo_vendita: z.number().min(0, 'Prezzo vendita obbligatorio'),
  prezzo_acquisto: z.number().min(0).optional().nullable(),
});

/**
 * Adds sotto_soglia flag to each row
 * @param {Array} rows
 * @returns {Array}
 */
function addSogliaFlag(rows) {
  return rows.map((row) => ({
    ...row,
    sotto_soglia: row.quantita <= row.soglia_avviso,
  }));
}

/**
 * Magazzino routes - CRUD + search + export
 * @param {import('fastify').FastifyInstance} app
 */
async function magazzinoRoutes(app) {
  // List (paginated, with categoria join and sotto_soglia flag)
  app.get('/', { preHandler: [app.authenticate] }, async (request) => {
    const { page, perPage, offset } = parsePagination(request.query);
    const { categoria_id, sotto_soglia } = request.query;

    let query = app
      .db('pezzi_magazzino as p')
      .leftJoin('categorie as c', 'p.categoria_id', 'c.id')
      .select(
        'p.*',
        'c.nome as categoria_nome'
      );

    if (categoria_id) {
      query = query.where('p.categoria_id', categoria_id);
    }

    if (sotto_soglia === 'true') {
      query = query.whereRaw('p.quantita <= p.soglia_avviso');
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

    return paginatedResponse(addSogliaFlag(rows), Number(count), page, perPage);
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
      .db('pezzi_magazzino as p')
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

    return paginatedResponse(addSogliaFlag(rows), Number(count), page, perPage);
  });

  // Get by barcode (for scanner)
  app.get('/barcode/:barcode', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { barcode } = request.params;
    const pezzo = await app
      .db('pezzi_magazzino as p')
      .leftJoin('categorie as c', 'p.categoria_id', 'c.id')
      .select('p.*', 'c.nome as categoria_nome')
      .where('p.barcode', barcode)
      .first();

    if (!pezzo) {
      return reply.status(404).send({ error: 'Pezzo non trovato con questo barcode' });
    }
    return { ...pezzo, sotto_soglia: pezzo.quantita <= pezzo.soglia_avviso };
  });

  // Get by ID
  app.get('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    const pezzo = await app
      .db('pezzi_magazzino as p')
      .leftJoin('categorie as c', 'p.categoria_id', 'c.id')
      .select('p.*', 'c.nome as categoria_nome')
      .where('p.id', id)
      .first();

    if (!pezzo) {
      return reply.status(404).send({ error: 'Pezzo non trovato' });
    }
    return { ...pezzo, sotto_soglia: pezzo.quantita <= pezzo.soglia_avviso };
  });

  // Create
  app.post('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = pezzoSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dati non validi', details: parsed.error.flatten() });
    }

    // Check barcode uniqueness
    if (parsed.data.barcode) {
      const existing = await app
        .db('pezzi_magazzino')
        .where({ barcode: parsed.data.barcode })
        .first();
      if (existing) {
        return reply.status(409).send({ error: 'Barcode già esistente in magazzino' });
      }
    }

    // Check categoria exists
    if (parsed.data.categoria_id) {
      const cat = await app.db('categorie').where({ id: parsed.data.categoria_id }).first();
      if (!cat) {
        return reply.status(400).send({ error: 'Categoria non trovata' });
      }
    }

    const [pezzo] = await app.db('pezzi_magazzino').insert(parsed.data).returning('*');

    // Audit log: creazione pezzo
    try {
      await app.logModifica(app.db, {
        utente_id: request.user.id,
        entita: 'pezzo_magazzino',
        entita_id: pezzo.id,
        azione: 'creazione',
        dettaglio: { nome: pezzo.nome, barcode: pezzo.barcode },
      });
    } catch (logErr) {
      app.log.error({ err: logErr }, 'Failed to log modification');
    }

    return reply.status(201).send({
      ...pezzo,
      sotto_soglia: pezzo.quantita <= pezzo.soglia_avviso,
    });
  });

  // Update
  app.put('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    const parsed = pezzoSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dati non validi', details: parsed.error.flatten() });
    }

    const existing = await app.db('pezzi_magazzino').where({ id }).first();
    if (!existing) {
      return reply.status(404).send({ error: 'Pezzo non trovato' });
    }

    // Check barcode uniqueness (excluding current)
    if (parsed.data.barcode) {
      const duplicate = await app
        .db('pezzi_magazzino')
        .where({ barcode: parsed.data.barcode })
        .whereNot({ id })
        .first();
      if (duplicate) {
        return reply.status(409).send({ error: 'Barcode già esistente in magazzino' });
      }
    }

    const [updated] = await app
      .db('pezzi_magazzino')
      .where({ id })
      .update({ ...parsed.data, updated_at: app.db.fn.now() })
      .returning('*');

    // Audit log: modifica pezzo
    try {
      const diff = app.computeDiff(existing, updated, ['nome', 'marca', 'modello', 'quantita', 'prezzo_vendita', 'prezzo_acquisto', 'categoria_id', 'soglia_avviso', 'barcode']);
      if (diff) {
        await app.logModifica(app.db, {
          utente_id: request.user.id,
          entita: 'pezzo_magazzino',
          entita_id: id,
          azione: 'modifica',
          dettaglio: diff,
        });
      }
    } catch (logErr) {
      app.log.error({ err: logErr }, 'Failed to log modification');
    }

    return { ...updated, sotto_soglia: updated.quantita <= updated.soglia_avviso };
  });

  // Delete
  app.delete('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    const existing = await app.db('pezzi_magazzino').where({ id }).first();
    if (!existing) {
      return reply.status(404).send({ error: 'Pezzo non trovato' });
    }

    // Audit log: eliminazione pezzo (before delete)
    try {
      await app.logModifica(app.db, {
        utente_id: request.user.id,
        entita: 'pezzo_magazzino',
        entita_id: id,
        azione: 'eliminazione',
        dettaglio: { nome: existing.nome, barcode: existing.barcode },
      });
    } catch (logErr) {
      app.log.error({ err: logErr }, 'Failed to log modification');
    }

    await app.db('pezzi_magazzino').where({ id }).del();
    return { message: 'Pezzo eliminato' };
  });

  // Export Excel
  app.get('/export/excel', { preHandler: [app.authenticate] }, async (request, reply) => {
    const rows = await app
      .db('pezzi_magazzino as p')
      .leftJoin('categorie as c', 'p.categoria_id', 'c.id')
      .select(
        'p.barcode',
        'p.nome',
        'p.marca',
        'p.modello',
        'c.nome as categoria',
        'p.quantita',
        'p.soglia_avviso',
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
      Quantità: r.quantita,
      'Soglia Avviso': r.soglia_avviso,
      'Prezzo Vendita (€)': Number(r.prezzo_vendita).toFixed(2),
      'Prezzo Acquisto (€)': r.prezzo_acquisto ? Number(r.prezzo_acquisto).toFixed(2) : '',
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Magazzino');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    reply.header('Content-Disposition', 'attachment; filename="magazzino.xlsx"');
    return reply.send(buffer);
  });
}

module.exports = magazzinoRoutes;
