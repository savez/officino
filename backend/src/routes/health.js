/**
 * Health check routes
 * @param {import('fastify').FastifyInstance} app
 */
async function healthRoutes(app) {
  app.get('/health', async (request, reply) => {
    try {
      await app.db.raw('SELECT 1');
      return { status: 'ok', db: 'connected' };
    } catch (err) {
      reply.status(503);
      return { status: 'error', db: 'disconnected', message: err.message };
    }
  });
}

module.exports = healthRoutes;
