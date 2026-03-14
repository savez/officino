const PDFDocument = require('pdfkit');

/**
 * Formats a number as Italian currency (2 decimals, comma separator)
 * @param {number} n
 * @returns {string}
 */
function formatEuro(n) {
  return Number(n || 0)
    .toFixed(2)
    .replace('.', ',');
}

/**
 * Formats a date string as dd/mm/yyyy
 * @param {string|Date} dateStr
 * @returns {string}
 */
function formatDate(dateStr) {
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Generates a PDF buffer for a preventivo.
 *
 * @param {object} preventivo - Full preventivo with pezzi and client info
 * @param {object} impostazioni - Officina settings (nome, piva, indirizzo, etc.)
 * @returns {Promise<Buffer>}
 */
async function generaPdfPreventivo(preventivo, impostazioni) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `Preventivo ${preventivo.numero}`,
          Author: impostazioni.nome || 'Officina',
        },
      });

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width - 100; // margin left + right

      // === HEADER: Logo + Officina info ===
      let headerY = 50;

      // Logo (if available, stored as base64 data URI in DB)
      if (impostazioni.logo_base64) {
        const base64Data = impostazioni.logo_base64.replace(/^data:image\/\w+;base64,/, '');
        const logoBuffer = Buffer.from(base64Data, 'base64');
        doc.image(logoBuffer, 50, headerY, { width: 80 });
      }

      // Officina details (right-aligned)
      const infoX = 150;
      doc.fontSize(16).font('Helvetica-Bold').text(impostazioni.nome || '', infoX, headerY);
      headerY += 22;
      doc.fontSize(9).font('Helvetica');
      if (impostazioni.partita_iva) {
        doc.text(`P.IVA: ${impostazioni.partita_iva}`, infoX, headerY);
        headerY += 13;
      }
      if (impostazioni.indirizzo) {
        doc.text(impostazioni.indirizzo, infoX, headerY);
        headerY += 13;
      }
      if (impostazioni.telefono) {
        doc.text(`Tel: ${impostazioni.telefono}`, infoX, headerY);
        headerY += 13;
      }
      if (impostazioni.email) {
        doc.text(`Email: ${impostazioni.email}`, infoX, headerY);
        headerY += 13;
      }

      // Separator line
      headerY = Math.max(headerY, 140);
      doc.moveTo(50, headerY).lineTo(50 + pageWidth, headerY).stroke();
      headerY += 15;

      // === PREVENTIVO HEADER ===
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .text(`PREVENTIVO N. ${preventivo.numero}`, 50, headerY);
      headerY += 20;

      doc.fontSize(10).font('Helvetica');
      doc.text(`Data: ${formatDate(preventivo.data)}`, 50, headerY);
      doc.text(`Stato: ${preventivo.stato.toUpperCase()}`, 300, headerY);
      headerY += 20;

      // === CLIENT INFO ===
      doc.fontSize(11).font('Helvetica-Bold').text('Cliente:', 50, headerY);
      headerY += 15;
      doc.fontSize(10).font('Helvetica');
      doc.text(preventivo.cliente_nome || '', 50, headerY);
      headerY += 13;
      if (preventivo.cliente_cf) {
        doc.text(`C.F.: ${preventivo.cliente_cf}`, 50, headerY);
        headerY += 13;
      }
      if (preventivo.cliente_piva) {
        doc.text(`P.IVA: ${preventivo.cliente_piva}`, 50, headerY);
        headerY += 13;
      }

      headerY += 10;

      // === PEZZI TABLE ===
      if (preventivo.pezzi && preventivo.pezzi.length > 0) {
        doc.fontSize(11).font('Helvetica-Bold').text('Dettaglio Pezzi:', 50, headerY);
        headerY += 18;

        // Table header
        const colX = { desc: 50, qty: 320, price: 380, total: 460 };
        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('Descrizione', colX.desc, headerY);
        doc.text('Qtà', colX.qty, headerY);
        doc.text('Prezzo Unit.', colX.price, headerY);
        doc.text('Totale', colX.total, headerY);
        headerY += 14;

        // Separator
        doc.moveTo(50, headerY).lineTo(50 + pageWidth, headerY).stroke();
        headerY += 5;

        // Table rows
        doc.fontSize(9).font('Helvetica');
        for (const pezzo of preventivo.pezzi) {
          // Check page break
          if (headerY > 700) {
            doc.addPage();
            headerY = 50;
          }

          const desc = [pezzo.pezzo_nome, pezzo.pezzo_marca, pezzo.pezzo_modello]
            .filter(Boolean)
            .join(' - ');
          const subtotale = (Number(pezzo.quantita) * Number(pezzo.prezzo_unitario)).toFixed(2);

          doc.text(desc, colX.desc, headerY, { width: 260 });
          doc.text(String(pezzo.quantita), colX.qty, headerY);
          doc.text(`€ ${formatEuro(pezzo.prezzo_unitario)}`, colX.price, headerY);
          doc.text(`€ ${formatEuro(subtotale)}`, colX.total, headerY);

          if (pezzo.note) {
            headerY += 13;
            doc.fontSize(8).font('Helvetica-Oblique').text(`  Nota: ${pezzo.note}`, colX.desc, headerY, { width: 260 });
            doc.fontSize(9).font('Helvetica');
          }

          headerY += 15;
        }

        // Bottom separator
        doc.moveTo(50, headerY).lineTo(50 + pageWidth, headerY).stroke();
        headerY += 10;
      }

      // === MANODOPERA ===
      if (Number(preventivo.manodopera_ore) > 0) {
        if (headerY > 700) {
          doc.addPage();
          headerY = 50;
        }

        doc.fontSize(10).font('Helvetica-Bold').text('Manodopera:', 50, headerY);
        headerY += 15;
        doc.fontSize(9).font('Helvetica');
        doc.text(
          `${preventivo.manodopera_ore} ore x € ${formatEuro(preventivo.manodopera_costo_orario)}/h = € ${formatEuro(preventivo.manodopera_totale)}`,
          50,
          headerY
        );
        headerY += 20;
      }

      // === RIEPILOGO ===
      if (headerY > 650) {
        doc.addPage();
        headerY = 50;
      }

      const riepilogoX = 350;
      const labelX = riepilogoX;
      const valueX = 470;

      headerY += 5;
      doc.moveTo(riepilogoX, headerY).lineTo(50 + pageWidth, headerY).stroke();
      headerY += 10;

      doc.fontSize(10).font('Helvetica');
      doc.text('Imponibile:', labelX, headerY);
      doc.text(`€ ${formatEuro(preventivo.imponibile)}`, valueX, headerY, { align: 'right', width: 75 });
      headerY += 16;

      if (Number(preventivo.sconto_calcolato) > 0) {
        const scontoLabel =
          preventivo.sconto_tipo === 'percentuale'
            ? `Sconto (${preventivo.sconto_valore}%):`
            : 'Sconto:';
        doc.text(scontoLabel, labelX, headerY);
        doc.text(`- € ${formatEuro(preventivo.sconto_calcolato)}`, valueX, headerY, {
          align: 'right',
          width: 75,
        });
        headerY += 16;

        doc.text('Imponibile Netto:', labelX, headerY);
        doc.text(`€ ${formatEuro(preventivo.imponibile_netto)}`, valueX, headerY, {
          align: 'right',
          width: 75,
        });
        headerY += 16;
      }

      doc.text(`IVA (${preventivo.aliquota_iva}%):`, labelX, headerY);
      doc.text(`€ ${formatEuro(preventivo.iva)}`, valueX, headerY, { align: 'right', width: 75 });
      headerY += 16;

      // Total line
      doc.moveTo(riepilogoX, headerY).lineTo(50 + pageWidth, headerY).stroke();
      headerY += 8;
      doc.fontSize(13).font('Helvetica-Bold');
      doc.text('TOTALE:', labelX, headerY);
      doc.text(`€ ${formatEuro(preventivo.totale)}`, valueX, headerY, {
        align: 'right',
        width: 75,
      });
      headerY += 25;

      // === NOTE ===
      if (preventivo.note) {
        if (headerY > 700) {
          doc.addPage();
          headerY = 50;
        }
        doc.fontSize(10).font('Helvetica-Bold').text('Note:', 50, headerY);
        headerY += 15;
        doc.fontSize(9).font('Helvetica').text(preventivo.note, 50, headerY, { width: pageWidth });
      }

      // Finalize
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generaPdfPreventivo, formatEuro, formatDate };
