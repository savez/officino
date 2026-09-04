const { risolviPeriodo } = require('../services/periodo-analisi');
const { calcolaOreMancanti } = require('../services/ore-mancanti');
const { contaRapportini, misuraNote } = require('../services/metriche-dashboard');
const { ROLE_USER } = require('../utils/roles');

const round2 = (v) => Math.round(Number(v || 0) * 100) / 100;

/**
 * Query di base delle lavorazioni nel periodo, con cliente e operaio presi dal
 * rapportino.
 *
 * Cliente e operaio stanno ora sul rapportino, non sulla lavorazione: sono
 * dell'intervento, non della singola giornata. Ogni aggregazione parte da qui,
 * così le tre viste — per cliente, per operaio, ore mancanti — non possono
 * divergere nel modo in cui selezionano i dati.
 * @param {import('fastify').FastifyInstance} app
 * @param {string} da - inizio del periodo, AAAA-MM-GG
 * @param {string} a - fine del periodo, AAAA-MM-GG
 * @returns {import('knex').Knex.QueryBuilder}
 */
function lavorazioniDelPeriodo(app, da, a) {
  return app
    .db('lavorazioni as l')
    .join('rapportini as r', 'l.rapportino_id', 'r.id')
    .join('clienti as c', 'r.cliente_id', 'c.id')
    .join('utenti as u', 'r.utente_id', 'u.id')
    .whereBetween('l.giorno', [da, a]);
}

/**
 * Aggrega le ore per una chiave, distinguendo quelle già confluite in una nota.
 * @param {object[]} righe - lavorazioni con ore e nota_lavorazione_id
 * @param {string} chiaveId - nome del campo identificatore
 * @param {string} chiaveNome - nome del campo descrittivo
 * @returns {object[]} aggregati ordinati per ore decrescenti
 */
function aggregaOre(righe, chiaveId, chiaveNome) {
  const mappa = {};
  for (const riga of righe) {
    const id = riga[chiaveId];
    const ore = Number(riga.ore || 0);
    if (!mappa[id]) {
      mappa[id] = {
        [chiaveId]: id,
        [chiaveNome]: riga[chiaveNome],
        ore_totali: 0,
        ore_in_nota: 0,
        ore_non_gestite: 0,
      };
    }
    mappa[id].ore_totali += ore;
    if (riga.nota_lavorazione_id) mappa[id].ore_in_nota += ore;
    else mappa[id].ore_non_gestite += ore;
  }

  return Object.values(mappa)
    .sort((x, y) => y.ore_totali - x.ore_totali)
    .map((v) => ({
      ...v,
      ore_totali: round2(v.ore_totali),
      ore_in_nota: round2(v.ore_in_nota),
      ore_non_gestite: round2(v.ore_non_gestite),
    }));
}

/**
 * Rotte della dashboard.
 * @param {import('fastify').FastifyInstance} app
 */
