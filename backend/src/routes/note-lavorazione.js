const { z } = require('zod');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const {
  calcolaTotaliNota,
  overrideDi,
} = require('../services/calcolo-totali-nota');
const { derivaStato, CHIUSO } = require('../services/stato-rapportino');
const {
  dettagliAmmessi,
  verificaRichiesta,
  avvisiSoppressi,
} = require('../services/coerenza-nota');
const { generaRiassunto, eStatoModificato } = require('../services/riassunto-lavorazioni');
const {
  caricaContenutoNota,
  round2,
} = require('../services/contenuto-note');

const importo = () => z.number().min(0).multipleOf(0.01).nullable().optional();

const modificaCostoSchema = z.union([
  z.object({
    tipo: z.literal('materiale_prezzo'),
    materiale_id: z.number().int().positive(),
    prezzo_unitario: z.number().min(0).multipleOf(0.01),
  }),
  z.object({
    tipo: z.literal('lavorazione_costo_orario'),
    lavorazione_id: z.number().int().positive(),
    costo_orario_applicato: z.number().min(0).multipleOf(0.01),
  }),
]);

// I due valori ammessi si verificano QUI e non con un vincolo sul database: un
// CHECK si applica su PostgreSQL e non su SQLite, quindi darebbe una garanzia
// che nei test non esiste.
const divisioneEnum = z.enum(['unita', 'per_macchinario']);

const campiDocumento = {
  testo: z.string().optional().nullable(),
  // Due interruttori indipendenti al posto di una scelta a due valori: quella
  // non sapeva esprimere "manodopera si', materiali no".
  mostra_dettaglio_materiali: z.boolean().default(false),
  mostra_dettaglio_manodopera: z.boolean().default(false),
  totale_materiali_override: importo(),
  totale_manodopera_override: importo(),
  totale_override: importo(),
  divisione: divisioneEnum.default('unita'),
  rapportini_ids: z.array(z.number().int().positive()).min(1, 'Selezionare almeno un rapportino'),
  modifiche_costi: z.array(modificaCostoSchema).optional().default([]),
};

const notaCreateSchema = z.object({
  cliente_id: z.number().int().positive({ message: 'Cliente obbligatorio' }),
  // La data a cui il lavoro si riferisce, distinta da quella di creazione:
  // chi emette la nota il 15 per lavori di fine mese precedente deve poterlo
  // dire.
  data_riferimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato data non valido (AAAA-MM-GG)'),
  ...campiDocumento,
});

const notaUpdateSchema = z.object({
  data_riferimento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato data non valido (AAAA-MM-GG)')
    .optional(),
  ...campiDocumento,
  mostra_dettaglio_materiali: z.boolean().optional(),
  mostra_dettaglio_manodopera: z.boolean().optional(),
  divisione: divisioneEnum.optional(),
});

// Il caricamento del contenuto di una nota vive ora in
// `services/contenuto-note.js`, che ne espone anche la variante in blocco
// usata dalla dashboard. Un solo caricatore prepara l'ingresso di
// `calcolaTotaliNota`: due potrebbero divergere, e i totali con loro.

/**
 * Applica le modifiche ai costi dentro una transazione aperta.
 *
 * Solleva `{ status, error }` in caso di dati non validi, così il chiamante può
 * tradurlo in una risposta.
 * @param {import('knex').Knex} trx
 * @param {object[]} modifiche
 * @param {number[]} lavorazioneIdsAmmesse - lavorazioni che fanno parte della nota
 * @returns {Promise<{materiali: object[], lavorazioni: object[]}>}
 */
