const {
  calcolaOreMancanti,
  ORE_ATTESE_AL_GIORNO,
} = require('../../src/services/ore-mancanti');

// Lunedì 2 marzo 2026 → venerdì 6 marzo. Sabato 7 e domenica 8.
const OGGI = new Date(2026, 2, 20);

/**
 * Costruisce una riga aggregata come quella prodotta dalla route.
 * @param {number} utenteId - id operaio
 * @param {string} giorno - AAAA-MM-GG
 * @param {number} ore - ore caricate
 * @returns {object} riga
 */
function riga(utenteId, giorno, ore) {
  return { utente_id: utenteId, utente_nome: `Operaio ${utenteId}`, giorno, ore };
}

const OPERAI = [{ id: 1, nome: 'Operaio 1' }];

describe('individuazione dei giorni sotto soglia', () => {
  it('la soglia è 8 ore', () => {
    expect(ORE_ATTESE_AL_GIORNO).toBe(8);
  });

  it('un giorno feriale con 5 ore è segnalato con 3 mancanti', () => {
    const esito = calcolaOreMancanti({
      da: '2026-03-04',
      a: '2026-03-04',
      righe: [riga(1, '2026-03-04', 5)],
      operai: OPERAI,
      oggi: OGGI,
    });

    expect(esito).toHaveLength(1);
    expect(esito[0].giorni).toEqual([
      { giorno: '2026-03-04', ore_caricate: 5, ore_mancanti: 3, vuoto: false },
    ]);
  });

  it('un giorno con esattamente 8 ore non è segnalato', () => {
    const esito = calcolaOreMancanti({
      da: '2026-03-04',
      a: '2026-03-04',
      righe: [riga(1, '2026-03-04', 8)],
      operai: OPERAI,
      oggi: OGGI,
    });

    expect(esito).toEqual([]);
  });

  it('un giorno con più di 8 ore non è segnalato', () => {
    const esito = calcolaOreMancanti({
      da: '2026-03-04',
      a: '2026-03-04',
      righe: [riga(1, '2026-03-04', 10)],
      operai: OPERAI,
      oggi: OGGI,
    });

    expect(esito).toEqual([]);
  });
});

// Sabato e domenica non sono mai giorni scoperti, qualunque cosa
// contengano.
describe('fine settimana', () => {
  it('il sabato non è mai segnalato, nemmeno con zero ore', () => {
    const esito = calcolaOreMancanti({
      da: '2026-03-07',
      a: '2026-03-07',
      righe: [],
      operai: OPERAI,
      oggi: OGGI,
    });

    expect(esito).toEqual([]);
  });

  it('la domenica non è mai segnalata, nemmeno con 2 ore caricate', () => {
    const esito = calcolaOreMancanti({
      da: '2026-03-08',
      a: '2026-03-08',
      righe: [riga(1, '2026-03-08', 2)],
      operai: OPERAI,
      oggi: OGGI,
    });

    expect(esito).toEqual([]);
  });

  it('una settimana intera produce cinque giorni, non sette', () => {
    const esito = calcolaOreMancanti({
      da: '2026-03-02',
      a: '2026-03-08',
      righe: [],
      operai: OPERAI,
      oggi: OGGI,
    });

    expect(esito[0].giorni).toHaveLength(5);
  });
});

// Segnalare un giorno non ancora arrivato sarebbe un rimprovero per
// non aver fatto ciò che non si poteva fare.
describe('giorni futuri', () => {
  it('i giorni successivi a oggi non sono segnalati', () => {
    const esito = calcolaOreMancanti({
      da: '2026-03-16',
      a: '2026-03-27',
      righe: [],
      operai: OPERAI,
      oggi: new Date(2026, 2, 20),
    });

    const giorni = esito[0].giorni.map((g) => g.giorno);
    expect(giorni).toContain('2026-03-20');
    expect(giorni).not.toContain('2026-03-23');
  });

  it('oggi stesso è compreso', () => {
    const esito = calcolaOreMancanti({
      da: '2026-03-20',
      a: '2026-03-20',
      righe: [],
      operai: OPERAI,
      oggi: new Date(2026, 2, 20),
    });

    expect(esito[0].giorni.map((g) => g.giorno)).toEqual(['2026-03-20']);
  });
});

