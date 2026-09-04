import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const qui = dirname(fileURLToPath(import.meta.url));
const token = readFileSync(resolve(qui, '../../src/stili/_token.scss'), 'utf8');

/**
 * Legge un token di colore dal foglio dei token.
 *
 * Legge il SORGENTE, non una copia: se qualcuno cambia un valore senza
 * misurarlo, questi controlli lo fermano.
 * @param {string} nome - nome del token, senza il prefisso
 * @returns {string} il valore esadecimale
 */
function colore(nome) {
  const m = token.match(new RegExp(`\\$of-${nome}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`token $of-${nome} non trovato in _token.scss`);
  return m[1];
}

/**
 * Luminanza relativa secondo WCAG.
 * @param {string} hex - colore in forma #rrggbb
 * @returns {number}
 */
function luminanza(hex) {
  const canali = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lineari = canali.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lineari[0] + 0.7152 * lineari[1] + 0.0722 * lineari[2];
}

/**
 * Rapporto di contrasto fra due colori.
 * @param {string} a - primo colore
 * @param {string} b - secondo colore
 * @returns {number}
 */
function contrasto(a, b) {
  const [alto, basso] = [luminanza(a), luminanza(b)].sort((x, y) => y - x);
  return (alto + 0.05) / (basso + 0.05);
}

const carta = colore('carta');
const superficie = colore('superficie');

// ─────────────────────────────────────────────────────────────────────────────
// Tre valori proposti a occhio erano sbagliati, e solo la misura li ha trovati:
// l'ottone stava a 3,55:1 — insufficiente perfino come testo corrente — i bordi
// a 1,21:1 contro i 3:1 che servono perché un confine si veda, il testo
// secondario appena sotto la soglia critica. Nessuno dei tre si vedeva
// guardando lo schermo.
describe('i colori raggiungono le soglie dichiarate', () => {
  const critici = [
    ['inchiostro', 7],
    ['tenue', 7],
    ['abete', 7],
    ['ardesia', 7],
    ['allarme', 7],
  ];

  it.each(critici)('%s porta informazione critica: ≥ %i:1 su carta', (nome, soglia) => {
    expect(contrasto(colore(nome), carta)).toBeGreaterThanOrEqual(soglia);
  });

  // Limite dichiarato della direzione scelta: un giallo abbastanza scuro da
  // arrivare a 7:1 non sarebbe più un giallo. Vive quindi nella striscia, e
  // l'etichetta accanto resta in inchiostro.
  it('ottone raggiunge il testo corrente ma NON il critico', () => {
    const cr = contrasto(colore('ottone'), carta);
    expect(cr).toBeGreaterThanOrEqual(4.5);
    expect(cr).toBeLessThan(7);
  });

  it('il bordo si vede: ≥ 3:1, la soglia dei confini non testuali', () => {
    expect(contrasto(colore('bordo'), carta)).toBeGreaterThanOrEqual(3);
  });

  // A 1,53:1 non delimita nulla. Il controllo esiste perché nessuno lo usi
  // per un confine credendo che basti.
  it('il filo NON raggiunge i 3:1, ed è per questo che è solo decorativo', () => {
    expect(contrasto(colore('filo'), carta)).toBeLessThan(3);
  });
});

describe('il testo dei pulsanti pieni si legge', () => {
  it.each([['abete'], ['allarme'], ['ardesia']])(
    'bianco su %s supera 4,5:1',
    (nome) => {
      expect(contrasto('#ffffff', colore(nome))).toBeGreaterThanOrEqual(4.5);
    },
  );
});

describe('le superfici reggono lo stesso testo', () => {
  it('inchiostro si legge sia su carta sia su superficie', () => {
    expect(contrasto(colore('inchiostro'), carta)).toBeGreaterThanOrEqual(7);
    expect(contrasto(colore('inchiostro'), superficie)).toBeGreaterThanOrEqual(7);
  });
});

// Difetto rilevato in prova: $warning era mappato sull'ottone, che significa
// «rapportino aperto». I badge delle ore mancanti diventavano marroni, cioe' il
// colore di uno stato usato per una cosa che stato non e'. Questo controllo
// impedisce che la mappatura ci torni.
describe('i colori di stato non finiscono nelle semantiche di Bootstrap', () => {
  const officina = readFileSync(resolve(qui, '../../src/stili/officina.scss'), 'utf8');

  /**
   * Legge il valore assegnato a una variabile di Bootstrap.
   * @param {string} nome - nome della variabile, senza il dollaro
   * @returns {string} il token assegnato
   */
  function mappatura(nome) {
    const m = officina.match(new RegExp(`^\\$${nome}:\\s*([^;]+);`, 'm'));
    return m ? m[1].trim() : '';
  }

  it('$warning NON e un colore di stato', () => {
    expect(['$of-ottone', '$of-ardesia']).not.toContain(mappatura('warning'));
  });

  it('$primary resta l abete, che e anche «concluso»: coincidenza voluta', () => {
    expect(mappatura('primary')).toBe('$of-abete');
  });

  it('$danger e l allarme, riservato a cio che distrugge', () => {
    expect(mappatura('danger')).toBe('$of-allarme');
  });
});

describe('i token strutturali sono quelli dichiarati', () => {
  it('gli angoli sono vivi: il raggio è zero', () => {
    expect(token).toMatch(/\$of-raggio:\s*0\s*;/);
  });

  it("l'area toccabile minima è 48px e quella primaria 56px", () => {
    expect(token).toMatch(/\$of-tocco:\s*48px/);
    expect(token).toMatch(/\$of-tocco-primario:\s*56px/);
  });

  // Sotto: schede. Sopra: tabella. La soglia è un valore solo, dichiarato qui,
  // così che non si sparpagli in media query scritte a mano.
  it('la soglia fra le due impaginazioni è 992px', () => {
    expect(token).toMatch(/\$of-soglia:\s*992px/);
  });

  it('ogni token di colore è esposto anche come variabile CSS', () => {
    for (const nome of [
      'carta', 'superficie', 'inchiostro', 'tenue', 'bordo',
      'filo', 'abete', 'ottone', 'ardesia', 'allarme',
    ]) {
      expect(token).toContain(`--of-${nome}:`);
    }
  });
});