async function applicaModificheCosti(trx, modifiche, lavorazioneIdsAmmesse) {
  const riepilogo = { materiali: [], lavorazioni: [] };
  if (!modifiche || modifiche.length === 0) return riepilogo;

  const materialiIds = modifiche
    .filter((m) => m.tipo === 'materiale_prezzo')
    .map((m) => m.materiale_id);
  const lavorazioniIds = modifiche
    .filter((m) => m.tipo === 'lavorazione_costo_orario')
    .map((m) => m.lavorazione_id);

  if (materialiIds.length > 0) {
    const righe = await trx('materiali_lavorazione').whereIn('id', materialiIds);
    if (righe.length !== materialiIds.length) {
      throw { status: 422, error: 'Uno o più materiali non trovati' };
    }
    for (const mat of righe) {
      if (!lavorazioneIdsAmmesse.includes(mat.lavorazione_id)) {
        throw {
          status: 422,
          error: `Materiale ${mat.id} non appartiene alle lavorazioni della nota`,
        };
      }
    }
    const perId = new Map(righe.map((m) => [m.id, m]));
    for (const m of modifiche) {
      if (m.tipo !== 'materiale_prezzo') continue;
      const prima = perId.get(m.materiale_id);
      await trx('materiali_lavorazione')
        .where({ id: m.materiale_id })
        .update({ prezzo_unitario: m.prezzo_unitario });
      riepilogo.materiali.push({
        materiale_id: m.materiale_id,
        prima: Number(prima.prezzo_unitario || 0),
        dopo: m.prezzo_unitario,
      });
    }
  }

  if (lavorazioniIds.length > 0) {
    const righe = await trx('lavorazioni').whereIn('id', lavorazioniIds);
    if (righe.length !== lavorazioniIds.length) {
      throw { status: 422, error: 'Una o più lavorazioni non trovate' };
    }
    for (const l of righe) {
      if (!lavorazioneIdsAmmesse.includes(l.id)) {
        throw { status: 422, error: `Lavorazione ${l.id} non è associata alla nota` };
      }
    }
    const perId = new Map(righe.map((l) => [l.id, l]));
    for (const m of modifiche) {
      if (m.tipo !== 'lavorazione_costo_orario') continue;
      const prima = perId.get(m.lavorazione_id);
      await trx('lavorazioni').where({ id: m.lavorazione_id }).update({
        costo_orario_applicato: m.costo_orario_applicato,
        updated_at: trx.fn.now(),
      });
      riepilogo.lavorazioni.push({
        lavorazione_id: m.lavorazione_id,
        prima: Number(prima.costo_orario_applicato || 0),
        dopo: m.costo_orario_applicato,
      });
    }
  }
  return riepilogo;
}

/**
 * Verifica che i rapportini indicati possano entrare nella nota.
 * @param {object[]} rapportini - rapportini caricati dal database
 * @param {number[]} idsRichiesti
 * @param {number} clienteId
 * @param {number|null} notaCorrente - id della nota in modifica, se esiste
 * @returns {{status: number, error: string}|null} errore, oppure null
 */
function verificaRapportiniAmmessi(rapportini, idsRichiesti, clienteId, notaCorrente) {
  if (rapportini.length !== idsRichiesti.length) {
    return { status: 404, error: 'Uno o più rapportini non trovati' };
  }
  for (const r of rapportini) {
    if (r.cliente_id !== clienteId) {
      return {
        status: 400,
        error: 'Tutti i rapportini devono appartenere allo stesso cliente della nota',
      };
    }
    if (r.nota_lavorazione_id && Number(r.nota_lavorazione_id) !== Number(notaCorrente)) {
      return {
        status: 400,
        error: `Il rapportino ${r.id} è già associato a un'altra nota di lavorazione`,
      };
    }
    // Solo i rapportini CONCLUSI entrano in una nota: uno ancora aperto
    // potrebbe ricevere altre ore dopo che la nota è stata compilata, e la nota
    // risulterebbe incompleta senza che nulla lo segnali.
    if (derivaStato(r) !== CHIUSO && !r.nota_lavorazione_id) {
      return {
        status: 400,
        error: `Il rapportino ${r.id} non è concluso: solo i rapportini conclusi entrano in una nota di lavorazione`,
      };
    }
  }
  return null;
}

/**
 * Rotte delle note di lavorazione. Riservate all'amministratore.
 *
 * Cambia cosa si seleziona: rapportini invece di righe isolate. I totali
 * restano calcolati sulle lavorazioni, che sono il livello a cui stanno ore,
 * materiali e costo orario.
 * @param {import('fastify').FastifyInstance} app
 */
