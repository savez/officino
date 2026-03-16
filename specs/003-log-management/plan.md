# Implementation Plan: Gestione Log — Flag Attivazione e Pulizia

**Branch**: `003-log-management` | **Date**: 2026-03-01 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-log-management/spec.md`

## Summary

Aggiunta di un flag booleano `log_attivi` alle impostazioni officina per controllare la scrittura dei log di audit. Nuovi endpoint admin-only per conteggio e cancellazione log per data. Protezione admin-only di tutti i route log: backend 403 + guard router frontend + voce menu nascosta.

**Approccio tecnico**: migration per `log_attivi`, guard inline in `logModifica` (no caching, KISS), due nuovi endpoint (`GET /api/log/count-before`, `DELETE /api/log/before`), estensione schema Zod impostazioni.

## Technical Context

**Language/Version**: JavaScript (Node.js 22) + JSDoc
**Primary Dependencies**: Fastify 5.x, Knex, Zod, @fastify/jwt, Vue.js 3, Bootstrap 5, Vite
**Storage**: PostgreSQL — 1 colonna booleana aggiuntiva su `impostazioni_officina`
**Testing**: Jest — unit tests + integration tests (backend); nessun test frontend
**Target Platform**: Linux server (Docker container)
**Project Type**: Web application fullstack (REST API + SPA Vue.js)
**Performance Goals**: Nessun requisito specifico (sistema interno, ~10 utenti)
**Constraints**: KISS — no caching, operazioni sincrone, no eventi/websocket
**Scale/Scope**: Uso interno officina, volume log basso

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principio                          | Verifica | Note                             |
| ---------------------------------- | -------- | -------------------------------- |
| JavaScript + JSDoc (no TypeScript) | ✅ PASS  | Nessun tipo TS introdotto        |
| Vue.js + Vite + Bootstrap          | ✅ PASS  | Nessun framework aggiuntivo      |
| Fastify + Knex + PostgreSQL        | ✅ PASS  | 1 migration + query dirette      |
| Unit test obbligatori              | ✅ PASS  | Unit + integration test previsti |
| ESLint + Prettier                  | ✅ PASS  | Nessun nuovo pattern             |
| Security-first                     | ✅ PASS  | Fix security gap: log admin-only |
| KISS — no complessità inutile      | ✅ PASS  | Guard inline, no caching         |
| Nessun dato sensibile hardcoded    | ✅ PASS  | —                                |

**Pre-design gate: PASS** — nessuna violazione. Procedo con Phase 0.

**Post-design gate: PASS** — nessuna violazione introdotta dal design. Nota: ordine registrazione route in `log.js` (path statici `/count-before` e `/before` prima di `/:entita/:entita_id`).

## Project Structure

### Documentation (this feature)

```text
specs/003-log-management/
├── plan.md              # Questo file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── log-api.md       # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks — NON creato da /speckit.plan)
```

### Source Code

```text
backend/
├── migrations/
│   └── 20260301_010_add_log_attivi_to_impostazioni.js  ← NEW
├── src/
│   ├── routes/
│   │   ├── log.js           ← MODIFY: admin guard + endpoint count + endpoint delete
│   │   └── impostazioni.js  ← MODIFY: log_attivi in schema Zod + PUT handler
│   └── services/
│       └── log-modifiche.js ← MODIFY: check log_attivi prima dell'insert
└── tests/
    ├── integration/
    │   ├── log.test.js          ← MODIFY: test admin-only + purge
    │   └── impostazioni.test.js ← MODIFY: test log_attivi field
    └── unit/
        └── log-modifiche.test.js ← MODIFY: test flag-check behavior

frontend/
└── src/
    ├── App.vue                     ← MODIFY: v-if="adminUser" su voce Log nel menu
    ├── router/index.js             ← MODIFY: meta.requiresAdmin su /log
    ├── pages/
    │   ├── LogModifichePage.vue    ← MODIFY: UI bulk delete con date picker + confirm
    │   └── ImpostazioniPage.vue    ← MODIFY: toggle log_attivi nel form
    └── services/
        └── log.js                  ← MODIFY: aggiungere countBefore() e purgeBefore()
```

**Structure Decision**: Web application fullstack Option 2. Nessuna nuova directory. Feature tocca 1 migration, 3 sorgenti backend, 3 test backend, 4 sorgenti frontend.
