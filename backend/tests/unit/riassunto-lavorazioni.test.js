const {
  componiRiassunto,
  eStatoModificato,
} = require('../../src/services/riassunto-lavorazioni');

describe('componiRiassunto', () => {
  it('raggruppa le note per giorno, con il giorno come sezione', () => {
    const testo = componiRiassunto([
      { giorno: '2026-09-03', note: 'Sostituito filtro olio' },
      { giorno: '2026-09-05', note: 'Controllo impianto idraulico' },
    ]);
    expect(testo).toBe(
      '03/09/2026\nSostituito filtro olio\n\n05/09/2026\nControllo impianto idraulico',
    );
  });

  it('mette sotto lo stesso giorno le note di piu lavorazioni', () => {
    const testo = componiRiassunto([
      { giorno: '2026-09-03', note: 'Prima nota' },
      { giorno: '2026-09-03', note: 'Seconda nota' },
    ]);
    expect(testo).toBe('03/09/2026\nPrima nota\nSeconda nota');
  });

  it('ordina i giorni dal piu antico', () => {
    const testo = componiRiassunto([
      { giorno: '2026-09-10', note: 'Dopo' },
      { giorno: '2026-09-01', note: 'Prima' },
    ]);
    expect(testo.indexOf('Prima')).toBeLessThan(testo.indexOf('Dopo'));
  });

  // Un giorno con la sola data e nulla sotto sembrerebbe un errore di
  // compilazione.
  it('le lavorazioni senza note non producono righe ne intestazioni', () => {
    const testo = componiRiassunto([
      { giorno: '2026-09-03', note: null },
      { giorno: '2026-09-04', note: '   ' },
      { giorno: '2026-09-05', note: 'Unica nota' },
    ]);
    expect(testo).toBe('05/09/2026\nUnica nota');
    expect(testo).not.toContain('03/09/2026');
    expect(testo).not.toContain('04/09/2026');
  });

  // Sono due giornate di lavoro, non un duplicato da eliminare.
  it('note identiche in giorni diversi compaiono entrambe', () => {
    const testo = componiRiassunto([
      { giorno: '2026-09-03', note: 'Rabbocco olio' },
      { giorno: '2026-09-04', note: 'Rabbocco olio' },
    ]);
    expect(testo.match(/Rabbocco olio/g)).toHaveLength(2);
    expect(testo).toContain('03/09/2026');
    expect(testo).toContain('04/09/2026');
  });

  it('senza alcuna nota restituisce stringa vuota', () => {
    expect(componiRiassunto([{ giorno: '2026-09-03', note: null }])).toBe('');
  });

  it('su un elenco vuoto restituisce stringa vuota invece di sollevare', () => {
    expect(componiRiassunto([])).toBe('');
    expect(componiRiassunto()).toBe('');
  });

  it('toglie gli spazi ai bordi delle note', () => {
    expect(componiRiassunto([{ giorno: '2026-09-03', note: '  Nota  ' }])).toBe(
      '03/09/2026\nNota',
    );
  });
});

describe('eStatoModificato', () => {
  it('un testo identico al generato non risulta modificato', () => {
    expect(eStatoModificato('03/09/2026\nNota', '03/09/2026\nNota')).toBe(false);
  });

  it('un testo diverso risulta modificato', () => {
    expect(eStatoModificato('Testo mio', '03/09/2026\nNota')).toBe(true);
  });

  it('gli spazi ai bordi non contano', () => {
    expect(eStatoModificato('  Nota  ', 'Nota')).toBe(false);
  });

  it('un testo cancellato a fronte di un generato non vuoto risulta modificato', () => {
    expect(eStatoModificato('', '03/09/2026\nNota')).toBe(true);
    expect(eStatoModificato(null, '03/09/2026\nNota')).toBe(true);
  });

  it('due vuoti non risultano modificati', () => {
    expect(eStatoModificato(null, '')).toBe(false);
  });
});
