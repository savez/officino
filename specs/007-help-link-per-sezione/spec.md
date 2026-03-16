# Feature Specification: Help Link per Sezione

**Feature Branch**: `007-help-link-per-sezione`
**Created**: 2026-03-14
**Status**: Approved
**Input**: "Creare un link con la guida al programma per ogni sezione e funzionalità dell'applicazione officino"

---

## Contesto

Officino è un gestionale per officine meccaniche. Gli utenti (admin e operai) devono poter
accedere a una guida contestuale senza lasciare l'app. La guida deve essere:

- Interna all'app (route `/guida`)
- Raggiungibile da ogni pagina tramite un'icona `?` nell'header
- Completata da tooltip inline sui campi/concetti più complessi

---

## User Scenarios & Testing

### User Story 1 — Operaio consulta la guida sui rapportini (Priority: P1)

Un operaio non sa come compilare una riga di rapportino (cosa inserire in "Macchina",
come aggiungere materiali). Clicca l'icona `?` nell'header della pagina Rapportini
e viene portato direttamente alla sezione della guida dedicata ai rapportini.

**Why this priority**: È la funzionalità più usata dagli utenti non-admin e quella
con più campi che richiedono spiegazione (materiali, stati, note lavorazione).

**Independent Test**: Navigare su `/rapportini`, cliccare l'icona `?`, verificare
che si approdi su `/guida#rapportini` con il contenuto corretto visibile.

**Acceptance Scenarios**:

1. **Given** l'utente è sulla pagina `/rapportini`, **When** clicca l'icona `?` nell'header, **Then** viene navigato a `/guida#rapportini`
2. **Given** l'utente è su `/guida#rapportini`, **When** la pagina è caricata, **Then** la sezione rapportini è scrollata in vista automaticamente

---

### User Story 2 — Admin consulta la guida sui preventivi (Priority: P1)

Un admin vuole capire il flusso di stati di un preventivo (bozza → approvato → fatturato).
Clicca `?` dalla pagina Preventivi e trova la spiegazione del ciclo di vita.

**Why this priority**: Il sistema degli stati dei preventivi è il workflow più critico
dell'app e non è autoesplicativo.

**Independent Test**: Navigare su `/preventivi`, cliccare `?`, verificare sezione
preventivi con descrizione degli stati e delle azioni disponibili.

**Acceptance Scenarios**:

1. **Given** l'utente è su `/preventivi`, **When** clicca `?`, **Then** approda su `/guida#preventivi`
2. **Given** l'utente è su `/guida#preventivi`, **When** legge la sezione, **Then** trova la tabella degli stati (bozza/approvato/rifiutato/scaduto/fatturato/cancellato) con spiegazione di ogni transizione

---

### User Story 3 — Utente usa il tooltip inline sul barcode scanner (Priority: P2)

Un utente non capisce a cosa serve il campo "Barcode" nel form prodotto. Passa il cursore
sull'icona `?` accanto al campo e vede un tooltip che spiega cosa è e come si usa
lo scanner.

**Why this priority**: I tooltip inline riducono la necessità di navigare alla guida
per concetti semplici, migliorando la UX senza interrompere il flusso.

**Independent Test**: Aprire il modal "Nuovo Prodotto" in `/catalogo`, verificare
la presenza del tooltip accanto al campo Barcode.

**Acceptance Scenarios**:

1. **Given** il modal prodotto è aperto, **When** si passa su `?` accanto a "Barcode", **Then** compare un tooltip con spiegazione
2. **Given** l'utente è su mobile, **When** tocca l'icona `?` del tooltip, **Then** il tooltip compare al tocco

---

### User Story 4 — Navigazione interna nella guida (Priority: P2)

Un utente apre direttamente `/guida` dalla navbar e naviga tra le sezioni
tramite il menu laterale (desktop) o il menu a fisarmonica (mobile).

**Why this priority**: La guida deve essere usabile anche come riferimento standalone,
non solo come destinazione dei link contestuali.

**Acceptance Scenarios**:

1. **Given** l'utente è su `/guida`, **When** clicca su una voce del menu laterale, **Then** la pagina scrolla alla sezione corrispondente
2. **Given** l'utente è su mobile su `/guida`, **When** apre il menu a fisarmonica, **Then** può selezionare la sezione e scorrere ad essa

---

### Edge Cases

- Cosa succede se l'utente arriva su `/guida#sezione-inesistente`? → la pagina si carica normalmente dall'inizio senza errori.
- L'icona `?` deve essere presente anche sulla pagina Dettaglio Preventivo? → Sì, punta a `#preventivi`.
- La guida è accessibile agli utenti non-admin? → Sì, la route `/guida` è pubblica (richiede solo autenticazione, non admin).

---

## Requirements

### Functional Requirements

