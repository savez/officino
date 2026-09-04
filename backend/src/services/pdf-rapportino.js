const PDFDocument = require('pdfkit');

/**
 * Formatta una data come gg/mm/aaaa.
 * @param {string|Date} valore
 * @returns {string}
 */
function formatDate(valore) {
  const d = new Date(valore);
  const gg = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${gg}/${mm}/${d.getFullYear()}`;
}

const round2 = (v) => Math.round(Number(v || 0) * 100) / 100;

/**
 * Descrive il periodo coperto da un rapportino.
 *
 * Un rapportino copre più giorni: indicarne uno solo sarebbe fuorviante, e
 * ometterli entrambi renderebbe il foglio impossibile da collocare nel tempo.
 * @param {object[]} lavorazioni - lavorazioni ordinate per giorno
 * @returns {string} periodo leggibile, oppure stringa vuota
 */
function periodoLeggibile(lavorazioni) {
  const giorni = (lavorazioni || []).map((l) => l.giorno).filter(Boolean);
  if (giorni.length === 0) return '';
  const primo = formatDate(giorni[0]);
  const ultimo = formatDate(giorni[giorni.length - 1]);
  return primo === ultimo ? primo : `${primo} — ${ultimo}`;
}

/**
 * Genera il PDF operativo dei rapportini.
 *
 * Documento di officina: riporta ore, macchinario e materiali, e NON espone
 * alcun dato economico. È un'invariante già in vigore prima di questa modifica.
 * @param {string} intestazione - testo dell'intestazione (cliente e/o periodo)
 * @param {object[]} rapportini - rapportini con le loro lavorazioni
 * @returns {Promise<Buffer>}
 */
async function generaPdfRapportino(intestazione, rapportini) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        info: { Title: `Rapportino - ${intestazione}` },
      });

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width - 80;

      doc.fontSize(18).font('Helvetica-Bold').text(intestazione, { align: 'center' });
      doc.moveDown(0.5);
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(`Stampato il ${formatDate(new Date())}`, { align: 'center' });
      doc.moveDown(1);

      doc.moveTo(40, doc.y).lineTo(40 + pageWidth, doc.y).stroke();
      doc.moveDown(0.5);

      let oreTotali = 0;

      for (const r of rapportini) {
        const lavorazioni = r.lavorazioni || [];
        const oreRapportino = round2(lavorazioni.reduce((acc, l) => acc + Number(l.ore || 0), 0));
        oreTotali += oreRapportino;

        if (doc.y > doc.page.height - 150) doc.addPage();

        // Il macchinario compare una volta per intervento, non ripetuto su ogni
        // riga: è ciò che il rapportino identifica.
        doc.fontSize(12).font('Helvetica-Bold');
        doc.text(r.macchina || 'Macchinario non indicato', 40);

        doc.fontSize(9).font('Helvetica');
        const sottotitolo = [r.cliente_nome, r.utente_nome, periodoLeggibile(lavorazioni)]
          .filter(Boolean)
          .join(' | ');
        if (sottotitolo) doc.text(sottotitolo, 50);
        doc.text(`Ore totali: ${oreRapportino}h`, 50);

        for (const l of lavorazioni) {
          if (doc.y > doc.page.height - 110) doc.addPage();

          doc.moveDown(0.3);
          doc.fontSize(10).font('Helvetica-Bold');
          doc.text(`${formatDate(l.giorno)} — ${round2(l.ore)}h`, 55);

          doc.fontSize(9).font('Helvetica');
          if (l.materiali && l.materiali.length > 0) {
            const elenco = l.materiali
              .map((m) => `${m.nome} (x${m.quantita})${m.fuori_catalogo ? ' [fuori cat.]' : ''}`)
              .join(', ');
            doc.text(`Materiali: ${elenco}`, 60);
          }
          if (l.note) doc.text(`Note: ${l.note}`, 60);
        }

        doc.moveDown(0.5);
        doc.moveTo(40, doc.y).lineTo(40 + pageWidth, doc.y).strokeColor('#cccccc').stroke();
        doc.strokeColor('#000000');
        doc.moveDown(0.3);
      }

      doc.moveDown(1);
      doc.fontSize(13).font('Helvetica-Bold');
      doc.text(`Totale ore: ${round2(oreTotali)}h`, { align: 'right' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generaPdfRapportino };