// Un giorno con 5 ore è un'ora dimenticata, un giorno con 0 ore è
// quasi sempre un'assenza. Senza distinguerli, ad agosto il pannello
// elencherebbe ogni giorno di ferie di ogni operaio.
describe('giorno vuoto e giorno parziale', () => {
  it('distingue il giorno senza rapportini da quello parzialmente compilato', () => {
    const esito = calcolaOreMancanti({
      da: '2026-03-04',
      a: '2026-03-05',
      righe: [riga(1, '2026-03-04', 5)],
      operai: OPERAI,
      oggi: OGGI,
    });

    const perGiorno = Object.fromEntries(esito[0].giorni.map((g) => [g.giorno, g]));
    expect(perGiorno['2026-03-04'].vuoto).toBe(false);
    expect(perGiorno['2026-03-05'].vuoto).toBe(true);
    expect(perGiorno['2026-03-05'].ore_caricate).toBe(0);
    expect(perGiorno['2026-03-05'].ore_mancanti).toBe(8);
  });

  it('conta separatamente i giorni vuoti e quelli parziali', () => {
    const esito = calcolaOreMancanti({
      da: '2026-03-02',
      a: '2026-03-06',
      righe: [riga(1, '2026-03-02', 5), riga(1, '2026-03-03', 7)],
      operai: OPERAI,
      oggi: OGGI,
    });

    expect(esito[0].giorni_parziali).toBe(2);
    expect(esito[0].giorni_vuoti).toBe(3);
  });
});

describe('raggruppamento per operaio', () => {
  it('raggruppa e totalizza le ore mancanti di ciascuno', () => {
    const esito = calcolaOreMancanti({
      da: '2026-03-04',
      a: '2026-03-04',
      righe: [riga(1, '2026-03-04', 5), riga(2, '2026-03-04', 6)],
      operai: [
        { id: 1, nome: 'Operaio 1' },
        { id: 2, nome: 'Operaio 2' },
      ],
      oggi: OGGI,
    });

    expect(esito).toHaveLength(2);
    const perId = Object.fromEntries(esito.map((o) => [o.utente_id, o]));
    expect(perId[1].ore_mancanti_totali).toBe(3);
    expect(perId[2].ore_mancanti_totali).toBe(2);
  });

  it('somma le righe multiple dello stesso giorno', () => {
    const esito = calcolaOreMancanti({
      da: '2026-03-04',
      a: '2026-03-04',
      righe: [riga(1, '2026-03-04', 3), riga(1, '2026-03-04', 2)],
      operai: OPERAI,
      oggi: OGGI,
    });

    expect(esito[0].giorni[0].ore_caricate).toBe(5);
    expect(esito[0].giorni[0].ore_mancanti).toBe(3);
  });

  it('ordina gli operai per ore mancanti decrescenti', () => {
    const esito = calcolaOreMancanti({
      da: '2026-03-04',
      a: '2026-03-04',
      righe: [riga(1, '2026-03-04', 7), riga(2, '2026-03-04', 1)],
      operai: [
        { id: 1, nome: 'Operaio 1' },
        { id: 2, nome: 'Operaio 2' },
      ],
      oggi: OGGI,
    });

    expect(esito[0].utente_id).toBe(2);
  });

  it('un operaio con tutti i giorni completi non compare', () => {
    const esito = calcolaOreMancanti({
      da: '2026-03-04',
      a: '2026-03-04',
      righe: [riga(1, '2026-03-04', 8), riga(2, '2026-03-04', 4)],
      operai: [
        { id: 1, nome: 'Operaio 1' },
        { id: 2, nome: 'Operaio 2' },
      ],
      oggi: OGGI,
    });

    expect(esito.map((o) => o.utente_id)).toEqual([2]);
  });

  it('senza operai restituisce un elenco vuoto', () => {
    expect(
      calcolaOreMancanti({
        da: '2026-03-04',
        a: '2026-03-04',
        righe: [],
        operai: [],
        oggi: OGGI,
      })
    ).toEqual([]);
  });

  it('un intervallo interamente futuro non produce nulla', () => {
    expect(
      calcolaOreMancanti({
        da: '2026-04-01',
        a: '2026-04-30',
        righe: [],
        operai: OPERAI,
        oggi: OGGI,
      })
    ).toEqual([]);
  });

  it('arrotonda le ore mancanti a due decimali', () => {
    const esito = calcolaOreMancanti({
      da: '2026-03-04',
      a: '2026-03-04',
      righe: [riga(1, '2026-03-04', 7.333333)],
      operai: OPERAI,
      oggi: OGGI,
    });

    expect(esito[0].giorni[0].ore_mancanti).toBe(0.67);
  });
});
