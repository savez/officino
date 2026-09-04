const {
  eImposto,
  dettagliAmmessi,
  motivoDelRifiuto,
  verificaRichiesta,
  avvisiSoppressi,
} = require('../../src/services/coerenza-nota');

describe('eImposto', () => {
  // Distinguere zero da assenza e' il punto: un intervento in garanzia ha un
  // totale imposto pari a zero, e confonderlo con "nessun override"
  // riaccenderebbe un dettaglio che era stato spento.
  it('zero e un totale imposto', () => {
    expect(eImposto(0)).toBe(true);
  });

  it('null e undefined non lo sono', () => {
    expect(eImposto(null)).toBe(false);
    expect(eImposto(undefined)).toBe(false);
  });

  it('un importo qualsiasi lo e', () => {
    expect(eImposto(450.5)).toBe(true);
  });
});

describe('dettagliAmmessi', () => {
  it('senza alcun override entrambi i dettagli sono ammessi', () => {
    expect(dettagliAmmessi({})).toEqual({ materiali: true, manodopera: true });
  });

  it('il totale materiali imposto spegne solo i materiali', () => {
    expect(dettagliAmmessi({ totale_materiali_override: 300 })).toEqual({
      materiali: false,
      manodopera: true,
    });
  });

  it('il totale manodopera imposto spegne solo la manodopera', () => {
    expect(dettagliAmmessi({ totale_manodopera_override: 450 })).toEqual({
      materiali: true,
      manodopera: false,
    });
  });

  // Se si decide a parte la cifra finale, nessun elenco puo' sommare a quel
  // valore: mostrarne uno renderebbe il documento contraddittorio.
  it('il totale complessivo imposto spegne ENTRAMBI', () => {
    expect(dettagliAmmessi({ totale_override: 1000 })).toEqual({
      materiali: false,
      manodopera: false,
    });
  });

  it('il totale complessivo prevale anche sugli altri due', () => {
    expect(
      dettagliAmmessi({
        totale_override: 1000,
        totale_materiali_override: null,
        totale_manodopera_override: null,
      }),
    ).toEqual({ materiali: false, manodopera: false });
  });

  it('zero spegne come qualunque altro valore', () => {
    expect(dettagliAmmessi({ totale_materiali_override: 0 }).materiali).toBe(false);
    expect(dettagliAmmessi({ totale_override: 0 })).toEqual({
      materiali: false,
      manodopera: false,
    });
  });

  it('entrambi gli override di sezione spengono entrambi i dettagli', () => {
    expect(
      dettagliAmmessi({ totale_materiali_override: 300, totale_manodopera_override: 450 }),
    ).toEqual({ materiali: false, manodopera: false });
  });
});

describe('motivoDelRifiuto', () => {
  it('e null quando il dettaglio e ammesso', () => {
    expect(motivoDelRifiuto('materiali', {})).toBeNull();
  });

  // Un rifiuto che non dice cosa togliere manda a indovinare.
  it('nomina il totale dei materiali quando e quello a impedire', () => {
    const m = motivoDelRifiuto('materiali', { totale_materiali_override: 300 });
    expect(m).toMatch(/materiali/i);
    expect(m).toMatch(/rimuovi/i);
  });

  it('nomina il totale della manodopera quando e quello a impedire', () => {
    const m = motivoDelRifiuto('manodopera', { totale_manodopera_override: 450 });
    expect(m).toMatch(/manodopera/i);
  });

  it('nomina il totale complessivo quando e lui a prevalere', () => {
    const m = motivoDelRifiuto('materiali', {
      totale_override: 1000,
      totale_materiali_override: 300,
    });
    expect(m).toMatch(/complessivo/i);
  });
});

describe('verificaRichiesta', () => {
  it('accetta una richiesta senza dettagli e senza override', () => {
    expect(verificaRichiesta({}).valida).toBe(true);
  });

  it('accetta i dettagli quando non ci sono override', () => {
    expect(
      verificaRichiesta({
        mostra_dettaglio_materiali: true,
        mostra_dettaglio_manodopera: true,
      }).valida,
    ).toBe(true);
  });

  it('respinge il dettaglio materiali sotto il proprio override', () => {
    const esito = verificaRichiesta({
      mostra_dettaglio_materiali: true,
      totale_materiali_override: 300,
    });
    expect(esito.valida).toBe(false);
    expect(esito.errore).toMatch(/materiali/i);
  });

  it('respinge il dettaglio manodopera sotto il proprio override', () => {
    expect(
      verificaRichiesta({
        mostra_dettaglio_manodopera: true,
        totale_manodopera_override: 450,
      }).valida,
    ).toBe(false);
  });

  it('respinge qualunque dettaglio sotto il totale complessivo', () => {
    expect(
      verificaRichiesta({ mostra_dettaglio_materiali: true, totale_override: 1000 }).valida,
    ).toBe(false);
    expect(
      verificaRichiesta({ mostra_dettaglio_manodopera: true, totale_override: 1000 }).valida,
    ).toBe(false);
  });

  // Spegnere il dettaglio e imporre il totale e' la combinazione normale, non
  // un errore: e' cio' che l'amministratore fa.
  it('accetta un override quando il dettaglio corrispondente e spento', () => {
    expect(
      verificaRichiesta({
        mostra_dettaglio_materiali: false,
        totale_materiali_override: 300,
        mostra_dettaglio_manodopera: true,
      }).valida,
    ).toBe(true);
  });
});

// Le stesse tre cifre girano nel codice in due forme: i nomi delle colonne e
// una forma breve. Averle entrambe ha gia' prodotto un difetto - una chiamata
// passava l'una a una funzione che leggeva l'altra, e ogni override risultava
// assente, senza errore. Il documento mostrava dettagli che avrebbe dovuto
// nascondere.
describe('le due forme sono equivalenti', () => {
  it('la forma breve vale come i nomi delle colonne', () => {
    expect(dettagliAmmessi({ materiali: 300 })).toEqual(
      dettagliAmmessi({ totale_materiali_override: 300 }),
    );
    expect(dettagliAmmessi({ complessivo: 500 })).toEqual(
      dettagliAmmessi({ totale_override: 500 }),
    );
  });

  it('anche per gli avvisi soppressi', () => {
    expect(avvisiSoppressi({ manodopera: 400 })).toEqual(
      avvisiSoppressi({ totale_manodopera_override: 400 }),
    );
  });

  it('anche per la verifica di una richiesta', () => {
    expect(
      verificaRichiesta({ mostra_dettaglio_materiali: true, materiali: 300 }).valida,
    ).toBe(false);
  });
});

describe('avvisiSoppressi', () => {
  // Un avviso su un valore che non finira' nel documento manda a correggere
  // qualcosa che non cambia nulla.
  it('senza override nessun avviso e soppresso', () => {
    expect(avvisiSoppressi({})).toEqual({ materiali: false, manodopera: false });
  });

  it('il totale materiali imposto sopprime gli avvisi sui materiali', () => {
    expect(avvisiSoppressi({ totale_materiali_override: 300 })).toEqual({
      materiali: true,
      manodopera: false,
    });
  });

  it('il totale manodopera imposto sopprime gli avvisi sulla manodopera', () => {
    expect(avvisiSoppressi({ totale_manodopera_override: 450 })).toEqual({
      materiali: false,
      manodopera: true,
    });
  });

  it('il totale complessivo imposto sopprime tutto', () => {
    expect(avvisiSoppressi({ totale_override: 1000 })).toEqual({
      materiali: true,
      manodopera: true,
    });
  });
});
