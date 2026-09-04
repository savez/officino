const {
  risolviPeriodo,
  periodoPredefinito,
  SCORCIATOIE,
  AMPIEZZA_MASSIMA_GIORNI,
} = require('../../src/services/periodo-analisi');

// Data di riferimento fissa: mercoledì 15 luglio 2026. Senza un "oggi"
// iniettabile i test delle scorciatoie fallirebbero a ogni cambio di mese.
const OGGI = new Date(2026, 6, 15);

describe('scorciatoie di periodo', () => {
  it('questo mese copre dal primo all ultimo giorno del mese corrente', () => {
    expect(risolviPeriodo({ scorciatoia: 'questo-mese' }, OGGI)).toEqual({
      da: '2026-07-01',
      a: '2026-07-31',
    });
  });

  it('mese scorso copre il mese precedente per intero', () => {
    expect(risolviPeriodo({ scorciatoia: 'mese-scorso' }, OGGI)).toEqual({
      da: '2026-06-01',
      a: '2026-06-30',
    });
  });

  it('mese scorso attraversa correttamente il capodanno', () => {
    expect(risolviPeriodo({ scorciatoia: 'mese-scorso' }, new Date(2026, 0, 10))).toEqual({
      da: '2025-12-01',
      a: '2025-12-31',
    });
  });

  it('ultimi 30 giorni finisce oggi e comprende 30 giorni in tutto', () => {
    expect(risolviPeriodo({ scorciatoia: 'ultimi-30-giorni' }, OGGI)).toEqual({
      da: '2026-06-16',
      a: '2026-07-15',
    });
  });

  it('quest anno parte dal primo gennaio e arriva a oggi', () => {
    expect(risolviPeriodo({ scorciatoia: 'quest-anno' }, OGGI)).toEqual({
      da: '2026-01-01',
      a: '2026-07-15',
    });
  });

  it('gestisce febbraio di un anno bisestile', () => {
    expect(risolviPeriodo({ scorciatoia: 'questo-mese' }, new Date(2024, 1, 10))).toEqual({
      da: '2024-02-01',
      a: '2024-02-29',
    });
  });

  it('espone le scorciatoie disponibili', () => {
    expect(SCORCIATOIE).toEqual(
      expect.arrayContaining(['questo-mese', 'mese-scorso', 'ultimi-30-giorni', 'quest-anno'])
    );
  });

  it('rifiuta una scorciatoia sconosciuta', () => {
    expect(() => risolviPeriodo({ scorciatoia: 'ultimo-decennio' }, OGGI)).toThrow(
      /scorciatoia/i
    );
  });
});

describe('intervallo esplicito', () => {
  it('accetta un intervallo valido e lo restituisce invariato', () => {
    expect(risolviPeriodo({ da: '2026-03-10', a: '2026-05-20' }, OGGI)).toEqual({
      da: '2026-03-10',
      a: '2026-05-20',
    });
  });

  it('accetta un intervallo di un solo giorno: gli estremi sono inclusi', () => {
    expect(risolviPeriodo({ da: '2026-03-10', a: '2026-03-10' }, OGGI)).toEqual({
      da: '2026-03-10',
      a: '2026-03-10',
    });
  });

  it('rifiuta la fine precedente all inizio', () => {
    expect(() => risolviPeriodo({ da: '2026-05-20', a: '2026-03-10' }, OGGI)).toThrow(
      /precedente|successiva|ordine/i
    );
  });

  it('rifiuta una data in formato non valido', () => {
    expect(() => risolviPeriodo({ da: '10-03-2026', a: '2026-05-20' }, OGGI)).toThrow();
    expect(() => risolviPeriodo({ da: '2026-03-10', a: 'domani' }, OGGI)).toThrow();
  });

  it('rifiuta una data inesistente nel calendario', () => {
    expect(() => risolviPeriodo({ da: '2026-02-30', a: '2026-03-10' }, OGGI)).toThrow();
  });

  it('rifiuta un intervallo con un solo estremo', () => {
    expect(() => risolviPeriodo({ da: '2026-03-10' }, OGGI)).toThrow();
    expect(() => risolviPeriodo({ a: '2026-03-10' }, OGGI)).toThrow();
  });
});

// FR-006: senza limite un intervallo di anni caricherebbe tutte le righe
// storiche in memoria, perche' l'aggregazione avviene lato applicazione.
describe('ampiezza massima', () => {
  it('accetta un intervallo esattamente al limite', () => {
    const da = new Date(2026, 0, 1);
    const a = new Date(2026, 0, 1);
    a.setDate(a.getDate() + AMPIEZZA_MASSIMA_GIORNI - 1);
    const iso = (d) => d.toISOString().slice(0, 10);

    expect(() => risolviPeriodo({ da: iso(da), a: iso(a) }, OGGI)).not.toThrow();
  });

  it('rifiuta un intervallo oltre il limite, dicendo qual e il limite', () => {
    const da = new Date(2026, 0, 1);
    const a = new Date(2026, 0, 1);
    a.setDate(a.getDate() + AMPIEZZA_MASSIMA_GIORNI);
    const iso = (d) => d.toISOString().slice(0, 10);

    expect(() => risolviPeriodo({ da: iso(da), a: iso(a) }, OGGI)).toThrow(
      new RegExp(String(AMPIEZZA_MASSIMA_GIORNI))
    );
  });

  it('il limite copre almeno un anno intero', () => {
    expect(AMPIEZZA_MASSIMA_GIORNI).toBeGreaterThanOrEqual(366);
  });
});

// FR-004: all'apertura la dashboard mostra qualcosa senza chiedere nulla.
describe('periodo predefinito', () => {
  it('propone il mese corrente', () => {
    expect(periodoPredefinito(OGGI)).toEqual({ da: '2026-07-01', a: '2026-07-31' });
  });

  it('e sempre un intervallo valido', () => {
    const p = periodoPredefinito(OGGI);

    expect(() => risolviPeriodo(p, OGGI)).not.toThrow();
  });
});

describe('precedenza fra scorciatoia e intervallo esplicito', () => {
  it('la scorciatoia vince, cosi il chiamante non deve svuotare da e a', () => {
    expect(
      risolviPeriodo({ scorciatoia: 'questo-mese', da: '2020-01-01', a: '2020-12-31' }, OGGI)
    ).toEqual({ da: '2026-07-01', a: '2026-07-31' });
  });

  it('senza argomenti restituisce il periodo predefinito', () => {
    expect(risolviPeriodo({}, OGGI)).toEqual(periodoPredefinito(OGGI));
  });
});
