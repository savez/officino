import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const qui = dirname(fileURLToPath(import.meta.url));

const leggi = (percorso) => readFileSync(resolve(qui, percorso), 'utf8');

const guida = leggi('../GuidaPage.vue');
const paginaRapportini = leggi('../RapportiniPage.vue');
const modaleLavorazione = leggi('../../components/LavorazioneFormModal.vue');

// La regola e' questa: la guida descrive il comportamento, non lo determina. Se una delle due si muove senza l'altra, e' la guida a essere
// sbagliata — ma nessuno se ne accorge finche' qualcuno non va a cercare quello
// che ha letto.
//
// Questi controlli legano le affermazioni piu' facili da far scadere ai valori
// da cui dipendono. Non coprono il comportamento del server, che sta nei test
// di integrazione.
describe('la guida dice il vero sui rapportini', () => {
  it('la soglia dichiarata coincide con quella applicata', () => {
    const soglia = modaleLavorazione.match(/SOGLIA_AVVISO_ORE\s*=\s*(\d+)/);
    expect(soglia).not.toBeNull();
    expect(guida).toContain(`${soglia[1]} ore in una singola lavorazione`);
  });

  it("l'avviso sulle ore e' confermabile, e la guida non lo chiama blocco", () => {
    // Se diventasse un rifiuto, questa frase direbbe il falso.
    expect(guida).toMatch(/Non è un blocco/);
    expect(modaleLavorazione).toMatch(/oreDaConfermare/);
  });

  it("il passo dichiarato per le ore coincide con quello del campo", () => {
    expect(modaleLavorazione).toMatch(/step="0\.25"/);
    expect(guida).toMatch(/quarti d'ora/);
  });

  it('la data proposta e\' quella odierna, come dichiarato', () => {
    expect(modaleLavorazione).toMatch(/giorno: oggi\(\)/);
    expect(guida).toMatch(/proposto a oggi/);
  });

  it('i tre stati nominati nella guida sono quelli che la pagina mostra', () => {
    // I tre stati vivono ora in StatoRapportino, unico posto in cui il colore
    // viene deciso: cercarli nella pagina non avrebbe piu' senso.
    const componente = leggi('../../components/StatoRapportino.vue');
    for (const stato of ['aperto', 'chiuso', 'gestito']) {
      expect(componente).toContain(stato);
    }
    expect(guida).toContain('Aperto');
    expect(guida).toContain('Concluso');
    expect(guida).toContain('In nota di lavorazione');
  });

  it('la dicitura per un rapportino vuoto e\' la stessa nei due posti', () => {
    expect(paginaRapportini).toContain("'nessuna lavorazione'");
    expect(guida).toContain('nessuna lavorazione');
  });

  it('il significato del filtro per periodo e\' spiegato in entrambi', () => {
    expect(paginaRapportini).toMatch(/almeno una lavorazione/);
    expect(guida).toMatch(/almeno una lavorazione/);
  });

  it('la guida non descrive piu\' la fascia oraria', () => {
    const sezione = guida.slice(
      guida.indexOf('<section id="rapportini"'),
      guida.indexOf('<section v-if="admin" id="note-lavorazione"'),
    );
    expect(sezione).not.toMatch(/ora inizio.*ora fine/i);
    expect(sezione).not.toMatch(/Nuova Riga/);
  });

  it('la guida non descrive piu\' il filtro per mese e anno', () => {
    expect(guida).not.toMatch(/periodo selezionato \(mese e anno\)/);
  });
});
