const { calcolaPreventivo, round2 } = require('../../src/services/calcolo-preventivo');

// ---------- round2 ----------

describe('round2', () => {
  it('should round to 2 decimal places', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(1.004)).toBe(1);
    expect(round2(2.345)).toBe(2.35);
    expect(round2(2.344)).toBe(2.34);
  });

  it('should handle integers', () => {
    expect(round2(5)).toBe(5);
    expect(round2(0)).toBe(0);
  });

  it('should handle negative numbers', () => {
    expect(round2(-1.005)).toBe(-1);
    expect(round2(-2.345)).toBe(-2.34);
    expect(round2(-2.346)).toBe(-2.35);
  });

  it('should return 0 for 0', () => {
    expect(round2(0)).toBe(0);
  });

  it('should handle very small numbers', () => {
    expect(round2(0.001)).toBe(0);
    expect(round2(0.009)).toBe(0.01);
  });
});

// ---------- Empty pezzi ----------

describe('calcolaPreventivo - empty pezzi', () => {
  it('should return all zeros when pezzi is empty and no labor', () => {
    const result = calcolaPreventivo({
      pezzi: [],
      manodopera_ore: 0,
      manodopera_costo_orario: 0,
      sconto_tipo: 'fisso',
      sconto_valore: 0,
      aliquota_iva: 22,
    });

    expect(result.manodopera_totale).toBe(0);
    expect(result.imponibile).toBe(0);
    expect(result.sconto_calcolato).toBe(0);
    expect(result.imponibile_netto).toBe(0);
    expect(result.iva).toBe(0);
    expect(result.totale).toBe(0);
  });

  it('should calculate labor even with empty pezzi', () => {
    const result = calcolaPreventivo({
      pezzi: [],
      manodopera_ore: 2,
      manodopera_costo_orario: 30,
      sconto_tipo: 'fisso',
      sconto_valore: 0,
      aliquota_iva: 22,
    });

    expect(result.manodopera_totale).toBe(60);
    expect(result.imponibile).toBe(60);
    expect(result.imponibile_netto).toBe(60);
    expect(result.iva).toBe(13.2);
    expect(result.totale).toBe(73.2);
  });
});

// ---------- Single pezzo ----------

describe('calcolaPreventivo - single pezzo', () => {
  it('should calculate correctly for a single line item', () => {
    const result = calcolaPreventivo({
      pezzi: [{ quantita: 3, prezzo_unitario: 10 }],
      manodopera_ore: 0,
      manodopera_costo_orario: 0,
      sconto_tipo: 'fisso',
      sconto_valore: 0,
      aliquota_iva: 22,
    });

    // 3 * 10 = 30
    expect(result.manodopera_totale).toBe(0);
    expect(result.imponibile).toBe(30);
    expect(result.sconto_calcolato).toBe(0);
    expect(result.imponibile_netto).toBe(30);
    expect(result.iva).toBe(6.6); // 30 * 0.22
    expect(result.totale).toBe(36.6);
  });
});

// ---------- Multiple pezzi ----------

describe('calcolaPreventivo - multiple pezzi', () => {
  it('should sum up multiple line items correctly', () => {
    const result = calcolaPreventivo({
      pezzi: [
        { quantita: 2, prezzo_unitario: 15 },
        { quantita: 5, prezzo_unitario: 3.5 },
        { quantita: 1, prezzo_unitario: 100 },
      ],
      manodopera_ore: 0,
      manodopera_costo_orario: 0,
      sconto_tipo: 'fisso',
      sconto_valore: 0,
      aliquota_iva: 22,
    });

    // (2*15) + (5*3.5) + (1*100) = 30 + 17.5 + 100 = 147.5
    expect(result.imponibile).toBe(147.5);
    expect(result.imponibile_netto).toBe(147.5);
    expect(result.iva).toBe(32.45); // 147.5 * 0.22
    expect(result.totale).toBe(179.95);
  });
});

// ---------- Labor ----------

describe('calcolaPreventivo - labor', () => {
  it('should calculate manodopera_totale as ore * costo_orario', () => {
    const result = calcolaPreventivo({
      pezzi: [],
      manodopera_ore: 3,
      manodopera_costo_orario: 25,
      sconto_tipo: 'fisso',
      sconto_valore: 0,
      aliquota_iva: 22,
    });

    expect(result.manodopera_totale).toBe(75);
    expect(result.imponibile).toBe(75);
  });

  it('should combine parts and labor in imponibile', () => {
    const result = calcolaPreventivo({
      pezzi: [{ quantita: 2, prezzo_unitario: 50 }],
      manodopera_ore: 1.5,
      manodopera_costo_orario: 40,
      sconto_tipo: 'fisso',
      sconto_valore: 0,
      aliquota_iva: 22,
    });

    // Parts: 2*50 = 100, Labor: 1.5*40 = 60 -> imponibile = 160
    expect(result.manodopera_totale).toBe(60);
    expect(result.imponibile).toBe(160);
    expect(result.imponibile_netto).toBe(160);
    expect(result.iva).toBe(35.2); // 160 * 0.22
    expect(result.totale).toBe(195.2);
  });

  it('should handle fractional hours correctly', () => {
    const result = calcolaPreventivo({
      pezzi: [],
      manodopera_ore: 0.25,
      manodopera_costo_orario: 40,
      sconto_tipo: 'fisso',
      sconto_valore: 0,
      aliquota_iva: 22,
    });

    expect(result.manodopera_totale).toBe(10);
    expect(result.imponibile).toBe(10);
  });
});

