const { z } = require('zod');
const { parsePagination, paginatedResponse } = require('../utils/pagination');

const notaCreateSchema = z.object({
    cliente_id: z.number().int().positive({ message: 'Cliente obbligatorio' }),
    testo: z.string().optional().nullable(),
    mostra_dettagli: z.boolean().default(true),
    righe_ids: z.array(z.number().int().positive()).min(1, 'Selezionare almeno una riga'),
});

const notaUpdateSchema = z.object({
    testo: z.string().optional().nullable(),
    mostra_dettagli: z.boolean().optional(),
    righe_ids: z.array(z.number().int().positive()).min(1, 'Selezionare almeno una riga'),
});

/**
 * Calculates total hours from an array of righe
 * @param {Array} righe - rows with ora_inizio and ora_fine
 * @returns {number} total hours
 */
function calcolaOreTotali(righe) {
    let totale = 0;
    for (const r of righe) {
        const [hi, mi] = r.ora_inizio.split(':').map(Number);
        const [hf, mf] = r.ora_fine.split(':').map(Number);
        totale += (hf * 60 + mf - hi * 60 - mi) / 60;
    }
    return Math.round(totale * 100) / 100;
}

/**
 * Note di Lavorazione routes - CRUD (admin only)
 * @param {import('fastify').FastifyInstance} app
 */
