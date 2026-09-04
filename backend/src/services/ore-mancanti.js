const { formatta, interpreta } = require('./periodo-analisi');

/**
 * Ore attese in un giorno feriale.
 *
 * Costante e uguale per tutti: il modello assume un'officina senza part-time,
 * quindi un campo per persona sarebbe complessita' senza contropartita.
 * Se un domani venissero introdotti orari ridotti, questo
 * valore diventa il default di un campo su `utenti`: il punto da toccare e'
 * uno solo.
 */
const ORE_ATTESE_AL_GIORNO = 8;

/**
 * Arrotonda a due decimali, come il resto dei calcoli sulle ore.
 * @param {number} valore - numero da arrotondare
 * @returns {number} valore arrotondato
 */
function round2(valore) {
  return Math.round(valore * 100) / 100;
}

/**
 * Vero per i giorni da lunedì a venerdì.
 *
 * Le festività non sono modellate: il 15 agosto è trattato come un normale
 * giorno feriale.
 * @param {Date} data - giorno da valutare
 * @returns {boolean} vero se feriale
 */
function isFeriale(data) {
  const giorno = data.getDay();
  return giorno >= 1 && giorno <= 5;
}

/**
 * Elenca i giorni feriali non futuri compresi nell'intervallo.
 * @param {string} da - data di inizio, AAAA-MM-GG
 * @param {string} a - data di fine, AAAA-MM-GG
 * @param {Date} oggi - data di riferimento
 * @returns {string[]} giorni in formato AAAA-MM-GG
 */
function giorniFerialiDaControllare(da, a, oggi) {
  const inizio = interpreta(da, 'iniziale');
  const fine = interpreta(a, 'finale');

  // Un giorno non ancora arrivato non puo' essere "scoperto": segnalarlo
  // sarebbe un rimprovero per non aver fatto cio' che non si poteva fare.
  const limite = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate());
  const ultimo = fine < limite ? fine : limite;

  const giorni = [];
  const cursore = new Date(inizio);
  while (cursore <= ultimo) {
    if (isFeriale(cursore)) {
      giorni.push(formatta(cursore));
    }
    cursore.setDate(cursore.getDate() + 1);
  }
  return giorni;
}

/**
 * Individua i giorni feriali in cui un operaio ha caricato meno delle ore
 * attese, raggruppati per persona.
 *
 * Il calcolo avviene in memoria e non in SQL: l'intervallo dei giorni si
 * genera in JavaScript, senza `generate_series` né altro specifico di
 * PostgreSQL, così i test possono girare su SQLite.
 * @param {object} parametri - dati di ingresso
 * @param {string} parametri.da - inizio dell'intervallo, AAAA-MM-GG
 * @param {string} parametri.a - fine dell'intervallo, AAAA-MM-GG
 * @param {Array<{utente_id: number, utente_nome: string, giorno: string, ore: number}>} parametri.righe - ore già aggregate
 * @param {Array<{id: number, nome: string}>} parametri.operai - operai da controllare
 * @param {Date} [parametri.oggi] - data di riferimento, iniettabile nei test
 * @returns {Array<object>} un elemento per operaio con almeno un giorno scoperto
 */
function calcolaOreMancanti({ da, a, righe = [], operai = [], oggi = new Date() }) {
  const giorniDaControllare = giorniFerialiDaControllare(da, a, oggi);
  if (giorniDaControllare.length === 0 || operai.length === 0) return [];

  // Ore caricate per operaio e per giorno. Le righe multiple dello stesso
  // giorno si sommano: sono lavorazioni diverse della stessa giornata.
  const oreCaricate = new Map();
  for (const r of righe) {
    const chiave = `${r.utente_id}|${r.giorno}`;
    oreCaricate.set(chiave, (oreCaricate.get(chiave) || 0) + Number(r.ore || 0));
  }

  const risultato = [];

  for (const operaio of operai) {
    const giorniScoperti = [];
    let oreMancantiTotali = 0;
    let giorniVuoti = 0;
    let giorniParziali = 0;

    for (const giorno of giorniDaControllare) {
      const caricate = oreCaricate.get(`${operaio.id}|${giorno}`) || 0;
      if (caricate >= ORE_ATTESE_AL_GIORNO) continue;

      const mancanti = round2(ORE_ATTESE_AL_GIORNO - caricate);
      // Un giorno con 5 ore e' un'ora dimenticata, uno con 0 ore e' quasi
      // sempre un'assenza: chi guarda deve poterli separare a colpo d'occhio,
      // altrimenti ad agosto il pannello elenca ogni giorno di ferie.
      const vuoto = caricate === 0;

      giorniScoperti.push({
        giorno,
        ore_caricate: round2(caricate),
        ore_mancanti: mancanti,
        vuoto,
      });

      oreMancantiTotali += mancanti;
      if (vuoto) giorniVuoti++;
      else giorniParziali++;
    }

    if (giorniScoperti.length === 0) continue;

    risultato.push({
      utente_id: operaio.id,
      utente_nome: operaio.nome,
      giorni: giorniScoperti,
      giorni_vuoti: giorniVuoti,
      giorni_parziali: giorniParziali,
      ore_mancanti_totali: round2(oreMancantiTotali),
    });
  }

  // In cima chi ha più ore da recuperare: è la persona con cui parlare per prima.
  return risultato.sort((x, y) => y.ore_mancanti_totali - x.ore_mancanti_totali);
}

module.exports = {
  calcolaOreMancanti,
  giorniFerialiDaControllare,
  isFeriale,
  ORE_ATTESE_AL_GIORNO,
};