// ---------- Sconto fisso ----------

describe('calcolaPreventivo - sconto fisso', () => {
  it('should apply fixed discount correctly', () => {
    const result = calcolaPreventivo({
      pezzi: [{ quantita: 1, prezzo_unitario: 100 }],
      manodopera_ore: 0,
      manodopera_costo_orario: 0,
      sconto_tipo: 'fisso',
      sconto_valore: 20,
      aliquota_iva: 22,
    });

    expect(result.imponibile).toBe(100);
    expect(result.sconto_calcolato).toBe(20);
    expect(result.imponibile_netto).toBe(80);
    expect(result.iva).toBe(17.6); // 80 * 0.22
    expect(result.totale).toBe(97.6);
  });

  it('should cap fixed discount at imponibile', () => {
    const result = calcolaPreventivo({
      pezzi: [{ quantita: 1, prezzo_unitario: 50 }],
      manodopera_ore: 0,
      manodopera_costo_orario: 0,
      sconto_tipo: 'fisso',
      sconto_valore: 100, // more than imponibile
      aliquota_iva: 22,
    });

    expect(result.imponibile).toBe(50);
    expect(result.sconto_calcolato).toBe(50); // capped at imponibile
    expect(result.imponibile_netto).toBe(0);
    expect(result.iva).toBe(0);
    expect(result.totale).toBe(0);
  });
});

// ---------- Sconto percentuale ----------

describe('calcolaPreventivo - sconto percentuale', () => {
  it('should apply percentage discount correctly', () => {
    const result = calcolaPreventivo({
      pezzi: [{ quantita: 1, prezzo_unitario: 200 }],
      manodopera_ore: 0,
      manodopera_costo_orario: 0,
      sconto_tipo: 'percentuale',
      sconto_valore: 10,
      aliquota_iva: 22,
    });

    // 10% of 200 = 20
    expect(result.imponibile).toBe(200);
    expect(result.sconto_calcolato).toBe(20);
    expect(result.imponibile_netto).toBe(180);
    expect(result.iva).toBe(39.6); // 180 * 0.22
    expect(result.totale).toBe(219.6);
  });

  it('should cap percentage discount at imponibile (100%+)', () => {
    const result = calcolaPreventivo({
      pezzi: [{ quantita: 1, prezzo_unitario: 50 }],
      manodopera_ore: 0,
      manodopera_costo_orario: 0,
      sconto_tipo: 'percentuale',
      sconto_valore: 150, // 150% -> sconto_calcolato = 75, but capped at 50
      aliquota_iva: 22,
    });

    expect(result.imponibile).toBe(50);
    expect(result.sconto_calcolato).toBe(50); // capped
    expect(result.imponibile_netto).toBe(0);
    expect(result.totale).toBe(0);
  });

  it('should apply 50% discount correctly', () => {
    const result = calcolaPreventivo({
      pezzi: [{ quantita: 4, prezzo_unitario: 25 }],
      manodopera_ore: 0,
      manodopera_costo_orario: 0,
      sconto_tipo: 'percentuale',
      sconto_valore: 50,
      aliquota_iva: 22,
    });

    // 4*25 = 100, 50% = 50
    expect(result.imponibile).toBe(100);
    expect(result.sconto_calcolato).toBe(50);
    expect(result.imponibile_netto).toBe(50);
    expect(result.iva).toBe(11); // 50 * 0.22
    expect(result.totale).toBe(61);
  });
});

// ---------- IVA rates ----------

