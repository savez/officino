/**
 * Dashboard stats route
 * GET /api/dashboard/stats?mese=3&anno=2026
 * @param {import('fastify').FastifyInstance} app
 */
async function dashboardRoutes(app) {
  app.get('/stats', { preHandler: [app.authenticate] }, async (request, reply) => {
    const mese = parseInt(request.query.mese, 10);
    const anno = parseInt(request.query.anno, 10);

    if (!mese || !anno || mese < 1 || mese > 12 || anno < 2000) {
      return reply.status(400).send({ error: 'Parametri mese e anno obbligatori e validi' });
    }

    const isAdmin = request.user.ruolo === 'admin';

    // Build date range for the month
    const meseStr = String(mese).padStart(2, '0');
    const dataInizio = `${anno}-${meseStr}-01`;
    // Last day of month
    const ultimoGiorno = new Date(anno, mese, 0).getDate();
    const dataFine = `${anno}-${meseStr}-${String(ultimoGiorno).padStart(2, '0')}`;

    // ── Preventivi ──────────────────────────────────────────────────
    const preventiviRows = await app.db('preventivi')
      .whereBetween('data', [dataInizio, dataFine])
      .select('stato')
      .count('id as cnt')
      .groupBy('stato');

    const perStato = {
      bozza: 0,
      approvato: 0,
      rifiutato: 0,
      scaduto: 0,
      fatturato: 0,
      cancellato: 0,
    };

    for (const row of preventiviRows) {
      if (perStato.hasOwnProperty(row.stato)) {
        perStato[row.stato] = Number(row.cnt);
      }
    }

    const totalePreventivi = Object.values(perStato).reduce((a, b) => a + b, 0);
    const aperti = perStato.bozza + perStato.approvato;
    const chiusi = perStato.rifiutato + perStato.scaduto + perStato.fatturato + perStato.cancellato;

    // ── Ore rapportino ───────────────────────────────────────────────
    // Fetch raw rows and aggregate in JS to stay DB-agnostic (works on
    // both PostgreSQL in production and SQLite in tests).
    let oreQuery = app.db('righe_rapportino as r')
      .join('clienti as c', 'r.cliente_id', 'c.id')
      .whereBetween('r.giorno', [dataInizio, dataFine])
      .select(
        'r.cliente_id',
        'c.nome as cliente_nome',
        'r.ora_inizio',
        'r.ora_fine',
        'r.nota_lavorazione_id'
      );

    if (!isAdmin) {
      oreQuery = oreQuery.where('r.utente_id', request.user.id);
    }

    const oreRighe = await oreQuery;

    // Aggregate per cliente in JavaScript
    const clienteMap = {};
    for (const riga of oreRighe) {
      const [h1, m1] = riga.ora_inizio.split(':').map(Number);
      const [h2, m2] = riga.ora_fine.split(':').map(Number);
      const ore = ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;

      if (!clienteMap[riga.cliente_id]) {
        clienteMap[riga.cliente_id] = {
          cliente_id: riga.cliente_id,
          cliente_nome: riga.cliente_nome,
          ore_totali: 0,
          ore_in_nota: 0,
          ore_non_gestite: 0,
        };
      }
      clienteMap[riga.cliente_id].ore_totali += ore;
      if (riga.nota_lavorazione_id) {
        clienteMap[riga.cliente_id].ore_in_nota += ore;
      } else {
        clienteMap[riga.cliente_id].ore_non_gestite += ore;
      }
    }

    const perCliente = Object.values(clienteMap)
      .sort((a, b) => b.ore_totali - a.ore_totali)
      .map((c) => ({
        cliente_id: c.cliente_id,
        cliente_nome: c.cliente_nome,
        ore_totali: Math.round(c.ore_totali * 100) / 100,
        ore_in_nota: Math.round(c.ore_in_nota * 100) / 100,
        ore_non_gestite: Math.round(c.ore_non_gestite * 100) / 100,
      }));

    // Aggregate per operaio (solo admin)
    let perOperaio = [];
    if (isAdmin) {
      // Fetch righe con utente_nome per aggregazione per operaio
      const oreQueryOperaio = app.db('righe_rapportino as r')
        .join('utenti as u', 'r.utente_id', 'u.id')
        .whereBetween('r.giorno', [dataInizio, dataFine])
        .select(
          'r.utente_id',
          'u.nome as utente_nome',
          'r.ora_inizio',
          'r.ora_fine',
          'r.nota_lavorazione_id'
        );
      
      const oreRigheOperaio = await oreQueryOperaio;
      
      const operaioMap = {};
      for (const riga of oreRigheOperaio) {
        const [h1, m1] = riga.ora_inizio.split(':').map(Number);
        const [h2, m2] = riga.ora_fine.split(':').map(Number);
        const ore = ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
        
        if (!operaioMap[riga.utente_id]) {
          operaioMap[riga.utente_id] = {
            utente_id: riga.utente_id,
            utente_nome: riga.utente_nome,
            ore_totali: 0,
            ore_in_nota: 0,
            ore_non_gestite: 0,
          };
        }
        operaioMap[riga.utente_id].ore_totali += ore;
        if (riga.nota_lavorazione_id) {
          operaioMap[riga.utente_id].ore_in_nota += ore;
        } else {
          operaioMap[riga.utente_id].ore_non_gestite += ore;
        }
      }
      
      perOperaio = Object.values(operaioMap)
        .sort((a, b) => b.ore_totali - a.ore_totali)
        .map((o) => ({
          utente_id: o.utente_id,
          utente_nome: o.utente_nome,
          ore_totali: Math.round(o.ore_totali * 100) / 100,
          ore_in_nota: Math.round(o.ore_in_nota * 100) / 100,
          ore_non_gestite: Math.round(o.ore_non_gestite * 100) / 100,
        }));
    }

    return {
      preventivi: {
        totale: totalePreventivi,
        per_stato: perStato,
        aperti,
        chiusi,
      },
      ore: {
        per_cliente: perCliente,
        per_operaio: perOperaio,
      },
    };
  });

  // Export ore in Excel (admin only)
  app.get('/export-ore', { preHandler: [app.authenticate, app.requireRole('admin')] }, async (request, reply) => {
    const mese = parseInt(request.query.mese, 10);
    const anno = parseInt(request.query.anno, 10);

    if (!mese || !anno || mese < 1 || mese > 12 || anno < 2000) {
      return reply.status(400).send({ error: 'Parametri mese e anno obbligatori e validi' });
    }

    const meseStr = String(mese).padStart(2, '0');
    const dataInizio = `${anno}-${meseStr}-01`;
    const ultimoGiorno = new Date(anno, mese, 0).getDate();
    const dataFine = `${anno}-${meseStr}-${String(ultimoGiorno).padStart(2, '0')}`;

    // Fetch righe dettagliate per i 3 fogli
    const righe = await app.db('righe_rapportino as r')
      .join('utenti as u', 'r.utente_id', 'u.id')
      .join('clienti as c', 'r.cliente_id', 'c.id')
      .whereBetween('r.giorno', [dataInizio, dataFine])
      .select(
        'r.giorno',
        'u.nome as utente_nome',
        'c.nome as cliente_nome',
        'r.ora_inizio',
        'r.ora_fine',
        'r.nota_lavorazione_id',
        'r.macchina',
        'r.note'
      )
      .orderBy('r.giorno', 'asc')
      .orderBy('r.ora_inizio', 'asc');

    // Aggregazione per operaio
    const operaioMap = {};
    for (const riga of righe) {
      const [h1, m1] = riga.ora_inizio.split(':').map(Number);
      const [h2, m2] = riga.ora_fine.split(':').map(Number);
      const ore = ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;

      if (!operaioMap[riga.utente_nome]) {
        operaioMap[riga.utente_nome] = {
          ore_totali: 0,
          ore_in_nota: 0,
          ore_non_gestite: 0,
        };
      }
      operaioMap[riga.utente_nome].ore_totali += ore;
      if (riga.nota_lavorazione_id) {
        operaioMap[riga.utente_nome].ore_in_nota += ore;
      } else {
        operaioMap[riga.utente_nome].ore_non_gestite += ore;
      }
    }

    // Aggregazione per cliente
    const clienteMap = {};
    for (const riga of righe) {
      const [h1, m1] = riga.ora_inizio.split(':').map(Number);
      const [h2, m2] = riga.ora_fine.split(':').map(Number);
      const ore = ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;

      if (!clienteMap[riga.cliente_nome]) {
        clienteMap[riga.cliente_nome] = {
          ore_totali: 0,
          ore_in_nota: 0,
          ore_non_gestite: 0,
        };
      }
      clienteMap[riga.cliente_nome].ore_totali += ore;
      if (riga.nota_lavorazione_id) {
        clienteMap[riga.cliente_nome].ore_in_nota += ore;
      } else {
        clienteMap[riga.cliente_nome].ore_non_gestite += ore;
      }
    }

    const XLSX = require('xlsx');

    // Foglio 1: Ore per Operaio
    const operaioData = Object.entries(operaioMap).map(([operaio, dati]) => ({
      Operaio: operaio,
      'Ore Totali': Math.round(dati.ore_totali * 100) / 100,
      'Ore in Nota': Math.round(dati.ore_in_nota * 100) / 100,
      'Ore non Gestite': Math.round(dati.ore_non_gestite * 100) / 100,
    }));

    // Foglio 2: Ore per Cliente
    const clienteData = Object.entries(clienteMap).map(([cliente, dati]) => ({
      Cliente: cliente,
      'Ore Totali': Math.round(dati.ore_totali * 100) / 100,
      'Ore in Nota': Math.round(dati.ore_in_nota * 100) / 100,
      'Ore non Gestite': Math.round(dati.ore_non_gestite * 100) / 100,
    }));

    // Foglio 3: Dettaglio
    const dettaglioData = righe.map((r) => {
      const [h1, m1] = r.ora_inizio.split(':').map(Number);
      const [h2, m2] = r.ora_fine.split(':').map(Number);
      const ore = Math.round((((h2 * 60 + m2) - (h1 * 60 + m1)) / 60) * 100) / 100;
      return {
        Giorno: r.giorno,
        Operaio: r.utente_nome,
        Cliente: r.cliente_nome,
        'Ora Inizio': r.ora_inizio,
        'Ora Fine': r.ora_fine,
        Ore: ore,
        'In Nota': r.nota_lavorazione_id ? 'Sì' : 'No',
        Macchina: r.macchina || '',
        Note: r.note || '',
      };
    });

    // Crea workbook Excel
    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(operaioData);
    const ws2 = XLSX.utils.json_to_sheet(clienteData);
    const ws3 = XLSX.utils.json_to_sheet(dettaglioData);

    XLSX.utils.book_append_sheet(wb, ws1, 'Ore per Operaio');
    XLSX.utils.book_append_sheet(wb, ws2, 'Ore per Cliente');
    XLSX.utils.book_append_sheet(wb, ws3, 'Dettaglio');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    reply.header('Content-Disposition', `attachment; filename="ore_${anno}_${meseStr}.xlsx"`);
    return reply.send(buffer);
  });
}

module.exports = dashboardRoutes;