async function dashboardRoutes(app) {
  app.get('/stats', { preHandler: [app.authenticate] }, async (request, reply) => {
    let periodo;
    try {
      periodo = risolviPeriodo(request.query);
    } catch (err) {
      return reply.status(400).send({ error: err.message });
    }

    const isAdmin = request.user.ruolo === 'admin';
    const dataInizio = periodo.da;
    const dataFine = periodo.a;

    // Il filtro sull'utente si IMPONE, non si valida: per un non-admin
    // l'operaio_id in arrivo viene sovrascritto col proprio, qualunque cosa
    // contenga. Un parametro ignorato non può diventare una fuga di dati per
    // una dimenticanza in un ramo condizionale più avanti.
    const operaioRichiesto = Number(request.query.operaio_id) || null;
    const filtroUtenteId = isAdmin ? operaioRichiesto : request.user.id;

    // ── Ore ───────────────────────────────────────────────────────────────
    // Una sola lettura alimenta le tre viste: per cliente, per operaio e ore
    // mancanti. Le ore sono un dato registrato, non più una durata da calcolare
    // dalla fascia oraria.
    let query = lavorazioniDelPeriodo(app, dataInizio, dataFine).select(
      'l.giorno',
      'l.ore',
      'r.cliente_id',
      'c.nome as cliente_nome',
      'r.utente_id',
      'u.nome as utente_nome',
      'r.nota_lavorazione_id'
    );
    if (filtroUtenteId) query = query.where('r.utente_id', filtroUtenteId);

    const righe = await query;

    const perCliente = aggregaOre(righe, 'cliente_id', 'cliente_nome');
    const perOperaio = isAdmin ? aggregaOre(righe, 'utente_id', 'utente_nome') : [];

    // Elenco degli operai selezionabili: l'unione di due insiemi.
    //
    // 1. TUTTI gli utenti con ruolo operaio, anche se nel periodo non hanno
    //    caricato niente. Ricavarlo dalle sole lavorazioni del periodo lascia
    //    la tendina vuota quando non ci sono rapportini, e rende invisibile
    //    nelle ore mancanti chi non ha caricato NULLA — cioè la persona che si
    //    vorrebbe vedere per prima.
    //
    // 2. Chiunque abbia lavorazioni nel periodo, qualunque sia il suo ruolo
    //    oggi. Serve per chi è stato promosso o disattivato dopo aver
    //    lavorato: le sue ore restano e devono restare raggiungibili.
    let operai = [];
    if (isAdmin) {
      const [utentiOperai, autoriDelPeriodo] = await Promise.all([
        app.db('utenti').where({ ruolo: ROLE_USER }).select('id', 'nome'),
        lavorazioniDelPeriodo(app, dataInizio, dataFine).distinct('u.id', 'u.nome'),
      ]);

      const perId = new Map();
      for (const u of [...utentiOperai, ...autoriDelPeriodo]) {
        perId.set(u.id, { id: u.id, nome: u.nome });
      }
      operai = [...perId.values()].sort((a, b) => a.nome.localeCompare(b.nome));
    }

    // ── Ore mancanti ──────────────────────────────────────────────────────
    // `ore-mancanti.js` NON è stato modificato da questa feature: riceve righe
    // già aggregate e non sa da dove vengano le ore. Cambia solo cosa gli si
    // passa.
    const operaiDaControllare = isAdmin
      ? filtroUtenteId
        ? operai.filter((o) => o.id === filtroUtenteId)
        : operai
      : [{ id: request.user.id, nome: request.user.nome || 'Io' }];

    const righeOre = righe.map((riga) => ({
      utente_id: riga.utente_id ?? request.user.id,
      giorno: typeof riga.giorno === 'string' ? riga.giorno : String(riga.giorno),
      ore: Number(riga.ore || 0),
    }));

    const oreMancanti = calcolaOreMancanti({
      da: dataInizio,
      a: dataFine,
      righe: righeOre,
      operai: operaiDaControllare,
    });

    // ── Metriche del lavoro, per il solo amministratore ───────────────────
    // All'operaio non compaiono affatto: misura le proprie ore, non il flusso
    // dell'officina. Le chiavi restano assenti invece di arrivare a zero, cosi'
    // «non ti riguarda» non si confonde con «non e' successo nulla».
    const metriche = {};
    if (isAdmin) {
      const [rapportini, note] = await Promise.all([
        contaRapportini(app.db, { periodo, utenteId: filtroUtenteId }),
        misuraNote(app.db, { periodo, utenteId: filtroUtenteId }),
      ]);
      metriche.rapportini = rapportini;
      metriche.note = note;
    }

    return {
      periodo,
      operai,
      ore_mancanti: oreMancanti,
      operaio_id: filtroUtenteId,
      ore: { per_cliente: perCliente, per_operaio: perOperaio },
      ...metriche,
    };
  });

  // ── Esportazione in Excel ───────────────────────────────────────────────
  app.get(
    '/export-ore',
    { preHandler: [app.authenticate, app.requireRole('admin')] },
    async (request, reply) => {
      let periodo;
      try {
        periodo = risolviPeriodo(request.query);
      } catch (err) {
        return reply.status(400).send({ error: err.message });
      }

      const dataInizio = periodo.da;
      const dataFine = periodo.a;

      // L'esportazione deve rispettare lo stesso filtro operaio dello schermo:
      // se i due divergessero, si esporterebbero i dati di tutti mentre se ne
      // guarda uno solo, senza che nulla lo segnali.
      const filtroUtenteId = Number(request.query.operaio_id) || null;

      let query = lavorazioniDelPeriodo(app, dataInizio, dataFine)
        .select(
          'l.giorno',
          'l.ore',
          'l.note',
          'u.nome as utente_nome',
          'c.nome as cliente_nome',
          'r.macchina',
          'r.nota_lavorazione_id',
          'r.utente_id',
          'r.cliente_id'
        )
        .orderBy('l.giorno', 'asc')
        // Secondo criterio necessario: senza, le lavorazioni dello stesso
        // giorno cambierebbero posto a ogni esportazione, e due file dello
        // stesso periodo risulterebbero diversi senza motivo apparente.
        .orderBy('l.id', 'asc');

      if (filtroUtenteId) query = query.where('r.utente_id', filtroUtenteId);

      const righe = await query;

      const perOperaio = aggregaOre(righe, 'utente_id', 'utente_nome');
      const perCliente = aggregaOre(righe, 'cliente_id', 'cliente_nome');

      const XLSX = require('xlsx');

      const foglioOperai = perOperaio.map((o) => ({
        Operaio: o.utente_nome,
        'Ore Totali': o.ore_totali,
        'Ore in Nota': o.ore_in_nota,
        'Ore non Gestite': o.ore_non_gestite,
      }));

      const foglioClienti = perCliente.map((c) => ({
        Cliente: c.cliente_nome,
        'Ore Totali': c.ore_totali,
        'Ore in Nota': c.ore_in_nota,
        'Ore non Gestite': c.ore_non_gestite,
      }));

      // Le colonne "Ora Inizio" e "Ora Fine" sono sostituite da "Ore": la
      // fascia oraria non viene più registrata. È un cambio visibile a chi usa
      // il foglio, non un adeguamento interno.
      const foglioDettaglio = righe.map((r) => ({
        Giorno: r.giorno,
        Operaio: r.utente_nome,
        Cliente: r.cliente_nome,
        Macchina: r.macchina || '',
        Ore: round2(r.ore),
        'In Nota': r.nota_lavorazione_id ? 'Sì' : 'No',
        Note: r.note || '',
      }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(foglioOperai), 'Ore per Operaio');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(foglioClienti), 'Ore per Cliente');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(foglioDettaglio), 'Dettaglio');

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      reply.header(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      const suffisso = filtroUtenteId ? `_operaio-${filtroUtenteId}` : '';
      reply.header(
        'Content-Disposition',
        `attachment; filename="ore_${dataInizio}_${dataFine}${suffisso}.xlsx"`
      );
      return reply.send(buffer);
    }
  );
}

module.exports = dashboardRoutes;
