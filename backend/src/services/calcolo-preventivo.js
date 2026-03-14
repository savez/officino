/**
 * Centralized calculation service for preventivi.
 * All amounts are VAT-excluded. IVA is applied on the net total.
 *
 * @module services/calcolo-preventivo
 */

/**
 * Rounds a number to 2 decimal places
 * @param {number} n
 * @returns {number}
 */
function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Calculates all derived fields for a preventivo.
 *
 * @param {object} params
 * @param {Array<{ quantita: number, prezzo_unitario: number }>} params.pezzi - line items
 * @param {number} params.manodopera_ore - labor hours
 * @param {number} params.manodopera_costo_orario - labor cost per hour
 * @param {'fisso'|'percentuale'} params.sconto_tipo - discount type
 * @param {number} params.sconto_valore - discount value (fixed amount or percentage)
 * @param {number} params.aliquota_iva - VAT rate (e.g. 22 for 22%)
 * @returns {{
 *   manodopera_totale: number,
 *   imponibile: number,
 *   sconto_calcolato: number,
 *   imponibile_netto: number,
 *   iva: number,
 *   totale: number
 * }}
 */
function calcolaPreventivo({
  pezzi = [],
  manodopera_ore = 0,
  manodopera_costo_orario = 0,
  sconto_tipo = 'fisso',
  sconto_valore = 0,
  aliquota_iva = 22,
}) {
  // Sum of all line items
  const totale_pezzi = pezzi.reduce((sum, p) => {
    return sum + (Number(p.quantita) || 0) * (Number(p.prezzo_unitario) || 0);
  }, 0);

  // Labor total
  const manodopera_totale = round2(
    (Number(manodopera_ore) || 0) * (Number(manodopera_costo_orario) || 0)
  );

  // Taxable amount (parts + labor)
  const imponibile = round2(totale_pezzi + manodopera_totale);

  // Discount calculation
  let sconto_calcolato;
  if (sconto_tipo === 'percentuale') {
    sconto_calcolato = round2(imponibile * (Number(sconto_valore) || 0) / 100);
  } else {
    sconto_calcolato = round2(Number(sconto_valore) || 0);
  }

  // Don't allow discount to exceed imponibile
  sconto_calcolato = Math.min(sconto_calcolato, imponibile);

  // Net taxable
  const imponibile_netto = round2(imponibile - sconto_calcolato);

  // VAT
  const iva = round2(imponibile_netto * (Number(aliquota_iva) || 0) / 100);

  // Grand total
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

module.exports = { calcolaPreventivo, round2 };
