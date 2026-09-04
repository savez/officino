const PDFDocument = require('pdfkit');
const { calcolaTotaliLavorazione, calcolaTotaliNota } = require('./calcolo-totali-nota');
const { dettagliAmmessi } = require('./coerenza-nota');

/**
 * Formatta una data come gg/mm/aaaa.
 * @param {string|Date} valore - data da formattare
 * @returns {string}
 */
function formatDate(valore) {
  const d = new Date(valore);
  const gg = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${gg}/${mm}/${d.getFullYear()}`;
}

/**
 * Formatta un importo in euro all'italiana.
 * @param {number} importo - valore in euro
 * @returns {string}
 */
function fmtEuro(importo) {
  const v = Math.round(Number(importo || 0) * 100) / 100;
  return `${v.toFixed(2).replace('.', ',')} €`;
}

const round2 = (v) => Math.round(Number(v || 0) * 100) / 100;

/**
 * Raggruppa i rapportini in sezioni.
 *
 * Con `divisione = per_macchinario` una sezione per macchinario; altrimenti una
 * sola. Unione e divisione diventano cosi' lo stesso codice con un
 * raggruppamento diverso, invece di due percorsi di stampa da tenere allineati.
 *
 * Il raggruppamento e' per MACCHINARIO e non per rapportino: due rapportini
 * sullo stesso macchinario confluiscono nella stessa sezione.
 *
 * @param {object[]} rapportini - rapportini con le loro lavorazioni
 * @param {string} divisione - 'unita' oppure 'per_macchinario'
 * @returns {Array<{titolo: string|null, lavorazioni: object[]}>}
 */
function raggruppaInSezioni(rapportini, divisione) {
  const elenco = rapportini || [];

  if (divisione !== 'per_macchinario') {
    return [
      {
        titolo: null,
        lavorazioni: elenco.flatMap((r) =>
          (r.lavorazioni || []).map((l) => ({ ...l, macchina: r.macchina })),
        ),
      },
    ];
  }

  const perMacchina = new Map();
  for (const r of elenco) {
    const chiave = r.macchina || 'Macchinario non indicato';
    if (!perMacchina.has(chiave)) perMacchina.set(chiave, []);
    for (const l of r.lavorazioni || []) {
      perMacchina.get(chiave).push({ ...l, macchina: r.macchina });
    }
  }
  return [...perMacchina.entries()].map(([titolo, lavorazioni]) => ({ titolo, lavorazioni }));
}

/**
 * Costruisce il modello del documento: cosa conterra', senza disegnarlo.
 *
 * Espone tre indicatori che presidiano un'invariante:
 *
 * - `contiene_manodopera` puo' ora essere VERO — e' il cambiamento di questa
 *   revisione, e ribalta in parte una regola precedente;
 * - `contiene_costo_orario` resta SEMPRE falso;
 * - `contiene_importo_per_riga_ore` resta SEMPRE falso.
 *
 * Va detto cosa questo ottiene e cosa no. Mostrando tutte le ore e un importo
 * complessivo della manodopera, la tariffa MEDIA resta ricavabile con una
 * divisione. Il divieto dell'importo per riga riduce l'attrito — non offre il
 * numero gia' pronto, non invita la discussione riga per riga — ma non rende la
 * tariffa indeducibile. Nessuno costruisca sopra questi indicatori una garanzia
 * che non c'e'.
 *
 * @param {object} nota - la nota, coi suoi interruttori e i totali imposti
 * @param {object[]} rapportini - rapportini con lavorazioni e materiali
 * @returns {object} il modello del documento
 */
function buildPdfModel(nota, rapportini) {
  const override = {
    materiali:
      nota.totale_materiali_override === undefined ? null : nota.totale_materiali_override,
    manodopera:
      nota.totale_manodopera_override === undefined ? null : nota.totale_manodopera_override,
    complessivo: nota.totale_override === undefined ? null : nota.totale_override,
  };

  // La stessa regola della validazione: un totale imposto spegne il dettaglio
  // corrispondente. Applicarla anche qui evita che un documento stampi cio' che
  // l'API avrebbe respinto.
  const ammessi = dettagliAmmessi(override);
  const mostraMateriali = Boolean(nota.mostra_dettaglio_materiali) && ammessi.materiali;
  const mostraManodopera = Boolean(nota.mostra_dettaglio_manodopera) && ammessi.manodopera;

  const divisione = nota.divisione === 'per_macchinario' ? 'per_macchinario' : 'unita';
  const gruppi = raggruppaInSezioni(rapportini, divisione);

  const sezioni = gruppi.map((g) => {
    const materiali = [];
    const oreRighe = [];
    let subtotaleMateriali = 0;
    let costoManodopera = 0;

    for (const l of g.lavorazioni) {
      const t = calcolaTotaliLavorazione({
        ore: Number(l.ore || 0),
        costo_orario_applicato: Number(l.costo_orario_applicato || 0),
        materiali: (l.materiali || []).map((m) => ({
          prezzo_unitario: Number(m.prezzo_unitario || 0),
          quantita: Number(m.quantita || 0),
        })),
      });
      subtotaleMateriali += t.subtotale_materiali;
      costoManodopera += t.costo_manodopera;

      for (const m of l.materiali || []) {
        materiali.push({
          nome: m.nome,
          quantita: m.quantita,
          fuori_catalogo: !!m.fuori_catalogo,
          prezzo_unitario: round2(m.prezzo_unitario),
          totale_materiale: round2(Number(m.prezzo_unitario || 0) * Number(m.quantita || 0)),
        });
      }

      // Una riga per lavorazione: giorno, macchinario e ore. NESSUN importo
      // accanto alle ore, e nessuna tariffa.
      oreRighe.push({
        giorno: l.giorno,
        // Dividendo per macchinario, il macchinario e' gia' dato dalla sezione
        // e non si ripete sulla riga.
        macchina: divisione === 'per_macchinario' ? null : l.macchina || null,
        ore: round2(l.ore),
      });
    }

    return {
      titolo: g.titolo,
      materiali,
      ore_righe: oreRighe,
      ore_totali: round2(oreRighe.reduce((a, r) => a + r.ore, 0)),
      // I totali di sezione compaiono SOLO per le voci non imposte: un totale
      // imposto e' della nota e vive in fondo. Ripartirlo fra i macchinari
      // significherebbe inventare una suddivisione che nessuno ha deciso.
      totale_materiali:
        ammessi.materiali && gruppi.length > 1 ? round2(subtotaleMateriali) : null,
      totale_manodopera:
        ammessi.manodopera && gruppi.length > 1 ? round2(costoManodopera) : null,
    };
  });

  const lavorazioniPiatte = (rapportini || []).flatMap((r) => r.lavorazioni || []);
  const totali = calcolaTotaliNota(
    lavorazioniPiatte.map((l) => ({
      ore: Number(l.ore || 0),
      costo_orario_applicato: Number(l.costo_orario_applicato || 0),
      materiali: (l.materiali || []).map((m) => ({
        prezzo_unitario: Number(m.prezzo_unitario || 0),
        quantita: Number(m.quantita || 0),
      })),
    })),
    override,
  );

  return {
    header: {
      cliente_nome: nota.cliente_nome,
      data_riferimento: nota.data_riferimento,
    },
    testo: nota.testo || null,
    divisione,
    mostra_dettaglio_materiali: mostraMateriali,
    mostra_dettaglio_manodopera: mostraManodopera,
    sezioni,
    totali,
    ore_totali: round2(sezioni.reduce((a, s) => a + s.ore_totali, 0)),
    // Un totale di voce si mostra se il suo dettaglio e' visibile oppure se e'
    // stato imposto: in quel caso e' esattamente la cifra che si vuole esporre.
    mostra_totale_materiali: mostraMateriali || !ammessi.materiali,
    mostra_totale_manodopera: mostraManodopera || !ammessi.manodopera,
    contiene_manodopera: mostraManodopera,
    contiene_costo_orario: false,
    contiene_importo_per_riga_ore: false,
  };
}

/**
 * Disegna una sezione: i suoi materiali, le sue ore e i totali che le spettano.
 *
 * @param {import('pdfkit')} doc - documento in costruzione
 * @param {object} sezione - sezione del modello
 * @param {object} modello - il modello completo, per gli interruttori
 * @param {number} pageWidth - larghezza utile della pagina
 * @returns {void}
 */
function renderSezione(doc, sezione, modello, pageWidth) {
  if (doc.y > doc.page.height - 160) doc.addPage();

  if (sezione.titolo) {
    doc.fontSize(12).font('Helvetica-Bold').text(sezione.titolo);
    doc.moveDown(0.2);
  }

  // Una sezione priva di contenuto va omessa, non stampata vuota.
  if (modello.mostra_dettaglio_materiali && sezione.materiali.length > 0) {
    doc.fontSize(10).font('Helvetica-Bold').text('Materiali', 50);
    doc.fontSize(9).font('Helvetica');
    for (const m of sezione.materiali) {
      const etichetta = m.fuori_catalogo ? `${m.nome} [fuori cat.]` : m.nome;
      doc.text(
        `  • ${etichetta} — ${m.quantita} × ${fmtEuro(m.prezzo_unitario)} = ${fmtEuro(m.totale_materiale)}`,
        55,
      );
    }
    if (sezione.totale_materiali !== null) {
      doc
        .font('Helvetica-Bold')
        .text(`Totale materiali: ${fmtEuro(sezione.totale_materiali)}`, { align: 'right' });
      doc.font('Helvetica');
    }
    doc.moveDown(0.3);
  }

  if (modello.mostra_dettaglio_manodopera && sezione.ore_righe.length > 0) {
    if (doc.y > doc.page.height - 140) doc.addPage();
    doc.fontSize(10).font('Helvetica-Bold').text('Manodopera', 50);
    doc.fontSize(9).font('Helvetica');
    for (const r of sezione.ore_righe) {
      // Giorno, macchinario e ore. Nessun importo: accostarlo alle ore
      // renderebbe la tariffa leggibile riga per riga.
      const parti = [formatDate(r.giorno), r.macchina, `${r.ore}h`].filter(Boolean);
      doc.text(`  • ${parti.join(' — ')}`, 55);
    }
    if (sezione.totale_manodopera !== null) {
      doc
        .font('Helvetica-Bold')
        .text(`Totale manodopera: ${fmtEuro(sezione.totale_manodopera)}`, { align: 'right' });
      doc.font('Helvetica');
    }
    doc.moveDown(0.3);
  }

  doc.moveTo(40, doc.y).strokeColor('#cccccc').lineTo(40 + pageWidth, doc.y).stroke();
  doc.strokeColor('#000000');
  doc.moveDown(0.3);
}

/**
 * Genera il PDF di una nota di lavorazione.
 *
 * @param {object} nota - dati della nota, compresi interruttori e totali imposti
 * @param {object[]} rapportini - rapportini con lavorazioni e materiali
 * @returns {Promise<Buffer>}
 */
async function generaPdfNotaLavorazione(nota, rapportini) {
  return new Promise((resolve, reject) => {
    try {
      const modello = buildPdfModel(nota, rapportini);
      const { totali, sezioni } = modello;

      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        // Compressione disattivata: mantiene il PDF ispezionabile per i
        // controlli automatici. Su documenti di questa dimensione il costo e'
        // trascurabile.
        compress: false,
        info: { Title: `Nota Lavorazione - ${nota.cliente_nome}` },
      });

      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width - 80;

      // Intestazione: dice a cosa si riferisce il foglio che si ha in mano.
      doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .text(
          `Nota di lavorazione per ${nota.cliente_nome} del ${formatDate(nota.data_riferimento)}`,
          { align: 'center' },
        );
      doc.moveDown(1);
      doc.moveTo(40, doc.y).lineTo(40 + pageWidth, doc.y).stroke();
      doc.moveDown(0.5);

      if (modello.testo) {
        doc.fontSize(11).font('Helvetica');
        doc.text(modello.testo, 40, doc.y, { width: pageWidth });
        doc.moveDown(1);
        doc.moveTo(40, doc.y).lineTo(40 + pageWidth, doc.y).stroke();
        doc.moveDown(0.5);
      }

      const qualcosaDaMostrare =
        modello.mostra_dettaglio_materiali || modello.mostra_dettaglio_manodopera;
      if (qualcosaDaMostrare) {
        for (const sezione of sezioni) {
          renderSezione(doc, sezione, modello, pageWidth);
        }
      }

      // Totali della nota. Quelli imposti compaiono una volta sola, qui.
      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica');
      doc.text(`Totale ore: ${modello.ore_totali}h`, { align: 'right' });

      // Un totale di voce compare solo se quella voce e' esposta: o perche' il
      // suo dettaglio e' mostrato, o perche' e' stato imposto a mano ed e'
      // proprio la cifra che si vuole far vedere.
      //
      // Senza questa condizione una nota convertita dal modello precedente
      // mostrerebbe l'importo della manodopera, che nel documento originale non
      // compariva mai: una ristampa direbbe al cliente qualcosa che l'originale
      // non diceva.
      if (modello.mostra_totale_materiali) {
        doc.text(`Totale materiali: ${fmtEuro(totali.totale_materiali)}`, { align: 'right' });
      }
      if (modello.mostra_totale_manodopera) {
        doc.text(`Totale manodopera: ${fmtEuro(totali.totale_manodopera)}`, { align: 'right' });
      }

      doc.moveDown(0.3);
      doc.fontSize(13).font('Helvetica-Bold');
      doc.text(`TOTALE: ${fmtEuro(totali.totale_finale)}`, { align: 'right' });

      // Nessuno spazio per la firma: il documento si chiude sul totale.
      // La riga per la controfirma era stata valutata e scartata.
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generaPdfNotaLavorazione, buildPdfModel };
