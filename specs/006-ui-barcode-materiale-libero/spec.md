# Feature Specification: Icone Pagine, Barcode Scanner e Materiale Libero nei Preventivi

**Feature Branch**: `006-icons-barcode-free-material`
**Created**: 2026-03-10
**Status**: Completed
**Input**: User description: "Ogni titolo pagina deve avere la propria iconcina come i rapportini. Poter inserire sia nei preventivi che nei rapportini il materiale scansionando il barcode. Inserimento sia nei preventivi che nei rapportini del materiale NON a catalogo, materiale libero."

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Icone nei titoli delle pagine (Priority: P2)

Ogni pagina dell'applicazione deve mostrare un'icona Bootstrap Icons nel titolo (tag h2), coerente con l'icona usata nel menu di navigazione. La pagina Rapportini è l'esempio di riferimento con `<i class="bi bi-journal-text me-2"></i>`.

**Why this priority**: Miglioramento puramente visuale che non impatta la funzionalità.

**Independent Test**: Navigare in ogni pagina dell'applicazione e verificare che il titolo h2 contenga un'icona coerente con il menu.

**Acceptance Scenarios**:

1. **Given** l'utente naviga alla pagina Catalogo Prodotti, **When** la pagina si carica, **Then** il titolo mostra l'icona bi-box-seam prima del testo.
2. **Given** l'utente naviga alla pagina Categorie, **When** la pagina si carica, **Then** il titolo mostra l'icona bi-tag.
3. **Given** l'utente naviga alla pagina Clienti, **When** la pagina si carica, **Then** il titolo mostra l'icona bi-people.
4. **Given** l'utente naviga alla pagina Preventivi, **When** la pagina si carica, **Then** il titolo mostra l'icona bi-file-earmark-text.
5. **Given** l'utente naviga alla pagina Utenti, **When** la pagina si carica, **Then** il titolo mostra l'icona bi-person-gear.
6. **Given** l'utente naviga alla pagina Impostazioni, **When** la pagina si carica, **Then** il titolo mostra l'icona bi-gear.
7. **Given** l'utente naviga alla Dashboard, **When** la pagina si carica, **Then** il titolo mostra l'icona bi-speedometer2 e il testo è "Benvenuto in Officino".

---

### User Story 2 — Barcode scanner nel form preventivi (Priority: P1) 🎯 MVP

L'utente vuole poter aggiungere prodotti a un preventivo scansionando il barcode con la fotocamera, come già avviene nel form rapportini tramite il componente MaterialeSelector. Un pulsante con icona barcode deve apparire accanto al campo di ricerca prodotti nel form preventivo.

**Why this priority**: Velocizza significativamente l'inserimento prodotti, specialmente in officina.

**Independent Test**: Aprire il form di creazione preventivo, premere il pulsante barcode, scansionare un codice, verificare che il prodotto venga aggiunto alla lista pezzi del preventivo.

**Acceptance Scenarios**:

1. **Given** l'utente è nel form di creazione/modifica preventivo, **When** guarda la sezione pezzi, **Then** vede un pulsante con icona bi-upc-scan accanto al campo di ricerca.
2. **Given** l'utente preme il pulsante barcode nel form preventivo, **When** scansiona un codice valido, **Then** il prodotto corrispondente viene aggiunto alla lista pezzi con quantità 1 e il prezzo di vendita dal catalogo.
3. **Given** l'utente scansiona un barcode già presente nella lista pezzi, **When** il prodotto viene trovato, **Then** la quantità del prodotto esistente viene incrementata di 1.
4. **Given** l'utente scansiona un barcode non presente nel catalogo, **When** il codice non viene trovato, **Then** si apre il form di inserimento manuale pre-compilato per permettere l'aggiunta come materiale fuori catalogo.

---

### User Story 3 — Materiale libero (fuori catalogo) nei preventivi (Priority: P1) 🎯 MVP

L'utente vuole poter aggiungere al preventivo materiali che non sono presenti nel catalogo prodotti, inserendo manualmente nome, prezzo e quantità. Questo è analogo alla funzionalità "fuori catalogo" già presente nei rapportini, ma applicata ai preventivi. I prodotti fuori catalogo devono essere distinguibili visivamente con un badge.

**Why this priority**: Permette di creare preventivi completi anche per prodotti non ancora catalogati o servizi una tantum.

**Independent Test**: Aprire il form preventivo, aggiungere un materiale manuale con nome e prezzo, salvare il preventivo, verificare che il dettaglio mostri il materiale con badge "fuori cat.".

**Acceptance Scenarios**:

1. **Given** l'utente è nel form preventivo, **When** preme il pulsante "Inserisci manualmente", **Then** appare un form con campi: nome prodotto, prezzo unitario, quantità.
2. **Given** l'utente compila il form manuale con nome e prezzo, **When** preme "Aggiungi", **Then** il materiale viene aggiunto alla lista pezzi del preventivo con flag `fuori_catalogo: true`.
3. **Given** il preventivo contiene materiali fuori catalogo, **When** l'utente visualizza la lista pezzi nel form, **Then** questi materiali mostrano il badge "fuori cat." accanto al nome.
4. **Given** il preventivo contiene materiali fuori catalogo, **When** viene salvato e poi riaperto in modifica, **Then** i materiali fuori catalogo vengono caricati correttamente con nome, prezzo e badge.
5. **Given** l'utente visualizza il dettaglio di un preventivo con materiali fuori catalogo, **When** guarda la tabella pezzi, **Then** i materiali fuori catalogo mostrano il nome manuale e il badge "fuori cat.".
6. **Given** un preventivo con materiali fuori catalogo viene duplicato, **When** il duplicato viene creato, **Then** contiene gli stessi materiali fuori catalogo con nome e prezzo originali.
7. **Given** un preventivo viene esportato in JSON, **When** il file viene scaricato, **Then** contiene i campi `fuori_catalogo` e `nome_manuale` per i materiali liberi.
8. **Given** un file JSON con materiali fuori catalogo viene importato, **When** l'import viene processato, **Then** i materiali fuori catalogo vengono creati correttamente senza cercare corrispondenze nel catalogo.

