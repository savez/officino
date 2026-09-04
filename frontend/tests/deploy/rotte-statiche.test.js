import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const qui = dirname(fileURLToPath(import.meta.url));
const nginx = readFileSync(resolve(qui, '../../nginx.conf'), 'utf8');

/**
 * Estrae il corpo di un blocco `location`, contando le graffe.
 *
 * Un'espressione regolare che si fermasse alla prima `}` taglierebbe il blocco
 * a meta' appena qualcuno vi annidasse una direttiva con un proprio corpo.
 * @param {string} conf contenuto di nginx.conf
 * @param {string} chiave il matcher del blocco, come compare nel file
 * @returns {string|null} il corpo fra graffe, o null se il blocco non c'e'
 */
function corpoDiLocation(conf, chiave) {
  const inizio = conf.indexOf(`location ${chiave}`);
  if (inizio === -1) return null;
  const apertura = conf.indexOf('{', inizio);
  if (apertura === -1) return null;
  let livello = 0;
  for (let i = apertura; i < conf.length; i++) {
    if (conf[i] === '{') livello++;
    else if (conf[i] === '}' && --livello === 0) return conf.slice(apertura + 1, i);
  }
  return null;
}

// Difetto gia' riscontrato in produzione: aprire direttamente /rapportini
// restituiva 404, mentre navigandoci dall'interno funzionava. Le rotte del
// router esistono solo nel browser, non come file sul server.
//
// È una riga di configurazione facile da perdere in un riordino, e il difetto
// che ne consegue non si vede provando l'applicazione dall'interno: serve
// aprire un link diretto, ricaricare una pagina o usare un segnalibro.
//
// Il controllo viveva su render.yaml. Da quando il deploy e' solo Docker, la
// stessa garanzia sta in frontend/nginx.conf, che il frontend/Dockerfile copia
// in /etc/nginx/conf.d/default.conf. Nota che qui l'ORDINE dei blocchi non
// conta: nginx sceglie per precedenza del matcher, non per posizione nel file,
// quindi non c'e' piu' nulla da asserire sull'ordinamento.
describe('il sito statico serve le rotte del router', () => {
  it('ogni percorso che non e\' un file cade su index.html', () => {
    const radice = corpoDiLocation(nginx, '/ ');
    expect(radice).not.toBeNull();
    expect(radice).toMatch(/try_files\s+[^;]*\/index\.html\s*;/);
  });

  it('le chiamate API restano inoltrate al backend', () => {
    const api = corpoDiLocation(nginx, '/api/');
    expect(api).not.toBeNull();
    const proxy = api.match(/proxy_pass\s+(\S+?)\s*;/);
    expect(proxy).not.toBeNull();
    // Deve uscire dal sito statico: un percorso locale rimanderebbe la chiamata
    // a nginx stesso, che non ha nessuna API da rispondere.
    expect(proxy[1]).toMatch(/^https?:\/\//);
  });

  // Il gemello del difetto qui sopra, e il piu' insidioso dei due. Se anche gli
  // asset cadessero su index.html, un bundle mancante non darebbe 404 ma
  // restituirebbe l'HTML dell'applicazione con content-type sbagliato: il
  // browser proverebbe a eseguire una pagina HTML come JavaScript, e l'errore
  // che ne esce non nomina il file che manca.
  it('un asset mancante da 404, non la pagina', () => {
    const asset = corpoDiLocation(nginx, '~*');
    expect(asset).not.toBeNull();
    expect(asset).toMatch(/try_files\s+\$uri\s+=404\s*;/);
    expect(asset).not.toMatch(/index\.html/);
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
