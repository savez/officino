const {
  derivaStato,
  verificaModificabile,
  verificaEliminabile,
  verificaChiudibile,
  verificaRiapribile,
} = require('../../src/services/stato-rapportino');

const AUTORE = { id: 7, ruolo: 'user' };
const ALTRO_OPERAIO = { id: 8, ruolo: 'user' };
const AMMINISTRATORE = { id: 1, ruolo: 'admin' };

const aperto = { id: 1, utente_id: 7, chiuso_il: null, nota_lavorazione_id: null };
const chiuso = { id: 2, utente_id: 7, chiuso_il: '2026-09-01T10:00:00Z', nota_lavorazione_id: null };
const gestito = { id: 3, utente_id: 7, chiuso_il: '2026-09-01T10:00:00Z', nota_lavorazione_id: 5 };

describe('derivaStato', () => {
  it('senza chiusura e senza nota è aperto', () => {
    expect(derivaStato(aperto)).toBe('aperto');
  });

  it('con chiusura e senza nota è chiuso', () => {
    expect(derivaStato(chiuso)).toBe('chiuso');
  });

  it('con nota è gestito', () => {
    expect(derivaStato(gestito)).toBe('gestito');
  });

  // Lo stato non è memorizzato: la nota prevale sulla chiusura per costruzione,
  // quindi non esiste una combinazione in cui le due fonti si contraddicano.
  it('la nota prevale anche senza chiuso_il', () => {
    expect(derivaStato({ ...aperto, nota_lavorazione_id: 5 })).toBe('gestito');
  });
});

// La tabella completa stato x ruolo. È il punto in cui il comportamento cambia
// rispetto a prima, quando l'amministratore modificava qualunque riga in
// qualunque stato.
describe('verificaModificabile', () => {
  const casi = [
    ['aperto', aperto, AUTORE, true],
    ['aperto', aperto, AMMINISTRATORE, true],
    ['aperto', aperto, ALTRO_OPERAIO, false],
    ['chiuso', chiuso, AUTORE, false],
    ['chiuso', chiuso, AMMINISTRATORE, false],
    ['chiuso', chiuso, ALTRO_OPERAIO, false],
    ['gestito', gestito, AUTORE, false],
    ['gestito', gestito, AMMINISTRATORE, false],
    ['gestito', gestito, ALTRO_OPERAIO, false],
  ];

  it.each(casi)('%s, ruolo %#: consentito=%s', (nome, rapportino, utente, atteso) => {
    expect(verificaModificabile(rapportino, utente).consentito).toBe(atteso);
  });

  // È il caso che questa feature cambia. Se questo test passa per errore
  // restituendo true, l'intera regola sui permessi è saltata.
  it("l'amministratore NON modifica un rapportino chiuso senza riaprirlo", () => {
    const esito = verificaModificabile(chiuso, AMMINISTRATORE);
    expect(esito.consentito).toBe(false);
    expect(esito.codice).toBe(403);
    expect(esito.messaggio).toMatch(/riapri/i);
  });

  it("all'operaio il messaggio dice a chi rivolgersi", () => {
    expect(verificaModificabile(chiuso, AUTORE).messaggio).toMatch(/amministratore/i);
  });

  it('un rapportino gestito rimanda alla dissociazione dalla nota', () => {
    expect(verificaModificabile(gestito, AMMINISTRATORE).messaggio).toMatch(/nota/i);
  });
});

describe('verificaEliminabile', () => {
  it("l'autore elimina un rapportino aperto e vuoto", () => {
    expect(verificaEliminabile(aperto, AUTORE, 0).consentito).toBe(true);
  });

  it("l'autore NON elimina un rapportino aperto con lavorazioni", () => {
    const esito = verificaEliminabile(aperto, AUTORE, 3);
    expect(esito.consentito).toBe(false);
    expect(esito.codice).toBe(403);
  });

  it("l'amministratore elimina anche un rapportino pieno", () => {
    expect(verificaEliminabile(aperto, AMMINISTRATORE, 3).consentito).toBe(true);
  });

  it('nessuno elimina un rapportino chiuso', () => {
    expect(verificaEliminabile(chiuso, AMMINISTRATORE, 0).consentito).toBe(false);
    expect(verificaEliminabile(chiuso, AUTORE, 0).consentito).toBe(false);
  });

  it('nessuno elimina un rapportino gestito', () => {
    expect(verificaEliminabile(gestito, AMMINISTRATORE, 0).consentito).toBe(false);
  });
});

describe('verificaChiudibile', () => {
  it("l'autore chiude un rapportino aperto con almeno una lavorazione", () => {
    expect(verificaChiudibile(aperto, AUTORE, 1).consentito).toBe(true);
  });

  // Un intervento senza ore non è un intervento.
  it('un rapportino vuoto non si chiude, e il codice è 400 non 403', () => {
    const esito = verificaChiudibile(aperto, AUTORE, 0);
    expect(esito.consentito).toBe(false);
    expect(esito.codice).toBe(400);
  });

  it("l'amministratore non chiude al posto dell'operaio", () => {
    expect(verificaChiudibile(aperto, AMMINISTRATORE, 1).consentito).toBe(false);
  });

  it('un rapportino già chiuso non si richiude', () => {
    expect(verificaChiudibile(chiuso, AUTORE, 1).consentito).toBe(false);
  });
});

describe('verificaRiapribile', () => {
  it('solo un amministratore riapre', () => {
    expect(verificaRiapribile(chiuso, AMMINISTRATORE).consentito).toBe(true);
    expect(verificaRiapribile(chiuso, AUTORE).consentito).toBe(false);
  });

  it('un rapportino gestito non si riapre finché è nella nota', () => {
    const esito = verificaRiapribile(gestito, AMMINISTRATORE);
    expect(esito.consentito).toBe(false);
    expect(esito.messaggio).toMatch(/nota/i);
  });

  it('un rapportino già aperto non si riapre', () => {
    expect(verificaRiapribile(aperto, AMMINISTRATORE).codice).toBe(400);
  });
});
