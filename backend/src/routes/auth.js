const bcrypt = require('bcrypt');
const { z } = require('zod');

const loginSchema = z.object({
  email: z.string().email('Email non valida'),
  password: z.string().min(1, 'Password obbligatoria'),
});

/**
 * Authentication routes
 * @param {import('fastify').FastifyInstance} app
 */
async function authRoutes(app) {
  // Register — disabilitato: gli utenti vengono creati solo da un admin tramite /utenti
  app.post('/register', async (_request, reply) => {
    return reply
      .status(410)
      .send({ error: 'La registrazione pubblica è disabilitata. Contatta un amministratore.' });
  });

  // Login
  app.post('/login', {
    config: {
      rateLimit: { max: 10, timeWindow: '1 minute' },
    },
    handler: async (request, reply) => {
      const parsed = loginSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: 'Dati non validi', details: parsed.error.flatten() });
      }

      const { email, password } = parsed.data;

      const user = await app.db('utenti').where({ email }).first();
      if (!user) {
        return reply.status(401).send({ error: 'Credenziali non valide' });
      }

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return reply.status(401).send({ error: 'Credenziali non valide' });
      }

      const token = app.jwt.sign({ id: user.id, email: user.email, ruolo: user.ruolo });
      const refreshToken = app.jwt.sign(
        { id: user.id, type: 'refresh' },
        { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
      );

      return {
        user: { id: user.id, nome: user.nome, email: user.email, ruolo: user.ruolo },
        token,
        refreshToken,
      };
    },
  });

  // Refresh token
  app.post('/refresh', async (request, reply) => {
    const { refreshToken } = request.body || {};
    if (!refreshToken) {
      return reply.status(400).send({ error: 'Refresh token obbligatorio' });
    }

    try {
      const decoded = app.jwt.verify(refreshToken);
      if (decoded.type !== 'refresh') {
        return reply.status(401).send({ error: 'Token non valido' });
      }

      const user = await app
        .db('utenti')
        .where({ id: decoded.id })
        .select('id', 'nome', 'email', 'ruolo')
        .first();

      if (!user) {
        return reply.status(401).send({ error: 'Utente non trovato' });
      }

      const token = app.jwt.sign({ id: user.id, email: user.email, ruolo: user.ruolo });
      const newRefreshToken = app.jwt.sign(
        { id: user.id, type: 'refresh' },
        { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
      );

      return { user, token, refreshToken: newRefreshToken };
    } catch (err) {
      return reply.status(401).send({ error: 'Refresh token scaduto o non valido' });
    }
  });

  // Get current user (protected)
  app.get('/me', { preHandler: [app.authenticate] }, async (request) => {
    const user = await app
      .db('utenti')
      .where({ id: request.user.id })
      .select('id', 'nome', 'email', 'ruolo', 'costo_orario')
      .first();
    return { user };
  });
}

module.exports = authRoutes;
