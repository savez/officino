const { normalizza, stessoMacchinario } = require('../../src/services/macchinario');

describe('normalizza', () => {
  it('toglie gli spazi ai bordi', () => {
    expect(normalizza('  Trattore  ')).toBe('trattore');
  });

  it('contrae gli spazi multipli', () => {
    expect(normalizza('Trattore   JD   6130R')).toBe('trattore jd 6130r');
  });

  it('non distingue maiuscole e minuscole', () => {
    expect(normalizza('TRATTORE')).toBe(normalizza('trattore'));
  });

  it('su un valore non testuale restituisce stringa vuota invece di sollevare', () => {
    expect(normalizza(null)).toBe('');
    expect(normalizza(undefined)).toBe('');
    expect(normalizza(42)).toBe('');
  });
});

describe('stessoMacchinario', () => {
  // È il caso che rende l'avviso utile invece che decorativo: con il confronto
  // esatto resterebbe muto proprio qui.
  it('riconosce lo stesso macchinario scritto con maiuscole diverse', () => {
    expect(stessoMacchinario('Trattore JD 6130R', 'trattore jd 6130r')).toBe(true);
  });

  it('riconosce lo stesso macchinario con spazi diversi', () => {
    expect(stessoMacchinario('  Trattore   JD ', 'Trattore JD')).toBe(true);
  });

  it('non confonde macchinari diversi', () => {
    expect(stessoMacchinario('Trattore JD 6130R', 'Trattore JD 6140R')).toBe(false);
  });

  // Un confronto approssimato segnalerebbe questi due; è esplicitamente fuori
  // scope, perché sarebbe un'anagrafica travestita.
  it('non fa confronti approssimati: una lettera di differenza sono due macchinari', () => {
    expect(stessoMacchinario('Trattore JD', 'Trattore JB')).toBe(false);
  });

  it('due nomi vuoti non sono lo stesso macchinario', () => {
    expect(stessoMacchinario('', '')).toBe(false);
    expect(stessoMacchinario('   ', 'Trattore')).toBe(false);
  });
});
