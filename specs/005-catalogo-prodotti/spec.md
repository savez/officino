# Feature Specification: Rinomina Magazzino in Catalogo Prodotti e Rimozione Gestione Stock

**Feature Branch**: `005-catalogo-prodotti`
**Created**: 2026-03-10
**Status**: Completed
**Input**: User description: "Il magazzino deve cambiare funzione. Rinominare magazzino in catalogo prodotti. Rimuovere dalla tabella dell'elenco prodotti la quantità. Rimuovere riferimento della quantità anche sul preventivo e sui rapportini. Togliere nei filtri le soglie."

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Catalogo prodotti al posto del magazzino (Priority: P1) 🎯 MVP

L'utente vuole navigare e gestire un catalogo di prodotti senza il concetto di giacenza/stock. La voce di menu, il titolo della pagina, le etichette e i percorsi URL devono tutti riflettere il nome "Catalogo Prodotti" invece di "Magazzino". Il form di creazione/modifica prodotto non deve più mostrare i campi quantità e soglia avviso.

**Why this priority**: È il cambiamento strutturale principale che ridefinisce la funzione dell'entità da magazzino con stock a catalogo prodotti.

**Independent Test**: Accedere all'applicazione, verificare che il menu mostri "Catalogo Prodotti", navigare alla pagina, verificare che la tabella non abbia la colonna "Qtà", aprire il form di creazione e verificare che non ci siano campi quantità e soglia avviso.

**Acceptance Scenarios**:

1. **Given** l'utente è autenticato, **When** guarda il menu di navigazione, **Then** vede "Catalogo Prodotti" con icona bi-box-seam al posto di "Magazzino".
2. **Given** l'utente naviga alla pagina catalogo, **When** visualizza la tabella prodotti, **Then** non esiste la colonna "Qtà" e le righe non hanno stile rosso per sotto-soglia.
3. **Given** l'utente apre il form di creazione prodotto, **When** compila i campi, **Then** non sono presenti i campi "Quantità" e "Soglia Avviso".
4. **Given** l'utente modifica un prodotto esistente, **When** salva le modifiche, **Then** il sistema non invia né quantità né soglia_avviso al backend.
5. **Given** l'utente accede all'URL /catalogo, **When** la pagina si carica, **Then** viene mostrata la pagina Catalogo Prodotti.

---

### User Story 2 — Rimozione filtro sotto-soglia e alert dashboard (Priority: P1)

Il filtro "Solo sotto soglia" nella pagina catalogo e la card "Pezzi sotto soglia" nella dashboard devono essere rimossi, poiché senza il concetto di quantità non ha senso monitorare le soglie.

**Why this priority**: Senza quantità e soglia, queste funzionalità diventano incoerenti e mostrerebbero errori.

**Independent Test**: Verificare che la pagina catalogo non abbia il checkbox "Solo sotto soglia". Verificare che la dashboard mostri solo "Prodotti in catalogo" senza la card rossa/verde "sotto soglia".

**Acceptance Scenarios**:

1. **Given** l'utente è nella pagina Catalogo Prodotti, **When** guarda i filtri, **Then** non esiste il checkbox "Solo sotto soglia".
2. **Given** l'utente è nella Dashboard, **When** guarda le card statistiche, **Then** vede "Prodotti in catalogo" ma non "Pezzi sotto soglia".
3. **Given** l'utente esporta il catalogo in Excel, **When** apre il file, **Then** non ci sono le colonne "Quantità" e "Soglia Avviso".

---

### User Story 3 — Rimozione scalatura stock all'approvazione preventivo (Priority: P1)

Quando un preventivo viene approvato, il sistema non deve più verificare la disponibilità di stock né decrementare le quantità dei prodotti. Il messaggio di warning sulla scalatura non deve apparire.

**Why this priority**: La scalatura stock è incompatibile con il nuovo modello senza giacenza.

**Independent Test**: Creare un preventivo con prodotti, approvarlo e verificare che l'approvazione avvenga senza warning di stock e senza errori 409.

**Acceptance Scenarios**:

