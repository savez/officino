const { z } = require('zod');
const { parsePagination, paginatedResponse } = require('../utils/pagination');

const dataSogliaSchema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato data non valido (atteso YYYY-MM-DD)'),
});

/**
 * Log Modifiche routes - read-only API for viewing audit trail
 * @param {import('fastify').FastifyInstance} app
 */
async function logRoutes(app) {
  const adminOnly = [app.authenticate, app.requireRole('admin')];

  // List (paginated, with filters)
  app.get('/', { preHandler: adminOnly }, async (request) => {
    const { page, perPage, offset } = parsePagination(request.query);
    const { entita, entita_id, utente_id, azione, data_da, data_a } = request.query;

    let query = app
      .db('log_modifiche as l')
      .leftJoin('utenti as u', 'l.utente_id', 'u.id')
      .select('l.*', 'u.nome as utente_nome', 'u.email as utente_email');

    if (entita) {
      query = query.where('l.entita', entita);
    }
    if (entita_id) {
      query = query.where('l.entita_id', entita_id);
    }
    if (utente_id) {
      query = query.where('l.utente_id', utente_id);
    }
    if (azione) {
      query = query.where('l.azione', azione);
    }
    if (data_da) {
      query = query.where('l.created_at', '>=', data_da);
    }
    if (data_a) {
      query = query.where('l.created_at', '<=', `${data_a} 23:59:59`);
    }

    const countQuery = query.clone().clearSelect().count('l.id as count').first();
    const { count } = await countQuery;

    const rows = await query
      .clone()
      .clearOrder()
      .orderBy('l.created_at', 'desc')
      .limit(perPage)
      .offset(offset);

    // Parse dettaglio JSON
    const data = rows.map((row) => ({
      ...row,
      dettaglio: typeof row.dettaglio === 'string' ? JSON.parse(row.dettaglio) : row.dettaglio,
    }));

    return paginatedResponse(data, Number(count), page, perPage);
  });

  // Count logs before a given date (admin only)
  app.get('/count-before', { preHandler: adminOnly }, async (request, reply) => {
    const parsed = dataSogliaSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dati non validi', details: parsed.error.flatten() });
    }

    const threshold = `${parsed.data.data} 00:00:00`;
    const result = await app
      .db('log_modifiche')
      .where('created_at', '<', threshold)
      .count('id as count')
      .first();

    return { count: Number(result?.count || 0) };
  });

  // Delete logs before a given date (admin only)
  app.delete('/before', { preHandler: adminOnly }, async (request, reply) => {
    const parsed = dataSogliaSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dati non validi', details: parsed.error.flatten() });
    }

    const threshold = `${parsed.data.data} 00:00:00`;
    const deletedRows = await app
      .db('log_modifiche')
      .where('created_at', '<', threshold)
      .del()
      .returning('id');

    return { deleted: deletedRows.length };
  });

  // Get logs for a specific entity
  app.get('/:entita/:entita_id', { preHandler: adminOnly }, async (request) => {
    const { entita, entita_id } = request.params;
    const { page, perPage, offset } = parsePagination(request.query);

    let query = app
      .db('log_modifiche as l')
      .leftJoin('utenti as u', 'l.utente_id', 'u.id')
      .select('l.*', 'u.nome as utente_nome')
      .where('l.entita', entita)
      .where('l.entita_id', entita_id);

    const countQuery = query.clone().clearSelect().count('l.id as count').first();
    const { count } = await countQuery;

    const rows = await query
      .clone()
      .clearOrder()
      .orderBy('l.created_at', 'desc')
      .limit(perPage)
      .offset(offset);

    const data = rows.map((row) => ({
      ...row,
      dettaglio: typeof row.dettaglio === 'string' ? JSON.parse(row.dettaglio) : row.dettaglio,
    }));

    return paginatedResponse(data, Number(count), page, perPage);
  });
}

module.exports = logRoutes;