---

### Edge Cases

- Cosa succede se l'utente aggiunge un materiale manuale senza prezzo? Il prezzo di default è 0, il materiale viene aggiunto normalmente.
- Cosa succede se l'utente aggiunge un materiale manuale con nome vuoto? La validazione frontend impedisce l'aggiunta.
- Cosa succede nel calcolo totale del preventivo con materiali misti (catalogo + liberi)? Il calcolo tratta tutti i materiali allo stesso modo: quantità × prezzo_unitario.
- Cosa succede se si tenta di importare un JSON con materiali fuori catalogo in una versione precedente del sistema? L'import fallirà perché i campi `fuori_catalogo` e `nome_manuale` non esistevano.

## Requirements _(mandatory)_

### Functional Requirements

#### Icone Pagine

- **FR-001**: Ogni pagina DEVE mostrare un'icona Bootstrap Icons nel titolo h2, coerente con l'icona del menu di navigazione.
- **FR-002**: La Dashboard DEVE mostrare il titolo "Benvenuto in Officino" con icona bi-speedometer2.

#### Barcode Scanner Preventivi

- **FR-003**: Il form di creazione/modifica preventivo DEVE includere un pulsante di scansione barcode accanto al campo di ricerca prodotti.
- **FR-004**: La scansione di un barcode valido DEVE aggiungere il prodotto corrispondente alla lista pezzi con quantità 1 e prezzo dal catalogo.
- **FR-005**: La scansione di un barcode di prodotto già presente nella lista DEVE incrementare la quantità di 1.
- **FR-006**: La scansione di un barcode non presente nel catalogo DEVE aprire il form di inserimento manuale.

#### Materiale Libero Preventivi

- **FR-007**: La tabella `preventivo_pezzi` DEVE essere modificata: `pezzo_id` reso nullable, aggiunta colonna `nome_manuale` (string nullable), aggiunta colonna `fuori_catalogo` (boolean default false).
- **FR-008**: Lo schema di validazione backend DEVE accettare `pezzo_id` O `nome_manuale` a seconda del flag `fuori_catalogo`.
- **FR-009**: Il form preventivo DEVE permettere l'inserimento manuale di materiali con nome, prezzo e quantità.
- **FR-010**: I materiali fuori catalogo DEVONO essere visivamente distinguibili con un badge "fuori cat." nella lista pezzi.
- **FR-011**: L'export JSON DEVE includere i campi `fuori_catalogo` e `nome_manuale` per i materiali liberi.
- **FR-012**: L'import JSON DEVE gestire i materiali fuori catalogo senza cercare corrispondenze nel catalogo.
- **FR-013**: La duplicazione di un preventivo DEVE preservare i materiali fuori catalogo con nome e prezzo originali.
- **FR-014**: Il dettaglio preventivo DEVE mostrare il nome manuale e badge "fuori cat." per i materiali liberi.

### Key Entities

- **Preventivo Pezzi (estensione)**: Riga di dettaglio di un preventivo. Attributi estesi: pezzo_id (ora nullable), nome_manuale (string nullable), fuori_catalogo (boolean, default false). Quando fuori_catalogo è true, il prodotto non è referenziato dal catalogo e il nome viene preso da nome_manuale.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Tutte le pagine principali (7 pagine) mostrano un'icona nel titolo h2.
- **SC-002**: Il pulsante barcode è visibile e funzionante nel form preventivo.
- **SC-003**: Un prodotto scansionato da barcode viene aggiunto correttamente al preventivo con prezzo dal catalogo.
- **SC-004**: Un materiale libero può essere aggiunto al preventivo con nome, prezzo e quantità personalizzati.
- **SC-005**: I materiali fuori catalogo sono distinguibili con badge "fuori cat." sia nel form che nel dettaglio.
- **SC-006**: Un preventivo con materiali misti (catalogo + liberi) calcola correttamente imponibile, IVA e totale.
- **SC-007**: L'export/import JSON gestisce correttamente i materiali fuori catalogo.
- **SC-008**: La duplicazione preserva integralmente i materiali fuori catalogo.

## Assumptions

- Il componente BarcodeScannerModal è già disponibile e testato (usato in CatalogoProdottiPage e MaterialeSelector).
- Il servizio `getCatalogoByBarcode` è già implementato nel service catalogo.js.
- Il sistema di calcolo preventivo (`calcolaPreventivo`) non necessita modifiche: tratta tutti i pezzi come `{ quantita, prezzo_unitario }` indipendentemente dalla provenienza.
- I rapportini supportano già sia barcode scanning che materiale libero tramite MaterialeSelector — nessuna modifica necessaria per i rapportini.

## Dependencies

- **Branch 005-catalogo-prodotti**: Tabella `catalogo_prodotti`, servizio `catalogo.js`, endpoint `/api/catalogo`.
- **Componente BarcodeScannerModal**: Già implementato per il catalogo e i rapportini.
- **Tabella preventivo_pezzi**: Deve essere già creata (migration 006 nel branch 001).
