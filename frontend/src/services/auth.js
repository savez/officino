import api from './api';

/**
 * Logs in a user
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ user: object, token: string, refreshToken: string }>}
 */
export async function login(email, password) {
  const { data } = await api.post('/auth/login', { email, password });
  localStorage.setItem('token', data.token);
  localStorage.setItem('refreshToken', data.refreshToken);
  localStorage.setItem('user', JSON.stringify(data.user));
  return data;
}

/**
 * Registers a new user
 * @param {string} nome
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ user: object, token: string, refreshToken: string }>}
 */
export async function register(nome, email, password) {
  const { data } = await api.post('/auth/register', { nome, email, password });
  localStorage.setItem('token', data.token);
  localStorage.setItem('refreshToken', data.refreshToken);
  localStorage.setItem('user', JSON.stringify(data.user));
  return data;
}

/** Logs out the current user */
export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
}

/**
 * Returns the currently stored user
 * @returns {object|null}
 */
export function getCurrentUser() {
  const raw = localStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}

/**
 * Returns true if the currently logged in user has role 'admin'
 * @returns {boolean}
 */
export function isAdmin() {
  const user = getCurrentUser();
  return user?.ruolo === 'admin';
}
