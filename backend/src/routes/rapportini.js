const { z } = require('zod');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const { risolviPeriodo } = require('../services/periodo-analisi');
const { calcolaTotaliLavorazione } = require('../services/calcolo-totali-nota');
const { trovaDuplicatoAperto } = require('../services/macchinario');
const {
  derivaStato,
  isAmministratore,
  puoVedere,
  verificaModificabile,
  verificaEliminabile,
  verificaChiudibile,
  verificaRiapribile,
  applicaStato,
} = require('../services/stato-rapportino');
const { applicaPeriodoElenco } = require('../services/periodo-rapportini');

const materialeSchema = z
  .object({
    pezzo_id: z.number().int().positive().optional().nullable(),
    nome_manuale: z.string().min(1).optional().nullable(),
    quantita: z.number().int().min(1).default(1),
    fuori_catalogo: z.boolean().default(false),
    prezzo_unitario: z.number().min(0).multipleOf(0.01).optional().default(0),
  })
  .refine((m) => (m.fuori_catalogo ? !!m.nome_manuale : !!m.pezzo_id), {
    message: 'pezzo_id obbligatorio per materiali da catalogo, nome_manuale per fuori catalogo',
  });

const rapportinoSchema = z.object({
  cliente_id: z.number().int().positive({ message: 'Cliente obbligatorio' }),
  // Testo libero: nessuna anagrafica macchinari, per scelta esplicita.
  // Vuoto non è ammesso perché è l'unica cosa che distingue un rapportino da
  // un altro dello stesso operaio per lo stesso cliente.
  macchina: z.string().trim().min(1, { message: 'Macchinario obbligatorio' }),
});

// Il tetto di 999,99 non è un giudizio sulla plausibilità: è la capienza della
// colonna. Respingerlo qui produce un messaggio leggibile invece di un errore
// del driver. L'avviso sopra le 12 ore vive nell'interfaccia ed è confermabile:
// il server non blocca nulla in quella fascia (FR-005a).
const lavorazioneSchema = z.object({
  giorno: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato giorno non valido (AAAA-MM-GG)'),
  ore: z
    .number()
    .positive({ message: 'Le ore devono essere maggiori di zero' })
    .max(999.99, { message: 'Valore troppo grande: massimo 999,99 ore per lavorazione' })
    .refine((v) => Math.round(v * 100) % 25 === 0, {
      message: "Le ore vanno indicate a quarti d'ora (multipli di 0,25)",
    }),
  note: z.string().optional().nullable(),
  materiali: z.array(materialeSchema).optional().default([]),
  costo_orario_applicato: z.number().min(0).multipleOf(0.01).optional(),
});

const round2 = (v) => Math.round(Number(v) * 100) / 100;

/**
 * Risolve il costo orario da registrare sulla lavorazione.
 *
 * Solo l'amministratore può imporre un valore; per gli altri quello inviato
 * viene ignorato SENZA errore e si usa la fotografia del profilo (FR-006b).
 * Ignorare in silenzio invece di rifiutare è deliberato: un operaio che invia
 * il campo non sta tentando nulla, sta usando un client che lo include.
 * @param {import('fastify').FastifyInstance} app
 * @param {object} request
 * @param {number|undefined} fornito
 * @returns {Promise<number>}
 */
async function risolviCostoOrario(app, request, fornito) {
  if (isAmministratore(request.user) && typeof fornito === 'number') {
    return fornito;
  }
  const u = await app.db('utenti').where({ id: request.user.id }).first();
  return Number(u && u.costo_orario != null ? u.costo_orario : 0);
}

/**
 * Carica un rapportino e il numero delle sue lavorazioni.
 *
 * Tutti gli endpoint che modificano passano da qui: è ciò che rende possibile
 * applicare la regola sui permessi in un punto solo invece di ripeterla.
 * @param {import('fastify').FastifyInstance} app
 * @param {number|string} id
 * @returns {Promise<{rapportino: object, numeroLavorazioni: number}|null>}
 */
async function caricaRapportino(app, id) {
  const rapportino = await app.db('rapportini').where({ id }).first();
  if (!rapportino) return null;
  const [conteggio] = await app.db('lavorazioni').where({ rapportino_id: id }).count('* as n');
  return { rapportino, numeroLavorazioni: Number(conteggio.n) };
}

