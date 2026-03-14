const fastify = require('fastify');
const cors = require('@fastify/cors');
const helmet = require('@fastify/helmet');
const rateLimit = require('@fastify/rate-limit');
const jwt = require('@fastify/jwt');
const multipart = require('@fastify/multipart');
const db = require('./utils/db');
const { logModifica, computeDiff } = require('./services/log-modifiche');
const { makeRequireRole } = require('./utils/roles');

/**
 * Builds and configures the Fastify application
 * @param {object} [opts] - Fastify options override (useful for testing)
 * @returns {Promise<import('fastify').FastifyInstance>}
 */
async function buildApp(opts = {}) {
  const app = fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport:
        process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
    ...opts,
  });

  // Security
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  });
  await app.register(rateLimit, {
    max: opts.skipRateLimit ? 10000 : 100,
    timeWindow: '1 minute',
  });

  // JWT
  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    sign: { expiresIn: process.env.JWT_EXPIRES_IN || '15m' },
  });

  // Multipart (file upload)
  await app.register(multipart, {
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB max
    },
  });

  // DB instance on app
  app.decorate('db', db);

  // Log service decorators
  app.decorate('logModifica', logModifica);
  app.decorate('computeDiff', computeDiff);

  // Auth decorator
  app.decorate('authenticate', async function (request, reply) {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.status(401).send({ error: 'Non autorizzato' });
    }
  });

  // Role-based authorization decorator
  // Usage: { preHandler: [app.authenticate, app.requireRole('admin')] }
  app.decorate('requireRole', makeRequireRole);

  // Routes
  app.register(require('./routes/health'), { prefix: '/api' });
  app.register(require('./routes/auth'), { prefix: '/api/auth' });
  app.register(require('./routes/categorie'), { prefix: '/api/categorie' });
  app.register(require('./routes/catalogo'), { prefix: '/api/catalogo' });
  app.register(require('./routes/clienti'), { prefix: '/api/clienti' });
  app.register(require('./routes/preventivi'), { prefix: '/api/preventivi' });
  app.register(require('./routes/impostazioni'), { prefix: '/api/impostazioni' });
  app.register(require('./routes/utenti'), { prefix: '/api/utenti' });
  app.register(require('./routes/log'), { prefix: '/api/log' });
  app.register(require('./routes/rapportini'), { prefix: '/api/rapportini' });
  app.register(require('./routes/note-lavorazione'), {
    prefix: '/api/note-lavorazione',
  });
  app.register(require('./routes/dashboard'), { prefix: '/api/dashboard' });

  // Graceful shutdown
  app.addHook('onClose', async () => {
    await db.destroy();
  });

  return app;
}

module.exports = buildApp;
