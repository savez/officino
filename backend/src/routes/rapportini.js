const { z } = require('zod');
const { parsePagination, paginatedResponse } = require('../utils/pagination');

const materialeSchema = z.object({
    pezzo_id: z.number().int().positive().optional().nullable(),
    nome_manuale: z.string().min(1).optional().nullable(),
    quantita: z.number().int().min(1).default(1),
    fuori_catalogo: z.boolean().default(false),
}).refine(
    (m) => {
        if (m.fuori_catalogo) return !!m.nome_manuale;
        return !!m.pezzo_id;
    },
    { message: 'pezzo_id obbligatorio per materiali da catalogo, nome_manuale per fuori catalogo' }
);

const rigaSchema = z.object({
    cliente_id: z.number().int().positive({ message: 'Cliente obbligatorio' }),
    giorno: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato giorno non valido (YYYY-MM-DD)'),
    ora_inizio: z.string().regex(/^\d{2}:\d{2}$/, 'Formato ora non valido (HH:mm)'),
    ora_fine: z.string().regex(/^\d{2}:\d{2}$/, 'Formato ora non valido (HH:mm)'),
    macchina: z.string().optional().nullable(),
    note: z.string().optional().nullable(),
    materiali: z.array(materialeSchema).optional().default([]),
}).refine(
    (data) => data.ora_fine > data.ora_inizio,
    { message: 'Ora fine deve essere successiva a ora inizio', path: ['ora_fine'] }
);

/**
 * Rapportini routes - Insert, list, delete righe rapportino
 * @param {import('fastify').FastifyInstance} app
 */
