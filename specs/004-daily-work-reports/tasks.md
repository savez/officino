# Tasks: Rapportini Giornalieri e Note di Lavorazione

**Input**: Design documents from `/specs/004-daily-work-reports/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Non esplicitamente richiesti nella spec. Non inclusi.

**Organization**: Tasks grouped by user story. Web app structure: `backend/src/`, `frontend/src/`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Creazione tabelle database e registrazione route

- [x] T001 Creare migrazione `note_lavorazione` in `backend/migrations/20260309_012_create_note_lavorazione.js`
- [x] T002 Creare migrazione `righe_rapportino` in `backend/migrations/20260309_013_create_righe_rapportino.js` (FK verso note_lavorazione)
- [x] T003 Creare migrazione `materiali_rapportino` in `backend/migrations/20260309_014_create_materiali_rapportino.js`
- [x] T004 Registrare route plugin `rapportini` e `note-lavorazione` in `backend/src/app.js`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend services e frontend services condivisi da tutte le user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 [P] Creare service file `frontend/src/services/rapportini.js` con funzioni: `getRighe(params)`, `creaRiga(data)`, `cancellaRiga(id)`, `stampaRapportini(params)`
- [x] T006 [P] Creare service file `frontend/src/services/note-lavorazione.js` con funzioni: `getNote(params)`, `getNota(id)`, `creaNota(data)`, `aggiornaNota(id, data)`, `cancellaNota(id)`, `stampaNota(id)`
- [x] T007 Aggiungere rotte per Rapportini e Note Lavorazione in `frontend/src/router/index.js` con meta auth e ruoli
- [x] T008 Aggiungere voci menu "Rapportini" (tutti) e "Note Lavorazione" (solo admin) nella navbar in `frontend/src/App.vue`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Operaio inserisce riga rapportino (Priority: P1) 🎯 MVP

**Goal**: L'operaio può inserire una riga di rapportino con giorno, fascia oraria, cliente, macchina e note

**Independent Test**: Login come operaio, inserire una riga con tutti i campi, verificare che appaia nell'elenco

### Implementation for User Story 1

- [x] T009 [US1] Creare route `POST /api/rapportini` in `backend/src/routes/rapportini.js` — validazione Zod (giorno, ora_inizio, ora_fine con ora_fine > ora_inizio, cliente_id obbligatorio, macchina e note opzionali), salvataggio riga con utente_id dal JWT, log audit
- [x] T010 [US1] Creare componente `frontend/src/components/RigaRapportinoFormModal.vue` — form con campi: giorno (date picker), ora inizio, ora fine, cliente (select da API clienti), macchina (testo libero), note (textarea). Nessun campo prezzo
- [x] T011 [US1] Creare pagina `frontend/src/pages/RapportiniPage.vue` — struttura base con bottone "Nuova riga" che apre il modal, lista vuota placeholder

**Checkpoint**: L'operaio può inserire righe di rapportino (senza materiali per ora)

---

## Phase 4: User Story 2 - Operaio seleziona materiali (Priority: P1)

**Goal**: L'operaio può aggiungere materiali dal magazzino (ricerca + barcode) o fuori magazzino al rapportino

**Independent Test**: Inserire una riga con materiale da magazzino (ricerca), scansione barcode, e materiale manuale. Verificare decremento stock.

### Implementation for User Story 2

- [x] T012 [US2] Estendere route `POST /api/rapportini` in `backend/src/routes/rapportini.js` — aggiungere gestione array `materiali` nel body, validazione Zod per materiali (pezzo_id o nome_manuale+fuori_magazzino), salvataggio in `materiali_rapportino`, decremento stock in transazione Knex
- [x] T013 [US2] Creare componente `frontend/src/components/MaterialeSelector.vue` — ricerca prodotti magazzino con debounce 300ms via `GET /api/magazzino?search=`, bottone scansione barcode (riusa `BarcodeScannerModal.vue`), inserimento manuale prodotto fuori magazzino (nome + quantità), lista materiali aggiunti con quantità editabile, nessun prezzo visibile
- [x] T014 [US2] Integrare `MaterialeSelector` nel form `frontend/src/components/RigaRapportinoFormModal.vue` — aggiungere sezione materiali sotto i campi esistenti, passare array materiali al POST

**Checkpoint**: L'operaio può inserire righe complete con materiali, stock decrementato

---

## Phase 5: User Story 3 - Operaio visualizza e cancella righe (Priority: P1)

**Goal**: L'operaio vede le proprie righe e può cancellare quelle non gestite

**Independent Test**: Login come operaio, verificare di vedere solo le proprie righe, cancellarne una non gestita, verificare che una gestita non sia cancellabile

### Implementation for User Story 3

- [x] T015 [US3] Creare route `GET /api/rapportini` in `backend/src/routes/rapportini.js` — se ruolo user: filtro `utente_id` dal JWT; se admin: tutte le righe. Paginazione, join con `utenti`, `clienti`, `materiali_rapportino` (con nome pezzo da `pezzi_magazzino`). Supporto filtri query: `cliente_id`, `utente_id`, `giorno`, `gestita`
- [x] T016 [US3] Creare route `DELETE /api/rapportini/:id` in `backend/src/routes/rapportini.js` — operaio: solo proprie righe con `nota_lavorazione_id IS NULL`; admin: qualsiasi riga. Ripristino stock in transazione (per ogni materiale da magazzino). Log audit
- [x] T017 [US3] Completare pagina `frontend/src/pages/RapportiniPage.vue` — tabella righe con colonne (giorno, orario, cliente, macchina, materiali, note, stato gestione), bottone cancella visibile solo su righe non gestite, paginazione, messaggio "solo l'amministratore può cancellare righe gestite" se gestita

**Checkpoint**: MVP completo — operaio può inserire, visualizzare e cancellare righe di rapportino con materiali

---

## Phase 6: User Story 4 - Admin visualizza rapportini di tutti (Priority: P2)

**Goal**: L'amministratore vede tutte le righe con filtri per cliente e operaio

**Independent Test**: Login come admin, verificare di vedere righe di tutti gli operai, filtrare per cliente e per operaio

### Implementation for User Story 4

- [x] T018 [US4] Aggiungere filtri admin in `frontend/src/pages/RapportiniPage.vue` — se admin: mostrare select filtro cliente (da API clienti), select filtro operaio (da API utenti), filtro per giornata (date picker), filtro per stato gestione. Colonna "Operaio" visibile solo per admin

**Checkpoint**: Admin ha visione completa di tutti i rapportini con filtri

---

## Phase 7: User Story 5 - Admin crea nota di lavorazione (Priority: P2)

**Goal**: L'admin seleziona righe dello stesso cliente e crea una nota di lavorazione con riassunto e dettaglio ore

**Independent Test**: Selezionare 3 righe di un cliente, creare nota con testo, verificare righe marcate come gestite e totale ore corretto

### Implementation for User Story 5

- [x] T019 [US5] Creare route `POST /api/note-lavorazione` in `backend/src/routes/note-lavorazione.js` — validazione Zod (cliente_id, testo, mostra_dettagli, righe_ids min 1), verifica tutte le righe stesso cliente_id, verifica nessuna riga già associata ad altra nota, transazione: crea nota + aggiorna `righe_rapportino.nota_lavorazione_id`, log audit
- [x] T020 [US5] Creare route `GET /api/note-lavorazione` in `backend/src/routes/note-lavorazione.js` — solo admin, paginazione, join clienti, conteggio righe e ore totali (calcolate da ora_fine - ora_inizio), filtro per `cliente_id`
- [x] T021 [US5] Creare route `GET /api/note-lavorazione/:id` in `backend/src/routes/note-lavorazione.js` — solo admin, dettaglio nota con righe associate (join utenti, materiali), calcolo ore totali
- [x] T022 [US5] Aggiungere checkbox selezione righe in `frontend/src/pages/RapportiniPage.vue` — visibile solo per admin, solo su righe non gestite, bottone "Crea Nota di Lavorazione" abilitato quando >= 1 riga selezionata, validazione client-side che tutte le righe siano dello stesso cliente
- [x] T023 [US5] Creare componente `frontend/src/components/NotaLavorazioneFormModal.vue` — form con: cliente (readonly, derivato dalle righe), textarea riassunto, checkbox mostra dettagli, riepilogo righe selezionate con dettaglio ore per riga, totale ore calcolato
- [x] T024 [US5] Creare pagina `frontend/src/pages/NoteLavorazionePage.vue` — tabella note con colonne (cliente, riassunto troncato, ore totali, n. righe, data creazione), paginazione, filtro per cliente, click su riga per dettaglio

**Checkpoint**: Admin può creare note di lavorazione e visualizzarle

---

## Phase 8: User Story 6 - Admin modifica nota di lavorazione (Priority: P3)

**Goal**: L'admin può modificare testo, flag dettagli e associazione righe di una nota esistente

**Independent Test**: Modificare una nota rimuovendo e aggiungendo righe, verificare che le associazioni si aggiornino correttamente

### Implementation for User Story 6

- [x] T025 [US6] Creare route `PUT /api/note-lavorazione/:id` in `backend/src/routes/note-lavorazione.js` — validazione Zod, gestione diff righe (rimosse → nota_lavorazione_id = NULL, aggiunte → verifica stesso cliente e non associate ad altra nota), transazione, log audit
- [x] T026 [US6] Creare route `DELETE /api/note-lavorazione/:id` in `backend/src/routes/note-lavorazione.js` — solo admin, ON DELETE SET NULL gestisce automaticamente le righe, log audit
- [x] T027 [US6] Aggiungere funzionalità modifica in `frontend/src/pages/NoteLavorazionePage.vue` — bottone modifica su ogni nota, apre `NotaLavorazioneFormModal` precompilato con dati nota e righe associate, possibilità di rimuovere righe e aggiungere nuove righe non gestite dello stesso cliente. Bottone cancella nota con conferma

**Checkpoint**: Admin ha gestione completa note di lavorazione (CRUD)

---

## Phase 9: User Story 7 - Stampa rapportini (Priority: P3)

**Goal**: L'admin può stampare rapportini filtrati per giornata o cliente con layout semplice

**Independent Test**: Filtrare per cliente, stampare, verificare PDF con intestazione cliente, tabella righe e totale ore

### Implementation for User Story 7

- [x] T028 [US7] Creare service `backend/src/services/pdf-rapportino.js` — genera PDF con pdfkit: intestazione (nome cliente o data giornata), tabella righe (operaio, giorno, fascia oraria, macchina, materiali, note), totale ore in fondo. Layout semplice, nessuna intestazione aziendale
- [x] T029 [US7] Creare route `GET /api/rapportini/stampa` in `backend/src/routes/rapportini.js` — solo admin, query params `giorno` e/o `cliente_id` (almeno uno obbligatorio), risponde con Content-Type application/pdf
- [x] T030 [US7] Aggiungere bottone "Stampa" in `frontend/src/pages/RapportiniPage.vue` — visibile solo per admin quando è attivo un filtro per giornata o cliente, apre PDF in nuova tab

**Checkpoint**: Stampa rapportini funzionante

---

## Phase 10: User Story 8 - Stampa nota di lavorazione (Priority: P3)

**Goal**: L'admin può stampare una nota di lavorazione con intestazione cliente e riassunto

**Independent Test**: Stampare una nota con dettagli visibili e una senza, verificare layout corretto

### Implementation for User Story 8

- [x] T031 [US8] Creare service `backend/src/services/pdf-nota-lavorazione.js` — genera PDF con pdfkit: intestazione nome cliente, testo riassuntivo, se mostra_dettagli: tabella righe (operaio, giorno, fascia oraria, macchina, materiali, note), totale ore sempre visibile. Layout semplice, nessuna intestazione aziendale
- [x] T032 [US8] Creare route `GET /api/note-lavorazione/:id/stampa` in `backend/src/routes/note-lavorazione.js` — solo admin, risponde con Content-Type application/pdf
- [x] T033 [US8] Aggiungere bottone "Stampa" in `frontend/src/pages/NoteLavorazionePage.vue` — su ogni nota, apre PDF in nuova tab

**Checkpoint**: Stampa note lavorazione funzionante

---

## Phase 11: User Story 9 - Cancellazione rapportino con associazione a nota (Priority: P3)

**Goal**: La cancellazione di una riga associata a una nota rimuove automaticamente l'associazione

**Independent Test**: Cancellare (come admin) una riga gestita, verificare che la nota resti intatta senza quella riga

### Implementation for User Story 9

- [x] T034 [US9] Verificare e completare logica di cancellazione in `backend/src/routes/rapportini.js` — la FK `nota_lavorazione_id` con ON DELETE SET NULL nella migrazione gestisce automaticamente il caso. Verificare che il ripristino stock funzioni anche per righe gestite. Aggiungere test manuale

**Checkpoint**: Integrità referenziale garantita tra rapportini e note

---

## Phase 12: Polish & Cross-Cutting Concerns

**Purpose**: Miglioramenti trasversali a tutte le user story

- [x] T035 [P] Aggiungere log audit per tutte le operazioni rapportini e note in `backend/src/routes/rapportini.js` e `backend/src/routes/note-lavorazione.js` — usare `logModifica` da `backend/src/services/log-modifiche.js`
- [x] T036 [P] Aggiungere seed di esempio per rapportini e note in `backend/seeds/001_sample_data.js` — almeno 5 righe rapportino e 1 nota di lavorazione
- [x] T037 Validazione quickstart: eseguire `specs/004-daily-work-reports/quickstart.md` end-to-end e verificare tutti i flussi

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (migrazioni eseguite)
- **US1 (Phase 3)**: Depends on Phase 2
- **US2 (Phase 4)**: Depends on US1 (estende POST rapportini e form)
- **US3 (Phase 5)**: Depends on US1 (serve almeno la POST per avere righe da visualizzare)
- **US4 (Phase 6)**: Depends on US3 (estende la pagina rapportini con filtri admin)
- **US5 (Phase 7)**: Depends on US3 + US4 (serve la vista admin con righe da selezionare)
- **US6 (Phase 8)**: Depends on US5 (serve una nota da modificare)
- **US7 (Phase 9)**: Depends on US4 (serve la vista filtrata per generare PDF)
- **US8 (Phase 10)**: Depends on US5 (serve una nota da stampare)
- **US9 (Phase 11)**: Depends on US5 (serve l'associazione riga-nota)
- **Polish (Phase 12)**: Depends on all phases complete

### User Story Dependencies

```
Phase 1 (Setup) → Phase 2 (Foundation)
    ↓
