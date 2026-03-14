const { z } = require('zod');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const { calcolaPreventivo } = require('../services/calcolo-preventivo');
const { generaPdfPreventivo } = require('../services/pdf-preventivo');

const preventivoLineSchema = z.object({
  pezzo_id: z.number().int().positive().optional().nullable(),
  nome_manuale: z.string().min(1).optional().nullable(),
  quantita: z.number().int().positive('Quantità deve essere > 0'),
  prezzo_unitario: z.number().min(0, 'Prezzo deve essere >= 0'),
  note: z.string().optional().nullable(),
  fuori_catalogo: z.boolean().default(false),
}).refine(
  (p) => {
    if (p.fuori_catalogo) return !!p.nome_manuale;
    return !!p.pezzo_id;
  },
  { message: 'pezzo_id obbligatorio per prodotti da catalogo, nome_manuale per fuori catalogo' }
);

const preventivoSchema = z.object({
  cliente_id: z.number().int().positive('Cliente obbligatorio'),
  operaio_id: z.number().int().positive().optional().nullable(),
  data: z.string().min(1, 'Data obbligatoria'), // YYYY-MM-DD
  manodopera_ore: z.number().min(0).default(0),
  manodopera_costo_orario: z.number().min(0).default(0),
  sconto_tipo: z.enum(['fisso', 'percentuale']).default('fisso'),
  sconto_valore: z.number().min(0).default(0),
  aliquota_iva: z.number().min(0).max(100).default(22),
  note: z.string().optional().nullable(),
  pezzi: z.array(preventivoLineSchema).default([]),
});

const VALID_TRANSITIONS = {
  bozza: ['approvato', 'rifiutato', 'scaduto'],
  approvato: ['fatturato', 'cancellato'],
  rifiutato: [],
  scaduto: [],
  fatturato: [],
  cancellato: [],
};

/**
 * Generates the next sequential preventivo number for the given year
 * @param {import('knex').Knex} db
 * @param {number} year
 * @returns {Promise<string>}
 */
async function generateNumero(db, year) {
  const prefix = `${year}/`;
  const lastPreventivo = await db('preventivi')
    .where('numero', 'like', `${prefix}%`)
    .orderByRaw("CAST(SPLIT_PART(numero, '/', 2) AS INTEGER) DESC")
    .first();

  let nextNum = 1;
  if (lastPreventivo) {
    const parts = lastPreventivo.numero.split('/');
    nextNum = parseInt(parts[1], 10) + 1;
  }

  return `${prefix}${String(nextNum).padStart(4, '0')}`;
}

/**
 * Loads a preventivo with its pezzi and client info
 * @param {import('knex').Knex} db
 * @param {number} id
 * @returns {Promise<object|null>}
 */
async function loadPreventivo(db, id) {
  const preventivo = await db('preventivi as pr')
    .leftJoin('clienti as cl', 'pr.cliente_id', 'cl.id')
    .leftJoin('utenti as u', 'pr.utente_id', 'u.id')
    .leftJoin('utenti as op', 'pr.operaio_id', 'op.id')
    .select(
      'pr.*',
      'cl.nome as cliente_nome',
      'cl.codice_fiscale as cliente_cf',
      'cl.partita_iva as cliente_piva',
      'u.nome as utente_nome',
      'op.nome as operaio_nome',
      'op.costo_orario as operaio_costo_orario'
    )
    .where('pr.id', id)
    .first();

  if (!preventivo) return null;

  const pezzi = await db('preventivo_pezzi as pp')
    .leftJoin('catalogo_prodotti as pm', 'pp.pezzo_id', 'pm.id')
    .select(
      'pp.*',
      'pp.nome_manuale',
      'pp.fuori_catalogo',
      'pm.nome as pezzo_nome',
      'pm.barcode as pezzo_barcode',
      'pm.marca as pezzo_marca',
      'pm.modello as pezzo_modello'
    )
    .where('pp.preventivo_id', id)
    .orderBy('pp.id', 'asc');

  return { ...preventivo, pezzi };
}

/**
 * Preventivi routes - CRUD + state management + stock deduction
 * @param {import('fastify').FastifyInstance} app
 */
