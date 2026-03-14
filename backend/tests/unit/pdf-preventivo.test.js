const { generaPdfPreventivo, formatEuro, formatDate } = require('../../src/services/pdf-preventivo');

// ---------- formatEuro ----------

describe('formatEuro', () => {
  it('should format 0 as "0,00"', () => {
    expect(formatEuro(0)).toBe('0,00');
  });

  it('should format 100 as "100,00"', () => {
    expect(formatEuro(100)).toBe('100,00');
  });

  it('should format 1234.56 as "1234,56"', () => {
    expect(formatEuro(1234.56)).toBe('1234,56');
  });

  it('should format small decimal 0.5 as "0,50"', () => {
    expect(formatEuro(0.5)).toBe('0,50');
  });

  it('should format negative number -10.5 as "-10,50"', () => {
    expect(formatEuro(-10.5)).toBe('-10,50');
  });

  it('should handle null/undefined as "0,00"', () => {
    expect(formatEuro(null)).toBe('0,00');
    expect(formatEuro(undefined)).toBe('0,00');
  });

  it('should handle string number "99.9" as "99,90"', () => {
    expect(formatEuro('99.9')).toBe('99,90');
  });

  it('should round to 2 decimal places', () => {
    expect(formatEuro(1.999)).toBe('2,00');
    expect(formatEuro(1.004)).toBe('1,00');
    // Note: 1.005 rounds to "1,00" due to IEEE 754 floating-point with toFixed(2)
    expect(formatEuro(1.005)).toBe('1,00');
    expect(formatEuro(1.006)).toBe('1,01');
  });
});

// ---------- formatDate ----------

describe('formatDate', () => {
  it('should format a date string as dd/mm/yyyy', () => {
    expect(formatDate('2026-01-15')).toBe('15/01/2026');
  });

  it('should format a Date object as dd/mm/yyyy', () => {
    const date = new Date(2026, 11, 25); // December 25, 2026
    expect(formatDate(date)).toBe('25/12/2026');
  });

  it('should pad single-digit day and month', () => {
    expect(formatDate('2026-03-05')).toBe('05/03/2026');
  });

  it('should handle end of year date', () => {
    expect(formatDate('2026-12-31')).toBe('31/12/2026');
  });

  it('should handle beginning of year date', () => {
    expect(formatDate('2026-01-01')).toBe('01/01/2026');
  });
});

// ---------- generaPdfPreventivo ----------

