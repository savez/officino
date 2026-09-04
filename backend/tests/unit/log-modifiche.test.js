const { computeDiff, logModifica } = require('../../src/services/log-modifiche');

describe('logModifica', () => {
  // Il registro e' disattivato: la funzione non deve scrivere nulla, e non deve
  // nemmeno interrogare il database. Il test verifica il contratto — nessuna
  // riga scritta — non il modo in cui ci si arriva.
  it('non scrive nulla e non tocca il database', async () => {
    const db = jest.fn(() => {
      throw new Error('il registro e\' disattivato: nessuna query attesa');
    });

    await expect(
      logModifica(db, {
        utente_id: 1,
        entita: 'cliente',
        entita_id: 10,
        azione: 'modifica',
        dettaglio: { nome: { prima: 'A', dopo: 'B' } },
      }),
    ).resolves.toBeUndefined();

    expect(db).not.toHaveBeenCalled();
  });
});

describe('computeDiff', () => {
  it('should return null when objects are identical', () => {
    const before = { nome: 'Test', prezzo: 10 };
    const after = { nome: 'Test', prezzo: 10 };

    expect(computeDiff(before, after)).toBeNull();
  });

  it('should detect changed fields', () => {
    const before = { nome: 'Vecchio', prezzo: 10 };
    const after = { nome: 'Nuovo', prezzo: 20 };

    const result = computeDiff(before, after);

    expect(result).toEqual({
      nome: { prima: 'Vecchio', dopo: 'Nuovo' },
      prezzo: { prima: 10, dopo: 20 },
    });
  });

  it('should only include changed fields, ignoring unchanged ones', () => {
    const before = { nome: 'Test', prezzo: 10, quantita: 5 };
    const after = { nome: 'Test', prezzo: 20, quantita: 5 };

    const result = computeDiff(before, after);

    expect(result).toEqual({
      prezzo: { prima: 10, dopo: 20 },
    });
    expect(result).not.toHaveProperty('nome');
    expect(result).not.toHaveProperty('quantita');
  });

  it('should handle null values in before', () => {
    const before = { nome: null, prezzo: 10 };
    const after = { nome: 'Nuovo', prezzo: 10 };

    const result = computeDiff(before, after);

    expect(result).toEqual({
      nome: { prima: null, dopo: 'Nuovo' },
    });
  });

  it('should handle null values in after', () => {
    const before = { nome: 'Vecchio', prezzo: 10 };
    const after = { nome: null, prezzo: 10 };

    const result = computeDiff(before, after);

    expect(result).toEqual({
      nome: { prima: 'Vecchio', dopo: null },
    });
  });

  it('should handle undefined values in before', () => {
    const before = { prezzo: 10 };
    const after = { nome: 'Nuovo', prezzo: 10 };

    const result = computeDiff(before, after);

    expect(result).toEqual({
      nome: { prima: null, dopo: 'Nuovo' },
    });
  });

  it('should handle undefined values in after', () => {
    const before = { nome: 'Vecchio', prezzo: 10 };
    const after = { prezzo: 10 };

    const result = computeDiff(before, after);

    expect(result).toEqual({
      nome: { prima: 'Vecchio', dopo: null },
    });
  });

  it('should work with a specific field list', () => {
    const before = { nome: 'Vecchio', prezzo: 10, quantita: 5, marca: 'A' };
    const after = { nome: 'Nuovo', prezzo: 20, quantita: 5, marca: 'B' };

    const result = computeDiff(before, after, ['nome', 'prezzo']);

    expect(result).toEqual({
      nome: { prima: 'Vecchio', dopo: 'Nuovo' },
      prezzo: { prima: 10, dopo: 20 },
    });
    // marca changed but was not in the fields list
    expect(result).not.toHaveProperty('marca');
  });

  it('should return null when all specified fields are unchanged', () => {
    const before = { nome: 'Test', prezzo: 10, quantita: 5 };
    const after = { nome: 'Test', prezzo: 10, quantita: 99 };

    const result = computeDiff(before, after, ['nome', 'prezzo']);

    expect(result).toBeNull();
  });

  it('should not show diff for numeric vs string comparison (e.g. "22" vs 22)', () => {
    const before = { prezzo: '22', quantita: '10' };
    const after = { prezzo: 22, quantita: 10 };

    const result = computeDiff(before, after);

    expect(result).toBeNull();
  });

  it('should not show diff when both values are null/undefined', () => {
    const before = { nome: null };
    const after = { nome: undefined };

    const result = computeDiff(before, after);

    expect(result).toBeNull();
  });

  it('should detect change from empty string to a value', () => {
    const before = { nome: '' };
    const after = { nome: 'Nuovo' };

    const result = computeDiff(before, after);

    expect(result).toEqual({
      nome: { prima: '', dopo: 'Nuovo' },
    });
  });

  it('should handle empty objects', () => {
    const result = computeDiff({}, {});
    expect(result).toBeNull();
  });

  it('should handle fields present only in after', () => {
    const before = {};
    const after = { nome: 'Nuovo' };

    const result = computeDiff(before, after);

    expect(result).toEqual({
      nome: { prima: null, dopo: 'Nuovo' },
    });
  });

  it('should handle fields present only in before', () => {
    const before = { nome: 'Vecchio' };
    const after = {};

    const result = computeDiff(before, after);

    expect(result).toEqual({
      nome: { prima: 'Vecchio', dopo: null },
    });
  });
});