describe('calcolaPreventivo - IVA rates', () => {
  it('should calculate 0% IVA correctly', () => {
    const result = calcolaPreventivo({
      pezzi: [{ quantita: 1, prezzo_unitario: 100 }],
      manodopera_ore: 0,
      manodopera_costo_orario: 0,
      sconto_tipo: 'fisso',
      sconto_valore: 0,
      aliquota_iva: 0,
    });

    expect(result.imponibile_netto).toBe(100);
    expect(result.iva).toBe(0);
    expect(result.totale).toBe(100);
  });

  it('should calculate 10% IVA correctly', () => {
    const result = calcolaPreventivo({
      pezzi: [{ quantita: 1, prezzo_unitario: 100 }],
      manodopera_ore: 0,
      manodopera_costo_orario: 0,
      sconto_tipo: 'fisso',
      sconto_valore: 0,
      aliquota_iva: 10,
    });

    expect(result.imponibile_netto).toBe(100);
    expect(result.iva).toBe(10);
    expect(result.totale).toBe(110);
  });

  it('should calculate 22% IVA correctly', () => {
    const result = calcolaPreventivo({
      pezzi: [{ quantita: 1, prezzo_unitario: 100 }],
      manodopera_ore: 0,
      manodopera_costo_orario: 0,
      sconto_tipo: 'fisso',
      sconto_valore: 0,
      aliquota_iva: 22,
    });

    expect(result.imponibile_netto).toBe(100);
    expect(result.iva).toBe(22);
    expect(result.totale).toBe(122);
  });

  it('should calculate IVA on imponibile_netto (after discount)', () => {
    const result = calcolaPreventivo({
      pezzi: [{ quantita: 1, prezzo_unitario: 100 }],
      manodopera_ore: 0,
      manodopera_costo_orario: 0,
      sconto_tipo: 'fisso',
      sconto_valore: 30,
      aliquota_iva: 22,
    });

    // imponibile_netto = 100 - 30 = 70
    expect(result.imponibile_netto).toBe(70);
    expect(result.iva).toBe(15.4); // 70 * 0.22
    expect(result.totale).toBe(85.4);
  });
});

// ---------- Rounding ----------

describe('calcolaPreventivo - rounding', () => {
  it('should round all fields to 2 decimal places', () => {
    const result = calcolaPreventivo({
      pezzi: [{ quantita: 3, prezzo_unitario: 7.33 }],
      manodopera_ore: 1.33,
      manodopera_costo_orario: 17.77,
      sconto_tipo: 'fisso',
      sconto_valore: 0,
      aliquota_iva: 22,
    });

    // Every field should be a number with at most 2 decimals
    const fields = [
      result.manodopera_totale,
      result.imponibile,
      result.sconto_calcolato,
      result.imponibile_netto,
      result.iva,
      result.totale,
    ];

    for (const value of fields) {
      const decimalPart = value.toString().split('.')[1] || '';
      expect(decimalPart.length).toBeLessThanOrEqual(2);
    }
  });

  it('should handle a complex scenario with all features combined', () => {
    const result = calcolaPreventivo({
      pezzi: [
        { quantita: 3, prezzo_unitario: 12.5 },
        { quantita: 1, prezzo_unitario: 45.99 },
      ],
      manodopera_ore: 2.5,
      manodopera_costo_orario: 35,
      sconto_tipo: 'percentuale',
      sconto_valore: 15,
      aliquota_iva: 22,
    });

    // Parts: (3*12.5) + (1*45.99) = 37.5 + 45.99 = 83.49
    // Labor: 2.5*35 = 87.5
    // Imponibile: 83.49 + 87.5 = 170.99
    // Sconto: 170.99 * 15/100 = 25.6485 -> round2 -> 25.65
    // Imponibile netto: 170.99 - 25.65 = 145.34
    // IVA: 145.34 * 22/100 = 31.9748 -> round2 -> 31.97
    // Totale: 145.34 + 31.97 = 177.31

    expect(result.manodopera_totale).toBe(87.5);
    expect(result.imponibile).toBe(170.99);
    expect(result.sconto_calcolato).toBe(25.65);
    expect(result.imponibile_netto).toBe(145.34);
    expect(result.iva).toBe(31.97);
    expect(result.totale).toBe(177.31);
  });
});

// ---------- Defaults ----------

describe('calcolaPreventivo - defaults', () => {
  it('should use default values when called with empty object', () => {
    const result = calcolaPreventivo({});

    expect(result.manodopera_totale).toBe(0);
    expect(result.imponibile).toBe(0);
    expect(result.sconto_calcolato).toBe(0);
    expect(result.imponibile_netto).toBe(0);
    expect(result.iva).toBe(0);
    expect(result.totale).toBe(0);
  });

  it('should handle string numbers in pezzi (from DB)', () => {
    const result = calcolaPreventivo({
      pezzi: [{ quantita: '3', prezzo_unitario: '10.50' }],
      manodopera_ore: '2',
      manodopera_costo_orario: '30',
      sconto_tipo: 'fisso',
      sconto_valore: '5',
      aliquota_iva: '22',
    });

    // Parts: 3*10.50 = 31.50, Labor: 2*30 = 60 -> imponibile = 91.50
    // Sconto: 5 -> netto = 86.50
    // IVA: 86.50 * 0.22 = 19.03
    // Totale: 86.50 + 19.03 = 105.53
    expect(result.manodopera_totale).toBe(60);
    expect(result.imponibile).toBe(91.5);
    expect(result.sconto_calcolato).toBe(5);
    expect(result.imponibile_netto).toBe(86.5);
    expect(result.iva).toBe(19.03);
    expect(result.totale).toBe(105.53);
  });
});
