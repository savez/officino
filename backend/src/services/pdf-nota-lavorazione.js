const PDFDocument = require('pdfkit');

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
 * Calculates hours between two time strings
 * @param {string} oraInizio - HH:mm
 * @param {string} oraFine - HH:mm
 * @returns {number}
 */
function calcolaOre(oraInizio, oraFine) {
    const [hi, mi] = oraInizio.split(':').map(Number);
    const [hf, mf] = oraFine.split(':').map(Number);
    return Math.round(((hf * 60 + mf - hi * 60 - mi) / 60) * 100) / 100;
}

/**
 * Generates a PDF buffer for a nota di lavorazione.
 * Layout semplice: intestazione cliente, riassunto, opzionalmente dettaglio righe, totale ore.
 *
 * @param {object} nota - Nota with cliente_nome, testo, mostra_dettagli
 * @param {Array} righe - Array of righe with materiali
 * @returns {Promise<Buffer>}
 */
async function generaPdfNotaLavorazione(nota, righe) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                margin: 40,
                info: { Title: `Nota Lavorazione - ${nota.cliente_nome}` },
            });

            const chunks = [];
            doc.on('data', (chunk) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            const pageWidth = doc.page.width - 80;

            // Header - client name
            doc.fontSize(18).font('Helvetica-Bold').text(nota.cliente_nome, { align: 'center' });
            doc.moveDown(0.3);
            doc.fontSize(10).font('Helvetica').text(`Nota di lavorazione del ${formatDate(nota.created_at)}`, { align: 'center' });
            doc.moveDown(1);

            // Separator
            doc.moveTo(40, doc.y).lineTo(40 + pageWidth, doc.y).stroke();
            doc.moveDown(0.5);

            // Summary text
            if (nota.testo) {
                doc.fontSize(11).font('Helvetica');
                doc.text(nota.testo, 40, doc.y, { width: pageWidth });
                doc.moveDown(1);
            }

            let oreTotali = 0;
            for (const r of righe) {
                oreTotali += calcolaOre(r.ora_inizio, r.ora_fine);
            }

            // Detail rows (if mostra_dettagli)
            if (nota.mostra_dettagli && righe.length > 0) {
                doc.moveTo(40, doc.y).lineTo(40 + pageWidth, doc.y).stroke();
                doc.moveDown(0.5);

                doc.fontSize(12).font('Helvetica-Bold').text('Dettaglio lavorazioni');
                doc.moveDown(0.5);

                for (const riga of righe) {
                    const ore = calcolaOre(riga.ora_inizio, riga.ora_fine);

                    if (doc.y > doc.page.height - 120) {
                        doc.addPage();
                    }

                    doc.fontSize(10).font('Helvetica-Bold');
                    doc.text(
                        `${formatDate(riga.giorno)} | ${riga.ora_inizio} - ${riga.ora_fine} (${ore}h) | ${riga.utente_nome}`
                    );

                    doc.fontSize(9).font('Helvetica');
                    if (riga.macchina) {
                        doc.text(`Macchina: ${riga.macchina}`, 50);
                    }
                    if (riga.materiali && riga.materiali.length > 0) {
                        const matList = riga.materiali
                            .map((m) => `${m.nome} (x${m.quantita})`)
                            .join(', ');
                        doc.text(`Materiali: ${matList}`, 50);
                    }
                    if (riga.note) {
                        doc.text(`Note: ${riga.note}`, 50);
                    }

                    doc.moveDown(0.3);
                    doc.moveTo(40, doc.y).lineTo(40 + pageWidth, doc.y).strokeColor('#cccccc').stroke();
                    doc.strokeColor('#000000');
                    doc.moveDown(0.3);
                }
            }

            // Total hours (always visible)
            doc.moveDown(1);
            doc.fontSize(13).font('Helvetica-Bold');
            doc.text(`Totale ore: ${oreTotali}h`, { align: 'right' });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

module.exports = { generaPdfNotaLavorazione };