1. **Given** un preventivo è in stato bozza, **When** l'utente lo approva, **Then** il messaggio di conferma non menziona "scaricherà le quantità dal magazzino".
2. **Given** un preventivo viene approvato, **When** il backend processa la transizione, **Then** non viene eseguita nessuna query di decremento sulla tabella catalogo_prodotti.
3. **Given** un preventivo con prodotti viene approvato, **When** l'operazione completa, **Then** non viene generato nessun log di tipo "scalatura".

---

### User Story 4 — Rimozione gestione stock nei rapportini (Priority: P1)

Quando si crea o cancella una riga rapportino con materiali, il sistema non deve più verificare la disponibilità di stock, né decrementare/incrementare le quantità dei prodotti.

**Why this priority**: Coerenza con la rimozione del concetto di stock.

**Independent Test**: Creare una riga rapportino con materiali da catalogo, verificare che non ci siano errori di "stock insufficiente". Cancellare la riga e verificare che non venga eseguito alcun ripristino stock.

**Acceptance Scenarios**:

1. **Given** l'utente crea una riga rapportino con materiali da catalogo, **When** conferma l'inserimento, **Then** non viene verificata nessuna disponibilità stock e il materiale viene aggiunto normalmente.
2. **Given** l'utente cancella una riga rapportino con materiali, **When** la riga viene eliminata, **Then** non viene eseguito nessun incremento stock nella tabella catalogo_prodotti.

---

### User Story 5 — Rinomina "fuori magazzino" in "fuori catalogo" (Priority: P2)

I badge e le etichette che indicavano "fuori magazzino" o "fuori mag." devono essere aggiornati in "fuori catalogo" / "fuori cat." per coerenza con il nuovo naming.

**Why this priority**: Importante per la coerenza dell'interfaccia ma non critico per il funzionamento.

**Independent Test**: Creare una riga rapportino con un materiale manuale, verificare che il badge mostri "fuori cat.".

**Acceptance Scenarios**:

1. **Given** un rapportino contiene materiale inserito manualmente, **When** l'utente visualizza i materiali, **Then** il badge mostra "fuori cat." invece di "fuori mag.".
2. **Given** il PDF del rapportino viene generato, **When** contiene materiali manuali, **Then** l'etichetta è "[fuori cat.]".

---

### User Story 6 — Disabilitazione log management (Priority: P2)

Il sistema di log management deve essere disabilitato: il link "Log" nel menu deve essere commentato (non cancellato), il checkbox "Attiva registrazione log modifiche" nelle impostazioni deve essere commentato, e il servizio di logging deve restituire immediatamente senza scrivere log.

**Why this priority**: Funzionalità temporaneamente sospesa, il codice resta per eventuale riattivazione futura.

**Independent Test**: Verificare che il menu non mostri "Log". Verificare che le impostazioni non mostrino il checkbox log. Verificare che le operazioni CRUD non generino voci di log.

**Acceptance Scenarios**:

1. **Given** un utente admin è autenticato, **When** guarda il menu di navigazione, **Then** la voce "Log" non è visibile.
2. **Given** un admin è nella pagina Impostazioni, **When** guarda il form, **Then** non è presente il checkbox "Attiva registrazione log modifiche".
3. **Given** qualsiasi operazione viene eseguita (creazione, modifica, eliminazione), **When** il backend chiama logModifica, **Then** la funzione ritorna immediatamente senza scrivere nella tabella log_modifiche.

---

### Edge Cases