/**
 * Verifica che i materiali da catalogo esistano davvero.
 * @param {import('fastify').FastifyInstance} app
 * @param {Array<object>} materiali
 * @returns {Promise<string|null>} messaggio d'errore, oppure null
 */
async function verificaMateriali(app, materiali) {
  for (const mat of materiali) {
    if (!mat.fuori_catalogo) {
      const pezzo = await app.db('catalogo_prodotti').where({ id: mat.pezzo_id }).first();
      if (!pezzo) return `Prodotto con id ${mat.pezzo_id} non trovato`;
    }
  }
  return null;
}

/**
 * Inserisce i materiali di una lavorazione, con la fotografia del prezzo.
 * @param {import('knex').Knex} trx
 * @param {number} lavorazioneId
 * @param {Array<object>} materiali
 * @returns {Promise<void>}
 */
async function inserisciMateriali(trx, lavorazioneId, materiali) {
  for (const mat of materiali) {
    await trx('materiali_lavorazione').insert({
      lavorazione_id: lavorazioneId,
      pezzo_id: mat.fuori_catalogo ? null : mat.pezzo_id,
      nome_manuale: mat.fuori_catalogo ? mat.nome_manuale : null,
      quantita: mat.quantita,
      fuori_catalogo: mat.fuori_catalogo,
      prezzo_unitario: Number(mat.prezzo_unitario || 0),
    });
  }
}

/**
 * Carica i materiali di un insieme di lavorazioni, raggruppati per lavorazione.
 *
 * Il prezzo è esposto solo all'amministratore: è l'invariante già in vigore, per
 * cui un operaio non vede mai dati economici.
 * @param {import('fastify').FastifyInstance} app
 * @param {number[]} lavorazioneIds
 * @param {boolean} conPrezzi
 * @returns {Promise<Record<number, object[]>>}
 */
async function caricaMateriali(app, lavorazioneIds, conPrezzi) {
  const mappa = {};
  if (lavorazioneIds.length === 0) return mappa;

  const materiali = await app
    .db('materiali_lavorazione as m')
    .leftJoin('catalogo_prodotti as p', 'm.pezzo_id', 'p.id')
    .whereIn('m.lavorazione_id', lavorazioneIds)
    .select('m.*', 'p.nome as pezzo_nome');

  for (const mat of materiali) {
    if (!mappa[mat.lavorazione_id]) mappa[mat.lavorazione_id] = [];
    const base = {
      id: mat.id,
      pezzo_id: mat.pezzo_id,
      nome: mat.fuori_catalogo ? mat.nome_manuale : mat.pezzo_nome,
      quantita: mat.quantita,
      fuori_catalogo: mat.fuori_catalogo,
    };
    if (conPrezzi) {
      const prezzo = Number(mat.prezzo_unitario || 0);
      base.prezzo_unitario = prezzo;
      base.totale_materiale = round2(prezzo * Number(mat.quantita || 0));
    }
    mappa[mat.lavorazione_id].push(base);
  }
  return mappa;
}

/**
 * Rotte dei rapportini: il contenitore delle lavorazioni svolte da un operaio
 * su un solo macchinario per un solo cliente.
 *
 * Le lavorazioni sono annidate sotto il rapportino di proposito. Non esistono
 * come risorsa di primo livello perché così ogni modifica carica prima il
 * rapportino padre, che è il passaggio necessario per applicare la regola sui
 * permessi: non c'è una via per modificare una lavorazione senza esserci
 * passati.
 * @param {import('fastify').FastifyInstance} app
 */
