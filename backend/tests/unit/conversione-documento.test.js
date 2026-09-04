const fs = require('fs');
const path = require('path');
const { generaPdfNotaLavorazione } = require('../../src/services/pdf-nota-lavorazione');

const RIFERIMENTO = path.resolve(__dirname, '../fixtures/documento-prima.json');

/**
 * Estrae il testo visibile da un PDF non compresso.
 *
 * pdfkit scrive le stringhe in esadecimale dentro array TJ. Non conta che la
 * decodifica sia perfetta sui caratteri accentati: conta che sia la stessa con
 * cui e' stato catturato il riferimento, perche' serve a confrontare.
 *
 * @param {Buffer} buffer - il PDF generato
 * @returns {string[]} righe di testo, nell'ordine in cui compaiono
 */
function testoVisibile(buffer) {
  const grezzo = buffer.toString('latin1');
  const righe = [];
  for (const blocco of grezzo.match(/\[[^\]]*\]\s*TJ/g) || []) {
    const testo = (blocco.match(/<([0-9a-fA-F]+)>/g) || [])
      .map((h) => Buffer.from(h.slice(1, -1), 'hex').toString('latin1'))
      .join('');
    if (testo.trim()) righe.push(testo);
  }
  return righe;
}

// La stessa nota che ha prodotto il riferimento, come la migrazione la
// converte: materiali accesi perche' lo erano, manodopera SEMPRE spenta,
// data_riferimento = created_at, divisione unita.
const notaConvertita = {
  cliente_nome: 'Azienda Rossi',
  data_riferimento: '2026-08-31',
  testo: 'Manutenzione ordinaria di fine mese.',
  divisione: 'unita',
  mostra_dettaglio_materiali: true,
  mostra_dettaglio_manodopera: false,
  totale_materiali_override: null,
  totale_manodopera_override: null,
  totale_override: null,
};

const rapportini = [
  {
    id: 1,
    macchina: 'Trattore JD 6130R',
    utente_nome: 'Mario Bianchi',
    lavorazioni: [
      {
        id: 1,
        giorno: '2026-08-28',
        ore: 4,
        note: 'Sostituito filtro olio',
        costo_orario_applicato: 30,
        materiali: [
          { id: 1, nome: 'Filtro olio', quantita: 2, fuori_catalogo: false, prezzo_unitario: 12.5 },
        ],
      },
      { id: 2, giorno: '2026-08-29', ore: 2.5, note: null, costo_orario_applicato: 30, materiali: [] },
    ],
  },
  {
    id: 2,
    macchina: 'Mietitrebbia CX',
    utente_nome: 'Luigi Verdi',
    lavorazioni: [
      {
        id: 3,
        giorno: '2026-08-30',
        ore: 6,
        note: 'Controllo impianto idraulico',
        costo_orario_applicato: 35,
        materiali: [
          { id: 2, nome: 'Guarnizione', quantita: 3, fuori_catalogo: true, prezzo_unitario: 4 },
        ],
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// FR-036 non chiede soltanto che le note gia' emesse restino stampabili: chiede
// che il documento NON CAMBI ASPETTO. Una ristampa non deve dire al cliente
// qualcosa che l'originale non diceva.
//
// `documento-prima.json` e' il testo del PDF catturato PRIMA della modifica.
// Questo confronto ha gia' trovato un difetto vero: il blocco dei totali
// stampava l'importo della manodopera anche col dettaglio spento, quindi una
// nota convertita l'avrebbe rivelato. Senza il riferimento, "non e' cambiato"
// sarebbe rimasta un'opinione.
describe('una nota convertita dal modello precedente non cambia aspetto', () => {
  let prima;
  let dopo;

  beforeAll(async () => {
    prima = JSON.parse(fs.readFileSync(RIFERIMENTO, 'utf8')).join(' | ');
    dopo = testoVisibile(await generaPdfNotaLavorazione(notaConvertita, rapportini)).join(' | ');
  });

  it('il riferimento esiste e non e vuoto', () => {
    // Senza questo controllo, un file mancante o svuotato renderebbe tutti gli
    // altri verdi confrontando stringhe vuote.
    expect(prima.length).toBeGreaterThan(100);
    expect(prima).toContain('Azienda Rossi');
  });

  it('la data resta quella che il documento vecchio riportava', () => {
    expect(prima).toContain('31/08/2026');
    expect(dopo).toContain('31/08/2026');
  });

  it('il cliente resta nel titolo', () => {
    expect(dopo).toContain('Azienda Rossi');
  });

  it('il riassunto resta', () => {
    expect(dopo).toContain('Manutenzione ordinaria di fine mese.');
  });

  it('i materiali restano visibili, come lo erano', () => {
    expect(dopo).toContain('Filtro olio');
    expect(dopo).toContain('Guarnizione');
  });

  it('il totale complessivo e identico', () => {
    expect(prima).toContain('442,00');
    expect(dopo).toContain('442,00');
  });

  // È il difetto che questo confronto ha trovato: la migrazione spegneva la
  // manodopera, ma il blocco dei totali la stampava lo stesso.
  it("la MANODOPERA non compare, come nell'originale", () => {
    expect(prima).not.toMatch(/manodopera/i);
    expect(dopo).not.toMatch(/manodopera/i);
  });

  it('nessuna tariffa oraria, come prima', () => {
    expect(dopo).not.toMatch(/€\/h|tariffa/i);
  });

  // Lo spazio per la firma era l'unica aggiunta della feature 022. Ritirato su
  // richiesta il 2026-09-04, il documento torna a coincidere con il precedente
  // anche su questo punto: nessuna delle due versioni lo riporta.
  it('nessuno spazio per la firma, in nessuna delle due versioni', () => {
    expect(prima).not.toMatch(/firma/i);
    expect(dopo).not.toMatch(/firma/i);
  });
});
