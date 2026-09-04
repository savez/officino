const {
  calcolaTotaliLavorazione,
  calcolaTotaliNota,
  rilevaWarningPdf,
} = require('../../src/services/calcolo-totali-nota');

// Le ore sono un dato registrato. La conversione da fascia oraria non esiste
// più, e con essa i casi limite che la circondavano — fine prima dell'inizio,
// orari vuoti — che non sono rappresentabili con un numero di ore validato.

describe('calcolaTotaliLavorazione', () => {
  it('somma materiali e manodopera', () => {
    const lavorazione = {
      id: 1,
      ore: 4,
      costo_orario_applicato: 25,
      materiali: [
        { id: 1, nome: 'Filtro', quantita: 2, prezzo_unitario: 6 },
        { id: 2, nome: 'Olio', quantita: 1, prezzo_unitario: 6 },
      ],
    };
    const t = calcolaTotaliLavorazione(lavorazione);
    expect(t.ore_lavorate).toBe(4);
    expect(t.subtotale_materiali).toBe(18);
    expect(t.costo_manodopera).toBe(100);
    expect(t.totale_lavorazione).toBe(118);
  });

  it('gestisce le ore frazionarie a quarti', () => {
    const t = calcolaTotaliLavorazione({
      id: 1,
      ore: 4.25,
      costo_orario_applicato: 20,
      materiali: [],
    });
    expect(t.ore_lavorate).toBe(4.25);
    expect(t.costo_manodopera).toBe(85);
  });

  it('senza materiali il subtotale è zero', () => {
    const t = calcolaTotaliLavorazione({ id: 1, ore: 2, costo_orario_applicato: 30 });
    expect(t.subtotale_materiali).toBe(0);
    expect(t.totale_lavorazione).toBe(60);
  });

  // Caso limite già coperto prima della modifica: va conservato.
  it('segnala il costo orario a zero quando ci sono ore', () => {
    const t = calcolaTotaliLavorazione({
      id: 1,
      ore: 3,
      costo_orario_applicato: 0,
      materiali: [],
    });
    expect(t.flag_costo_orario_zero).toBe(true);
    expect(t.costo_manodopera).toBe(0);
  });

  it('non segnala il costo orario a zero se non ci sono ore', () => {
    const t = calcolaTotaliLavorazione({
      id: 1,
      ore: 0,
      costo_orario_applicato: 0,
      materiali: [],
    });
    expect(t.flag_costo_orario_zero).toBe(false);
  });

  // Caso limite già coperto prima della modifica: va conservato.
  it('segnala i materiali senza prezzo', () => {
    const t = calcolaTotaliLavorazione({
      id: 1,
      ore: 1,
      costo_orario_applicato: 10,
      materiali: [{ id: 1, nome: 'Bullone', quantita: 5, prezzo_unitario: 0 }],
    });
    expect(t.flag_materiali_senza_prezzo).toBe(true);
    expect(t.totale_lavorazione).toBe(10);
  });

  it('arrotonda a due decimali', () => {
    const t = calcolaTotaliLavorazione({
      id: 1,
      ore: 0.25,
      costo_orario_applicato: 33.33,
      materiali: [{ id: 1, nome: 'x', quantita: 3, prezzo_unitario: 0.67 }],
    });
    expect(t.costo_manodopera).toBe(8.33);
    expect(t.subtotale_materiali).toBe(2.01);
    expect(t.totale_lavorazione).toBe(10.34);
  });
});

