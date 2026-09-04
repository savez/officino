import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const qui = dirname(fileURLToPath(import.meta.url));
const render = readFileSync(resolve(qui, '../../../render.yaml'), 'utf8');

/**
 * Estrae le regole di riscrittura del sito statico, nell'ordine in cui sono
 * dichiarate.
 * @returns {Array<{source: string, destination: string}>} regole ordinate
 */
function regoleDiRiscrittura() {
  const regole = [];
  const righe = render.split('\n');
  for (let i = 0; i < righe.length; i++) {
    const sorgente = righe[i].match(/^\s*source:\s*(\S+)/);
    if (!sorgente) continue;
    const destinazione = (righe[i + 1] || '').match(/^\s*destination:\s*(\S+)/);
    if (destinazione) regole.push({ source: sorgente[1], destination: destinazione[1] });
  }
  return regole;
}

// Difetto gia' riscontrato in produzione: aprire direttamente /rapportini
// restituiva 404, mentre navigandoci dall'interno funzionava. Le rotte del
// router esistono solo nel browser, non come file sul server.
//
// È una riga di configurazione facile da perdere in un riordino, e il difetto
// che ne consegue non si vede provando l'applicazione dall'interno: serve
// aprire un link diretto, ricaricare una pagina o usare un segnalibro.
/**
 * Una destinazione punta al backend, non a un file del sito statico.
 *
 * Nel file versionato l'indirizzo e' un segnaposto: chi installa lo sostituisce
 * con quello del proprio backend. Il controllo verifica quindi che la
 * destinazione non sia un percorso locale, non che sia gia' un URL valido.
 * @param {string} destinazione valore della regola di riscrittura
 * @returns {boolean} vero se punta fuori dal sito statico
 */
function esterna(destinazione) {
  return !destinazione.startsWith('/');
}

describe('il sito statico serve le rotte del router', () => {
  const regole = regoleDiRiscrittura();

  it('esiste la riscrittura di ogni percorso su index.html', () => {
    expect(regole).toContainEqual({ source: '/*', destination: '/index.html' });
  });

  // L'ordine di valutazione non è documentato da Render: tenere la regola
  // generica in fondo la rende innocua comunque.
  it('la regola generica sta DOPO quelle verso il backend', () => {
    const generica = regole.findIndex((r) => r.source === '/*');
    const versoBackend = regole
      .map((r, i) => (esterna(r.destination) ? i : -1))
      .filter((i) => i >= 0);

    expect(generica).toBeGreaterThan(-1);
    expect(versoBackend.length).toBeGreaterThan(0);
    for (const i of versoBackend) {
      expect(i).toBeLessThan(generica);
    }
  });

  it('le chiamate API restano inoltrate al backend', () => {
    const api = regole.find((r) => r.source === '/api/*');
    expect(api).toBeDefined();
    expect(esterna(api.destination)).toBe(true);
    expect(api.destination).toMatch(/\/api\/\*$/);
  });
});

// Conseguenza diretta della riscrittura: da quando ogni percorso arriva a
// index.html, un indirizzo inesistente non riceve piu' un 404 dal server ma
// finisce nel router. Senza una rotta di riserva il router non troverebbe
// corrispondenza e non renderizzerebbe nulla: una pagina bianca, peggio di un
// errore perche' non dice cosa e' successo.
describe('il router gestisce gli indirizzi inesistenti', () => {
  const sorgente = readFileSync(resolve(qui, '../../src/router/index.js'), 'utf8');

  it('esiste una rotta di riserva', () => {
    expect(sorgente).toMatch(/path:\s*'\/:[A-Za-z]+\(\.\*\)\*?'/);
  });

  it('la rotta di riserva e\' dichiarata per ultima', () => {
    const riserva = sorgente.search(/path:\s*'\/:[A-Za-z]+\(\.\*\)\*?'/);
    const percorsiDopo = sorgente.slice(riserva).match(/path:\s*'\//g) || [];
    // Solo se stessa: qualunque rotta dichiarata dopo non verrebbe mai
    // raggiunta, perche' la riserva intercetta tutto.
    expect(percorsiDopo).toHaveLength(1);
  });
});
