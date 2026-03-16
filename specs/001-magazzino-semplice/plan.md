# Implementation Plan: magazzino-semplice

**Branch**: `001-magazzino-semplice` | **Date**: 2026-02-24 | **Updated**: 2026-02-28 | **Spec**: specs/001-magazzino-semplice/spec.md
**Input**: Feature specification from `/specs/001-magazzino-semplice/spec.md`

## Summary

Applicazione web/mobile-first per la gestione semplice del magazzino officina, preventivi e clienti. Stack: Node.js (Fastify), Vue.js (Vite + Bootstrap), PostgreSQL (Knex), tutto in Docker. JavaScript con JSDoc, API validate, security-first, export/import, autenticazione email/password.

## Technical Context

**Language**: JavaScript (ES2022+) con JSDoc per type hints
**Runtime**: Node.js 20+
**Package Manager**: pnpm
**Backend**: Fastify, Knex (query builder + migrazioni), zod/ajv (validazione), JWT + bcrypt (auth)
**Frontend**: Vue.js 3+, Vite 5+ (bundler), Bootstrap 5+ (CSS mobile-first), html5-qrcode (barcode scanner)
**Database**: PostgreSQL 15+
**PDF**: pdfkit (layout semplice schematico)
**Export**: xlsx (export Excel)
**File Storage**: Filesystem locale (volume Docker persistente per logo officina)
**Testing**: Jest (backend), Vitest (frontend)
**Linting**: ESLint + Prettier
**Target Platform**: Web (desktop/mobile), responsive
**Deployment**: Immagine Docker (docker-compose dev + prod)
**API Base**: `/api/...` (nessun versioning)
**Performance Goals**: Risposta API < 300ms, export < 2s, login < 1s, generazione PDF < 3s
**Constraints**: Security-first, mobile-first, KISS, nessun dato sensibile nei log, backup automatico
**Scale/Scope**: 1-10 utenti contemporanei (target: 3 utenti), <10k record/tabella

### Ambiente di sviluppo Docker (2026-02-28)

- In `frontend/vite.config.js` il dev server deve usare `host: true` per esposizione su rete/container.
- Il file watching deve usare `watch.usePolling: true` per garantire hot reload affidabile con bind mount Docker Desktop (macOS).

## Key Design Decisions

### Architettura (2026-02-27)

1. **Vue.js + Vite + Bootstrap**: Vue per reattività e componenti, Vite per DX e hot reload, Bootstrap per UI responsive mobile-first.
2. **JavaScript + JSDoc**: niente TypeScript, JSDoc per type safety e documentazione senza overhead di compilazione.
3. **Knex**: query builder leggero con migrazioni manuali. No ORM pesante (Prisma), massimo controllo sulle query.
4. **pnpm**: package manager veloce ed efficiente su disco.
5. **pdfkit**: generazione PDF leggera, layout schematico semplice per preventivi. No browser headless (puppeteer).
6. **html5-qrcode**: scanner barcode da fotocamera, supporta EAN-13 e QR code.
7. **Filesystem locale per logo**: semplice, volume Docker persistente. No cloud storage.
8. **Nessun API versioning**: progetto interno con 3 utenti, non serve.
9. **Solo dev + prod**: nessun ambiente di staging.

### Funzionali (2026-02-27)

