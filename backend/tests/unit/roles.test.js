const { ROLE_USER, ROLE_ADMIN, makeRequireRole } = require('../../src/utils/roles');

// ---------- Costanti ----------

describe('Role constants', () => {
  it('ROLE_USER should be "user"', () => {
    expect(ROLE_USER).toBe('user');
  });

  it('ROLE_ADMIN should be "admin"', () => {
    expect(ROLE_ADMIN).toBe('admin');
  });
});

// ---------- makeRequireRole ----------

function makeReply() {
  const reply = {
    _status: null,
    _body: null,
    status(code) {
      this._status = code;
      return this;
    },
    send(body) {
      this._body = body;
      return this;
    },
  };
  return reply;
}

describe('makeRequireRole', () => {
  it('should return 403 when request.user is null', async () => {
    const handler = makeRequireRole(ROLE_ADMIN);
    const request = { user: null };
    const reply = makeReply();
    await handler(request, reply);
    expect(reply._status).toBe(403);
    expect(reply._body).toHaveProperty('error');
    expect(reply._body.error).toMatch(/Accesso negato/i);
  });

  it('should return 403 when request.user is undefined', async () => {
    const handler = makeRequireRole(ROLE_ADMIN);
    const request = {};
    const reply = makeReply();
    await handler(request, reply);
    expect(reply._status).toBe(403);
  });

  it('should return 403 when user role does not match required role', async () => {
    const handler = makeRequireRole(ROLE_ADMIN);
    const request = { user: { id: 1, ruolo: ROLE_USER } };
    const reply = makeReply();
    await handler(request, reply);
    expect(reply._status).toBe(403);
    expect(reply._body.error).toMatch(/Accesso negato/i);
  });

  it('should not send error when user role matches required role', async () => {
    const handler = makeRequireRole(ROLE_ADMIN);
    const request = { user: { id: 1, ruolo: ROLE_ADMIN } };
    const reply = makeReply();
    await handler(request, reply);
    expect(reply._status).toBeNull();
    expect(reply._body).toBeNull();
  });

  it('should work for ROLE_USER as required role', async () => {
    const handler = makeRequireRole(ROLE_USER);
    const request = { user: { id: 1, ruolo: ROLE_USER } };
    const reply = makeReply();
    await handler(request, reply);
    expect(reply._status).toBeNull();
  });

  it('should return 403 when user is admin but role_user required — mismatched args', async () => {
    // Edge case: admin calling a hypothetical user-only route
    const handler = makeRequireRole(ROLE_USER);
    const request = { user: { id: 1, ruolo: ROLE_ADMIN } };
    const reply = makeReply();
    await handler(request, reply);
    expect(reply._status).toBe(403);
  });

  it('should create independent handlers per required role', () => {
    const adminHandler = makeRequireRole(ROLE_ADMIN);
    const userHandler = makeRequireRole(ROLE_USER);
    expect(adminHandler).not.toBe(userHandler);
  });
});