async function preventiviRoutes(app) {
  // List (paginated, with client info)
  app.get('/', { preHandler: [app.authenticate] }, async (request) => {
    const { page, perPage, offset } = parsePagination(request.query);
    const { stato, cliente_id } = request.query;

    let query = app
      .db('preventivi as pr')
      .leftJoin('clienti as cl', 'pr.cliente_id', 'cl.id')
      .leftJoin('utenti as u', 'pr.utente_id', 'u.id')
      .leftJoin('utenti as op', 'pr.operaio_id', 'op.id')
      .select(
        'pr.*',
        'cl.nome as cliente_nome',
        'u.nome as utente_nome',
        'op.nome as operaio_nome'
      );

    if (stato) {
      query = query.where('pr.stato', stato);
    }
    if (cliente_id) {
      query = query.where('pr.cliente_id', cliente_id);
    }

    const countQuery = query.clone().clearSelect().count('pr.id as count').first();
    const { count } = await countQuery;

    const rows = await query
      .clone()
      .clearOrder()
      .orderBy('pr.created_at', 'desc')
      .limit(perPage)
      .offset(offset);

    return paginatedResponse(rows, Number(count), page, perPage);
  });

  // Search
  app.get('/search', { preHandler: [app.authenticate] }, async (request) => {
    const { q, stato } = request.query;
    const { page, perPage, offset } = parsePagination(request.query);

    if (!q || q.trim().length < 1) {
      return paginatedResponse([], 0, page, perPage);
    }

    const term = `%${q.trim()}%`;

    let query = app
      .db('preventivi as pr')
      .leftJoin('clienti as cl', 'pr.cliente_id', 'cl.id')
      .leftJoin('utenti as u', 'pr.utente_id', 'u.id')
      .leftJoin('utenti as op', 'pr.operaio_id', 'op.id')
      .select('pr.*', 'cl.nome as cliente_nome', 'u.nome as utente_nome', 'op.nome as operaio_nome')
      .where(function () {
        this.whereILike('pr.numero', term)
          .orWhereILike('cl.nome', term);
      });

    if (stato) {
      query = query.andWhere('pr.stato', stato);
    }

    const countQuery = query.clone().clearSelect().count('pr.id as count').first();
    const { count } = await countQuery;

    const rows = await query
      .clone()
      .clearOrder()
      .orderBy('pr.created_at', 'desc')
      .limit(perPage)
      .offset(offset);

    return paginatedResponse(rows, Number(count), page, perPage);
  });

  // Get by ID (with pezzi details)
  app.get('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    const preventivo = await loadPreventivo(app.db, id);

    if (!preventivo) {
      return reply.status(404).send({ error: 'Preventivo non trovato' });
    }
    return preventivo;
  });

  // Create
  app.post('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = preventivoSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dati non validi', details: parsed.error.flatten() });
    }

    const data = parsed.data;
    const utente_id = request.user.id;

    // Verify client exists and is not archived
    const cliente = await app.db('clienti').where({ id: data.cliente_id }).first();
    if (!cliente) {
      return reply.status(400).send({ error: 'Cliente non trovato' });
    }
    if (cliente.archiviato) {
      return reply.status(400).send({ error: 'Impossibile creare preventivo per cliente archiviato' });
    }

    // Verify operaio exists (if provided)
    if (data.operaio_id) {
      const operaio = await app.db('utenti').where({ id: data.operaio_id }).first();
      if (!operaio) {
        return reply.status(400).send({ error: 'Operaio non trovato' });
      }
    }

    // Verify all pezzi exist (only for non-fuori_catalogo items)
    for (const pezzo of data.pezzi) {
      if (!pezzo.fuori_catalogo) {
        const exists = await app.db('catalogo_prodotti').where({ id: pezzo.pezzo_id }).first();
        if (!exists) {
          return reply.status(400).send({ error: `Pezzo con ID ${pezzo.pezzo_id} non trovato` });
        }
      }
    }

    // Calculate totals
    const calcoli = calcolaPreventivo({
      pezzi: data.pezzi,
      manodopera_ore: data.manodopera_ore,
      manodopera_costo_orario: data.manodopera_costo_orario,
      sconto_tipo: data.sconto_tipo,
      sconto_valore: data.sconto_valore,
      aliquota_iva: data.aliquota_iva,
    });

    // Generate numero
    const year = new Date(data.data).getFullYear();
    const numero = await generateNumero(app.db, year);

    // Insert in transaction
    const result = await app.db.transaction(async (trx) => {
      const [preventivo] = await trx('preventivi')
        .insert({
          numero,
          cliente_id: data.cliente_id,
          operaio_id: data.operaio_id || null,
          utente_id,
          data: data.data,
          stato: 'bozza',
          manodopera_ore: data.manodopera_ore,
          manodopera_costo_orario: data.manodopera_costo_orario,
          manodopera_totale: calcoli.manodopera_totale,
          sconto_tipo: data.sconto_tipo,
          sconto_valore: data.sconto_valore,
          sconto_calcolato: calcoli.sconto_calcolato,
          aliquota_iva: data.aliquota_iva,
          imponibile: calcoli.imponibile,
          imponibile_netto: calcoli.imponibile_netto,
          iva: calcoli.iva,
          totale: calcoli.totale,
          note: data.note,
        })
        .returning('*');

      // Insert line items
      if (data.pezzi.length > 0) {
        await trx('preventivo_pezzi').insert(
          data.pezzi.map((p) => ({
            preventivo_id: preventivo.id,
            pezzo_id: p.fuori_catalogo ? null : p.pezzo_id,
            nome_manuale: p.fuori_catalogo ? p.nome_manuale : null,
            fuori_catalogo: p.fuori_catalogo || false,
            quantita: p.quantita,
            prezzo_unitario: p.prezzo_unitario,
            note: p.note || null,
          }))
        );
      }

      return preventivo;
    });

    const full = await loadPreventivo(app.db, result.id);

    // Audit
    // : creazione preventivo
    try {
      await app.logModifica(app.db, {
        utente_id: request.user.id,
        entita: 'preventivo',
        entita_id: result.id,
        azione: 'creazione',
        dettaglio: { numero, cliente_nome: cliente.nome, totale: calcoli.totale },
      });
    } catch (logErr) {
      app.log.error({ err: logErr }, 'Failed to log modification');
    }

    return reply.status(201).send(full);
  });

  // Update (only in bozza state)
  app.put('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    const parsed = preventivoSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dati non validi', details: parsed.error.flatten() });
    }

    const existing = await app.db('preventivi').where({ id }).first();
    if (!existing) {
      return reply.status(404).send({ error: 'Preventivo non trovato' });
    }

    if (existing.stato !== 'bozza') {
      return reply.status(403).send({
        error: 'Preventivo modificabile solo in stato bozza',
      });
    }

    const data = parsed.data;

    // Verify client
    const cliente = await app.db('clienti').where({ id: data.cliente_id }).first();
    if (!cliente) {
      return reply.status(400).send({ error: 'Cliente non trovato' });
    }

    // Verify operaio exists (if provided)
    if (data.operaio_id) {
      const operaio = await app.db('utenti').where({ id: data.operaio_id }).first();
      if (!operaio) {
        return reply.status(400).send({ error: 'Operaio non trovato' });
      }
    }

    // Verify pezzi (only for non-fuori_catalogo items)
    for (const pezzo of data.pezzi) {
      if (!pezzo.fuori_catalogo) {
        const exists = await app.db('catalogo_prodotti').where({ id: pezzo.pezzo_id }).first();
        if (!exists) {
          return reply.status(400).send({ error: `Pezzo con ID ${pezzo.pezzo_id} non trovato` });
        }
      }
    }

    // Calculate
    const calcoli = calcolaPreventivo({
      pezzi: data.pezzi,
      manodopera_ore: data.manodopera_ore,
      manodopera_costo_orario: data.manodopera_costo_orario,
      sconto_tipo: data.sconto_tipo,
      sconto_valore: data.sconto_valore,
      aliquota_iva: data.aliquota_iva,
    });

    await app.db.transaction(async (trx) => {
      await trx('preventivi')
        .where({ id })
        .update({
          cliente_id: data.cliente_id,
          operaio_id: data.operaio_id || null,
          data: data.data,
          manodopera_ore: data.manodopera_ore,
          manodopera_costo_orario: data.manodopera_costo_orario,
          manodopera_totale: calcoli.manodopera_totale,
          sconto_tipo: data.sconto_tipo,
          sconto_valore: data.sconto_valore,
          sconto_calcolato: calcoli.sconto_calcolato,
          aliquota_iva: data.aliquota_iva,
          imponibile: calcoli.imponibile,
          imponibile_netto: calcoli.imponibile_netto,
          iva: calcoli.iva,
          totale: calcoli.totale,
          note: data.note,
          updated_at: app.db.fn.now(),
        });

      // Replace line items
      await trx('preventivo_pezzi').where({ preventivo_id: id }).del();
      if (data.pezzi.length > 0) {
        await trx('preventivo_pezzi').insert(
          data.pezzi.map((p) => ({
            preventivo_id: id,
            pezzo_id: p.fuori_catalogo ? null : p.pezzo_id,
            nome_manuale: p.fuori_catalogo ? p.nome_manuale : null,
            fuori_catalogo: p.fuori_catalogo || false,
            quantita: p.quantita,
            prezzo_unitario: p.prezzo_unitario,
            note: p.note || null,
          }))
        );
      }
    });

    const full = await loadPreventivo(app.db, id);

    // Audit log: modifica preventivo
    try {
      const updatedRow = await app.db('preventivi').where({ id }).first();
      const diff = app.computeDiff(existing, updatedRow, ['cliente_id', 'operaio_id', 'data', 'manodopera_ore', 'manodopera_costo_orario', 'sconto_tipo', 'sconto_valore', 'aliquota_iva', 'totale', 'note']);
      if (diff) {
        await app.logModifica(app.db, {
          utente_id: request.user.id,
          entita: 'preventivo',
          entita_id: id,
          azione: 'modifica',
          dettaglio: diff,
        });
      }
    } catch (logErr) {
      app.log.error({ err: logErr }, 'Failed to log modification');
    }

    return full;
  });

  // Change state
  app.patch('/:id/stato', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    const { stato } = request.body || {};

    if (!stato) {
      return reply.status(400).send({ error: 'Nuovo stato obbligatorio' });
    }

    const preventivo = await app.db('preventivi').where({ id }).first();
    if (!preventivo) {
      return reply.status(404).send({ error: 'Preventivo non trovato' });
    }

    const allowed = VALID_TRANSITIONS[preventivo.stato];
    if (!allowed || !allowed.includes(stato)) {
      return reply.status(400).send({
        error: `Transizione da "${preventivo.stato}" a "${stato}" non consentita`,
      });
    }

    await app.db('preventivi')
      .where({ id })
      .update({ stato, updated_at: app.db.fn.now() });

    // Audit log: cambio stato preventivo
    try {
      await app.logModifica(app.db, {
        utente_id: request.user.id,
        entita: 'preventivo',
        entita_id: id,
        azione: 'cambio_stato',
        dettaglio: { da: preventivo.stato, a: stato },
      });
    } catch (logErr) {
      app.log.error({ err: logErr }, 'Failed to log modification');
    }

    const full = await loadPreventivo(app.db, id);
    return full;
  });

  // Generate PDF
  app.get('/:id/pdf', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    const preventivo = await loadPreventivo(app.db, id);
    if (!preventivo) {
      return reply.status(404).send({ error: 'Preventivo non trovato' });
    }

    const impostazioni = await app.db('impostazioni_officina').first();
    if (!impostazioni) {
      return reply.status(500).send({ error: 'Impostazioni officina non configurate' });
    }

    const pdfBuffer = await generaPdfPreventivo(preventivo, impostazioni);

    reply.header('Content-Type', 'application/pdf');
    reply.header(
      'Content-Disposition',
      `attachment; filename="preventivo_${preventivo.numero.replace('/', '_')}.pdf"`
    );
    return reply.send(pdfBuffer);
  });

  // Export preventivo as JSON (for backup)
  app.get('/:id/export', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    const preventivo = await loadPreventivo(app.db, id);
    if (!preventivo) {
      return reply.status(404).send({ error: 'Preventivo non trovato' });
    }

    // Build export object (strip internal IDs, keep data only)
    const exportData = {
      _export_version: 1,
      _exported_at: new Date().toISOString(),
      numero: preventivo.numero,
      data: preventivo.data,
      stato: preventivo.stato,
      cliente: {
        nome: preventivo.cliente_nome,
        codice_fiscale: preventivo.cliente_cf || null,
        partita_iva: preventivo.cliente_piva || null,
      },
      manodopera_ore: preventivo.manodopera_ore,
      manodopera_costo_orario: preventivo.manodopera_costo_orario,
      manodopera_totale: preventivo.manodopera_totale,
      sconto_tipo: preventivo.sconto_tipo,
      sconto_valore: preventivo.sconto_valore,
      sconto_calcolato: preventivo.sconto_calcolato,
      aliquota_iva: preventivo.aliquota_iva,
      imponibile: preventivo.imponibile,
      imponibile_netto: preventivo.imponibile_netto,
      iva: preventivo.iva,
      totale: preventivo.totale,
      note: preventivo.note,
      pezzi: (preventivo.pezzi || []).map((p) => ({
        nome: p.fuori_catalogo ? p.nome_manuale : p.pezzo_nome,
        nome_manuale: p.nome_manuale || null,
        barcode: p.pezzo_barcode || null,
        marca: p.pezzo_marca || null,
        modello: p.pezzo_modello || null,
        quantita: p.quantita,
        prezzo_unitario: p.prezzo_unitario,
        note: p.note || null,
        fuori_catalogo: p.fuori_catalogo || false,
      })),
    };

    reply.header('Content-Type', 'application/json');
    reply.header(
      'Content-Disposition',
      `attachment; filename="preventivo_${preventivo.numero.replace('/', '_')}.json"`
    );
    return reply.send(exportData);
  });

  // Import preventivo from JSON (creates new bozza)
  app.post('/import', { preHandler: [app.authenticate] }, async (request, reply) => {
    const importData = request.body;

    if (!importData || !importData._export_version) {
      return reply.status(400).send({ error: 'Formato file non valido. Usa un file esportato dal sistema.' });
    }

    const utente_id = request.user.id;

    // Find or require client
    let cliente;
    if (importData.cliente && importData.cliente.nome) {
      // Try to find by exact name
      cliente = await app.db('clienti')
        .where({ nome: importData.cliente.nome, archiviato: false })
        .first();
    }

    if (!cliente) {
      return reply.status(400).send({
        error: `Cliente "${importData.cliente?.nome || 'sconosciuto'}" non trovato nel sistema. Crea prima il cliente.`,
      });
    }

    // Resolve pezzi from catalogo (match by barcode or name)
    const resolvedPezzi = [];
    for (const importPezzo of importData.pezzi || []) {
      // If already marked as fuori_catalogo in the export, keep it
      if (importPezzo.fuori_catalogo) {
        resolvedPezzi.push({
          pezzo_id: null,
          nome_manuale: importPezzo.nome_manuale || importPezzo.nome,
          fuori_catalogo: true,
          quantita: importPezzo.quantita,
          prezzo_unitario: importPezzo.prezzo_unitario,
          note: importPezzo.note || null,
        });
        continue;
      }

      let pezzo = null;

      if (importPezzo.barcode) {
        pezzo = await app.db('catalogo_prodotti').where({ barcode: importPezzo.barcode }).first();
      }
      if (!pezzo && importPezzo.nome) {
        pezzo = await app.db('catalogo_prodotti').whereILike('nome', importPezzo.nome).first();
      }

      if (!pezzo) {
        return reply.status(400).send({
          error: `Prodotto "${importPezzo.nome || importPezzo.barcode}" non trovato nel catalogo. Aggiungilo prima di importare.`,
        });
      }

      resolvedPezzi.push({
        pezzo_id: pezzo.id,
        quantita: importPezzo.quantita,
        prezzo_unitario: importPezzo.prezzo_unitario,
        note: importPezzo.note || null,
        fuori_catalogo: false,
      });
    }

    // Calculate totals
    const calcoli = calcolaPreventivo({
      pezzi: resolvedPezzi,
      manodopera_ore: importData.manodopera_ore || 0,
      manodopera_costo_orario: importData.manodopera_costo_orario || 0,
      sconto_tipo: importData.sconto_tipo || 'fisso',
      sconto_valore: importData.sconto_valore || 0,
      aliquota_iva: importData.aliquota_iva || 22,
    });

    // Generate new numero (always a new quote)
    const year = new Date().getFullYear();
    const numero = await generateNumero(app.db, year);

    const result = await app.db.transaction(async (trx) => {
      const [preventivo] = await trx('preventivi')
        .insert({
          numero,
          cliente_id: cliente.id,
          utente_id,
          data: importData.data || new Date().toISOString().split('T')[0],
          stato: 'bozza', // Always import as bozza
          manodopera_ore: importData.manodopera_ore || 0,
          manodopera_costo_orario: importData.manodopera_costo_orario || 0,
          manodopera_totale: calcoli.manodopera_totale,
          sconto_tipo: importData.sconto_tipo || 'fisso',
          sconto_valore: importData.sconto_valore || 0,
          sconto_calcolato: calcoli.sconto_calcolato,
          aliquota_iva: importData.aliquota_iva || 22,
          imponibile: calcoli.imponibile,
          imponibile_netto: calcoli.imponibile_netto,
          iva: calcoli.iva,
          totale: calcoli.totale,
          note: importData.note || null,
        })
        .returning('*');

      if (resolvedPezzi.length > 0) {
        await trx('preventivo_pezzi').insert(
          resolvedPezzi.map((p) => ({
            preventivo_id: preventivo.id,
            ...p,
          }))
        );
      }

      return preventivo;
    });

    const full = await loadPreventivo(app.db, result.id);
    return reply.status(201).send(full);
  });

  // Duplicate preventivo as new bozza
  app.post('/:id/duplica', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    const source = await loadPreventivo(app.db, id);
    if (!source) {
      return reply.status(404).send({ error: 'Preventivo non trovato' });
    }

    const utente_id = request.user.id;

    // Verify client still exists and is not archived
    const cliente = await app.db('clienti').where({ id: source.cliente_id }).first();
    if (!cliente) {
      return reply.status(400).send({ error: 'Cliente del preventivo originale non trovato' });
    }
    if (cliente.archiviato) {
      return reply.status(400).send({ error: 'Cliente del preventivo originale è archiviato' });
    }

    // Recalculate using source data
    const pezziPayload = (source.pezzi || []).map((p) => ({
      pezzo_id: p.fuori_catalogo ? null : p.pezzo_id,
      nome_manuale: p.nome_manuale || null,
      fuori_catalogo: p.fuori_catalogo || false,
      quantita: p.quantita,
      prezzo_unitario: p.prezzo_unitario,
      note: p.note || null,
    }));

    const calcoli = calcolaPreventivo({
      pezzi: pezziPayload,
      manodopera_ore: source.manodopera_ore || 0,
      manodopera_costo_orario: source.manodopera_costo_orario || 0,
      sconto_tipo: source.sconto_tipo || 'fisso',
      sconto_valore: source.sconto_valore || 0,
      aliquota_iva: source.aliquota_iva || 22,
    });

    const today = new Date().toISOString().split('T')[0];
    const year = new Date().getFullYear();
    const numero = await generateNumero(app.db, year);

    const result = await app.db.transaction(async (trx) => {
      const [preventivo] = await trx('preventivi')
        .insert({
          numero,
          cliente_id: source.cliente_id,
          operaio_id: source.operaio_id || null,
          utente_id,
          data: today,
          stato: 'bozza',
          manodopera_ore: source.manodopera_ore || 0,
          manodopera_costo_orario: source.manodopera_costo_orario || 0,
          manodopera_totale: calcoli.manodopera_totale,
          sconto_tipo: source.sconto_tipo || 'fisso',
          sconto_valore: source.sconto_valore || 0,
          sconto_calcolato: calcoli.sconto_calcolato,
          aliquota_iva: source.aliquota_iva || 22,
          imponibile: calcoli.imponibile,
          imponibile_netto: calcoli.imponibile_netto,
          iva: calcoli.iva,
          totale: calcoli.totale,
          note: source.note || null,
        })
        .returning('*');

      if (pezziPayload.length > 0) {
        await trx('preventivo_pezzi').insert(
          pezziPayload.map((p) => ({
            preventivo_id: preventivo.id,
            ...p,
          }))
        );
      }

      return preventivo;
    });

    const full = await loadPreventivo(app.db, result.id);

    // Audit log
    try {
      await app.logModifica(app.db, {
        utente_id: request.user.id,
        entita: 'preventivo',
        entita_id: result.id,
        azione: 'duplicazione',
        dettaglio: { numero, duplicato_da: source.numero, cliente_nome: cliente.nome, totale: calcoli.totale },
      });
    } catch (logErr) {
      app.log.error({ err: logErr }, 'Failed to log modification');
    }

    return reply.status(201).send(full);
  });

  // Delete (only bozza)
  app.delete('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    const existing = await app.db('preventivi').where({ id }).first();
    if (!existing) {
      return reply.status(404).send({ error: 'Preventivo non trovato' });
    }

    if (existing.stato !== 'bozza') {
      return reply.status(403).send({
        error: 'Solo i preventivi in bozza possono essere eliminati',
      });
    }

    // Audit log: eliminazione preventivo (before delete)
    try {
      await app.logModifica(app.db, {
        utente_id: request.user.id,
        entita: 'preventivo',
        entita_id: id,
        azione: 'eliminazione',
        dettaglio: { numero: existing.numero },
      });
    } catch (logErr) {
      app.log.error({ err: logErr }, 'Failed to log modification');
    }

    // preventivo_pezzi are CASCADE deleted
    await app.db('preventivi').where({ id }).del();
    return { message: 'Preventivo eliminato' };
  });
}

module.exports = preventiviRoutes;