async function rapportiniRoutes(app) {
    // List (paginated) - operaio: own rows, admin: all rows with filters
    app.get('/', { preHandler: [app.authenticate] }, async (request) => {
        const { page, perPage, offset } = parsePagination(request.query);
        const { cliente_id, utente_id, giorno, gestita } = request.query;
        const isAdmin = request.user.ruolo === 'admin';

        let query = app
            .db('righe_rapportino as r')
            .leftJoin('utenti as u', 'r.utente_id', 'u.id')
            .leftJoin('clienti as c', 'r.cliente_id', 'c.id');

        // Operaio sees only own rows
        if (!isAdmin) {
            query = query.where('r.utente_id', request.user.id);
        }

        // Filters
        if (cliente_id) query = query.where('r.cliente_id', cliente_id);
        if (utente_id && isAdmin) query = query.where('r.utente_id', utente_id);
        if (giorno) query = query.where('r.giorno', giorno);
        if (gestita === 'true') query = query.whereNotNull('r.nota_lavorazione_id');
        if (gestita === 'false') query = query.whereNull('r.nota_lavorazione_id');

        const countQuery = query.clone().clearSelect().count('r.id as count').first();
        const { count } = await countQuery;

        // Calcola ore totali di TUTTE le righe filtrate (ignora pagination)
        const oreTotaliQuery = query.clone().clearSelect()
            .select('r.ora_inizio', 'r.ora_fine');
        const tutteLeRighe = await oreTotaliQuery;
        let ore_totali_filtrate = 0;
        for (const riga of tutteLeRighe) {
            const [h1, m1] = riga.ora_inizio.split(':').map(Number);
            const [h2, m2] = riga.ora_fine.split(':').map(Number);
            ore_totali_filtrate += ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
        }
        ore_totali_filtrate = Math.round(ore_totali_filtrate * 100) / 100;

        const rows = await query
            .clone()
            .select(
                'r.*',
                'u.nome as utente_nome',
                'c.nome as cliente_nome'
            )
            .orderBy('r.giorno', 'desc')
            .orderBy('r.ora_inizio', 'desc')
            .limit(perPage)
            .offset(offset);

        // Load materiali for each row
        const rigaIds = rows.map((r) => r.id);
        let materialiMap = {};
        if (rigaIds.length > 0) {
            const materiali = await app
                .db('materiali_rapportino as m')
                .leftJoin('catalogo_prodotti as p', 'm.pezzo_id', 'p.id')
                .whereIn('m.riga_rapportino_id', rigaIds)
                .select(
                    'm.*',
                    'p.nome as pezzo_nome'
                );

            for (const mat of materiali) {
                if (!materialiMap[mat.riga_rapportino_id]) {
                    materialiMap[mat.riga_rapportino_id] = [];
                }
                materialiMap[mat.riga_rapportino_id].push({
                    id: mat.id,
                    pezzo_id: mat.pezzo_id,
                    nome: mat.fuori_catalogo ? mat.nome_manuale : mat.pezzo_nome,
                    quantita: mat.quantita,
                    fuori_catalogo: mat.fuori_catalogo,
                });
            }
        }

        const data = rows.map((r) => ({
            ...r,
            materiali: materialiMap[r.id] || [],
        }));

        const response = paginatedResponse(data, Number(count), page, perPage);
        response.ore_totali_filtrate = ore_totali_filtrate;
        return response;
    });

    // Create riga rapportino
    app.post('/', { preHandler: [app.authenticate] }, async (request, reply) => {
        const parsed = rigaSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Dati non validi',
                details: parsed.error.flatten(),
            });
        }

        const { materiali, ...rigaData } = parsed.data;

        // Verify cliente exists
        const cliente = await app.db('clienti').where({ id: rigaData.cliente_id }).first();
        if (!cliente) {
            return reply.status(404).send({ error: 'Cliente non trovato' });
        }

        // Verify prodotti exist for catalogo materials
        for (const mat of materiali) {
            if (!mat.fuori_catalogo) {
                const pezzo = await app.db('catalogo_prodotti').where({ id: mat.pezzo_id }).first();
                if (!pezzo) {
                    return reply.status(404).send({
                        error: `Prodotto con id ${mat.pezzo_id} non trovato`,
                    });
                }
            }
        }

        // Transaction: insert riga + materiali
        const result = await app.db.transaction(async (trx) => {
            const [riga] = await trx('righe_rapportino')
                .insert({
                    utente_id: request.user.id,
                    cliente_id: rigaData.cliente_id,
                    giorno: rigaData.giorno,
                    ora_inizio: rigaData.ora_inizio,
                    ora_fine: rigaData.ora_fine,
                    macchina: rigaData.macchina || null,
                    note: rigaData.note || null,
                })
                .returning('*');

            // Insert materiali
            for (const mat of materiali) {
                await trx('materiali_rapportino').insert({
                    riga_rapportino_id: riga.id,
                    pezzo_id: mat.fuori_catalogo ? null : mat.pezzo_id,
                    nome_manuale: mat.fuori_catalogo ? mat.nome_manuale : null,
                    quantita: mat.quantita,
                    fuori_catalogo: mat.fuori_catalogo,
                });
            }

            return riga;
        });

        // Audit log
        try {
            await app.logModifica(app.db, {
                utente_id: request.user.id,
                entita: 'riga_rapportino',
                entita_id: result.id,
                azione: 'creazione',
                dettaglio: {
                    cliente: cliente.nome,
                    giorno: rigaData.giorno,
                    ora_inizio: rigaData.ora_inizio,
                    ora_fine: rigaData.ora_fine,
                    materiali_count: materiali.length,
                },
            });
        } catch (logErr) {
            app.log.error({ err: logErr }, 'Failed to log modification');
        }

        return reply.status(201).send({ id: result.id, message: 'Riga rapportino inserita' });
    });

    // Delete riga rapportino
    app.delete('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
        const { id } = request.params;
        const isAdmin = request.user.ruolo === 'admin';

        const riga = await app.db('righe_rapportino').where({ id }).first();
        if (!riga) {
            return reply.status(404).send({ error: 'Riga rapportino non trovata' });
        }

        // Operaio: can only delete own rows that are not managed
        if (!isAdmin) {
            if (riga.utente_id !== request.user.id) {
                return reply.status(403).send({ error: 'Non puoi cancellare righe di altri operai' });
            }
            if (riga.nota_lavorazione_id) {
                return reply.status(403).send({
                    error: 'Non puoi cancellare una riga già gestita. Contatta l\'amministratore.',
                });
            }
        }

        // Delete riga (CASCADE deletes materiali)
        await app.db('righe_rapportino').where({ id }).del();

        // Audit log
        try {
            await app.logModifica(app.db, {
                utente_id: request.user.id,
                entita: 'riga_rapportino',
                entita_id: id,
                azione: 'eliminazione',
                dettaglio: {
                    giorno: riga.giorno,
                    ora_inizio: riga.ora_inizio,
                    ora_fine: riga.ora_fine,
                },
            });
        } catch (logErr) {
            app.log.error({ err: logErr }, 'Failed to log modification');
        }

        return { message: 'Riga rapportino eliminata' };
    });

    // Print rapportini as PDF (admin only)
    app.get('/stampa', {
        preHandler: [app.authenticate, app.requireRole('admin')],
    }, async (request, reply) => {
        const { giorno, cliente_id } = request.query;

        if (!giorno && !cliente_id) {
            return reply.status(400).send({
                error: 'Specificare almeno un filtro: giorno o cliente_id',
            });
        }

        let query = app
            .db('righe_rapportino as r')
            .leftJoin('utenti as u', 'r.utente_id', 'u.id')
            .leftJoin('clienti as c', 'r.cliente_id', 'c.id')
            .select('r.*', 'u.nome as utente_nome', 'c.nome as cliente_nome');

        if (giorno) query = query.where('r.giorno', giorno);
        if (cliente_id) query = query.where('r.cliente_id', cliente_id);

        const righe = await query.orderBy('r.giorno', 'asc').orderBy('r.ora_inizio', 'asc');

        if (righe.length === 0) {
            return reply.status(404).send({ error: 'Nessuna riga trovata per i filtri specificati' });
        }

        // Load materiali
        const rigaIds = righe.map((r) => r.id);
        const materiali = await app
            .db('materiali_rapportino as m')
            .leftJoin('catalogo_prodotti as p', 'm.pezzo_id', 'p.id')
            .whereIn('m.riga_rapportino_id', rigaIds)
            .select('m.*', 'p.nome as pezzo_nome');

        const materialiMap = {};
        for (const mat of materiali) {
            if (!materialiMap[mat.riga_rapportino_id]) {
                materialiMap[mat.riga_rapportino_id] = [];
            }
            materialiMap[mat.riga_rapportino_id].push({
                nome: mat.fuori_catalogo ? mat.nome_manuale : mat.pezzo_nome,
                quantita: mat.quantita,
                fuori_catalogo: mat.fuori_catalogo,
            });
        }

        const righeConMateriali = righe.map((r) => ({
            ...r,
            materiali: materialiMap[r.id] || [],
        }));

        // Get header info
        let intestazione;
        if (cliente_id) {
            const cliente = await app.db('clienti').where({ id: cliente_id }).first();
            intestazione = cliente ? cliente.nome : 'Cliente';
        } else {
            intestazione = giorno;
        }

        const { generaPdfRapportino } = require('../services/pdf-rapportino');
        const pdfBuffer = await generaPdfRapportino(intestazione, righeConMateriali);

        reply.header('Content-Type', 'application/pdf');
        reply.header('Content-Disposition', 'inline; filename="rapportino.pdf"');
        return reply.send(pdfBuffer);
    });
}

module.exports = rapportiniRoutes;
