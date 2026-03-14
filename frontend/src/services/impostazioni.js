import api from './api';

// ── Impostazioni ─────────────────────────────────────────────────────

/**
 * Get current impostazioni officina
 * @returns {Promise<object>}
 */
export async function getImpostazioni() {
  const { data } = await api.get('/impostazioni');
  return data;
}

/**
 * Update impostazioni officina
 * @param {object} payload - { nome, partita_iva, indirizzo, telefono, email, aliquota_iva_default, log_attivi }
 * @returns {Promise<object>}
 */
export async function updateImpostazioni(payload) {
  const { data } = await api.put('/impostazioni', payload);
  return data;
}

/**
 * Upload logo image
 * @param {File} file - Image file (png, jpeg, webp)
 * @returns {Promise<object>}
 */
export async function uploadLogo(file) {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/impostazioni/logo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

/**
 * Delete the current logo
 * @returns {Promise<object>}
 */
export async function deleteLogo() {
  const { data } = await api.delete('/impostazioni/logo');
  return data;
}
