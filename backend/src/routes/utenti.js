const bcrypt = require('bcrypt');
const { z } = require('zod');
const { parsePagination, paginatedResponse } = require('../utils/pagination');

const SALT_ROUNDS = 10;

const createUtenteSchema = z.object({
  nome: z.string().min(1, 'Nome obbligatorio'),
  email: z.string().email('Email non valida'),
  password: z.string().min(6, 'Password deve avere almeno 6 caratteri'),
  ruolo: z.enum(['user', 'admin']).default('user'),
  costo_orario: z.number().min(0).multipleOf(0.01).optional().default(0),
});

const updateUtenteSchema = z.object({
  nome: z.string().min(1, 'Nome obbligatorio'),
  email: z.string().email('Email non valida'),
  password: z.string().min(6, 'Password deve avere almeno 6 caratteri').optional().nullable(),
  ruolo: z.enum(['user', 'admin']).default('user'),
  costo_orario: z.number().min(0).multipleOf(0.01).optional().default(0),
});

/**
 * Utenti management routes (CRUD)
 * @param {import('fastify').FastifyInstance} app
 */
async function utentiRoutes(app) {
  const adminOnly = [app.authenticate, app.requireRole('admin')];

  // List utenti (paginated) - admin only
  app.get('/', { preHandler: adminOnly }, async (request) => {
    const { page, perPage, offset } = parsePagination(request.query);

    const countResult = await app.db('utenti').count('id as count').first();
    const count = Number(countResult.count);

    const rows = await app
      .db('utenti')
      .select('id', 'nome', 'email', 'ruolo', 'costo_orario', 'created_at', 'updated_at')
      .orderBy('nome', 'asc')
      .limit(perPage)
      .offset(offset);

    return paginatedResponse(rows, count, page, perPage);
  });

  // Get all utenti (for dropdowns, no pagination) - accessible to all authenticated users
  app.get('/all', { preHandler: [app.authenticate] }, async () => {
    const rows = await app
      .db('utenti')
      .select('id', 'nome', 'email', 'ruolo', 'costo_orario')
      .orderBy('nome', 'asc');
    return rows;
  });

  // Get single utente - admin only
  app.get('/:id', { preHandler: adminOnly }, async (request, reply) => {
    const { id } = request.params;
    const utente = await app
      .db('utenti')
      .select('id', 'nome', 'email', 'ruolo', 'costo_orario', 'created_at', 'updated_at')
      .where({ id })
      .first();

    if (!utente) {
      return reply.status(404).send({ error: 'Utente non trovato' });
    }

    return utente;
  });

  // Create utente - admin only
  app.post('/', { preHandler: adminOnly }, async (request, reply) => {
    const parsed = createUtenteSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dati non validi', details: parsed.error.flatten() });
    }

    const { nome, email, password, ruolo, costo_orario } = parsed.data;

    // Check duplicate email
    const existing = await app.db('utenti').where({ email }).first();
    if (existing) {
      return reply.status(409).send({ error: 'Email già registrata' });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const [utente] = await app
      .db('utenti')
      .insert({ nome, email, password_hash, ruolo, costo_orario })
      .returning(['id', 'nome', 'email', 'ruolo', 'costo_orario']);

    // Audit log
    try {
      await app.logModifica(app.db, {
        utente_id: request.user.id,
        entita: 'utente',
        entita_id: utente.id,
        azione: 'creazione',
        dettaglio: { nome, email, ruolo, costo_orario },
      });
    } catch (logErr) {
      app.log.error({ err: logErr }, 'Failed to log modification');
    }

    return reply.status(201).send(utente);
  });

  // Update utente - admin only
  app.put('/:id', { preHandler: adminOnly }, async (request, reply) => {
    const { id } = request.params;
    const parsed = updateUtenteSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dati non validi', details: parsed.error.flatten() });
    }

    const existing = await app.db('utenti').where({ id }).first();
    if (!existing) {
      return reply.status(404).send({ error: 'Utente non trovato' });
    }

    // Prevent self-role modification
    if (Number(id) === request.user.id && parsed.data.ruolo !== existing.ruolo) {
      return reply.status(403).send({ error: 'Non puoi modificare il tuo stesso ruolo' });
    }

    const { nome, email, password, ruolo, costo_orario } = parsed.data;

    // Check duplicate email (excluding current user)
    const emailDup = await app.db('utenti').where({ email }).whereNot({ id }).first();
    if (emailDup) {
      return reply.status(409).send({ error: 'Email già utilizzata da un altro utente' });
    }

    const updateData = {
      nome,
      email,
      ruolo,
      costo_orario,
      updated_at: app.db.fn.now(),
    };

    // Update password only if provided
    if (password) {
      updateData.password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    }

    await app.db('utenti').where({ id }).update(updateData);

    const updated = await app
      .db('utenti')
      .select('id', 'nome', 'email', 'ruolo', 'costo_orario', 'created_at', 'updated_at')
      .where({ id })
      .first();

    // Audit log
    try {
      const diff = app.computeDiff(existing, updated, ['nome', 'email', 'ruolo', 'costo_orario']);
      const dettaglio = diff || {};
      if (password) {
        dettaglio.password = { prima: '***', dopo: '***' };
      }
      if (Object.keys(dettaglio).length > 0) {
        await app.logModifica(app.db, {
          utente_id: request.user.id,
          entita: 'utente',
          entita_id: id,
          azione: 'modifica',
          dettaglio,
        });
      }
    } catch (logErr) {
      app.log.error({ err: logErr }, 'Failed to log modification');
    }

    return updated;
  });

  // Delete utente - admin only
  app.delete('/:id', { preHandler: adminOnly }, async (request, reply) => {
    const { id } = request.params;

    // Prevent self-deletion
    if (Number(id) === request.user.id) {
      return reply.status(403).send({ error: 'Non puoi eliminare il tuo stesso account' });
    }

    const existing = await app.db('utenti').where({ id }).first();
    if (!existing) {
      return reply.status(404).send({ error: 'Utente non trovato' });
    }

    // Check if user has preventivi
    const preventiviCount = await app
      .db('preventivi')
      .where({ utente_id: id })
      .count('id as count')
      .first();
    if (Number(preventiviCount.count) > 0) {
      return reply.status(409).send({
        error: `Impossibile eliminare: l'utente ha ${preventiviCount.count} preventivi associati`,
      });
    }

    // Audit log (before delete)
    try {
      await app.logModifica(app.db, {
        utente_id: request.user.id,
        entita: 'utente',
        entita_id: id,
        azione: 'eliminazione',
        dettaglio: { nome: existing.nome, email: existing.email },
      });
    } catch (logErr) {
      app.log.error({ err: logErr }, 'Failed to log modification');
    }

    await app.db('utenti').where({ id }).del();
    return { message: 'Utente eliminato' };
  });
}

module.exports = utentiRoutes;
