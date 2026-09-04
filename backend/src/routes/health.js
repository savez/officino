const { version } = require('../../package.json');

/**
 * Endpoint di salute, pubblico.
 *
 * Espone anche la versione del BACKEND. Serve perche' su Render backend e
 * frontend sono due servizi distinti che si distribuiscono separatamente: il
 * badge di versione nell'interfaccia dice quale frontend e' online e non dice
 * nulla sull'API. Senza questo, per sapere quale backend sta rispondendo
 * bisogna aprire la dashboard di Render.
 * @param {import('fastify').FastifyInstance} app
 */
async function healthRoutes(app) {
  app.get('/health', async (request, reply) => {
    try {
      await app.db.raw('SELECT 1');
      return { status: 'ok', db: 'connected', version };
    } catch (err) {
      reply.status(503);
      return { status: 'error', db: 'disconnected', version, message: err.message };
    }
  });
}

module.exports = healthRoutes;
