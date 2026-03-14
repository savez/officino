import api from './api';

/**
 * Fetches dashboard statistics for a given month and year
 * @param {number} mese - Month (1-12)
 * @param {number} anno - Year (e.g. 2026)
 * @returns {Promise<object>} Dashboard stats
 */
export async function getDashboardStats(mese, anno) {
  const { data } = await api.get('/dashboard/stats', { params: { mese, anno } });
  return data;
}

/**
 * Exports hours data to Excel
 * @param {number} mese - Month (1-12)
 * @param {number} anno - Year (e.g. 2026)
 */
export async function exportOreExcel(mese, anno) {
  try {
    const response = await api.get('/dashboard/export-ore', {
      params: { mese, anno },
      responseType: 'blob'
    });
    const url = window.URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ore_${anno}_${String(mese).padStart(2, '0')}.xlsx`;
    link.click();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Export error:', err);
    throw err;
  }
}
