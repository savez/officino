# Implementation Plan: Role-Based Access Control (RBAC)

**Branch**: `002-user-roles` | **Date**: 2026-02-28 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-user-roles/spec.md`

## Summary

Implement role-based access control with two ruoli predefiniti ("user" e "admin"). Il database ha già la colonna `ruolo` sulla tabella `utenti` e il JWT include il ruolo. Servono: middleware backend per autorizzazione, route guards frontend, menu condizionale, e protezione seed data con almeno un admin.

## Technical Context

**Language/Version**: JavaScript ES2022+ con JSDoc (no TypeScript)
**Primary Dependencies**: Fastify 5.x, Vue.js 3, Vue Router 4, Bootstrap 5, Knex, Zod
**Storage**: PostgreSQL 15+ (colonna `ruolo` già presente in tabella `utenti`)
**Testing**: Jest (backend), Vitest (frontend)
**Target Platform**: Web application (Docker containers)
**Project Type**: Web application (backend API + frontend SPA)
**Performance Goals**: API response < 300ms
**Constraints**: 1-10 utenti concorrenti, mobile-first, security-first
**Scale/Scope**: 3 utenti target, 2 ruoli (user, admin)

## Constitution Check

| Principio         | Conforme | Note                                                                 |
| ----------------- | -------- | -------------------------------------------------------------------- |
| Stack Tecnologico | ✅       | JavaScript + JSDoc, Fastify, Vue.js, Knex, pnpm                      |
| Testing e Qualità | ✅       | Unit test per middleware e route guards                              |
| Stile e Sicurezza | ✅       | camelCase, ESLint, security-first (403 per accessi non autorizzati)  |
| Semplicità e KISS | ✅       | Solo 2 ruoli, nessun sistema permessi complesso, middleware semplice |
| Automazione       | ✅       | Makefile già presente, migrazioni Knex                               |

## Project Structure

### Documentation (this feature)

```text
specs/002-user-roles/
├── plan.md              # This file
├── data-model.md        # Data model changes
├── spec.md              # Feature specification
├── checklists/
│   └── requirements.md  # Requirements checklist
└── tasks.md             # Task breakdown
```

### Source Code (changes to existing repository)

```text
backend/
├── src/
│   ├── app.js                        # Add requireRole decorator
│   ├── routes/
│   │   ├── utenti.js                 # Add requireRole('admin') preHandler
│   │   └── impostazioni.js           # Add requireRole('admin') preHandler
│   └── utils/
│       └── roles.js                  # NEW: Role constants and requireRole helper
├── migrations/
│   └── 20260228_010_update_seed_admin.js  # NEW: Set admin role for seed user
└── seeds/
    └── 001_sample_data.js            # Update: first user ruolo='admin'

frontend/
├── src/
│   ├── App.vue                       # Conditional nav menu based on role
│   ├── router/
│   │   └── index.js                  # Add role-based route guards + meta.requiresAdmin
│   └── services/
│       └── auth.js                   # Add isAdmin() helper
```

**Structure Decision**: Nessuna nuova directory. Si estende la struttura esistente aggiungendo un file utility `roles.js` nel backend e modificando i file esistenti per integrare il controllo ruoli.

## Design Decisions

| #   | Decisione                      | Scelta                       | Alternativa Scartata       | Motivazione                                                    |
| --- | ------------------------------ | ---------------------------- | -------------------------- | -------------------------------------------------------------- |
| 1   | Granularità permessi           | 2 ruoli fissi (user, admin)  | Tabella permessi/ruoli N:M | KISS - solo 2 ruoli necessari, nessun overhead                 |
| 2   | Enforcement backend            | Fastify preHandler decorator | Plugin Fastify custom      | Un decoratore `requireRole` è sufficiente e idiomatico Fastify |
| 3   | Enforcement frontend           | Vue Router beforeEach + meta | Direttive Vue custom       | Più semplice e centralizzato nel router                        |
| 4   | Visibilità menu                | Computed property in App.vue | Store Pinia/Vuex           | Nessuno store presente, computed da localStorage è sufficiente |
| 5   | Ruoli in DB                    | Colonna string con enum Zod  | Tabella ruoli separata     | Già implementato così, 2 soli valori possibili                 |
| 6   | Protezione auto-modifica ruolo | Check nel route handler      | Middleware dedicato        | Un solo endpoint da proteggere (PUT /utenti/:id)               |

## Complexity Tracking

Nessuna violazione della constitution. Implementazione minimale e KISS.
