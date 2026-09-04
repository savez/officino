import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { routes } from '../../router/index.js';

const qui = dirname(fileURLToPath(import.meta.url));

/**
 * Legge un file del frontend, togliendo i commenti HTML.
 *
 * I commenti vanno tolti perché il menu contiene voci disattivate lasciate a
 * commento: contarle darebbe un quadro diverso da quello che l'utente vede.
 * @param {string} percorso - percorso relativo al file di test
 * @returns {string} contenuto senza commenti HTML
 */
function leggiSenzaCommenti(percorso) {
  return readFileSync(resolve(qui, percorso), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
}

/**
 * Aree che il MENU mostra soltanto agli amministratori.
 *
 * È il riferimento per la guida: sono i due punti che decidono cosa l'utente
 * vede. Se divergono, la guida descrive pagine che l'utente non trova.
 * @returns {Set<string>} identificatori delle aree riservate nel menu
 */
function areeRiservateNelMenu() {
  const app = leggiSenzaCommenti('../../App.vue');
  const riservate = new Set();

  for (const blocco of app.split('<li').slice(1)) {
    const testa = blocco.slice(0, blocco.indexOf('>'));
    const percorso = blocco.match(/to="\/([^"]*)"/);
    if (/v-if="adminUser"/.test(testa) && percorso && percorso[1]) {
      riservate.add(percorso[1].split('/')[0]);
    }
  }
  return riservate;
}

/**
 * Aree che il menu mostra a tutti.
 * @returns {Set<string>} identificatori delle aree aperte nel menu
 */
function areeAperteNelMenu() {
  const app = leggiSenzaCommenti('../../App.vue');
  const aperte = new Set();

  for (const blocco of app.split('<li').slice(1)) {
    const testa = blocco.slice(0, blocco.indexOf('>'));
    const percorso = blocco.match(/to="\/([^"]*)"/);
    if (!/v-if="adminUser"/.test(testa) && percorso && percorso[1]) {
      aperte.add(percorso[1].split('/')[0]);
    }
  }
  return aperte;
}

/**
 * Aree che la GUIDA considera riservate.
 * @returns {Set<string>} identificatori delle sezioni riservate
 */
function areeRiservateNellaGuida() {
  const guida = readFileSync(resolve(qui, '../GuidaPage.vue'), 'utf8');
  const riservate = new Set();

  for (const riga of guida.split('\n')) {
    if (!riga.includes('adminOnly')) continue;
    const id = riga.match(/id:\s*'([^']+)'/);
    const valore = riga.match(/adminOnly:\s*(true|false)/);
    if (id && valore && valore[1] === 'true') riservate.add(id[1]);
  }
  return riservate;
}

/**
 * Aree protette dal ROUTER, cioè quelle da cui si viene davvero respinti.
 * @returns {Set<string>} identificatori delle aree protette
 */
function areeProtetteDalRouter() {
  return new Set(
    routes
      .filter((r) => r.meta?.requiresAdmin)
      .map((r) => r.path.replace(/^\//, '').split('/')[0])
      .filter(Boolean)
  );
}

// Questo test esiste per un difetto reale: le aree riservate erano dichiarate
// in tre posti — router, menu e guida — tenuti allineati solo dall'attenzione di
// chi modificava. Quando la feature 013 ha riservato Clienti e Preventivi, menu
// e router sono stati aggiornati e la guida no: un operaio leggeva istruzioni
// dettagliate per pagine che non poteva aprire.
//
// Né il build né il linter lo vedevano.
describe('coerenza fra guida e menu', () => {
  const menu = areeRiservateNelMenu();
  const guida = areeRiservateNellaGuida();

  it('il menu dichiara delle aree riservate', () => {
    // Senza questo controllo, gli altri test passerebbero confrontando insiemi
    // vuoti perché il file non viene letto correttamente.
    expect(menu.size).toBeGreaterThan(0);
  });

  // È l'invariante che conta: menu e guida sono i due punti che decidono cosa
  // l'utente vede. Se divergono, la guida descrive pagine che non trova.
  it('la guida riserva esattamente le aree che il menu nasconde', () => {
    expect([...guida].sort()).toEqual([...menu].sort());
  });

  it('clienti risulta riservata nella guida', () => {
    expect(guida.has('clienti')).toBe(true);
  });

  it('preventivi risulta riservata nella guida', () => {
    expect(guida.has('preventivi')).toBe(true);
  });

  it('le aree su cui l operaio lavora restano visibili nella guida', () => {
    for (const area of areeAperteNelMenu()) {
      expect({ area, riservataNellaGuida: guida.has(area) }).toEqual({
        area,
        riservataNellaGuida: false,
      });
    }
  });
});

// Il router è il livello che respinge davvero. Non coincide col menu, e le
// differenze sono note e volute: qui vengono fissate, così che se cambiassero
// qualcuno se ne accorga invece di scoprirlo per caso.
describe('divergenze note fra menu e router', () => {
  const menu = areeRiservateNelMenu();
  const router = areeProtetteDalRouter();

  // Lacuna registrata nella feature 013, per scelta esplicita dell'utente:
  // la voce è nascosta dal menu ma la rotta non è protetta, quindi chi conosce
  // l'indirizzo ci arriva e l'API risponde. Nascondere riduce la probabilità
  // che accada per caso, non la possibilità che accada.
  it('preventivi: nascosto dal menu ma la rotta non e protetta', () => {
    expect(menu.has('preventivi')).toBe(true);
    expect(router.has('preventivi')).toBe(false);
  });

  // La voce di menu è commentata (LOG MANAGEMENT DISABLED), quindi non compare
  // a nessuno, mentre la rotta resta protetta.
  it('log: rotta protetta, voce di menu disattivata', () => {
    expect(router.has('log')).toBe(true);
    expect(menu.has('log')).toBe(false);
  });

  it('a parte queste due, menu e router concordano', () => {
    const soloMenu = [...menu].filter((a) => !router.has(a));
    const soloRouter = [...router].filter((a) => !menu.has(a));

    expect({ soloMenu: soloMenu.sort(), soloRouter: soloRouter.sort() }).toEqual({
      soloMenu: ['preventivi'],
      soloRouter: ['log'],
    });
  });
});