describe('calcolaTotaliNota — totali calcolati', () => {
  const lavorazioni = [
    { id: 1, ore: 4, costo_orario_applicato: 25, materiali: [{ id: 1, nome: 'a', quantita: 1, prezzo_unitario: 10 }] },
    { id: 2, ore: 2, costo_orario_applicato: 25, materiali: [{ id: 2, nome: 'b', quantita: 2, prezzo_unitario: 5 }] },
  ];

  it('aggrega materiali e manodopera di tutte le lavorazioni', () => {
    const t = calcolaTotaliNota(lavorazioni, null);
    expect(t.totale_materiali_calcolato).toBe(20);
    expect(t.totale_manodopera_calcolato).toBe(150);
    expect(t.totale_calcolato).toBe(170);
    expect(t.totale_finale).toBe(170);
  });

  it('senza valori imposti nessun override risulta attivo', () => {
    const t = calcolaTotaliNota(lavorazioni, null);
    expect(t.override_materiali_attivo).toBe(false);
    expect(t.override_manodopera_attivo).toBe(false);
    expect(t.override_attivo).toBe(false);
    expect(t.override_discrepanza).toBe(false);
  });

  it('su un elenco vuoto restituisce zeri invece di sollevare', () => {
    expect(calcolaTotaliNota([], null).totale_calcolato).toBe(0);
    expect(calcolaTotaliNota(null, null).totale_calcolato).toBe(0);
  });
});

describe('calcolaTotaliNota — totali imposti di sezione', () => {
  const lavorazioni = [
    { id: 1, ore: 4, costo_orario_applicato: 25, materiali: [{ id: 1, nome: 'a', quantita: 1, prezzo_unitario: 10 }] },
    { id: 2, ore: 2, costo_orario_applicato: 25, materiali: [{ id: 2, nome: 'b', quantita: 2, prezzo_unitario: 5 }] },
  ];

  it('il totale imposto ai materiali sostituisce il calcolato', () => {
    const t = calcolaTotaliNota(lavorazioni, { materiali: 50 });
    expect(t.totale_materiali).toBe(50);
    expect(t.totale_finale).toBe(200); // 50 + 150
    expect(t.override_materiali_attivo).toBe(true);
  });

  it('il totale imposto alla manodopera sostituisce il calcolato', () => {
    const t = calcolaTotaliNota(lavorazioni, { manodopera: 400 });
    expect(t.totale_manodopera).toBe(400);
    expect(t.totale_finale).toBe(420); // 20 + 400
  });

  it('i due si sommano quando sono entrambi imposti', () => {
    const t = calcolaTotaliNota(lavorazioni, { materiali: 50, manodopera: 400 });
    expect(t.totale_finale).toBe(450);
  });

  // Servono a mostrare da cosa ci si sta discostando, e a tornare indietro
  // quando l'override viene rimosso.
  it('i valori CALCOLATI restano esposti anche sotto un override', () => {
    const t = calcolaTotaliNota(lavorazioni, { materiali: 50, manodopera: 400 });
    expect(t.totale_materiali_calcolato).toBe(20);
    expect(t.totale_manodopera_calcolato).toBe(150);
    expect(t.totale_calcolato).toBe(170);
  });

  it('togliendo gli override si torna esattamente ai valori calcolati', () => {
    const conOverride = calcolaTotaliNota(lavorazioni, { materiali: 50, manodopera: 400 });
    const senza = calcolaTotaliNota(lavorazioni, null);
    expect(senza.totale_finale).toBe(conOverride.totale_calcolato);
  });

  // Una correzione su un materiale sopravvive sotto l'override e torna a
  // determinare il totale quando viene tolto.
  it('una correzione di riga determina il totale appena l override sparisce', () => {
    const corrette = [
      { id: 1, ore: 4, costo_orario_applicato: 25, materiali: [{ id: 1, nome: 'a', quantita: 1, prezzo_unitario: 99 }] },
      { id: 2, ore: 2, costo_orario_applicato: 25, materiali: [{ id: 2, nome: 'b', quantita: 2, prezzo_unitario: 5 }] },
    ];
    expect(calcolaTotaliNota(corrette, { materiali: 50 }).totale_materiali_calcolato).toBe(109);
    expect(calcolaTotaliNota(corrette, null).totale_materiali).toBe(109);
  });

  it('zero e un totale imposto, non un valore assente', () => {
    const t = calcolaTotaliNota(lavorazioni, { materiali: 0 });
    expect(t.override_materiali_attivo).toBe(true);
    expect(t.totale_materiali).toBe(0);
    expect(t.totale_finale).toBe(150);
  });
});

