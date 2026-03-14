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
 * Generates a PDF buffer for rapportini report.
 * Layout semplice: intestazione cliente/giornata, tabella righe, totale ore.
 *
 * @param {string} intestazione - Header text (client name or date)
 * @param {Array} righe - Array of righe with materiali
 * @returns {Promise<Buffer>}
 */
async function generaPdfRapportino(intestazione, righe) {
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

            // Header
            doc.fontSize(18).font('Helvetica-Bold').text(intestazione, { align: 'center' });
            doc.moveDown(0.5);
            doc.fontSize(10).font('Helvetica').text(`Stampato il ${formatDate(new Date())}`, { align: 'center' });
            doc.moveDown(1);

            // Separator
            doc.moveTo(40, doc.y).lineTo(40 + pageWidth, doc.y).stroke();
            doc.moveDown(0.5);

            let oreTotali = 0;

            for (const riga of righe) {
                const ore = calcolaOre(riga.ora_inizio, riga.ora_fine);
                oreTotali += ore;

                // Check if we need a new page
                if (doc.y > doc.page.height - 120) {
                    doc.addPage();
                }

                // Row header
                doc.fontSize(11).font('Helvetica-Bold');
                doc.text(
                    `${formatDate(riga.giorno)} | ${riga.ora_inizio} - ${riga.ora_fine} (${ore}h) | ${riga.utente_nome}`,
                    40
                );

                doc.fontSize(9).font('Helvetica');

                if (riga.cliente_nome) {
                    doc.text(`Cliente: ${riga.cliente_nome}`, 50);
                }
                if (riga.macchina) {
                    doc.text(`Macchina: ${riga.macchina}`, 50);
                }
                if (riga.materiali && riga.materiali.length > 0) {
                    const matList = riga.materiali
                        .map((m) => `${m.nome} (x${m.quantita})${m.fuori_catalogo ? ' [fuori cat.]' : ''}`)
                        .join(', ');
                    doc.text(`Materiali: ${matList}`, 50);
                }
                if (riga.note) {
                    doc.text(`Note: ${riga.note}`, 50);
                }

                doc.moveDown(0.5);
                doc.moveTo(40, doc.y).lineTo(40 + pageWidth, doc.y).strokeColor('#cccccc').stroke();
                doc.strokeColor('#000000');
                doc.moveDown(0.3);
            }

            // Total
            doc.moveDown(1);
            doc.fontSize(13).font('Helvetica-Bold');
            doc.text(`Totale ore: ${oreTotali}h`, { align: 'right' });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

module.exports = { generaPdfRapportino };