async function noteLavorazioneRoutes(app) {
  // ── Elenco ────────────────────────────────────────────────────────────────
  app.get('/', { preHandler: [app.authenticate, app.requireRole('admin')] }, async (request) => {
    const { page, perPage, offset } = parsePagination(request.query);
    const { cliente_id } = request.query;

    let query = app.db('note_lavorazione as n').leftJoin('clienti as c', 'n.cliente_id', 'c.id');
    if (cliente_id) query = query.where('n.cliente_id', cliente_id);

    const [{ count }] = await query.clone().clearSelect().count('n.id as count');

    const note = await query
      .clone()
      .select('n.*', 'c.nome as cliente_nome')
      .orderBy('n.created_at', 'desc')
      .limit(perPage)
      .offset(offset);

    const data = [];
    for (const n of note) {
      const { rapportini, lavorazioni } = await caricaContenutoNota(app.db, n.id);
      const totali = calcolaTotaliNota(lavorazioni, overrideDi(n));
      data.push({
        ...n,
        ore_totali: round2(lavorazioni.reduce((acc, l) => acc + l.ore_lavorate, 0)),
        num_rapportini: rapportini.length,
        num_lavorazioni: lavorazioni.length,
        totale_calcolato: totali.totale_calcolato,
        totale_finale: totali.totale_finale,
      });
    }

    return paginatedResponse(data, Number(count), page, perPage);
  });

  // ── Riassunto precompilato ────────────────────────────────────────────────
  // Registrata prima di /:id perche' il percorso statico deve prevalere sul
  // parametrico.
  //
  // Il testo lo compone il SERVER, non l'interfaccia: e' l'unico modo di
  // riconoscere in seguito un testo scritto a mano. Se lo generasse il client,
  // il server saprebbe quale dei due ha in mano solo perche' il client glielo
  // dice, e un client che sbaglia farebbe perdere all'utente il proprio testo
  // in silenzio.
  app.get(
    '/riassunto',
    { preHandler: [app.authenticate, app.requireRole('admin')] },
    async (request) => {
      const grezzi = request.query.rapportini_ids;
      const ids = (Array.isArray(grezzi) ? grezzi : String(grezzi || '').split(','))
        .map((v) => Number(v))
        .filter((v) => Number.isInteger(v) && v > 0);

      return { testo: await generaRiassunto(app.db, ids) };
    }
  );

  // ── Dettaglio ─────────────────────────────────────────────────────────────
  app.get(
    '/:id',
    { preHandler: [app.authenticate, app.requireRole('admin')] },
    async (request, reply) => {
      const { id } = request.params;

      const nota = await app
        .db('note_lavorazione as n')
        .leftJoin('clienti as c', 'n.cliente_id', 'c.id')
        .where('n.id', id)
        .select('n.*', 'c.nome as cliente_nome')
        .first();

      if (!nota) return reply.status(404).send({ error: 'Nota di lavorazione non trovata' });

      const { rapportini, lavorazioni } = await caricaContenutoNota(app.db, id);
      const override = overrideDi(nota);
      const totali = calcolaTotaliNota(lavorazioni, override);

      return {
        ...nota,
        totale_override: override.complessivo,
        totale_materiali_override: override.materiali,
        totale_manodopera_override: override.manodopera,
        rapportini,
        ore_totali: round2(lavorazioni.reduce((acc, l) => acc + l.ore_lavorate, 0)),
        totale_materiali: totali.totale_materiali,
        totale_manodopera: totali.totale_manodopera,
        // I valori CALCOLATI restano esposti anche sotto un override: servono a
        // mostrare da cosa ci si sta discostando, e a farli riapparire quando
        // viene tolto.
        totale_materiali_calcolato: totali.totale_materiali_calcolato,
        totale_manodopera_calcolato: totali.totale_manodopera_calcolato,
        totale_calcolato: totali.totale_calcolato,
        totale_finale: totali.totale_finale,
        override_attivo: totali.override_attivo,
        override_discrepanza: totali.override_discrepanza,
        // L'interfaccia disabilita gli interruttori usando QUESTA risposta
        // invece di ricalcolare la regola per conto proprio: se la
        // ricalcolasse, prima o poi divergerebbe dal server.
        dettagli_ammessi: dettagliAmmessi(override),
      };
    }
  );

  // ── Creazione ─────────────────────────────────────────────────────────────
  app.post(
    '/',
    { preHandler: [app.authenticate, app.requireRole('admin')] },
    async (request, reply) => {
      const parsed = notaCreateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: 'Dati non validi', details: parsed.error.flatten() });
      }

      const { cliente_id, rapportini_ids, modifiche_costi, testo } = parsed.data;

      // La regola sta in un servizio, non qui: serve anche al PDF e
      // all'interfaccia, e scritta tre volte prima o poi divergerebbe.
      const esito = verificaRichiesta(parsed.data);
      if (!esito.valida) return reply.status(400).send({ error: esito.errore });

      const cliente = await app.db('clienti').where({ id: cliente_id }).first();
      if (!cliente) return reply.status(404).send({ error: 'Cliente non trovato' });

      const rapportini = await app.db('rapportini').whereIn('id', rapportini_ids);
      const errore = verificaRapportiniAmmessi(rapportini, rapportini_ids, cliente_id, null);
      if (errore) return reply.status(errore.status).send({ error: errore.error });

      const lavorazioniIds = (
        await app.db('lavorazioni').whereIn('rapportino_id', rapportini_ids).select('id')
      ).map((l) => l.id);

      // Calcolato PRIMA di aprire la transazione. Dentro, la transazione tiene
      // la connessione e una query su `app.db` ne aspetterebbe un'altra: con
      // SQLite il pool e' di una sola, e l'attesa non finisce mai.
      const generato = await generaRiassunto(app.db, rapportini_ids);

      let creata;
      let riepilogo = { materiali: [], lavorazioni: [] };
      try {
        creata = await app.db.transaction(async (trx) => {
          const dati = {
            cliente_id,
            testo: testo || null,
            data_riferimento: parsed.data.data_riferimento,
            mostra_dettaglio_materiali: parsed.data.mostra_dettaglio_materiali,
            mostra_dettaglio_manodopera: parsed.data.mostra_dettaglio_manodopera,
            divisione: parsed.data.divisione,
            // Calcolato dal server confrontando il testo ricevuto con quello
            // che genererebbe: se il client lo dichiarasse, un client che
            // sbaglia farebbe perdere all'utente il proprio testo in silenzio.
            riassunto_personalizzato: eStatoModificato(testo, generato),
          };
          for (const campo of [
            'totale_override',
            'totale_materiali_override',
            'totale_manodopera_override',
          ]) {
            if (parsed.data[campo] !== undefined) dati[campo] = parsed.data[campo];
          }

          const [nota] = await trx('note_lavorazione').insert(dati).returning('*');

          await trx('rapportini')
            .whereIn('id', rapportini_ids)
            .update({ nota_lavorazione_id: nota.id, updated_at: trx.fn.now() });

          riepilogo = await applicaModificheCosti(trx, modifiche_costi, lavorazioniIds);
          return nota;
        });
      } catch (err) {
        if (err && err.status && err.error) {
          return reply.status(err.status).send({ error: err.error });
        }
        throw err;
      }

      try {
        await app.logModifica(app.db, {
          utente_id: request.user.id,
          entita: 'nota_lavorazione',
          entita_id: creata.id,
          azione: 'creazione',
          dettaglio: {
            cliente: cliente.nome,
            rapportini_count: rapportini_ids.length,
            data_riferimento: parsed.data.data_riferimento,
            divisione: parsed.data.divisione,
            totale_override: parsed.data.totale_override ?? null,
          },
        });
        if (riepilogo.materiali.length > 0 || riepilogo.lavorazioni.length > 0) {
          await app.logModifica(app.db, {
            utente_id: request.user.id,
            entita: 'nota_lavorazione',
            entita_id: creata.id,
            azione: 'modifica_costi',
            dettaglio: riepilogo,
          });
        }
      } catch (logErr) {
        app.log.error({ err: logErr }, 'Registrazione della modifica non riuscita');
      }

      return reply.status(201).send({ id: creata.id, message: 'Nota di lavorazione creata' });
    }
  );

  // ── Modifica ──────────────────────────────────────────────────────────────
  app.put(
    '/:id',
    { preHandler: [app.authenticate, app.requireRole('admin')] },
    async (request, reply) => {
      const { id } = request.params;
      const parsed = notaUpdateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: 'Dati non validi', details: parsed.error.flatten() });
      }

      const nota = await app.db('note_lavorazione').where({ id }).first();
      if (!nota) return reply.status(404).send({ error: 'Nota di lavorazione non trovata' });

      const { testo, rapportini_ids, modifiche_costi } = parsed.data;

      // La verifica va fatta sullo stato RISULTANTE, non sui soli campi
      // inviati: chi accende un dettaglio senza toccare un override gia'
      // presente deve essere respinto lo stesso. Controllare solo il corpo
      // della richiesta lascerebbe passare esattamente il caso piu' probabile.
      const presente = (campo) => Object.prototype.hasOwnProperty.call(request.body || {}, campo);
      const risultante = {
        mostra_dettaglio_materiali: presente('mostra_dettaglio_materiali')
          ? parsed.data.mostra_dettaglio_materiali
          : Boolean(nota.mostra_dettaglio_materiali),
        mostra_dettaglio_manodopera: presente('mostra_dettaglio_manodopera')
          ? parsed.data.mostra_dettaglio_manodopera
          : Boolean(nota.mostra_dettaglio_manodopera),
        totale_materiali_override: presente('totale_materiali_override')
          ? (parsed.data.totale_materiali_override ?? null)
          : (nota.totale_materiali_override ?? null),
        totale_manodopera_override: presente('totale_manodopera_override')
          ? (parsed.data.totale_manodopera_override ?? null)
          : (nota.totale_manodopera_override ?? null),
        totale_override: presente('totale_override')
          ? (parsed.data.totale_override ?? null)
          : (nota.totale_override ?? null),
      };

      const esito = verificaRichiesta(risultante);
      if (!esito.valida) return reply.status(400).send({ error: esito.errore });

      const attuali = (
        await app.db('rapportini').where({ nota_lavorazione_id: id }).select('id')
      ).map((r) => r.id);

      const daRimuovere = attuali.filter((rid) => !rapportini_ids.includes(rid));
      const daAggiungere = rapportini_ids.filter((rid) => !attuali.includes(rid));

      if (daAggiungere.length > 0) {
        const nuovi = await app.db('rapportini').whereIn('id', daAggiungere);
        const errore = verificaRapportiniAmmessi(nuovi, daAggiungere, nota.cliente_id, Number(id));
        if (errore) return reply.status(errore.status).send({ error: errore.error });
      }

      const lavorazioniIds = (
        await app.db('lavorazioni').whereIn('rapportino_id', rapportini_ids).select('id')
      ).map((l) => l.id);

      const generato = await generaRiassunto(app.db, rapportini_ids);

      let riepilogo = { materiali: [], lavorazioni: [] };
      try {
        await app.db.transaction(async (trx) => {
          const aggiornamento = { updated_at: trx.fn.now() };
          if (testo !== undefined) {
            aggiornamento.testo = testo || null;
            aggiornamento.riassunto_personalizzato = eStatoModificato(testo, generato);
          }
          if (presente('data_riferimento')) {
            aggiornamento.data_riferimento = parsed.data.data_riferimento;
          }
          if (presente('divisione')) aggiornamento.divisione = parsed.data.divisione;
          aggiornamento.mostra_dettaglio_materiali = risultante.mostra_dettaglio_materiali;
          aggiornamento.mostra_dettaglio_manodopera = risultante.mostra_dettaglio_manodopera;
          for (const campo of [
            'totale_override',
            'totale_materiali_override',
            'totale_manodopera_override',
          ]) {
            if (presente(campo)) aggiornamento[campo] = parsed.data[campo] ?? null;
          }

          await trx('note_lavorazione').where({ id }).update(aggiornamento);

          // Dissociare significa azzerare SOLO il legame con la nota:
          // `chiuso_il` resta, quindi il rapportino torna in stato chiuso da
          // sé, senza codice apposito. Riportarlo ad aperto
          // richiederebbe una riapertura esplicita dell'amministratore.
          if (daRimuovere.length > 0) {
            await trx('rapportini')
              .whereIn('id', daRimuovere)
              .update({ nota_lavorazione_id: null, updated_at: trx.fn.now() });
          }
          if (daAggiungere.length > 0) {
            await trx('rapportini')
              .whereIn('id', daAggiungere)
              .update({ nota_lavorazione_id: id, updated_at: trx.fn.now() });
          }

          riepilogo = await applicaModificheCosti(trx, modifiche_costi, lavorazioniIds);
        });
      } catch (err) {
        if (err && err.status && err.error) {
          return reply.status(err.status).send({ error: err.error });
        }
        throw err;
      }

      try {
        await app.logModifica(app.db, {
          utente_id: request.user.id,
          entita: 'nota_lavorazione',
          entita_id: id,
          azione: 'modifica',
          dettaglio: {
            rapportini_aggiunti: daAggiungere.length,
            rapportini_rimossi: daRimuovere.length,
            divisione: parsed.data.divisione ?? null,
            totale_override_modificato: presente('totale_override'),
          },
        });
        if (riepilogo.materiali.length > 0 || riepilogo.lavorazioni.length > 0) {
          await app.logModifica(app.db, {
            utente_id: request.user.id,
            entita: 'nota_lavorazione',
            entita_id: id,
            azione: 'modifica_costi',
            dettaglio: riepilogo,
          });
        }
      } catch (logErr) {
        app.log.error({ err: logErr }, 'Registrazione della modifica non riuscita');
      }

      return { message: 'Nota di lavorazione aggiornata' };
    }
  );

  // ── Eliminazione ──────────────────────────────────────────────────────────
  app.delete(
    '/:id',
    { preHandler: [app.authenticate, app.requireRole('admin')] },
    async (request, reply) => {
      const { id } = request.params;

      const nota = await app.db('note_lavorazione').where({ id }).first();
      if (!nota) return reply.status(404).send({ error: 'Nota di lavorazione non trovata' });

      // ON DELETE SET NULL dissocia i rapportini: `chiuso_il` resta, quindi
      // tornano in stato chiuso. I prezzi e i costi orari modificati mentre
      // erano nella nota RESTANO sulle lavorazioni: rappresentano quanto è
      // stato effettivamente fatturato.
      await app.db('note_lavorazione').where({ id }).del();

      try {
        await app.logModifica(app.db, {
          utente_id: request.user.id,
          entita: 'nota_lavorazione',
          entita_id: id,
          azione: 'eliminazione',
          dettaglio: { cliente_id: nota.cliente_id },
        });
      } catch (logErr) {
        app.log.error({ err: logErr }, 'Registrazione della modifica non riuscita');
      }

      return { message: 'Nota di lavorazione eliminata' };
    }
  );

  /**
   * Carica la nota con il suo contenuto, per la stampa e per gli avvisi.
   * @param {number|string} id
   * @returns {Promise<{nota: object, rapportini: object[], lavorazioni: object[]}|null>}
   */
  async function caricaNotaCompleta(id) {
    const nota = await app
      .db('note_lavorazione as n')
      .leftJoin('clienti as c', 'n.cliente_id', 'c.id')
      .where('n.id', id)
      .select('n.*', 'c.nome as cliente_nome')
      .first();
    if (!nota) return null;

    const { rapportini, lavorazioni } = await caricaContenutoNota(app.db, id);
    return { nota, rapportini, lavorazioni };
  }

  // Avvisi prima della generazione del PDF: lavorazioni con costo orario a zero
  // e materiali senza prezzo. Un documento che espone un costo a zero senza
  // averlo segnalato è indistinguibile da uno corretto.
  app.get(
    '/:id/pdf-warnings',
    { preHandler: [app.authenticate, app.requireRole('admin')] },
    async (request, reply) => {
      const caricata = await caricaNotaCompleta(request.params.id);
      if (!caricata) return reply.status(404).send({ error: 'Nota di lavorazione non trovata' });

      const { rilevaWarningPdf } = require('../services/calcolo-totali-nota');
      const avvisi = rilevaWarningPdf(caricata.lavorazioni);

      // Un avviso segnala un valore a zero che finirebbe nel documento. Con un
      // totale imposto quel valore non ci finisce, perche' la cifra e' decisa a
      // parte: lasciarlo manderebbe a correggere qualcosa che non cambia nulla,
      // e un avviso che sbaglia spesso viene ignorato anche quando ha ragione.
      const soppressi = avvisiSoppressi(overrideDi(caricata.nota));

      const lavorazioniZero = soppressi.manodopera ? [] : avvisi.lavorazioni_costo_orario_zero;
      const materialiZero = soppressi.materiali ? [] : avvisi.materiali_prezzo_zero;

      return {
        has_warnings: lavorazioniZero.length > 0 || materialiZero.length > 0,
        lavorazioni_costo_orario_zero: lavorazioniZero,
        materiali_prezzo_zero: materialiZero,
      };
    }
  );

  app.get(
    '/:id/stampa',
    { preHandler: [app.authenticate, app.requireRole('admin')] },
    async (request, reply) => {
      const caricata = await caricaNotaCompleta(request.params.id);
      if (!caricata) return reply.status(404).send({ error: 'Nota di lavorazione non trovata' });

      // Il parametro `modalita` non esiste piu': la scelta a due valori e'
      // stata sostituita da due interruttori indipendenti, che vivono sulla
      // nota. Un parametro di query non puo' piu' sovrascriverli.
      const { generaPdfNotaLavorazione } = require('../services/pdf-nota-lavorazione');
      const pdfBuffer = await generaPdfNotaLavorazione(caricata.nota, caricata.rapportini);

      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', 'inline; filename="nota_lavorazione.pdf"');
      return reply.send(pdfBuffer);
    }
  );
}

module.exports = noteLavorazioneRoutes;
