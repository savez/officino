---
description: "Task list for magazzino-semplice"
updated: "2026-02-27"
---

# Tasks: magazzino-semplice

**Input**: Design documents from `/specs/001-magazzino-semplice/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), data-model.md
**Stack**: Node.js + Fastify, Vue.js + Vite + Bootstrap, PostgreSQL + Knex, pnpm, JS + JSDoc

## Phase 1: Setup (Shared Infrastructure)

- [ ] T001 Crea directory `backend/`, `frontend/`, `docker/`, `uploads/`
- [ ] T002 Inizializza progetto Node.js in `backend/` (`pnpm init`, Fastify, dotenv)
- [ ] T003 Inizializza progetto Vue.js in `frontend/` (`pnpm create vite@latest` template vue, Bootstrap, Vue Router)
- [ ] T004 [P] Configura ESLint e Prettier in `backend/` (regole JSDoc)
- [ ] T005 [P] Configura ESLint e Prettier in `frontend/` (regole Vue + JSDoc)
- [ ] T006 [P] Crea Makefile root con comandi: build, test, lint, docker-up, docker-down, migrate, seed
- [ ] T007 [P] Crea file `.env.example` per backend e frontend

## Phase 2: Foundational (Blocking Prerequisites)

- [ ] T008 Crea `docker-compose.dev.yml` (backend + frontend + postgres, mount volumi, hot reload, volume uploads/)
- [ ] T009 Crea `docker-compose.prod.yml` (build ottimizzato, no volumi sorgente, volume uploads/ persistente)
- [ ] T010 [P] Definisci Dockerfile per backend (node:20-alpine, non root, healthcheck)
- [ ] T011 [P] Definisci Dockerfile per frontend (vite build, serve statici con nginx)
- [ ] T012 [P] Setup Postgres: crea script init db, utente, permessi minimi
- [ ] T013 [P] Configura Knex: knexfile.js (dev + prod), prima migrazione vuota, struttura migrations/ e seeds/
- [ ] T014 [P] Migrazione Knex: tabella `utenti` (id, nome, email unique, password_hash, ruolo default 'user', costo_orario)
- [ ] T015 [P] Definisci struttura base Fastify: routes, controller, schema validation (zod/ajv), JSDoc, paginazione helper
- [ ] T016 [P] Configura CORS, helmet, rate limit, logging centralizzato (pino)
- [ ] T017 [P] Implementa autenticazione email/password (bcrypt hash, JWT access + refresh token, registrazione con nome)
- [ ] T018 [P] Setup gestione variabili ambiente sicura (dotenv, validazione schema env)
- [ ] T019 [P] Definisci struttura base Vue.js: Vue Router, layout mobile-first (Bootstrap grid, navbar responsive), componente paginazione, Vite dev server Docker-friendly (`host: true`, `watch.usePolling: true`)
- [ ] T020 [P] Crea script di healthcheck per app e db
- [ ] T021 [P] Configura servizio API nel frontend (fetch/axios wrapper con JWT, base URL `/api`, supporto paginazione)

## Phase 3: User Story 1 - Gestione Magazzino (P1)

- [ ] T022 [P] [US1] Migrazione Knex: tabella `categorie` (id, nome unique, descrizione)
- [ ] T023 [P] [US1] Migrazione Knex: tabella `pezzi_magazzino` (barcode nullable, nome, marca, modello, categoria_id FK, quantita, soglia_avviso, prezzo_vendita, prezzo_acquisto nullable)
- [ ] T024 [P] [US1] Implementa CRUD API `/api/categorie` con validazione schema e paginazione
- [ ] T025 [P] [US1] Implementa CRUD API `/api/magazzino` con validazione schema e paginazione (inclusi prezzo_vendita, prezzo_acquisto, categoria_id)
- [ ] T026 [P] [US1] Implementa endpoint ricerca `/api/magazzino/search` per nome, marca, modello, barcode, categoria
- [ ] T027 [P] [US1] Implementa logica avviso soglia (flag `sotto_soglia` nel response della lista)
- [ ] T028 [P] [US1] Implementa endpoint export magazzino in Excel (`/api/magazzino/export`) con prezzi e categorie
- [ ] T029 [P] [US1] UI Vue: pagina gestione categorie (CRUD semplice)
- [ ] T030 [P] [US1] UI Vue: pagina elenco magazzino con ricerca, filtri per categoria, paginazione, indicatore visivo soglia (riga rossa/icona)
- [ ] T031 [P] [US1] UI Vue: integrazione html5-qrcode per scansione barcode da fotocamera
- [ ] T032 [P] [US1] UI Vue: form aggiunta/modifica pezzo (prezzo vendita, acquisto, categoria, barcode manuale)
- [ ] T033 [P] [US1] UI Vue: export Excel (download file)
- [ ] T034 [US1] Test backend (Jest): modello Knex, validazione, API magazzino e categorie, paginazione
- [ ] T035 [US1] Test frontend (Vitest): ricerca, barcode, export, indicatore soglia, paginazione

## Phase 4: User Story 2 - Gestione Clienti (P1)

- [ ] T036 [P] [US2] Migrazione Knex: tabella `clienti` (id, nome, telefono, email, indirizzo, codice_fiscale, partita_iva, note, archiviato boolean default false)
- [ ] T037 [P] [US2] Implementa CRUD API `/api/clienti` con validazione schema, paginazione e soft delete (archiviazione)
- [ ] T038 [P] [US2] Implementa endpoint ricerca clienti `/api/clienti/search` per nome, P.IVA, codice fiscale (esclude archiviati di default)
- [ ] T039 [P] [US2] UI Vue: pagina lista clienti con ricerca e paginazione (toggle mostra/nascondi archiviati)
- [ ] T040 [P] [US2] UI Vue: form creazione/modifica cliente (con CF e P.IVA)
- [ ] T041 [US2] Test backend (Jest): modello Knex, validazione, API clienti, soft delete
- [ ] T042 [US2] Test frontend (Vitest): CRUD clienti, ricerca, archiviazione

## Phase 5: User Story 3 - Preventivi (P2)

- [ ] T043 [P] [US3] Migrazione Knex: tabella `preventivi` (numero, cliente_id, utente_id, data, stato, manodopera_ore, manodopera_costo_orario, manodopera_totale, sconto_tipo, sconto_valore, sconto_calcolato, aliquota_iva, imponibile, imponibile_netto, iva, totale, note)
- [ ] T044 [P] [US3] Migrazione Knex: tabella `preventivo_pezzi` (preventivo_id, pezzo_id, quantita, prezzo_unitario, note)
- [ ] T045 [P] [US3] Implementa service calcolo preventivo centralizzato (manodopera_totale, imponibile, sconto fisso/percentuale, IVA, totale)
- [ ] T046 [P] [US3] Implementa API CRUD `/api/preventivi` con numerazione automatica (ANNO/NUM), calcoli e paginazione. Modifica consentita solo in stato bozza.
- [ ] T047 [P] [US3] Implementa endpoint cambio stato `/api/preventivi/:id/stato` (bozza → approvato/rifiutato/scaduto, approvato → fatturato)
- [ ] T048 [P] [US3] Implementa logica scalatura pezzi magazzino su approvazione (con verifica disponibilità, Knex transaction)
- [ ] T049 [P] [US3] UI Vue: creazione preventivo (selezione cliente autocomplete esclusi archiviati, aggiunta pezzi con prezzo precompilato e modificabile, manodopera, sconto)
- [ ] T050 [P] [US3] UI Vue: riepilogo preventivo con calcoli live (imponibile, sconto, IVA, totale)
- [ ] T051 [P] [US3] UI Vue: lista preventivi con filtri per stato, paginazione, dettaglio e azioni riga tramite modale dedicato (no dropdown). Editing bloccato se non in bozza.
- [ ] T052 [US3] Test backend (Jest): modelli Knex, API, numerazione, calcoli sconto/IVA, scalatura con transaction, blocco modifica non-bozza
- [ ] T053 [US3] Test frontend (Vitest): creazione, calcoli live, cambio stato, scalatura, blocco editing e visibilità completa del modale azioni su viewport diversi

## Phase 6: User Story 5/6 - PDF e Impostazioni Officina (P2)

- [ ] T054 [P] [US5/US6] Migrazione Knex: tabella `impostazioni_officina` (nome, partita_iva, indirizzo, telefono, email, logo_url, aliquota_iva_default)
- [ ] T055 [P] [US6] Implementa API `/api/impostazioni` (GET/PUT, unica riga)
- [ ] T056 [P] [US6] Implementa upload logo officina (`/api/impostazioni/logo`, salvataggio su filesystem uploads/, validazione tipo/dimensione)
- [ ] T057 [P] [US5] Implementa endpoint generazione PDF preventivo `/api/preventivi/:id/pdf` (pdfkit, layout schematico: intestazione officina, dettaglio pezzi, manodopera, sconto, IVA, totale)
- [ ] T058 [P] [US6] UI Vue: pagina impostazioni officina (form dati + upload logo)
- [ ] T059 [P] [US5] UI Vue: bottone "Genera PDF" nel dettaglio preventivo (download file)
- [ ] T060 [US5/US6] Test backend (Jest): generazione PDF pdfkit, API impostazioni, upload file
- [ ] T061 [US5/US6] Test frontend (Vitest): impostazioni, generazione PDF

## Phase 7: User Story 4 - Ricerca/Backup Preventivi (P3)

- [ ] T062 [P] [US4] Implementa endpoint ricerca preventivi `/api/preventivi/search` per numero, cliente, anno
- [ ] T063 [P] [US4] Implementa endpoint export/import preventivo (`/api/preventivi/export`, `/api/preventivi/import`, formato JSON)
- [ ] T064 [P] [US4] UI Vue: ricerca avanzata preventivi (filtri, autocomplete cliente)
- [ ] T065 [P] [US4] UI Vue: export/import file preventivo
- [ ] T066 [US4] Test backend (Jest): ricerca, export/import
- [ ] T067 [US4] Test frontend (Vitest): ricerca, export/import

## Phase 8: User Story 7 - Log Modifiche (P3)

- [ ] T068 [P] [US7] Migrazione Knex: tabella `log_modifiche` (utente_id, entita, entita_id, azione, dettaglio jsonb, created_at)
- [ ] T069 [P] [US7] Implementa middleware/service per logging automatico operazioni (CRUD magazzino, preventivi, clienti, impostazioni)
- [ ] T070 [P] [US7] Implementa API `/api/log` (GET con filtri per entità, utente, data, paginazione)
- [ ] T071 [P] [US7] UI Vue: pagina visualizzazione log modifiche (con filtri e paginazione)
- [ ] T072 [US7] Test backend (Jest): logging, API log
- [ ] T073 [US7] Test frontend (Vitest): visualizzazione log

## Polish & Cross-Cutting

- [ ] T074 [P] Seed Knex: dati di esempio (categorie, pezzi, clienti, impostazioni officina)
- [ ] T075 [P] Aggiorna documentazione tecnica (README, quickstart)
- [ ] T076 [P] Aggiorna Makefile e script di deploy
- [ ] T077 [P] Audit sicurezza: dipendenze, test vulnerabilità, check JWT, upload file
- [ ] T078 [P] Test cross-device/responsive, fix UI mobile
- [ ] T079 [P] Refactor finale, cleanup codice e commenti inutili