- Cosa succede ai dati di quantità già presenti nel database? La migration rimuove le colonne quantita e soglia_avviso, i dati vengono persi irreversibilmente.
- Cosa succede ai log già registrati? Rimangono nella tabella log_modifiche ma non sono più accessibili dall'interfaccia (link commentato).
- Cosa succede se si riattivano i log? Basta decommentare il codice nel frontend (App.vue, ImpostazioniPage.vue) e rimuovere l'early return in log-modifiche.js.
- I vecchi file (MagazzinoPage.vue, magazzino.js, magazzino route) restano nel codebase? Sì, non vengono cancellati ma non sono più referenziati.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Il sistema DEVE rinominare la tabella `pezzi_magazzino` in `catalogo_prodotti` tramite migration.
- **FR-002**: Le colonne `quantita` e `soglia_avviso` DEVONO essere rimosse dalla tabella `catalogo_prodotti`.
- **FR-003**: La colonna `fuori_magazzino` in `materiali_rapportino` DEVE essere rinominata in `fuori_catalogo`.
- **FR-004**: Tutti gli endpoint API DEVONO usare il path `/api/catalogo` invece di `/api/magazzino`.
- **FR-005**: Il frontend DEVE mostrare "Catalogo Prodotti" in navigazione e titoli pagina.
- **FR-006**: Il form di creazione/modifica prodotto NON DEVE mostrare i campi quantità e soglia avviso.
- **FR-007**: La tabella prodotti NON DEVE mostrare la colonna "Qtà" né lo stile rosso per sotto-soglia.
- **FR-008**: Il filtro "Solo sotto soglia" DEVE essere rimosso dalla pagina catalogo.
- **FR-009**: L'approvazione di un preventivo NON DEVE eseguire alcuna scalatura stock.
- **FR-010**: La creazione/cancellazione di righe rapportino NON DEVE eseguire decrementi/incrementi stock.
- **FR-011**: L'export Excel del catalogo NON DEVE includere le colonne Quantità e Soglia Avviso.
- **FR-012**: La dashboard DEVE mostrare "Prodotti in catalogo" senza la card "Pezzi sotto soglia".
- **FR-013**: Il link "Log" nel menu DEVE essere commentato (non cancellato) nell'HTML.
- **FR-014**: Il checkbox `log_attivi` nelle impostazioni DEVE essere commentato.
- **FR-015**: La funzione `logModifica` DEVE restituire immediatamente senza scrivere log.

### Key Entities

- **Catalogo Prodotti (rinominata da Pezzi Magazzino)**: Entità principale che rappresenta un prodotto nel catalogo. Attributi: id, barcode, nome, marca, modello, categoria_id, prezzo_vendita, prezzo_acquisto, created_at, updated_at. Relazioni: appartiene a una Categoria (opzionale), referenziato da Preventivo Pezzi e Materiali Rapportino.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Il menu di navigazione mostra "Catalogo Prodotti" al posto di "Magazzino".
- **SC-002**: La pagina catalogo non mostra colonna quantità né filtro sotto-soglia.
- **SC-003**: Il form prodotto non contiene campi quantità e soglia avviso.
- **SC-004**: L'approvazione di un preventivo avviene senza errori di stock e senza warning di scalatura.
- **SC-005**: La creazione di rapportini con materiali da catalogo avviene senza controlli di stock.
- **SC-006**: L'export Excel contiene solo: Barcode, Nome, Marca, Modello, Categoria, Prezzo Vendita, Prezzo Acquisto.
- **SC-007**: La dashboard mostra la card "Prodotti in catalogo" senza "Pezzi sotto soglia".
- **SC-008**: Il link "Log" non è visibile nel menu per nessun utente.
- **SC-009**: Zero voci di log vengono create per qualsiasi operazione.

## Assumptions

- La migration è irreversibile per i dati di quantità e soglia: i valori vengono persi definitivamente.
- I vecchi file (magazzino.js, MagazzinoPage.vue) non vengono cancellati ma restano orfani nel codebase.
- Il log management può essere riattivato in futuro decommentando il codice.
- Le foreign key verso `pezzi_magazzino` (ora `catalogo_prodotti`) continuano a funzionare dopo il rename della tabella grazie alla gestione automatica di PostgreSQL.

## Dependencies

- **Branch 001-magazzino-semplice**: Tabella `pezzi_magazzino` originale.
- **Branch 003-log-management**: Funzionalità di log che viene disabilitata.
- **Branch 004-daily-work-reports**: Rapportini e note lavorazione che referenziano `pezzi_magazzino` e `fuori_magazzino`.
