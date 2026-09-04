const {
  buildPdfModel,
  generaPdfNotaLavorazione,
} = require('../../src/services/pdf-nota-lavorazione');

const notaBase = {
  cliente_nome: 'Azienda Rossi',
  data_riferimento: '2026-08-31',
  testo: 'Manutenzione ordinaria di fine mese.',
  divisione: 'unita',
  mostra_dettaglio_materiali: true,
  mostra_dettaglio_manodopera: true,
  totale_materiali_override: null,
  totale_manodopera_override: null,
  totale_override: null,
};

// Due rapportini su macchinari diversi. Materiali per 29, manodopera per 160.
const rapportiniBase = [
  {
    id: 1,
    macchina: 'Trattore JD 6130R',
    utente_nome: 'Mario',
    lavorazioni: [
      {
        id: 1,
        giorno: '2026-08-28',
        ore: 4,
        costo_orario_applicato: 25,
        materiali: [
          { id: 10, nome: 'Cavo', quantita: 2, fuori_catalogo: false, prezzo_unitario: 7.5 },
          { id: 11, nome: 'Vite', quantita: 5, fuori_catalogo: true, prezzo_unitario: 0.4 },
        ],
      },
    ],
  },
  {
    id: 2,
    macchina: 'Mietitrebbia CX',
    utente_nome: 'Luigi',
    lavorazioni: [
      {
        id: 2,
        giorno: '2026-08-30',
        ore: 2,
        costo_orario_applicato: 30,
        materiali: [
          { id: 12, nome: 'Filtro', quantita: 1, fuori_catalogo: false, prezzo_unitario: 12 },
        ],
      },
    ],
  },
];

describe('buildPdfModel — intestazione', () => {
  it("riporta cliente e data di RIFERIMENTO, non quella di creazione", () => {
    const m = buildPdfModel({ ...notaBase, created_at: '2026-09-15' }, rapportiniBase);
    expect(m.header.cliente_nome).toBe('Azienda Rossi');
    expect(m.header.data_riferimento).toBe('2026-08-31');
  });
});