Phase 3 (US1: Inserimento) → Phase 4 (US2: Materiali)
    ↓
Phase 5 (US3: Visualizza/Cancella)
    ↓
Phase 6 (US4: Filtri Admin)
    ↓                           ↓
Phase 7 (US5: Crea Nota)    Phase 9 (US7: Stampa Rapportini)
    ↓           ↓
Phase 8 (US6)  Phase 10 (US8: Stampa Nota)
    ↓
Phase 11 (US9: Cancellazione con nota)
    ↓
Phase 12 (Polish)
```

### Parallel Opportunities

- **Phase 2**: T005 e T006 (frontend services) in parallelo
- **Phase 7**: T019, T020, T021 (backend routes note) possono essere sviluppati in parallelo
- **Phase 9 e 10**: Stampa rapportini (US7) e stampa note (US8) possono procedere in parallelo dopo le rispettive dipendenze
- **Phase 12**: T035 e T036 in parallelo

---

## Implementation Strategy

### MVP First (User Stories 1-3)

1. Complete Phase 1: Setup (migrazioni DB)
2. Complete Phase 2: Foundational (services frontend, routing, menu)
3. Complete Phase 3: US1 (inserimento righe)
4. Complete Phase 4: US2 (materiali con barcode e ricerca)
5. Complete Phase 5: US3 (visualizzazione e cancellazione)
6. **STOP and VALIDATE**: L'operaio può inserire, vedere e cancellare rapportini con materiali
7. Deploy/demo MVP

### Incremental Delivery

1. MVP (US1-3) → Operai possono lavorare
2. +US4 → Admin vede tutto con filtri
3. +US5 → Admin crea note di lavorazione
4. +US6 → Admin modifica note
5. +US7+US8 → Stampa rapportini e note
6. +US9 → Integrità cancellazione
7. Polish → Seed, log, validazione

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Le migrazioni vanno eseguite nell'ordine: note_lavorazione → righe_rapportino → materiali_rapportino (per FK dependencies)
