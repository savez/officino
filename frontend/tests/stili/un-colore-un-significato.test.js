import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';

const qui = dirname(fileURLToPath(import.meta.url));
const radice = resolve(qui, '../../src');

/**
 * Elenca ricorsivamente i file con le estensioni indicate.
 * @param {string} cartella - da cui partire
 * @param {string[]} estensioni - estensioni ammesse
 * @returns {string[]} percorsi assoluti
 */
function file(cartella, estensioni) {
  return readdirSync(cartella).flatMap((nome) => {
    const percorso = join(cartella, nome);
    if (statSync(percorso).isDirectory()) {
      return nome === '__tests__' ? [] : file(percorso, estensioni);
    }
    return estensioni.some((e) => nome.endsWith(e)) ? [percorso] : [];
  });
}

// I token sono il solo posto in cui un colore viene deciso. Senza questo
// controllo, «un colore, un significato» regge finché nessuno lo dimentica: e
// basta una pagina che scrive un esadecimale a mano perché due schermate
// mostrino lo stesso stato in due modi, senza che nessuno se ne accorga.
describe('i colori vivono nei token, non nelle pagine', () => {
  const sorgenti = file(radice, ['.vue', '.js']).filter((p) => !p.includes('/stili/'));

  it('nessun esadecimale scritto a mano in pagine e componenti', () => {
    const colpevoli = [];
    for (const percorso of sorgenti) {
      const testo = readFileSync(percorso, 'utf8');
      // Esclude gli esadecimali dentro gli URL dei dati e i colori dei grafici,
      // che sono un caso a parte e dichiarato.
      // I grafici hanno una tavolozza propria, dichiarata a parte: sono dati,
      // non interfaccia.
      const trovati = percorso.includes('/charts/')
        ? []
        : testo.match(/#[0-9a-fA-F]{6}\b/g) || [];
      if (trovati.length > 0) {
        colpevoli.push(`${percorso.replace(radice, 'src')}: ${trovati.join(', ')}`);
      }
    }
    expect(colpevoli).toEqual([]);
  });

  // Attenzione a cosa vieta e cosa no. `--of-abete` ha DUE significati
  // dichiarati: e' il primario e lo stato «concluso». Usarlo come primario e'
  // legittimo ovunque. Ottone e ardesia invece esistono solo per due stati:
  // se comparissero altrove, il colore starebbe tornando a essere deciso in
  // pagina, che e' esattamente cio' che StatoRapportino esiste per impedire.
  it('i colori di stato puro si usano solo in StatoRapportino', () => {
    const altri = sorgenti.filter((p) => !p.endsWith('StatoRapportino.vue'));
    const colpevoli = [];
    for (const percorso of altri) {
      const testo = readFileSync(percorso, 'utf8');
      if (/--of-ottone|--of-ardesia/.test(testo)) {
        colpevoli.push(percorso.replace(radice, 'src'));
      }
    }
    expect(colpevoli).toEqual([]);
  });

  it('nessun file oltre StatoRapportino associa un nome di stato a un colore', () => {
    const altri = sorgenti.filter((p) => !p.endsWith('StatoRapportino.vue'));
    for (const percorso of altri) {
      const testo = readFileSync(percorso, 'utf8');
      // Una mappa che accosta «aperto/chiuso/gestito» a un colore e' una
      // seconda fonte di verita': due schermate finirebbero per mostrare lo
      // stesso stato in due modi.
      expect(testo).not.toMatch(/(aperto|chiuso|gestito)\s*:\s*\{[^}]*colore/);
    }
  });
});