describe('buildPdfModel — i due dettagli sono indipendenti', () => {
  const combinazioni = [
    [true, true],
    [true, false],
    [false, true],
    [false, false],
  ];

  it.each(combinazioni)(
    'materiali=%s manodopera=%s produce esattamente le sezioni attese',
    (materiali, manodopera) => {
      const m = buildPdfModel(
        {
          ...notaBase,
          mostra_dettaglio_materiali: materiali,
          mostra_dettaglio_manodopera: manodopera,
        },
        rapportiniBase,
      );
      expect(m.mostra_dettaglio_materiali).toBe(materiali);
      expect(m.mostra_dettaglio_manodopera).toBe(manodopera);
    },
  );

  it('il totale complessivo c e sempre, in ogni combinazione', () => {
    for (const [materiali, manodopera] of combinazioni) {
      const m = buildPdfModel(
        {
          ...notaBase,
          mostra_dettaglio_materiali: materiali,
          mostra_dettaglio_manodopera: manodopera,
        },
        rapportiniBase,
      );
      expect(m.totali.totale_finale).toBe(189);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Questi due controlli presidiano un'invariante che cambia FORMA, non sparisce:
// la manodopera ora si mostra, la tariffa oraria no. Sono l'unica cosa che
// impedisce alla tariffa di finire sul documento del cliente, e sono il tipo di
// test che si cancella per far passare la build quando il requisito cambia.
//
// ATTENZIONE a cosa NON garantiscono. Il documento mostra tutte le ore e un
// importo complessivo della manodopera: la tariffa MEDIA si ricava con una
// divisione. Riducono l'attrito, non l'informazione. Nessuno ci costruisca
// sopra una garanzia che non c'e'.
describe("l'invariante sul costo orario", () => {
  const combinazioni = [
    [true, true],
    [true, false],
    [false, true],
    [false, false],
  ];

  it.each(combinazioni)(
    'materiali=%s manodopera=%s: nessun costo orario nel modello',
    (materiali, manodopera) => {
      const m = buildPdfModel(
        {
          ...notaBase,
          mostra_dettaglio_materiali: materiali,
          mostra_dettaglio_manodopera: manodopera,
        },
        rapportiniBase,
      );
      expect(m.contiene_costo_orario).toBe(false);
      expect(m.contiene_importo_per_riga_ore).toBe(false);
      expect(JSON.stringify(m)).not.toMatch(/costo_orario_applicato/);
    },
  );

  it('le righe della manodopera portano le ore, mai un importo', () => {
    const m = buildPdfModel(notaBase, rapportiniBase);
    for (const riga of m.sezioni[0].ore_righe) {
      expect(riga).toHaveProperty('ore');
      expect(riga).not.toHaveProperty('importo');
      expect(riga).not.toHaveProperty('costo_manodopera');
      expect(riga).not.toHaveProperty('costo_orario_applicato');
    }
  });

  it('contiene_manodopera segue l interruttore: e il cambiamento di questa revisione', () => {
    expect(buildPdfModel(notaBase, rapportiniBase).contiene_manodopera).toBe(true);
    expect(
      buildPdfModel({ ...notaBase, mostra_dettaglio_manodopera: false }, rapportiniBase)
        .contiene_manodopera,
    ).toBe(false);
  });
});

// Difetto trovato confrontando una nota convertita col documento originale: la
// migrazione spegneva la manodopera, ma il blocco dei totali la stampava lo
// stesso. Una nota vecchia ristampata avrebbe rivelato al cliente un importo
// che l'originale non conteneva.
describe('i totali non rivelano una voce che il documento non mostra', () => {
  it('col dettaglio manodopera spento e nessun override, il suo totale non compare', () => {
    const m = buildPdfModel(
      { ...notaBase, mostra_dettaglio_manodopera: false },
      rapportiniBase,
    );
    expect(m.mostra_totale_manodopera).toBe(false);
    expect(m.mostra_totale_materiali).toBe(true);
  });

  it('col dettaglio materiali spento e nessun override, il suo totale non compare', () => {
    const m = buildPdfModel(
      { ...notaBase, mostra_dettaglio_materiali: false },
      rapportiniBase,
    );
    expect(m.mostra_totale_materiali).toBe(false);
  });

  // Un totale imposto e' proprio la cifra che si vuole far vedere.
  it('un totale imposto si mostra anche col dettaglio spento', () => {
    const m = buildPdfModel(
      { ...notaBase, mostra_dettaglio_manodopera: false, totale_manodopera_override: 400 },
      rapportiniBase,
    );
    expect(m.mostra_totale_manodopera).toBe(true);
  });

  it('senza alcun dettaglio ne override, resta il solo totale complessivo', () => {
    const m = buildPdfModel(
      {
        ...notaBase,
        mostra_dettaglio_materiali: false,
        mostra_dettaglio_manodopera: false,
      },
      rapportiniBase,
    );
    expect(m.mostra_totale_materiali).toBe(false);
    expect(m.mostra_totale_manodopera).toBe(false);
    expect(m.totali.totale_finale).toBe(189);
  });
});

// Con una sezione sola, il totale di sezione e quello della nota sarebbero lo
// stesso numero stampato due volte.
describe('i totali di sezione compaiono solo dove servono', () => {
  it('con una sezione sola non ci sono totali di sezione', () => {
    const m = buildPdfModel({ ...notaBase, divisione: 'unita' }, rapportiniBase);
    expect(m.sezioni[0].totale_materiali).toBeNull();
    expect(m.sezioni[0].totale_manodopera).toBeNull();
  });

  it('con piu sezioni ciascuna porta i propri', () => {
    const m = buildPdfModel({ ...notaBase, divisione: 'per_macchinario' }, rapportiniBase);
    for (const sezione of m.sezioni) {
      expect(sezione.totale_materiali).not.toBeNull();
      expect(sezione.totale_manodopera).not.toBeNull();
    }
  });
});

describe('buildPdfModel — righe della manodopera', () => {
  it('una riga per lavorazione, con giorno macchinario e ore', () => {
    const m = buildPdfModel(notaBase, rapportiniBase);
    expect(m.sezioni[0].ore_righe).toEqual([
      { giorno: '2026-08-28', macchina: 'Trattore JD 6130R', ore: 4 },
      { giorno: '2026-08-30', macchina: 'Mietitrebbia CX', ore: 2 },
    ]);
  });

  it('due lavorazioni nello stesso giorno su macchinari diversi restano due righe', () => {
    const m = buildPdfModel(notaBase, [
      { id: 1, macchina: 'A', lavorazioni: [{ id: 1, giorno: '2026-08-28', ore: 3, costo_orario_applicato: 20, materiali: [] }] },
      { id: 2, macchina: 'B', lavorazioni: [{ id: 2, giorno: '2026-08-28', ore: 4, costo_orario_applicato: 20, materiali: [] }] },
    ]);
    expect(m.sezioni[0].ore_righe).toHaveLength(2);
  });
});

describe('buildPdfModel — divisione per macchinario', () => {
  it('unita produce una sezione sola', () => {
    const m = buildPdfModel({ ...notaBase, divisione: 'unita' }, rapportiniBase);
    expect(m.sezioni).toHaveLength(1);
    expect(m.sezioni[0].titolo).toBeNull();
  });

  it('per_macchinario produce una sezione per macchinario', () => {
    const m = buildPdfModel({ ...notaBase, divisione: 'per_macchinario' }, rapportiniBase);
    expect(m.sezioni.map((s) => s.titolo)).toEqual(['Trattore JD 6130R', 'Mietitrebbia CX']);
  });

  // La divisione e per MACCHINARIO, non per rapportino.
  it('due rapportini sullo stesso macchinario confluiscono in una sezione', () => {
    const m = buildPdfModel({ ...notaBase, divisione: 'per_macchinario' }, [
      { id: 1, macchina: 'Trattore JD', lavorazioni: [{ id: 1, giorno: '2026-08-28', ore: 3, costo_orario_applicato: 20, materiali: [] }] },
      { id: 2, macchina: 'Trattore JD', lavorazioni: [{ id: 2, giorno: '2026-08-29', ore: 4, costo_orario_applicato: 20, materiali: [] }] },
    ]);
    expect(m.sezioni).toHaveLength(1);
    expect(m.sezioni[0].ore_righe).toHaveLength(2);
  });

  it('dividendo, il macchinario non si ripete sulle righe: e gia la sezione', () => {
    const m = buildPdfModel({ ...notaBase, divisione: 'per_macchinario' }, rapportiniBase);
    for (const s of m.sezioni) {
      for (const r of s.ore_righe) expect(r.macchina).toBeNull();
    }
  });

  it('la somma dei totali di sezione da il totale complessivo', () => {
    const m = buildPdfModel({ ...notaBase, divisione: 'per_macchinario' }, rapportiniBase);
    const somma = m.sezioni.reduce(
      (a, s) => a + s.totale_materiali + s.totale_manodopera,
      0,
    );
    expect(Math.round(somma * 100) / 100).toBe(m.totali.totale_finale);
  });
});

describe('buildPdfModel — totali imposti', () => {
  it('il totale materiali imposto spegne il dettaglio materiali', () => {
    const m = buildPdfModel({ ...notaBase, totale_materiali_override: 50 }, rapportiniBase);
    expect(m.mostra_dettaglio_materiali).toBe(false);
    expect(m.mostra_dettaglio_manodopera).toBe(true);
    expect(m.totali.totale_finale).toBe(210); // 50 + 160
  });

  it('il totale manodopera imposto spegne il dettaglio manodopera', () => {
    const m = buildPdfModel({ ...notaBase, totale_manodopera_override: 400 }, rapportiniBase);
    expect(m.mostra_dettaglio_manodopera).toBe(false);
    expect(m.mostra_dettaglio_materiali).toBe(true);
  });

  it('il totale complessivo imposto spegne entrambi', () => {
    const m = buildPdfModel({ ...notaBase, totale_override: 500 }, rapportiniBase);
    expect(m.mostra_dettaglio_materiali).toBe(false);
    expect(m.mostra_dettaglio_manodopera).toBe(false);
    expect(m.totali.totale_finale).toBe(500);
  });

  // È il punto dove divisione e override si incrociano, ed è dove si
  // produrrebbe un documento che si contraddice.
  it('dividendo con un totale imposto, nessuna sezione riporta quel totale', () => {
    const m = buildPdfModel(
      { ...notaBase, divisione: 'per_macchinario', totale_materiali_override: 50 },
      rapportiniBase,
    );
    for (const s of m.sezioni) {
      expect(s.totale_materiali).toBeNull();
      expect(s.totale_manodopera).not.toBeNull();
    }
    expect(m.totali.totale_materiali).toBe(50);
  });

  it('con tutto imposto, nessuna sezione ha alcun totale proprio', () => {
    const m = buildPdfModel(
      { ...notaBase, divisione: 'per_macchinario', totale_override: 500 },
      rapportiniBase,
    );
    for (const s of m.sezioni) {
      expect(s.totale_materiali).toBeNull();
      expect(s.totale_manodopera).toBeNull();
    }
  });
});

describe('generaPdfNotaLavorazione', () => {
  it('produce un Buffer non vuoto con header PDF', async () => {
    const buf = await generaPdfNotaLavorazione(notaBase, rapportiniBase);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.slice(0, 4).toString('ascii')).toBe('%PDF');
    expect(buf.length).toBeGreaterThan(500);
  });

  it.each([
    ['entrambi i dettagli', true, true],
    ['solo materiali', true, false],
    ['solo manodopera', false, true],
    ['nessun dettaglio', false, false],
  ])('%s: il documento si genera senza errori', async (_n, materiali, manodopera) => {
    const buf = await generaPdfNotaLavorazione(
      {
        ...notaBase,
        mostra_dettaglio_materiali: materiali,
        mostra_dettaglio_manodopera: manodopera,
      },
      rapportiniBase,
    );
    expect(buf.slice(0, 4).toString('ascii')).toBe('%PDF');
  });

  it('senza rapportini produce comunque un documento', async () => {
    const buf = await generaPdfNotaLavorazione(notaBase, []);
    expect(buf.slice(0, 4).toString('ascii')).toBe('%PDF');
  });
});
