import api from './api';

/**
 * Recupera le statistiche della dashboard per un periodo.
 * @param {object} periodo - intervallo di analisi
 * @param {string} [periodo.da] - data di inizio, AAAA-MM-GG
 * @param {string} [periodo.a] - data di fine, AAAA-MM-GG
 * @param {string} [periodo.scorciatoia] - in alternativa a da/a
 * @param {number|string} [periodo.operaio_id] - restringe a un singolo operaio
 * @returns {Promise<object>} statistiche, con il periodo effettivamente usato
 */
export async function getDashboardStats(periodo = {}) {
  const { data } = await api.get('/dashboard/stats', { params: periodo });
  return data;
}

/**
 * Esporta le ore in Excel per lo stesso periodo mostrato a schermo.
 *
 * Riceve gli stessi parametri di getDashboardStats di proposito: se i due
 * divergessero, si esporterebbe un periodo diverso da quello guardato senza
 * che nulla lo segnali.
 * @param {object} periodo - intervallo di analisi, come sopra
 * @returns {Promise<void>}
 */
export async function exportOreExcel(periodo = {}) {
  try {
    const response = await api.get('/dashboard/export-ore', {
      params: periodo,
      responseType: 'blob',
    });

    const url = window.URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;

    // Il nome arriva dal server, che conosce le date risolte anche quando il
    // client ha chiesto una scorciatoia.
    const disposizione = response.headers?.['content-disposition'] || '';
    const trovato = disposizione.match(/filename="?([^"]+)"?/);
    link.download = trovato ? trovato[1] : 'ore.xlsx';

    link.click();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Export error:', err);
    throw err;
  }
}