- **FR-001**: La route `/guida` DEVE essere accessibile a tutti gli utenti autenticati.
- **FR-002**: Ogni pagina DEVE avere un'icona `?` cliccabile nell'header che naviga a `/guida#<anchor>`.
- **FR-003**: La pagina `/guida` DEVE contenere una sezione per ogni sezione dell'app: Dashboard, Catalogo Prodotti, Categorie, Clienti, Preventivi, Rapportini, Note di Lavorazione (admin), Utenti (admin), Impostazioni (admin).
- **FR-004**: La pagina `/guida` DEVE avere un indice/sommario navigabile.
- **FR-005**: Gli anchor (`#`) DEVE corrispondere esattamente ai valori usati dai link `?` nelle pagine.
- **FR-006**: I tooltip inline DEVONO essere presenti nei seguenti campi complessi: Barcode (catalogo), Prezzo Acquisto vs Vendita (catalogo), Stati preventivo (preventivi), Materiali fuori catalogo (rapportini/preventivi), Costo orario (utenti), Nota di lavorazione - relazione con rapportini.
- **FR-007**: Il componente `HelpIcon` DEVE essere riutilizzabile e accettare una prop `anchor` (string) per determinare la destinazione del link.
- **FR-008**: I tooltip DEVONO usare i Bootstrap tooltip nativi (già presente nel progetto) o un'implementazione CSS pura, senza dipendenze aggiuntive.

### Key Entities

- **HelpIcon**: Componente Vue riutilizzabile. Props: `anchor` (string, destinazione `/guida#anchor`). Render: icona `bi-question-circle` come link `<router-link>`.
- **HelpTooltip**: Componente Vue riutilizzabile per tooltip inline. Props: `text` (string, testo del tooltip). Render: icona `bi-question-circle-fill` con tooltip Bootstrap.
- **GuidaPage**: Pagina Vue con contenuto statico della guida, strutturata in sezioni con `id` HTML corrispondenti agli anchor.

---

## Componenti da creare

| File | Tipo | Scopo |
|---|---|---|
| `frontend/src/components/HelpIcon.vue` | Componente | Icona `?` con router-link a sezione guida |
| `frontend/src/components/HelpTooltip.vue` | Componente | Tooltip inline su campi complessi |
| `frontend/src/pages/GuidaPage.vue` | Pagina | Guida completa dell'applicazione |

## File da modificare

| File | Modifica |
|---|---|
| `frontend/src/router/index.js` | Aggiungere route `/guida` |
| `frontend/src/App.vue` | Aggiungere link "Guida" nella navbar |
| `frontend/src/pages/DashboardPage.vue` | Aggiungere `<HelpIcon anchor="dashboard">` |
| `frontend/src/pages/CatalogoProdottiPage.vue` | Aggiungere `<HelpIcon anchor="catalogo">` |
| `frontend/src/pages/CategoriePage.vue` | Aggiungere `<HelpIcon anchor="categorie">` |
| `frontend/src/pages/ClientiPage.vue` | Aggiungere `<HelpIcon anchor="clienti">` |
| `frontend/src/pages/PreventiviPage.vue` | Aggiungere `<HelpIcon anchor="preventivi">` |
| `frontend/src/pages/PreventivoDettaglioPage.vue` | Aggiungere `<HelpIcon anchor="preventivi">` |
| `frontend/src/pages/RapportiniPage.vue` | Aggiungere `<HelpIcon anchor="rapportini">` |
| `frontend/src/pages/NoteLavorazionePage.vue` | Aggiungere `<HelpIcon anchor="note-lavorazione">` |
| `frontend/src/pages/UtentiPage.vue` | Aggiungere `<HelpIcon anchor="utenti">` |
| `frontend/src/pages/ImpostazioniPage.vue` | Aggiungere `<HelpIcon anchor="impostazioni">` |
| `frontend/src/components/PezzoFormModal.vue` | Aggiungere `<HelpTooltip>` su Barcode, Prezzo Acquisto |
| `frontend/src/components/RigaRapportinoFormModal.vue` | Aggiungere `<HelpTooltip>` su Materiali |
| `frontend/src/components/UtenteFormModal.vue` | Aggiungere `<HelpTooltip>` su Costo Orario |

---

## Struttura della Guida (`/guida`)

```
# Guida a Officino

## Indice
- Dashboard
- Catalogo Prodotti
- Categorie
- Clienti
- Preventivi
  - Ciclo di vita degli stati
  - Dettaglio preventivo
- Rapportini
  - Come registrare una riga
  - Materiali
  - Creare una Nota di Lavorazione
- Note di Lavorazione (admin)
- Utenti (admin)
- Impostazioni (admin)
```

---

## Success Criteria

- **SC-001**: Ogni pagina dell'app ha un'icona `?` visibile e cliccabile che porta alla sezione corretta della guida.
- **SC-002**: La pagina `/guida` è accessibile da menu navbar e dai link contestuali.
- **SC-003**: I tooltip inline sono visibili su hover (desktop) e su tocco (mobile) nei campi identificati.
- **SC-004**: Nessuna dipendenza npm aggiuntiva introdotta.
- **SC-005**: Il codice segue le convenzioni del progetto (camelCase, Vue Composition API, Bootstrap).