describe('generaPdfPreventivo', () => {
  const minimalPreventivo = {
    numero: '2026/0001',
    data: '2026-01-15',
    stato: 'bozza',
    cliente_nome: 'Test Cliente',
    cliente_cf: null,
    cliente_piva: null,
    pezzi: [],
    manodopera_ore: 0,
    manodopera_costo_orario: 0,
    manodopera_totale: 0,
    sconto_tipo: 'fisso',
    sconto_valore: 0,
    sconto_calcolato: 0,
    imponibile: 0,
    imponibile_netto: 0,
    aliquota_iva: 22,
    iva: 0,
    totale: 0,
    note: null,
  };

  const minimalImpostazioni = {
    nome: 'Test Officina',
    partita_iva: null,
    indirizzo: null,
    telefono: null,
    email: null,
    logo_url: null,
    aliquota_iva_default: 22,
  };

  it('should return a Buffer', async () => {
    const result = await generaPdfPreventivo(minimalPreventivo, minimalImpostazioni);
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it('should return a buffer that starts with %PDF (valid PDF header)', async () => {
    const result = await generaPdfPreventivo(minimalPreventivo, minimalImpostazioni);
    const header = result.subarray(0, 5).toString('ascii');
    expect(header).toBe('%PDF-');
  });

  it('should work with minimal data (no pezzi, no logo)', async () => {
    const result = await generaPdfPreventivo(minimalPreventivo, minimalImpostazioni);
    expect(result.length).toBeGreaterThan(0);
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it('should work with full data (pezzi, manodopera, sconto, notes)', async () => {
    const fullPreventivo = {
      ...minimalPreventivo,
      cliente_nome: 'Mario Rossi',
      cliente_cf: 'RSSMRA80A01H501Z',
      cliente_piva: '01234567890',
      pezzi: [
        {
          pezzo_nome: 'Bullone M8',
          pezzo_marca: 'BoltCo',
          pezzo_modello: 'BM8',
          quantita: 3,
          prezzo_unitario: 10,
          note: 'Nota pezzo 1',
        },
        {
          pezzo_nome: 'Dado M8',
          pezzo_marca: null,
          pezzo_modello: null,
          quantita: 6,
          prezzo_unitario: 2.5,
          note: null,
        },
      ],
      manodopera_ore: 2,
      manodopera_costo_orario: 30,
      manodopera_totale: 60,
      sconto_tipo: 'percentuale',
      sconto_valore: 10,
      sconto_calcolato: 10.5,
      imponibile: 105,
      imponibile_netto: 94.5,
      aliquota_iva: 22,
      iva: 20.79,
      totale: 115.29,
      note: 'Note del preventivo di test',
    };

    const fullImpostazioni = {
      nome: 'Officina Meccanica Rossi',
      partita_iva: '01234567890',
      indirizzo: 'Via Roma 1, 20100 Milano',
      telefono: '+39 0461 123456',
      email: 'info@officinarossi.it',
      logo_url: null, // no logo file in tests
      aliquota_iva_default: 22,
    };

    const result = await generaPdfPreventivo(fullPreventivo, fullImpostazioni);
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);

    // Valid PDF header
    const header = result.subarray(0, 5).toString('ascii');
    expect(header).toBe('%PDF-');
  });

  it('should handle missing/null fields gracefully', async () => {
    const sparsePreventivo = {
      numero: '2026/0099',
      data: '2026-06-01',
      stato: 'bozza',
      cliente_nome: null,
      cliente_cf: null,
      cliente_piva: null,
      pezzi: null, // null instead of array
      manodopera_ore: 0,
      manodopera_costo_orario: 0,
      manodopera_totale: 0,
      sconto_tipo: 'fisso',
      sconto_valore: 0,
      sconto_calcolato: 0,
      imponibile: 0,
      imponibile_netto: 0,
      aliquota_iva: 22,
      iva: 0,
      totale: 0,
      note: null,
    };

    const sparseImpostazioni = {
      nome: null,
      partita_iva: null,
      indirizzo: null,
      telefono: null,
      email: null,
      logo_url: null,
      aliquota_iva_default: 22,
    };

    const result = await generaPdfPreventivo(sparsePreventivo, sparseImpostazioni);
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should handle pezzi with note fields', async () => {
    const preventivoWithNotes = {
      ...minimalPreventivo,
      pezzi: [
        {
          pezzo_nome: 'Pezzo con nota',
          pezzo_marca: null,
          pezzo_modello: null,
          quantita: 1,
          prezzo_unitario: 50,
          note: 'Nota molto importante per il pezzo',
        },
      ],
      imponibile: 50,
      imponibile_netto: 50,
      iva: 11,
      totale: 61,
    };

    const result = await generaPdfPreventivo(preventivoWithNotes, minimalImpostazioni);
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should produce a larger PDF when there is more content', async () => {
    const emptyResult = await generaPdfPreventivo(minimalPreventivo, minimalImpostazioni);

    const fullPreventivo = {
      ...minimalPreventivo,
      pezzi: Array.from({ length: 10 }, (_, i) => ({
        pezzo_nome: `Pezzo ${i + 1}`,
        pezzo_marca: 'Marca',
        pezzo_modello: 'Modello',
        quantita: i + 1,
        prezzo_unitario: 10 + i,
        note: `Nota pezzo ${i + 1}`,
      })),
      manodopera_ore: 5,
      manodopera_costo_orario: 40,
      manodopera_totale: 200,
      sconto_tipo: 'percentuale',
      sconto_valore: 15,
      sconto_calcolato: 50,
      imponibile: 500,
      imponibile_netto: 450,
      iva: 99,
      totale: 549,
      note: 'Note aggiuntive per il preventivo completo con molti dettagli.',
    };

    const fullResult = await generaPdfPreventivo(fullPreventivo, minimalImpostazioni);
    expect(fullResult.length).toBeGreaterThan(emptyResult.length);
  });
});