async function noteLavorazioneRoutes(app) {
    // List (paginated, admin only)
    app.get('/', {
        preHandler: [app.authenticate, app.requireRole('admin')],
    }, async (request) => {
        const { page, perPage, offset } = parsePagination(request.query);
        const { cliente_id } = request.query;

        let query = app
            .db('note_lavorazione as n')
            .leftJoin('clienti as c', 'n.cliente_id', 'c.id');

        if (cliente_id) query = query.where('n.cliente_id', cliente_id);

        const countQuery = query.clone().clearSelect().count('n.id as count').first();
        const { count } = await countQuery;

        const notes = await query
            .clone()
            .select('n.*', 'c.nome as cliente_nome')
            .orderBy('n.created_at', 'desc')
            .limit(perPage)
            .offset(offset);

        // Calculate ore_totali and num_righe for each note
        const noteIds = notes.map((n) => n.id);
        let righeStats = {};
        if (noteIds.length > 0) {
            const righe = await app
                .db('righe_rapportino')
                .whereIn('nota_lavorazione_id', noteIds)
                .select('nota_lavorazione_id', 'ora_inizio', 'ora_fine');

            for (const r of righe) {
                if (!righeStats[r.nota_lavorazione_id]) {
                    righeStats[r.nota_lavorazione_id] = [];
                }
                righeStats[r.nota_lavorazione_id].push(r);
            }
        }

        const data = notes.map((n) => {
            const righeNota = righeStats[n.id] || [];
            return {
                ...n,
                ore_totali: calcolaOreTotali(righeNota),
                num_righe: righeNota.length,
            };
        });

        return paginatedResponse(data, Number(count), page, perPage);
    });

    // Get by ID (admin only, with righe details)
    app.get('/:id', {
        preHandler: [app.authenticate, app.requireRole('admin')],
    }, async (request, reply) => {
        const { id } = request.params;

        const nota = await app
            .db('note_lavorazione as n')
            .leftJoin('clienti as c', 'n.cliente_id', 'c.id')
            .where('n.id', id)
            .select('n.*', 'c.nome as cliente_nome')
            .first();

        if (!nota) {
            return reply.status(404).send({ error: 'Nota di lavorazione non trovata' });
        }

        // Load righe with details
        const righe = await app
            .db('righe_rapportino as r')
            .leftJoin('utenti as u', 'r.utente_id', 'u.id')
            .where('r.nota_lavorazione_id', id)
            .select('r.*', 'u.nome as utente_nome')
            .orderBy('r.giorno', 'asc')
            .orderBy('r.ora_inizio', 'asc');

        // Load materiali for righe
        const rigaIds = righe.map((r) => r.id);
        let materialiMap = {};
        if (rigaIds.length > 0) {
            const materiali = await app
                .db('materiali_rapportino as m')
                .leftJoin('catalogo_prodotti as p', 'm.pezzo_id', 'p.id')
                .whereIn('m.riga_rapportino_id', rigaIds)
                .select('m.*', 'p.nome as pezzo_nome');

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
        }

        const righeDettaglio = righe.map((r) => {
            const [hi, mi] = r.ora_inizio.split(':').map(Number);
            const [hf, mf] = r.ora_fine.split(':').map(Number);
            const ore = Math.round(((hf * 60 + mf - hi * 60 - mi) / 60) * 100) / 100;
            return {
                ...r,
                ore,
                materiali: materialiMap[r.id] || [],
            };
        });

        return {
            ...nota,
            righe: righeDettaglio,
            ore_totali: calcolaOreTotali(righe),
        };
    });

    // Create nota di lavorazione (admin only)
    app.post('/', {
        preHandler: [app.authenticate, app.requireRole('admin')],
    }, async (request, reply) => {
        const parsed = notaCreateSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Dati non validi',
                details: parsed.error.flatten(),
            });
        }

        const { cliente_id, testo, mostra_dettagli, righe_ids } = parsed.data;

        // Verify cliente exists
        const cliente = await app.db('clienti').where({ id: cliente_id }).first();
        if (!cliente) {
            return reply.status(404).send({ error: 'Cliente non trovato' });
        }

        // Verify righe: exist, same client, not already managed
        const righe = await app
            .db('righe_rapportino')
            .whereIn('id', righe_ids);

        if (righe.length !== righe_ids.length) {
            return reply.status(404).send({ error: 'Una o più righe non trovate' });
        }

        for (const riga of righe) {
            if (riga.cliente_id !== cliente_id) {
                return reply.status(400).send({
                    error: 'Tutte le righe devono appartenere allo stesso cliente della nota',
                });
            }
            if (riga.nota_lavorazione_id) {
                return reply.status(400).send({
                    error: `La riga ${riga.id} è già associata a un'altra nota di lavorazione`,
                });
            }
        }

        // Transaction: create nota + update righe
        const result = await app.db.transaction(async (trx) => {
            const [nota] = await trx('note_lavorazione')
                .insert({
                    cliente_id,
                    testo: testo || null,
                    mostra_dettagli,
                })
                .returning('*');

            await trx('righe_rapportino')
                .whereIn('id', righe_ids)
                .update({
                    nota_lavorazione_id: nota.id,
                    updated_at: trx.fn.now(),
                });

            return nota;
        });

        // Audit log
        try {
            await app.logModifica(app.db, {
                utente_id: request.user.id,
                entita: 'nota_lavorazione',
                entita_id: result.id,
                azione: 'creazione',
                dettaglio: {
                    cliente: cliente.nome,
                    righe_count: righe_ids.length,
                },
            });
        } catch (logErr) {
            app.log.error({ err: logErr }, 'Failed to log modification');
        }

        return reply.status(201).send({ id: result.id, message: 'Nota di lavorazione creata' });
    });

    // Update nota di lavorazione (admin only)
    app.put('/:id', {
        preHandler: [app.authenticate, app.requireRole('admin')],
    }, async (request, reply) => {
        const { id } = request.params;
        const parsed = notaUpdateSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Dati non validi',
                details: parsed.error.flatten(),
            });
        }

        const nota = await app.db('note_lavorazione').where({ id }).first();
        if (!nota) {
            return reply.status(404).send({ error: 'Nota di lavorazione non trovata' });
        }

        const { testo, mostra_dettagli, righe_ids } = parsed.data;

        // Get current righe
        const currentRighe = await app
            .db('righe_rapportino')
            .where({ nota_lavorazione_id: id })
            .select('id');
        const currentIds = currentRighe.map((r) => r.id);

        const toRemove = currentIds.filter((rid) => !righe_ids.includes(rid));
        const toAdd = righe_ids.filter((rid) => !currentIds.includes(rid));

        // Verify new righe: same client, not already managed by another note
        if (toAdd.length > 0) {
            const newRighe = await app.db('righe_rapportino').whereIn('id', toAdd);

            if (newRighe.length !== toAdd.length) {
                return reply.status(404).send({ error: 'Una o più righe da aggiungere non trovate' });
            }

            for (const riga of newRighe) {
                if (riga.cliente_id !== nota.cliente_id) {
                    return reply.status(400).send({
                        error: 'Tutte le righe devono appartenere allo stesso cliente della nota',
                    });
                }
                if (riga.nota_lavorazione_id && riga.nota_lavorazione_id !== Number(id)) {
                    return reply.status(400).send({
                        error: `La riga ${riga.id} è già associata a un'altra nota di lavorazione`,
                    });
                }
            }
        }

        // Transaction: update nota + manage righe associations
        await app.db.transaction(async (trx) => {
            const updateData = { updated_at: trx.fn.now() };
            if (testo !== undefined) updateData.testo = testo || null;
            if (mostra_dettagli !== undefined) updateData.mostra_dettagli = mostra_dettagli;

            await trx('note_lavorazione').where({ id }).update(updateData);

            // Remove old associations
            if (toRemove.length > 0) {
                await trx('righe_rapportino')
                    .whereIn('id', toRemove)
                    .update({
                        nota_lavorazione_id: null,
                        updated_at: trx.fn.now(),
                    });
            }

            // Add new associations
            if (toAdd.length > 0) {
                await trx('righe_rapportino')
                    .whereIn('id', toAdd)
                    .update({
                        nota_lavorazione_id: id,
                        updated_at: trx.fn.now(),
                    });
            }
        });

        // Audit log
        try {
            await app.logModifica(app.db, {
                utente_id: request.user.id,
                entita: 'nota_lavorazione',
                entita_id: id,
                azione: 'modifica',
                dettaglio: {
                    righe_aggiunte: toAdd.length,
                    righe_rimosse: toRemove.length,
                },
            });
        } catch (logErr) {
            app.log.error({ err: logErr }, 'Failed to log modification');
        }

        return { message: 'Nota di lavorazione aggiornata' };
    });

    // Delete nota di lavorazione (admin only)
    app.delete('/:id', {
        preHandler: [app.authenticate, app.requireRole('admin')],
    }, async (request, reply) => {
        const { id } = request.params;

        const nota = await app.db('note_lavorazione').where({ id }).first();
        if (!nota) {
            return reply.status(404).send({ error: 'Nota di lavorazione non trovata' });
        }

        // ON DELETE SET NULL handles righe automatically
        await app.db('note_lavorazione').where({ id }).del();

        // Audit log
        try {
            await app.logModifica(app.db, {
                utente_id: request.user.id,
                entita: 'nota_lavorazione',
                entita_id: id,
                azione: 'eliminazione',
                dettaglio: { cliente_id: nota.cliente_id },
            });
        } catch (logErr) {
            app.log.error({ err: logErr }, 'Failed to log modification');
        }

        return { message: 'Nota di lavorazione eliminata' };
    });

    // Print nota di lavorazione as PDF (admin only)
    app.get('/:id/stampa', {
        preHandler: [app.authenticate, app.requireRole('admin')],
    }, async (request, reply) => {
        const { id } = request.params;

        // Reuse the detail endpoint logic
        const nota = await app
            .db('note_lavorazione as n')
            .leftJoin('clienti as c', 'n.cliente_id', 'c.id')
            .where('n.id', id)
            .select('n.*', 'c.nome as cliente_nome')
            .first();

        if (!nota) {
            return reply.status(404).send({ error: 'Nota di lavorazione non trovata' });
        }

        const righe = await app
            .db('righe_rapportino as r')
            .leftJoin('utenti as u', 'r.utente_id', 'u.id')
            .where('r.nota_lavorazione_id', id)
            .select('r.*', 'u.nome as utente_nome')
            .orderBy('r.giorno', 'asc')
            .orderBy('r.ora_inizio', 'asc');

        // Load materiali
        const rigaIds = righe.map((r) => r.id);
        let materialiMap = {};
        if (rigaIds.length > 0) {
            const materiali = await app
                .db('materiali_rapportino as m')
                .leftJoin('catalogo_prodotti as p', 'm.pezzo_id', 'p.id')
                .whereIn('m.riga_rapportino_id', rigaIds)
                .select('m.*', 'p.nome as pezzo_nome');

            for (const mat of materiali) {
                if (!materialiMap[mat.riga_rapportino_id]) {
                    materialiMap[mat.riga_rapportino_id] = [];
                }
                materialiMap[mat.riga_rapportino_id].push({
                    nome: mat.fuori_catalogo ? mat.nome_manuale : mat.pezzo_nome,
                    quantita: mat.quantita,
                });
            }
        }

        const righeDettaglio = righe.map((r) => ({
            ...r,
            materiali: materialiMap[r.id] || [],
        }));

        const { generaPdfNotaLavorazione } = require('../services/pdf-nota-lavorazione');
        const pdfBuffer = await generaPdfNotaLavorazione(nota, righeDettaglio);

        reply.header('Content-Type', 'application/pdf');
        reply.header('Content-Disposition', 'inline; filename="nota_lavorazione.pdf"');
        return reply.send(pdfBuffer);
    });
}

module.exports = noteLavorazioneRoutes;