10. **Prezzi IVA esclusa**: tutti i prezzi nel sistema sono IVA esclusa. L'IVA viene applicata solo sul totale del preventivo con aliquota configurabile.
11. **Prezzo vendita/acquisto**: ogni pezzo ha un prezzo_vendita obbligatorio e un prezzo_acquisto opzionale.
12. **Prezzo modificabile nel preventivo**: il prezzo viene precompilato dal magazzino ma può essere sovrascritto nel singolo preventivo.
13. **Sconto flessibile**: importo fisso o percentuale. In entrambi i casi il preventivo/PDF mostra l'importo fisso calcolato.
14. **Manodopera semplice**: una sola voce per preventivo (ore x costo orario). Costo orario modificabile per preventivo.
15. **Stati preventivo**: bozza → approvato → fatturato. Possibili anche: rifiutato, scaduto.
16. **PDF con intestazione officina**: dati officina salvati nel DB e configurabili dall'utente.
17. **Categorie pezzi**: i pezzi sono organizzati per categorie. Se la categoria è eliminata, il pezzo resta senza categoria.
18. **Avvisi solo visivi**: nessuna notifica email, solo indicatore nella lista magazzino.
19. **Barcode EAN-13 + manuale**: formato principale EAN-13, codice manuale accettato, campo nullable.
20. **Gestione clienti dedicata**: pagina CRUD separata con codice fiscale e P.IVA.
21. **Log modifiche**: registrazione automatica su DB di tutte le operazioni significative.
22. **Nessun sistema permessi in v1**: tutti gli utenti autenticati hanno le stesse funzionalità.
23. **Nessuna gestione conflitti**: con 3 utenti previsti, il rischio è trascurabile.
24. **Nome utente**: ogni utente ha un campo `nome` visualizzato nei log e preventivi, oltre all'email.
25. **Soft delete clienti**: i clienti con preventivi non si eliminano fisicamente, vengono archiviati. I clienti archiviati non appaiono nelle selezioni.
26. **Preventivo modificabile solo in bozza**: una volta cambiato stato, il preventivo è bloccato.
27. **Paginazione**: tutte le liste API sono paginate (es. 25/50 per pagina). Frontend con componente paginazione riutilizzabile.
28. **Campi calcolati nel service layer**: `manodopera_totale`, `sconto_calcolato`, `imponibile`, `imponibile_netto`, `iva`, `totale` calcolati nel backend, non come generated columns PostgreSQL (compatibilità Knex).
29. **Vite dev server Docker-friendly**: in sviluppo Docker usare `host: true` e `watch.usePolling: true` per rendere stabile l'hot reload frontend.
30. **Azioni preventivi in modale**: nella lista preventivi le azioni di riga sono esposte tramite modale dedicato (non dropdown), per garantire usabilità su viewport piccoli e tabelle con poche righe senza clipping.

## Constitution Check

- Stack (Fastify, Vue.js, Knex, pnpm, JS+JSDoc): conforme alla constitution v2.0.0
- Sicurezza, testing, KISS, Makefile, lint, mobile-first: OK
- Tutte le API devono essere validate e sicure
- Nessun merge senza test verdi e lint pulito

## Project Structure

### Documentation (this feature)

```
specs/001-magazzino-semplice/
├── plan.md
├── data-model.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```
backend/
  ├── src/
  │   ├── controllers/
  │   ├── routes/
  │   ├── services/
  │   └── utils/
  ├── migrations/          # Knex migrations
  ├── seeds/               # Knex seed data
  ├── tests/
  ├── knexfile.js
  ├── Dockerfile
  └── package.json
frontend/
  ├── src/
  │   ├── components/
  │   ├── pages/           # Vue views/pages
  │   ├── router/          # Vue Router
  │   ├── stores/          # State management (Pinia o reactive)
  │   ├── services/        # API calls
  │   └── assets/
  ├── tests/
  ├── Dockerfile
  └── package.json
docker/
  ├── docker-compose.dev.yml
  └── docker-compose.prod.yml
uploads/                   # Logo officina (volume Docker)
Makefile
.env.example
```

**Structure Decision**: Web app fullstack, backend e frontend separati, tutto dockerizzato, DB Postgres con Knex, policy security-first, KISS.

## Complexity Tracking

Nessuna complessità non giustificata: tutto segue KISS e security-first.

### Complessità accettata

- **PDF generation (pdfkit)**: layout schematico semplice, nessun template HTML complesso.
- **Upload logo**: filesystem locale con validazione tipo/dimensione. Volume Docker persistente.
- **Calcoli preventivo**: logica di calcolo imponibile/sconto/IVA/totale da centralizzare in un service condiviso tra API e generazione PDF.
- **Barcode scanner**: html5-qrcode, integrazione browser-only, nessun servizio esterno.
