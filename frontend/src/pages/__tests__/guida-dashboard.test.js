import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const qui = dirname(fileURLToPath(import.meta.url));
const leggi = (p) => readFileSync(resolve(qui, p), 'utf8');

const guida = leggi('../GuidaPage.vue');
const pagina = leggi('../DashboardPage.vue');

// La guida descrive il comportamento, non lo determina. Se una delle due si
// muove senza l'altra e' la guida a essere sbagliata — ma nessuno se ne accorge
// finche' qualcuno non va a cercare quello che ha letto.
//
// La garanzia e' la stessa introdotta dalla feature 018 (FR-012), e serve
// perche' lo stesso difetto si e' gia' ripresentato: le sezioni Clienti e
// Preventivi mostrate a chi non poteva aprirle, e lo spazio per la firma
// promesso da una guida dopo che era stato tolto dal PDF.
describe('la guida dice il vero sulla dashboard', () => {
  const sezione = guida
    .slice(guida.indexOf('id="dashboard"'), guida.indexOf('id="catalogo"'))
    .replace(/\s+/g, ' ');

  it('non descrive piu le metriche dei preventivi, che non esistono', () => {
    expect(sezione).not.toMatch(/preventiv/i);
  });

  it('non nomina piu il grafico a ciambella, che e stato eliminato', () => {
    expect(sezione).not.toMatch(/ciambella|doughnut/i);
    expect(pagina).not.toMatch(/PreventiviDoughnutChart/);
  });

  it('descrive i conteggi dei rapportini per stato', () => {
    expect(sezione).toMatch(/rapportini nel periodo/i);
    for (const stato of ['aperti', 'conclusi', 'in nota di lavorazione']) {
      expect(sezione.toLowerCase()).toContain(stato);
    }
  });

  it('spiega perche i rapportini senza lavorazioni sono contati a parte', () => {
    // A schermo la somma sembra un'incoerenza finche' non la si legge: e' la
    // parte della guida che serve davvero, non quella che elenca i numeri.
    expect(sezione).toMatch(/senza lavorazioni/i);
    expect(sezione).toMatch(/non ha date|nessun periodo può escluderlo/i);
  });

  it('dichiara l invariante fra dashboard ed elenco', () => {
    expect(sezione).toMatch(/sommando i quattro numeri/i);
  });

  it('descrive numero e importo delle note', () => {
    expect(sezione).toMatch(/note di lavorazione/i);
    expect(sezione).toMatch(/importo/i);
    expect(sezione).toMatch(/data di riferimento/i);
  });

  it('dice che l importo comprende i totali imposti a mano', () => {
    expect(sezione).toMatch(/imposti a mano/i);
  });

  it('spiega perche l importo sparisce col filtro per operaio', () => {
    expect(sezione).toMatch(/filtro per operaio/i);
    expect(sezione).toMatch(/più persone/i);
  });

  it('non promette etichette di ruolo sulle schede, che sono state tolte', () => {
    // La guida descriveva un badge «admin» sulle intestazioni. Ora quelle
    // pillole non ci sono piu': la guida usa una dicitura, non le annuncia.
    expect(pagina).not.toMatch(/class="badge/);
  });

  it('i componenti delle metriche esistono davvero', () => {
    expect(pagina).toMatch(/MetricheRapportini/);
    expect(pagina).toMatch(/MetricheNote/);
  });
});
