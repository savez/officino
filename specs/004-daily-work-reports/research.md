# Research: Rapportini Giornalieri e Note di Lavorazione

**Branch**: `004-daily-work-reports` | **Date**: 2026-03-09

## R1: Gestione stock transazionale (decremento/ripristino materiali)

**Decision**: Usare transazioni Knex per decremento/ripristino atomico dello stock quando si salva/cancella una riga di rapportino con materiali da magazzino.

**Rationale**: Il progetto usa già transazioni Knex per operazioni multi-step (es. approvazione preventivi con scalatura stock in `preventivi.js`). Lo stesso pattern garantisce consistenza tra `righe_rapportino`, `materiali_rapportino` e `pezzi_magazzino.quantita`.

**Alternatives considered**:
- Decremento senza transazione: rischio di inconsistenza se il salvataggio fallisce a metà
- Event-driven (queue): overengineering per il volume atteso

## R2: Scansione barcode per materiali nel rapportino

**Decision**: Riutilizzare il componente `BarcodeScannerModal.vue` già esistente e il lookup barcode via API `/api/magazzino/barcode/:code` già implementato.

**Rationale**: Il componente html5-qrcode è già integrato e funzionante per il magazzino. Basta riutilizzarlo nel `MaterialeSelector.vue` con la stessa logica di lookup.

**Alternatives considered**:
- Nuovo componente scanner dedicato: duplicazione inutile
- Libreria scanner diversa: html5-qrcode è già nella constitution

## R3: Ricerca materiali in tempo reale

**Decision**: Usare l'endpoint esistente `GET /api/magazzino?search=...` con debounce lato frontend (300ms).

**Rationale**: L'API di ricerca magazzino supporta già il parametro `search` con `whereILike` case-insensitive. Il frontend deve solo aggiungere un input con debounce e dropdown risultati.

**Alternatives considered**:
- Endpoint dedicato `/api/magazzino/search`: non necessario, l'endpoint esistente è sufficiente
- Autocomplete con caricamento completo lato client: non scalabile se il catalogo cresce

## R4: Prodotti fuori magazzino

**Decision**: Memorizzare i prodotti fuori magazzino direttamente nella tabella `materiali_rapportino` con `pezzo_id = NULL` e campi `nome_manuale` e `quantita`. Flag `fuori_magazzino = true`.

**Rationale**: Approccio semplice che non inquina la tabella `pezzi_magazzino` con prodotti non gestiti. Il rapportino mantiene l'informazione senza side-effect sul magazzino.

**Alternatives considered**:
- Creare il prodotto in `pezzi_magazzino` con flag speciale: inquina il catalogo
- Tabella separata `prodotti_fuori_magazzino`: complessità non necessaria

## R5: Stampa PDF layout semplice

**Decision**: Usare pdfkit (già in uso per preventivi) con layout minimale: intestazione cliente/giornata, tabella righe, totale ore. Nessun logo o intestazione aziendale.

**Rationale**: Il progetto ha già `pdf-preventivo.js` come reference implementation. La stampa rapportini e note usa lo stesso approccio ma con layout più semplice.

**Alternatives considered**:
- HTML-to-PDF (puppeteer): richiede browser headless, violazione constitution (pdfkit scelto)
- Export CSV/Excel: non richiesto nella spec, xlsx già disponibile se servisse in futuro

## R6: Vincolo una nota per cliente

**Decision**: La tabella `note_lavorazione` avrà un campo `cliente_id` obbligatorio. L'API di creazione nota validerà che tutte le righe selezionate appartengano allo stesso cliente.

**Rationale**: Semplifica il modello dati e la stampa. La nota è un documento per-cliente come chiarito nella fase di clarify.

**Alternatives considered**:
- Nota senza vincolo cliente, derivato dalle righe: rischio inconsistenza se le righe cambiano

## R7: Protezione righe gestite

**Decision**: Le righe marcate come "gestite" (`nota_lavorazione_id IS NOT NULL`) non possono essere cancellate dall'operaio. Solo l'admin può rimuoverle (direttamente o tramite modifica nota).

**Rationale**: Protegge l'integrità delle note di lavorazione già create dall'amministratore. Chiarito in fase di clarify.

**Alternatives considered**:
- Soft delete con approvazione: troppo complesso per il contesto
- Nessuna protezione: rischio di alterare note già validate
