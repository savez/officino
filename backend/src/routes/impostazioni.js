const { z } = require('zod');

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

const impostazioniSchema = z.object({
  nome: z.string().min(1, 'Nome obbligatorio'),
  partita_iva: z.string().optional().nullable(),
  indirizzo: z.string().optional().nullable(),
  telefono: z.string().optional().nullable(),
  email: z.string().email('Email non valida').optional().nullable().or(z.literal('')),
  aliquota_iva_default: z.coerce.number().min(0).max(100).default(22),
  log_attivi: z.boolean().default(true),
});

/**
 * Impostazioni Officina routes - GET/PUT single row + logo upload
 * @param {import('fastify').FastifyInstance} app
 */
async function impostazioniRoutes(app) {
  const adminOnly = [app.authenticate, app.requireRole('admin')];

  // Get current settings - admin only
  app.get('/', { preHandler: adminOnly }, async (request, reply) => {
    const settings = await app.db('impostazioni_officina').first();
    if (!settings) {
      return reply.status(404).send({ error: 'Impostazioni non trovate' });
    }
    return settings;
  });

  // Update settings - admin only
  app.put('/', { preHandler: adminOnly }, async (request, reply) => {
    const parsed = impostazioniSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dati non validi', details: parsed.error.flatten() });
    }

    const settings = await app.db('impostazioni_officina').first();
    if (!settings) {
      return reply.status(404).send({ error: 'Impostazioni non trovate' });
    }

    // Normalize empty email to null
    const data = { ...parsed.data };
    if (data.email === '') data.email = null;

    const [updated] = await app
      .db('impostazioni_officina')
      .where({ id: settings.id })
      .update({ ...data, updated_at: app.db.fn.now() })
      .returning('*');

    // Audit log: modifica impostazioni
    try {
      const diff = app.computeDiff(settings, updated, [
        'nome',
        'partita_iva',
        'indirizzo',
        'telefono',
        'email',
        'aliquota_iva_default',
        'log_attivi',
      ]);
      if (diff) {
        await app.logModifica(app.db, {
          utente_id: request.user.id,
          entita: 'impostazioni',
          entita_id: settings.id,
          azione: 'modifica',
          dettaglio: diff,
        });
      }
    } catch (logErr) {
      app.log.error({ err: logErr }, 'Failed to log modification');
    }

    return updated;
  });

  // Upload logo - admin only (stored as base64 data URI in DB)
  app.post('/logo', { preHandler: adminOnly }, async (request, reply) => {
    const file = await request.file();
    if (!file) {
      return reply.status(400).send({ error: 'Nessun file caricato' });
    }

    // Validate mime type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return reply.status(400).send({
        error: `Tipo file non supportato. Formati accettati: PNG, JPEG, WebP`,
      });
    }

    // Read file buffer
    const chunks = [];
    for await (const chunk of file.file) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Validate size
    if (buffer.length > MAX_FILE_SIZE) {
      return reply.status(400).send({
        error: 'File troppo grande. Dimensione massima: 2MB',
      });
    }

    // Convert to base64 data URI
    const base64 = `data:${file.mimetype};base64,${buffer.toString('base64')}`;

    // Update DB
    const settings = await app.db('impostazioni_officina').first();

    const [updated] = await app
      .db('impostazioni_officina')
      .where({ id: settings.id })
      .update({ logo_base64: base64, logo_url: null, updated_at: app.db.fn.now() })
      .returning('*');

    // Audit log: caricamento logo
    try {
      await app.logModifica(app.db, {
        utente_id: request.user.id,
        entita: 'impostazioni',
        entita_id: settings.id,
        azione: 'modifica',
        dettaglio: { campo: 'logo', azione: 'caricamento' },
      });
    } catch (logErr) {
      app.log.error({ err: logErr }, 'Failed to log modification');
    }

    return updated;
  });

  // Delete logo
  app.delete('/logo', { preHandler: adminOnly }, async (request, reply) => {
    const settings = await app.db('impostazioni_officina').first();
    if (!settings || !settings.logo_base64) {
      return reply.status(404).send({ error: 'Nessun logo trovato' });
    }

    // Update DB
    const [updated] = await app
      .db('impostazioni_officina')
      .where({ id: settings.id })
      .update({ logo_base64: null, logo_url: null, updated_at: app.db.fn.now() })
      .returning('*');

    // Audit log: rimozione logo
    try {
      await app.logModifica(app.db, {
        utente_id: request.user.id,
        entita: 'impostazioni',
        entita_id: settings.id,
        azione: 'modifica',
        dettaglio: { campo: 'logo', azione: 'rimozione' },
      });
    } catch (logErr) {
      app.log.error({ err: logErr }, 'Failed to log modification');
    }

    return updated;
  });
}

module.exports = impostazioniRoutes;