async function rapportiniRoutes(app) {
  // ── Elenco paginato ──────────────────────────────────────────────────────
  app.get('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { page, perPage, offset } = parsePagination(request.query);
    const { cliente_id, utente_id, stato } = request.query;

    // Stesso servizio usato dalla dashboard: scorciatoie, messaggi d'errore
    // e limite di ampiezza non possono divergere fra i due filtri, perché
    // sono lo stesso codice. Le date restano FACOLTATIVE: ometterle
    // significa nessun filtro temporale.
    const chiedePeriodo = Boolean(request.query.da || request.query.a || request.query.scorciatoia);
    let periodo = null;
    if (chiedePeriodo) {
      try {
        periodo = risolviPeriodo(request.query);
      } catch (err) {
        return reply.status(400).send({ error: err.message });
      }
    }

    const admin = isAmministratore(request.user);

    let query = app
      .db('rapportini as r')
      .leftJoin('utenti as u', 'r.utente_id', 'u.id')
      .leftJoin('clienti as c', 'r.cliente_id', 'c.id');

    if (!admin) query = query.where('r.utente_id', request.user.id);
    if (cliente_id) query = query.where('r.cliente_id', cliente_id);
    if (utente_id && admin) query = query.where('r.utente_id', utente_id);

    // Lo stato non è una colonna: si traduce in condizioni sui due campi da
    // cui deriva. La traduzione sta accanto a `derivaStato`, cosi' il modo
    // di LEGGERE lo stato e quello di FILTRARLO non possono divergere.
    if (stato) query = applicaStato(query, stato, 'r');

    // "Almeno una lavorazione nell'intervallo, oppure nessuna lavorazione":
    // un rapportino che copre gennaio e marzo compare anche filtrando
    // febbraio (FR-021), e uno appena creato compare sempre, altrimenti
    // sarebbe irraggiungibile.
    //
    // La condizione vive in `periodo-rapportini.js` perche' la dashboard
    // deve contare gli stessi rapportini che questo elenco mostra: scritta
    // due volte, la coincidenza reggerebbe solo finche' nessuno tocca una
    // delle due copie.
    if (periodo) {
      query = applicaPeriodoElenco(query, periodo, 'r');
    }

    const [{ count }] = await query.clone().clearSelect().count('r.id as count');

    const righe = await query
      .clone()
      .select('r.*', 'u.nome as utente_nome', 'c.nome as cliente_nome')
      .orderBy('r.created_at', 'desc')
      .orderBy('r.id', 'desc')
      .limit(perPage)
      .offset(offset);

    const ids = righe.map((r) => r.id);
    const aggregati = {};
    if (ids.length > 0) {
      const righeAgg = await app
        .db('lavorazioni')
        .whereIn('rapportino_id', ids)
        .groupBy('rapportino_id')
        .select('rapportino_id')
        .min('giorno as giorno_da')
        .max('giorno as giorno_a')
        .sum('ore as totale_ore')
        .count('id as numero_lavorazioni');
      for (const a of righeAgg) aggregati[a.rapportino_id] = a;
    }

    // Ore totali su TUTTO il filtro, non solo sulla pagina: chi guarda un
    // periodo vuole il totale del periodo, non quello di venti righe.
    const [{ ore_filtrate }] = await app
      .db('lavorazioni as l')
      .whereIn('l.rapportino_id', query.clone().clearSelect().clearOrder().select('r.id'))
      .sum('l.ore as ore_filtrate');

    const data = righe.map((r) => {
      const agg = aggregati[r.id];
      return {
        id: r.id,
        utente_id: r.utente_id,
        utente_nome: r.utente_nome,
        cliente_id: r.cliente_id,
        cliente_nome: r.cliente_nome,
        macchina: r.macchina,
        stato: derivaStato(r),
        nota_lavorazione_id: r.nota_lavorazione_id,
        chiuso_il: r.chiuso_il,
        // null quando non ci sono lavorazioni: l'elenco deve mostrare
        // "nessuna lavorazione", non una cella vuota che si legge come
        // un difetto di caricamento.
        periodo: agg ? { da: agg.giorno_da, a: agg.giorno_a } : null,
        totale_ore: agg ? round2(agg.totale_ore) : 0,
        numero_lavorazioni: agg ? Number(agg.numero_lavorazioni) : 0,
      };
    });

    const risposta = paginatedResponse(data, Number(count), page, perPage);
    risposta.ore_totali_filtrate = round2(ore_filtrate || 0);
    return risposta;
  });

  // ── Stampa PDF (solo amministratore) ─────────────────────────────────────
  // Registrata prima di /:id perché il percorso statico deve prevalere sul
  // parametrico.
  app.get(
    '/stampa',
    { preHandler: [app.authenticate, app.requireRole('admin')] },
    async (request, reply) => {
      const { cliente_id } = request.query;

      const chiedePeriodo = Boolean(
        request.query.da || request.query.a || request.query.scorciatoia
      );
      let periodo = null;
      if (chiedePeriodo) {
        try {
          periodo = risolviPeriodo(request.query);
        } catch (err) {
          return reply.status(400).send({ error: err.message });
        }
      }

      // Senza almeno un filtro si stamperebbe l'intero storico
      // dell'officina in un solo documento.
      if (!periodo && !cliente_id) {
        return reply.status(400).send({
          error: 'Specificare almeno un filtro: un intervallo di date oppure un cliente',
        });
      }

      let query = app
        .db('rapportini as r')
        .leftJoin('utenti as u', 'r.utente_id', 'u.id')
        .leftJoin('clienti as c', 'r.cliente_id', 'c.id')
        .select('r.*', 'u.nome as utente_nome', 'c.nome as cliente_nome');

      if (cliente_id) query = query.where('r.cliente_id', cliente_id);
      if (periodo) {
        query = query.whereExists(function () {
          this.select(1)
            .from('lavorazioni as l')
            .whereRaw('l.rapportino_id = r.id')
            .whereBetween('l.giorno', [periodo.da, periodo.a]);
        });
      }

      const rapportini = await query.orderBy('r.id', 'asc');
      if (rapportini.length === 0) {
        return reply
          .status(404)
          .send({ error: 'Nessun rapportino trovato per i filtri specificati' });
      }

      let lavorazioniQuery = app.db('lavorazioni').whereIn(
        'rapportino_id',
        rapportini.map((r) => r.id)
      );
      if (periodo) {
        lavorazioniQuery = lavorazioniQuery.whereBetween('giorno', [periodo.da, periodo.a]);
      }
      const lavorazioni = await lavorazioniQuery.orderBy('giorno', 'asc').orderBy('id', 'asc');

      // Materiali SENZA prezzo: il documento operativo non espone dati
      // economici, invariante già in vigore.
      const materialiMap = await caricaMateriali(
        app,
        lavorazioni.map((l) => l.id),
        false
      );

      const perRapportino = {};
      for (const l of lavorazioni) {
        if (!perRapportino[l.rapportino_id]) perRapportino[l.rapportino_id] = [];
        perRapportino[l.rapportino_id].push({
          giorno: l.giorno,
          ore: round2(l.ore),
          note: l.note,
          materiali: materialiMap[l.id] || [],
        });
      }

      const modello = rapportini
        .map((r) => ({
          macchina: r.macchina,
          cliente_nome: r.cliente_nome,
          utente_nome: r.utente_nome,
          stato: derivaStato(r),
          lavorazioni: perRapportino[r.id] || [],
        }))
        .filter((r) => r.lavorazioni.length > 0);

      if (modello.length === 0) {
        return reply
          .status(404)
          .send({ error: 'Nessuna lavorazione trovata per i filtri specificati' });
      }

      const periodoLeggibile = periodo
        ? periodo.da === periodo.a
          ? periodo.da
          : `${periodo.da} — ${periodo.a}`
        : null;

      let intestazione;
      if (cliente_id) {
        const cliente = await app.db('clienti').where({ id: cliente_id }).first();
        const nomeCliente = cliente ? cliente.nome : 'Cliente';
        intestazione = periodoLeggibile ? `${nomeCliente} — ${periodoLeggibile}` : nomeCliente;
      } else {
        intestazione = periodoLeggibile;
      }

      const { generaPdfRapportino } = require('../services/pdf-rapportino');
      const pdfBuffer = await generaPdfRapportino(intestazione, modello);

      reply.header('Content-Type', 'application/pdf');
      const suffisso = periodo
        ? periodo.da === periodo.a
          ? `_${periodo.da}`
          : `_${periodo.da}_${periodo.a}`
        : '';
      reply.header('Content-Disposition', `inline; filename="rapportino${suffisso}.pdf"`);
      return reply.send(pdfBuffer);
    }
  );

  // ── Creazione del contenitore ────────────────────────────────────────────
  app.post('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = rapportinoSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dati non validi', details: parsed.error.flatten() });
    }

    const { cliente_id, macchina } = parsed.data;

    const cliente = await app.db('clienti').where({ id: cliente_id }).first();
    if (!cliente) {
      return reply.status(404).send({ error: 'Cliente non trovato' });
    }

    // L'avviso NON impedisce la creazione: segnala una conseguenza prima
    // che si verifichi, e la decisione resta all'operaio (FR-024).
    const duplicato = await trovaDuplicatoAperto(app.db, {
      utenteId: request.user.id,
      clienteId: cliente_id,
      macchina,
    });

    const [creato] = await app
      .db('rapportini')
      .insert({ utente_id: request.user.id, cliente_id, macchina })
      .returning('*');

    try {
      await app.logModifica(app.db, {
        utente_id: request.user.id,
        entita: 'rapportino',
        entita_id: creato.id,
        azione: 'creazione',
        dettaglio: { cliente: cliente.nome, macchina },
      });
    } catch (logErr) {
      app.log.error({ err: logErr }, 'Registrazione della modifica non riuscita');
    }

    const risposta = {
      id: creato.id,
      stato: 'aperto',
      macchina: creato.macchina,
      message: 'Rapportino creato',
    };
    if (duplicato) {
      risposta.avviso_duplicato = { id: duplicato.id, macchina: duplicato.macchina };
    }
    return reply.status(201).send(risposta);
  });

  // ── Dettaglio ────────────────────────────────────────────────────────────
  app.get('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const caricato = await caricaRapportino(app, request.params.id);
    if (!caricato) return reply.status(404).send({ error: 'Rapportino non trovato' });

    const { rapportino } = caricato;
    if (!puoVedere(rapportino, request.user)) {
      return reply.status(403).send({ error: 'Non puoi vedere i rapportini di altri operai' });
    }

    const admin = isAmministratore(request.user);
    const anagrafica = await app
      .db('rapportini as r')
      .leftJoin('utenti as u', 'r.utente_id', 'u.id')
      .leftJoin('clienti as c', 'r.cliente_id', 'c.id')
      .where('r.id', rapportino.id)
      .select('u.nome as utente_nome', 'c.nome as cliente_nome')
      .first();

    const lavorazioni = await app
      .db('lavorazioni')
      .where({ rapportino_id: rapportino.id })
      .orderBy('giorno', 'asc')
      .orderBy('id', 'asc');

    const materialiMap = await caricaMateriali(
      app,
      lavorazioni.map((l) => l.id),
      admin
    );

    let totaleOre = 0;
    const lavorazioniEsposte = lavorazioni.map((l) => {
      const materiali = materialiMap[l.id] || [];
      totaleOre += Number(l.ore);

      // Proiezione per l'operaio: nessun campo economico. È l'invariante
      // già in vigore e questa feature non la cambia.
      const base = {
        id: l.id,
        giorno: l.giorno,
        ore: round2(l.ore),
        note: l.note,
        materiali,
      };
      if (!admin) return base;

      const totali = calcolaTotaliLavorazione({
        ore: Number(l.ore),
        costo_orario_applicato: Number(l.costo_orario_applicato || 0),
        materiali: materiali.map((m) => ({
          prezzo_unitario: Number(m.prezzo_unitario || 0),
          quantita: Number(m.quantita || 0),
        })),
      });
      return {
        ...base,
        costo_orario_applicato: Number(l.costo_orario_applicato || 0),
        subtotale_materiali: totali.subtotale_materiali,
        costo_manodopera: totali.costo_manodopera,
        totale_lavorazione: totali.totale_lavorazione,
        flag_costo_orario_zero: totali.flag_costo_orario_zero,
        flag_materiali_senza_prezzo: totali.flag_materiali_senza_prezzo,
      };
    });

    return {
      id: rapportino.id,
      utente_id: rapportino.utente_id,
      utente_nome: anagrafica ? anagrafica.utente_nome : null,
      cliente_id: rapportino.cliente_id,
      cliente_nome: anagrafica ? anagrafica.cliente_nome : null,
      macchina: rapportino.macchina,
      stato: derivaStato(rapportino),
      chiuso_il: rapportino.chiuso_il,
      nota_lavorazione_id: rapportino.nota_lavorazione_id,
      periodo:
        lavorazioni.length > 0
          ? {
              da: lavorazioni[0].giorno,
              a: lavorazioni[lavorazioni.length - 1].giorno,
            }
          : null,
      totale_ore: round2(totaleOre),
      lavorazioni: lavorazioniEsposte,
    };
  });

  // ── Eliminazione del rapportino ──────────────────────────────────────────
  app.delete('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const caricato = await caricaRapportino(app, request.params.id);
    if (!caricato) return reply.status(404).send({ error: 'Rapportino non trovato' });

    const { rapportino, numeroLavorazioni } = caricato;
    const esito = verificaEliminabile(rapportino, request.user, numeroLavorazioni);
    if (!esito.consentito) {
      return reply.status(esito.codice).send({ error: esito.messaggio });
    }

    await app.db('rapportini').where({ id: rapportino.id }).del();

    try {
      await app.logModifica(app.db, {
        utente_id: request.user.id,
        entita: 'rapportino',
        entita_id: rapportino.id,
        azione: 'eliminazione',
        dettaglio: {
          macchina: rapportino.macchina,
          lavorazioni_perse: numeroLavorazioni,
        },
      });
    } catch (logErr) {
      app.log.error({ err: logErr }, 'Registrazione della modifica non riuscita');
    }

    return { message: 'Rapportino eliminato', lavorazioni_eliminate: numeroLavorazioni };
  });

  // ── Transizioni di stato ─────────────────────────────────────────────────
  // Rotte esplicite invece di un PATCH sullo stato: ogni transizione ha la
  // propria verifica lato server e il controllo "solo l'amministratore
  // riapre" sta in un punto solo (FR-035).
  app.post('/:id/chiudi', { preHandler: [app.authenticate] }, async (request, reply) => {
    const caricato = await caricaRapportino(app, request.params.id);
    if (!caricato) return reply.status(404).send({ error: 'Rapportino non trovato' });

    const { rapportino, numeroLavorazioni } = caricato;
    const esito = verificaChiudibile(rapportino, request.user, numeroLavorazioni);
    if (!esito.consentito) {
      return reply.status(esito.codice).send({ error: esito.messaggio });
    }

    await app.db('rapportini').where({ id: rapportino.id }).update({
      chiuso_il: app.db.fn.now(),
      updated_at: app.db.fn.now(),
    });

    try {
      await app.logModifica(app.db, {
        utente_id: request.user.id,
        entita: 'rapportino',
        entita_id: rapportino.id,
        azione: 'chiusura',
        dettaglio: { macchina: rapportino.macchina, lavorazioni: numeroLavorazioni },
      });
    } catch (logErr) {
      app.log.error({ err: logErr }, 'Registrazione della modifica non riuscita');
    }

    return { id: rapportino.id, stato: 'chiuso', message: 'Rapportino concluso' };
  });

  app.post('/:id/riapri', { preHandler: [app.authenticate] }, async (request, reply) => {
    const caricato = await caricaRapportino(app, request.params.id);
    if (!caricato) return reply.status(404).send({ error: 'Rapportino non trovato' });

    const { rapportino } = caricato;
    const esito = verificaRiapribile(rapportino, request.user);
    if (!esito.consentito) {
      return reply.status(esito.codice).send({ error: esito.messaggio });
    }

    await app.db('rapportini').where({ id: rapportino.id }).update({
      chiuso_il: null,
      updated_at: app.db.fn.now(),
    });

    try {
      await app.logModifica(app.db, {
        utente_id: request.user.id,
        entita: 'rapportino',
        entita_id: rapportino.id,
        azione: 'riapertura',
        dettaglio: { macchina: rapportino.macchina },
      });
    } catch (logErr) {
      app.log.error({ err: logErr }, 'Registrazione della modifica non riuscita');
    }

    return { id: rapportino.id, stato: 'aperto', message: 'Rapportino riaperto' };
  });

  // ── Lavorazioni ──────────────────────────────────────────────────────────
  app.post('/:id/lavorazioni', { preHandler: [app.authenticate] }, async (request, reply) => {
    const caricato = await caricaRapportino(app, request.params.id);
    if (!caricato) return reply.status(404).send({ error: 'Rapportino non trovato' });

    const esito = verificaModificabile(caricato.rapportino, request.user);
    if (!esito.consentito) {
      return reply.status(esito.codice).send({ error: esito.messaggio });
    }

    const parsed = lavorazioneSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dati non validi', details: parsed.error.flatten() });
    }

    const { materiali, costo_orario_applicato: costoFornito, ...dati } = parsed.data;

    const erroreMateriali = await verificaMateriali(app, materiali);
    if (erroreMateriali) return reply.status(404).send({ error: erroreMateriali });

    const costoOrario = await risolviCostoOrario(app, request, costoFornito);

    const creata = await app.db.transaction(async (trx) => {
      const [lavorazione] = await trx('lavorazioni')
        .insert({
          rapportino_id: caricato.rapportino.id,
          giorno: dati.giorno,
          ore: dati.ore,
          note: dati.note || null,
          costo_orario_applicato: costoOrario,
        })
        .returning('*');
      await inserisciMateriali(trx, lavorazione.id, materiali);
      return lavorazione;
    });

    try {
      await app.logModifica(app.db, {
        utente_id: request.user.id,
        entita: 'lavorazione',
        entita_id: creata.id,
        azione: 'creazione',
        dettaglio: {
          rapportino_id: caricato.rapportino.id,
          giorno: dati.giorno,
          ore: dati.ore,
          materiali_count: materiali.length,
        },
      });
    } catch (logErr) {
      app.log.error({ err: logErr }, 'Registrazione della modifica non riuscita');
    }

    return reply.status(201).send({ id: creata.id, message: 'Lavorazione aggiunta' });
  });

  app.put(
    '/:id/lavorazioni/:idLavorazione',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const caricato = await caricaRapportino(app, request.params.id);
      if (!caricato) return reply.status(404).send({ error: 'Rapportino non trovato' });

      const esito = verificaModificabile(caricato.rapportino, request.user);
      if (!esito.consentito) {
        return reply.status(esito.codice).send({ error: esito.messaggio });
      }

      const lavorazione = await app
        .db('lavorazioni')
        .where({ id: request.params.idLavorazione, rapportino_id: caricato.rapportino.id })
        .first();
      if (!lavorazione) return reply.status(404).send({ error: 'Lavorazione non trovata' });

      const parsed = lavorazioneSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: 'Dati non validi', details: parsed.error.flatten() });
      }

      const { materiali, costo_orario_applicato: costoFornito, ...dati } = parsed.data;

      const erroreMateriali = await verificaMateriali(app, materiali);
      if (erroreMateriali) return reply.status(404).send({ error: erroreMateriali });

      // L'amministratore che non indica un valore conserva quello già
      // registrato, invece di sovrascriverlo con la tariffa corrente:
      // rifotografarlo cambierebbe il prezzo di un lavoro passato a ogni
      // modifica.
      let costoOrario;
      if (isAmministratore(request.user)) {
        costoOrario =
          typeof costoFornito === 'number'
            ? costoFornito
            : Number(lavorazione.costo_orario_applicato || 0);
      } else {
        costoOrario = await risolviCostoOrario(app, request, undefined);
      }

      await app.db.transaction(async (trx) => {
        await trx('lavorazioni')
          .where({ id: lavorazione.id })
          .update({
            giorno: dati.giorno,
            ore: dati.ore,
            note: dati.note || null,
            costo_orario_applicato: costoOrario,
            updated_at: trx.fn.now(),
          });
        await trx('materiali_lavorazione').where({ lavorazione_id: lavorazione.id }).del();
        await inserisciMateriali(trx, lavorazione.id, materiali);
      });

      try {
        await app.logModifica(app.db, {
          utente_id: request.user.id,
          entita: 'lavorazione',
          entita_id: lavorazione.id,
          azione: 'modifica',
          dettaglio: { giorno: dati.giorno, ore: dati.ore },
        });
      } catch (logErr) {
        app.log.error({ err: logErr }, 'Registrazione della modifica non riuscita');
      }

      return { id: lavorazione.id, message: 'Lavorazione aggiornata' };
    }
  );

  app.delete(
    '/:id/lavorazioni/:idLavorazione',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const caricato = await caricaRapportino(app, request.params.id);
      if (!caricato) return reply.status(404).send({ error: 'Rapportino non trovato' });

      const esito = verificaModificabile(caricato.rapportino, request.user);
      if (!esito.consentito) {
        return reply.status(esito.codice).send({ error: esito.messaggio });
      }

      const lavorazione = await app
        .db('lavorazioni')
        .where({ id: request.params.idLavorazione, rapportino_id: caricato.rapportino.id })
        .first();
      if (!lavorazione) return reply.status(404).send({ error: 'Lavorazione non trovata' });

      await app.db('lavorazioni').where({ id: lavorazione.id }).del();

      try {
        await app.logModifica(app.db, {
          utente_id: request.user.id,
          entita: 'lavorazione',
          entita_id: lavorazione.id,
          azione: 'eliminazione',
          dettaglio: { rapportino_id: caricato.rapportino.id, giorno: lavorazione.giorno },
        });
      } catch (logErr) {
        app.log.error({ err: logErr }, 'Registrazione della modifica non riuscita');
      }

      // Il rapportino resta, vuoto e aperto. Non è più concludibile
      // finché non se ne aggiunge una: a quel punto l'operaio può
      // eliminarlo, altrimenti resterebbe bloccato nell'elenco.
      return { message: 'Lavorazione eliminata' };
    }
  );
}

module.exports = rapportiniRoutes;
