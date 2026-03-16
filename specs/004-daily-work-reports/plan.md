# Implementation Plan: Rapportini Giornalieri e Note di Lavorazione

**Branch**: `004-daily-work-reports` | **Date**: 2026-03-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-daily-work-reports/spec.md`

## Summary

Implementazione del sistema di rapportini giornalieri per operai e note di lavorazione per amministratori. Gli operai inseriscono righe di lavoro (fascia oraria, cliente, macchina, materiali dal magazzino o fuori magazzino) senza prezzi. L'amministratore visualizza tutti i rapportini, li filtra per cliente/operaio, seleziona righe dello stesso cliente per creare note di lavorazione con riassunto e dettaglio ore. Stampa semplice per rapportini e note con intestazione cliente. I materiali da magazzino decrementano automaticamente lo stock. Scansione barcode per selezione rapida materiali.

## Technical Context

**Language/Version**: JavaScript (Node.js) con JSDoc per type checking
**Primary Dependencies**: Fastify 5 (backend), Vue 3 + Vite 7 (frontend), Bootstrap 5, Knex 3, Zod 4, html5-qrcode, pdfkit
**Storage**: PostgreSQL con Knex query builder e migrazioni
**Testing**: Jest (backend), Vitest (frontend)
**Target Platform**: Web application (browser desktop e mobile)
**Project Type**: Web-service (monorepo backend + frontend)
**Performance Goals**: Standard web app, risposte API < 500ms, ricerca materiali in tempo reale < 300ms
**Constraints**: Render free tier (cold start), layout stampa semplice senza intestazione aziendale
**Scale/Scope**: Pochi operai (< 20), un amministratore, volume moderato di rapportini giornalieri

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| Stack: Node.js + Fastify + JavaScript + JSDoc | PASS | Nessuna deviazione |
| Frontend: Vue.js + Vite + Bootstrap | PASS | Nessuna deviazione |
| Database: PostgreSQL + Knex migrazioni | PASS | 3 nuove tabelle con migrazioni Knex |
| Package manager: pnpm | PASS | Già in uso |
| Testing: Unit test obbligatori | PASS | Jest backend + Vitest frontend |
| Stile: camelCase, ESLint, Prettier | PASS | Convenzioni esistenti |
| Sicurezza: No dati sensibili hardcoded | PASS | JWT auth esistente |
| KISS: Semplicità | PASS | Nessun pattern complesso aggiunto |
| Automazione: Makefile | PASS | Comandi esistenti sufficienti |
| PDF: pdfkit | PASS | Già in uso per preventivi |
| Barcode: html5-qrcode | PASS | Già in uso per magazzino |

**Result**: Tutti i gate superati. Nessuna violazione della constitution.

## Project Structure

### Documentation (this feature)

```text
specs/004-daily-work-reports/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (API contracts)
├── checklists/          # Quality checklists
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── routes/
│   │   ├── rapportini.js          # CRUD righe rapportino (operaio + admin)
│   │   └── note-lavorazione.js    # CRUD note lavorazione (admin)
│   └── services/
│       ├── pdf-rapportino.js      # PDF stampa rapportini
│       └── pdf-nota-lavorazione.js # PDF stampa note lavorazione
├── migrations/
│   ├── 20260309_012_create_righe_rapportino.js
│   ├── 20260309_013_create_materiali_rapportino.js
│   └── 20260309_014_create_note_lavorazione.js
└── tests/
    ├── routes/
    │   ├── rapportini.test.js
    │   └── note-lavorazione.test.js
    └── services/
        ├── pdf-rapportino.test.js
        └── pdf-nota-lavorazione.test.js

frontend/
├── src/
│   ├── pages/
│   │   ├── RapportiniPage.vue         # Lista rapportini (operaio: propri, admin: tutti)
│   │   └── NoteLavorazionePage.vue    # Lista + gestione note lavorazione (admin)
│   ├── components/
│   │   ├── RigaRapportinoFormModal.vue    # Form inserimento riga
│   │   ├── MaterialeSelector.vue          # Ricerca + barcode + manuale materiali
│   │   └── NotaLavorazioneFormModal.vue   # Form creazione/modifica nota
│   └── services/
│       ├── rapportini.js              # API calls rapportini
│       └── note-lavorazione.js        # API calls note lavorazione
└── tests/
    └── ...
```

**Structure Decision**: Web application (Option 2) - segue la struttura esistente del monorepo backend/frontend. Nuovi file seguono le convenzioni di naming e organizzazione già presenti nel progetto.

## Complexity Tracking

> Nessuna violazione della Constitution. Nessuna complessità aggiuntiva da giustificare.
