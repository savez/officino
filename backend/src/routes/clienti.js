const { z } = require('zod');
const { parsePagination, paginatedResponse } = require('../utils/pagination');

const clienteSchema = z.object({
  nome: z.string().min(1, 'Nome obbligatorio'),
  telefono: z.string().optional().nullable(),
  email: z.string().email('Email non valida').optional().nullable().or(z.literal('')),
  indirizzo: z.string().optional().nullable(),
  codice_fiscale: z.string().optional().nullable(),
  partita_iva: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

/**
 * Clienti routes - CRUD + search + soft delete (archiviazione)
 * @param {import('fastify').FastifyInstance} app
 */
async function clientiRoutes(app) {
  // List (paginated, with optional archiviati filter)
  app.get('/', { preHandler: [app.authenticate] }, async (request) => {
    const { page, perPage, offset } = parsePagination(request.query);
    const { archiviati } = request.query;

    let query = app.db('clienti');

    // By default, exclude archived clients unless explicitly requested
    if (archiviati === 'true') {
      // show all (including archived)
    } else if (archiviati === 'only') {
      query = query.where('archiviato', true);
    } else {
      query = query.where('archiviato', false);
    }

    // Count
    const countQuery = query.clone().count('id as count').first();
    const { count } = await countQuery;

    // Data
    const rows = await query
      .clone()
      .select('*')
      .orderBy('nome', 'asc')
      .limit(perPage)
      .offset(offset);

    return paginatedResponse(rows, Number(count), page, perPage);
  });

  // Get all active clients (no pagination, for dropdowns/autocomplete)
  app.get('/all', { preHandler: [app.authenticate] }, async () => {
    return app
      .db('clienti')
      .select('id', 'nome', 'telefono', 'email', 'codice_fiscale', 'partita_iva')
      .where('archiviato', false)
      .orderBy('nome', 'asc');
  });

  // Search
  app.get('/search', { preHandler: [app.authenticate] }, async (request) => {
    const { q, archiviati } = request.query;
    const { page, perPage, offset } = parsePagination(request.query);

    if (!q || q.trim().length < 1) {
      return paginatedResponse([], 0, page, perPage);
    }

    const term = `%${q.trim()}%`;

    let query = app
      .db('clienti')
      .where(function () {
        this.whereILike('nome', term)
          .orWhereILike('telefono', term)
          .orWhereILike('email', term)
          .orWhereILike('codice_fiscale', term)
          .orWhereILike('partita_iva', term);
      });

    // Filter archived
    if (archiviati === 'true') {
      // show all
    } else if (archiviati === 'only') {
      query = query.andWhere('archiviato', true);
    } else {
      query = query.andWhere('archiviato', false);
    }

    const countQuery = query.clone().clearSelect().count('id as count').first();
    const { count } = await countQuery;

    const rows = await query
      .clone()
      .select('*')
      .orderBy('nome', 'asc')
      .limit(perPage)
      .offset(offset);

    return paginatedResponse(rows, Number(count), page, perPage);
  });

  // Get by ID
  app.get('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    const cliente = await app.db('clienti').where({ id }).first();
    if (!cliente) {
      return reply.status(404).send({ error: 'Cliente non trovato' });
    }
    return cliente;
  });

  // Create
  app.post('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = clienteSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dati non validi', details: parsed.error.flatten() });
    }

    // Normalize empty email to null
    const data = { ...parsed.data };
    if (data.email === '') data.email = null;

    const [cliente] = await app.db('clienti').insert(data).returning('*');

    // Audit log: creazione cliente
    try {
      await app.logModifica(app.db, {
        utente_id: request.user.id,
        entita: 'cliente',
        entita_id: cliente.id,
        azione: 'creazione',
        dettaglio: { nome: cliente.nome },
      });
    } catch (logErr) {
      app.log.error({ err: logErr }, 'Failed to log modification');
    }

    return reply.status(201).send(cliente);
  });

  // Update
  app.put('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    const parsed = clienteSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dati non validi', details: parsed.error.flatten() });
    }

    const existing = await app.db('clienti').where({ id }).first();
    if (!existing) {
      return reply.status(404).send({ error: 'Cliente non trovato' });
    }

    // Normalize empty email to null
    const data = { ...parsed.data };
    if (data.email === '') data.email = null;

    const [updated] = await app
      .db('clienti')
      .where({ id })
      .update({ ...data, updated_at: app.db.fn.now() })
      .returning('*');

    // Audit log: modifica cliente
    try {
      const diff = app.computeDiff(existing, updated, ['nome', 'telefono', 'email', 'indirizzo', 'codice_fiscale', 'partita_iva']);
      if (diff) {
        await app.logModifica(app.db, {
          utente_id: request.user.id,
          entita: 'cliente',
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

  // Archive (soft delete)
  app.patch('/:id/archivia', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    const existing = await app.db('clienti').where({ id }).first();
    if (!existing) {
      return reply.status(404).send({ error: 'Cliente non trovato' });
    }

    const [updated] = await app
      .db('clienti')
      .where({ id })
      .update({ archiviato: true, updated_at: app.db.fn.now() })
      .returning('*');

    // Audit log: archiviazione cliente
    try {
      await app.logModifica(app.db, {
        utente_id: request.user.id,
        entita: 'cliente',
        entita_id: id,
        azione: 'archiviazione',
        dettaglio: { nome: existing.nome },
      });
    } catch (logErr) {
      app.log.error({ err: logErr }, 'Failed to log modification');
    }

    return updated;
  });

  // Restore (unarchive)
  app.patch('/:id/ripristina', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    const existing = await app.db('clienti').where({ id }).first();
    if (!existing) {
      return reply.status(404).send({ error: 'Cliente non trovato' });
    }

    const [updated] = await app
      .db('clienti')
      .where({ id })
      .update({ archiviato: false, updated_at: app.db.fn.now() })
      .returning('*');

    // Audit log: ripristino cliente
    try {
      await app.logModifica(app.db, {
        utente_id: request.user.id,
        entita: 'cliente',
        entita_id: id,
        azione: 'ripristino',
        dettaglio: { nome: existing.nome },
      });
    } catch (logErr) {
      app.log.error({ err: logErr }, 'Failed to log modification');
    }

    return updated;
  });

  // Delete (hard delete - only if no linked preventivi)
  app.delete('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    const existing = await app.db('clienti').where({ id }).first();
    if (!existing) {
      return reply.status(404).send({ error: 'Cliente non trovato' });
    }

    // Check if client has linked preventivi
    const hasPreventivi = await app
      .db('preventivi')
      .where({ cliente_id: id })
      .first();

    if (hasPreventivi) {
      return reply.status(409).send({
        error: 'Impossibile eliminare: il cliente ha preventivi collegati. Usa archiviazione.',
      });
    }

    // Audit log: eliminazione cliente (before delete)
    try {
      await app.logModifica(app.db, {
        utente_id: request.user.id,
        entita: 'cliente',
        entita_id: id,
        azione: 'eliminazione',
        dettaglio: { nome: existing.nome },
      });
    } catch (logErr) {
      app.log.error({ err: logErr }, 'Failed to log modification');
    }

    await app.db('clienti').where({ id }).del();
    return { message: 'Cliente eliminato' };
  });
}

module.exports = clientiRoutes;