describe('calcolaTotaliNota — totale complessivo imposto', () => {
  const lavorazioni = [
    { id: 1, ore: 4, costo_orario_applicato: 25, materiali: [{ id: 1, nome: 'a', quantita: 1, prezzo_unitario: 10 }] },
    { id: 2, ore: 2, costo_orario_applicato: 25, materiali: [{ id: 2, nome: 'b', quantita: 2, prezzo_unitario: 5 }] },
  ];

  it('sostituisce la somma e segnala la discrepanza', () => {
    const t = calcolaTotaliNota(lavorazioni, { complessivo: 250 });
    expect(t.totale_finale).toBe(250);
    expect(t.override_attivo).toBe(true);
    expect(t.override_discrepanza).toBe(true);
  });

  it('prevale sui due di sezione', () => {
    const t = calcolaTotaliNota(lavorazioni, { materiali: 50, manodopera: 400, complessivo: 250 });
    expect(t.totale_finale).toBe(250);
  });

  it('un valore uguale al calcolato non e una discrepanza', () => {
    expect(calcolaTotaliNota(lavorazioni, { complessivo: 170 }).override_discrepanza).toBe(false);
  });

  // La forma precedente della chiamata continua a significare la stessa cosa.
  it('un numero al posto dell oggetto vale come totale complessivo', () => {
    expect(calcolaTotaliNota(lavorazioni, 250).totale_finale).toBe(250);
    expect(calcolaTotaliNota(lavorazioni, 250).override_attivo).toBe(true);
  });
});

describe('rilevaWarningPdf', () => {
  it('segnala una lavorazione con costo orario a zero', () => {
    const out = rilevaWarningPdf([
      {
        id: 1,
        giorno: '2026-09-01',
        ore: 4,
        costo_orario_applicato: 0,
        utente_nome: 'Mario',
        macchina: 'Trattore JD',
        materiali: [],
      },
    ]);
    expect(out.has_warnings).toBe(true);
    expect(out.lavorazioni_costo_orario_zero).toHaveLength(1);
    expect(out.lavorazioni_costo_orario_zero[0]).toMatchObject({
      lavorazione_id: 1,
      giorno: '2026-09-01',
      ore: 4,
      utente_nome: 'Mario',
      macchina: 'Trattore JD',
    });
  });

  it('non segnala una lavorazione con costo orario valorizzato', () => {
    const out = rilevaWarningPdf([
      { id: 1, ore: 4, costo_orario_applicato: 30, materiali: [] },
    ]);
    expect(out.has_warnings).toBe(false);
  });

  it('segnala i materiali a prezzo zero indicando la lavorazione', () => {
    const out = rilevaWarningPdf([
      {
        id: 7,
        ore: 2,
        costo_orario_applicato: 30,
        materiali: [{ id: 3, nome: 'Bullone', quantita: 5, prezzo_unitario: 0, fuori_catalogo: true }],
      },
    ]);
    expect(out.has_warnings).toBe(true);
    expect(out.materiali_prezzo_zero[0]).toMatchObject({
      lavorazione_id: 7,
      materiale_id: 3,
      nome: 'Bullone',
      fuori_catalogo: true,
    });
  });

  it('un materiale a quantità zero non viene segnalato', () => {
    const out = rilevaWarningPdf([
      {
        id: 1,
        ore: 2,
        costo_orario_applicato: 30,
        materiali: [{ id: 3, nome: 'x', quantita: 0, prezzo_unitario: 0 }],
      },
    ]);
    expect(out.has_warnings).toBe(false);
  });

  it('su un elenco vuoto non segnala nulla', () => {
    expect(rilevaWarningPdf([]).has_warnings).toBe(false);
  });
});
