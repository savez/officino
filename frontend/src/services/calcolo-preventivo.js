/**
 * Client-side calculation mirror for live preview.
 * Mirrors the backend logic so totals update in real-time as the user edits.
 *
 * @param {object} params
 * @param {Array} params.pezzi - [{ prezzo_unitario, quantita }]
 * @param {number} params.manodopera_ore
 * @param {number} params.manodopera_costo_orario
 * @param {string} params.sconto_tipo - 'fisso' | 'percentuale'
 * @param {number} params.sconto_valore
 * @param {number} params.aliquota_iva
 * @returns {{ manodopera_totale, imponibile, sconto_calcolato, imponibile_netto, iva, totale }}
 */
export function calcolaPreventivo({
  pezzi = [],
  manodopera_ore = 0,
  manodopera_costo_orario = 0,
  sconto_tipo = 'fisso',
  sconto_valore = 0,
  aliquota_iva = 22,
} = {}) {
  // Manodopera
  const ore = Number(manodopera_ore) || 0;
  const costoOrario = Number(manodopera_costo_orario) || 0;
  const manodopera_totale = round2(ore * costoOrario);

  // Somma pezzi
  const totalePezzi = pezzi.reduce((sum, p) => {
    const qty = Number(p.quantita) || 0;
    const prezzo = Number(p.prezzo_unitario) || 0;
    return sum + qty * prezzo;
  }, 0);

  // Imponibile = pezzi + manodopera
  const imponibile = round2(totalePezzi + manodopera_totale);

  // Sconto
  const scontoVal = Number(sconto_valore) || 0;
  let sconto_calcolato = 0;
  if (sconto_tipo === 'percentuale') {
    sconto_calcolato = round2((imponibile * scontoVal) / 100);
  } else {
    sconto_calcolato = round2(scontoVal);
  }

  // Imponibile netto
  const imponibile_netto = round2(Math.max(0, imponibile - sconto_calcolato));

  // IVA
  const aliquota = Number(aliquota_iva) || 0;
  const iva = round2((imponibile_netto * aliquota) / 100);

  // Totale
  const totale = round2(imponibile_netto + iva);

  return {
    manodopera_totale,
    imponibile,
    sconto_calcolato,
    imponibile_netto,
    iva,
    totale,
  };
}

/**
 * Round to 2 decimal places
 */
function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
