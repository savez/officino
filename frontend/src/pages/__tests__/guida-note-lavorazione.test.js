import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const qui = dirname(fileURLToPath(import.meta.url));
const leggi = (p) => readFileSync(resolve(qui, p), 'utf8');

const guida = leggi('../GuidaPage.vue');
const modale = leggi('../../components/NotaLavorazioneFormModal.vue');
const pagina = leggi('../NoteLavorazionePage.vue');

// La guida descrive il comportamento, non lo determina. Se una delle due si
// muove senza l'altra, e' la guida a essere sbagliata — ma nessuno se ne
// accorge finche' qualcuno non va a cercare quello che ha letto.
describe('la guida dice il vero sulle note di lavorazione', () => {
  // Gli a capo dell'indentazione spezzano le frasi: normalizzare gli spazi
  // evita di scrivere espressioni fragili che si rompono al primo riformattaggio.
  const sezione = guida
    .slice(guida.indexOf('id="note-lavorazione"'), guida.indexOf('id="utenti"'))
    .replace(/\s+/g, ' ');

  it('descrive i due dettagli come indipendenti, e il modale ha due interruttori', () => {
    expect(sezione).toMatch(/indipendenti/i);
    expect(modale).toMatch(/data-testid="dettaglio-materiali"/);
    expect(modale).toMatch(/data-testid="dettaglio-manodopera"/);
  });

  // È il punto che la guida non deve promettere più di quanto il documento
  // faccia: la tariffa non compare, ma non è indeducibile.
  it('dice che la tariffa oraria non compare, senza promettere che sia irrecuperabile', () => {
    expect(sezione).toMatch(/non riporta la .{0,20}tariffa oraria/i);
    expect(sezione).not.toMatch(/impossibile risalire|non è ricavabile|non potrà mai sapere/i);
  });

  it('spiega perché un totale imposto spegne il dettaglio', () => {
    expect(sezione).toMatch(/spegne il dettaglio/i);
    expect(sezione).toMatch(/contraddittorio|non somma/i);
  });

  it('dice che il totale complessivo imposto li spegne entrambi', () => {
    expect(sezione).toMatch(/entrambi/i);
  });

  it('spiega che il riassunto modificato non viene rigenerato, e il modale lo fa', () => {
    expect(sezione).toMatch(/non viene più rigenerato/i);
    expect(modale).toMatch(/rigeneraSeIntatto/);
    expect(modale).toMatch(/riassuntoModificato/);
  });

  it('nomina il pulsante di rigenerazione con lo stesso testo del modale', () => {
    expect(sezione).toMatch(/Rigenera dalle note/);
    expect(modale).toMatch(/Rigenera dalle note/);
  });

  it('dice che la domanda sulla divisione compare solo con più rapportini', () => {
    expect(sezione).toMatch(/un solo rapportino la domanda non compare/i);
    expect(modale).toMatch(/chiediDivisione/);
  });

  it('dice che la divisione è per macchinario e non per rapportino', () => {
    expect(sezione).toMatch(/per macchinario<\/strong>, non per rapportino/i);
  });

  it('non promette piu uno spazio per la firma, che il PDF non ha piu', () => {
    // Una guida che descrive un elemento inesistente manda a cercare qualcosa
    // che non c'e' ed e' peggio di una guida incompleta: e' lo stesso difetto
    // che la feature 018 era servita a togliere.
    expect(sezione).not.toMatch(/firma/i);
  });

  it('non descrive più la modalità a due valori', () => {
    expect(sezione).not.toMatch(/modalita_pdf|solo totale|Modalità PDF/i);
  });

  it('non parla più di righe collegate: ora sono rapportini', () => {
    expect(sezione).not.toMatch(/righe collegate|righe di rapportino/i);
  });
});

describe('la pagina delle note riflette il nuovo modello', () => {
  it('la colonna della data è quella di RIFERIMENTO, non di creazione', () => {
    expect(pagina).toMatch(/data_riferimento/);
    expect(pagina).not.toMatch(/formatDate\(n\.created_at\)/);
  });

  it('conta rapportini, non righe', () => {
    expect(pagina).toMatch(/num_rapportini/);
    expect(pagina).not.toMatch(/num_righe/);
  });
});
