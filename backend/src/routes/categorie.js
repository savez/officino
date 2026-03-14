const { z } = require('zod');
const { parsePagination, paginatedResponse } = require('../utils/pagination');

const categoriaSchema = z.object({
  nome: z.string().min(1, 'Nome obbligatorio'),
  descrizione: z.string().optional().nullable(),
});

/**
 * Categorie routes - CRUD
 * @param {import('fastify').FastifyInstance} app
 */
async function categorieRoutes(app) {
  // List (paginated)
  app.get('/', { preHandler: [app.authenticate] }, async (request) => {
    const { page, perPage, offset } = parsePagination(request.query);

    const [{ count }] = await app.db('categorie').count('id as count');
    const rows = await app.db('categorie')
      .select('*')
      .orderBy('nome', 'asc')
      .limit(perPage)
      .offset(offset);

    return paginatedResponse(rows, Number(count), page, perPage);
  });

  // Get all (no pagination, for dropdowns)
  app.get('/all', { preHandler: [app.authenticate] }, async () => {
    return app.db('categorie').select('id', 'nome').orderBy('nome', 'asc');
  });

  // Get by ID
  app.get('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    const categoria = await app.db('categorie').where({ id }).first();
    if (!categoria) {
      return reply.status(404).send({ error: 'Categoria non trovata' });
    }
    return categoria;
  });

  // Create
  app.post('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = categoriaSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dati non validi', details: parsed.error.flatten() });
    }

    const existing = await app.db('categorie').where({ nome: parsed.data.nome }).first();
    if (existing) {
      return reply.status(409).send({ error: 'Categoria con questo nome già esistente' });
    }

    const [categoria] = await app.db('categorie').insert(parsed.data).returning('*');
    return reply.status(201).send(categoria);
  });

  // Update
  app.put('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    const parsed = categoriaSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dati non validi', details: parsed.error.flatten() });
    }

    const existing = await app.db('categorie').where({ id }).first();
    if (!existing) {
      return reply.status(404).send({ error: 'Categoria non trovata' });
    }

    // Check name uniqueness (excluding current)
    const duplicate = await app
      .db('categorie')
      .where({ nome: parsed.data.nome })
      .whereNot({ id })
      .first();
    if (duplicate) {
      return reply.status(409).send({ error: 'Categoria con questo nome già esistente' });
    }

    const [updated] = await app
      .db('categorie')
      .where({ id })
      .update({ ...parsed.data, updated_at: app.db.fn.now() })
      .returning('*');

    return updated;
  });

  // Delete
  app.delete('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    const existing = await app.db('categorie').where({ id }).first();
    if (!existing) {
      return reply.status(404).send({ error: 'Categoria non trovata' });
    }

    await app.db('categorie').where({ id }).del();
    return { message: 'Categoria eliminata' };
  });
}

module.exports = categorieRoutes;
