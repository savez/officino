/** @type {'user'} */
const ROLE_USER = 'user';

/** @type {'admin'} */
const ROLE_ADMIN = 'admin';

/**
 * Returns a Fastify preHandler that allows only users with the given role.
 * Must be used AFTER app.authenticate in the preHandler chain.
 * @param {string} requiredRole - The role required to access the route ('admin')
 * @returns {import('fastify').preHandlerHookHandler}
 * @example
 * app.get('/protected', { preHandler: [app.authenticate, app.requireRole('admin')] }, handler)
 */
function makeRequireRole(requiredRole) {
  return async function requireRole(request, reply) {
    if (!request.user || request.user.ruolo !== requiredRole) {
      return reply.status(403).send({ error: 'Accesso negato: permessi insufficienti' });
    }
  };
}

module.exports = { ROLE_USER, ROLE_ADMIN, makeRequireRole };
