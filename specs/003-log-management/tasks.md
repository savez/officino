# Tasks: Gestione Log — Flag Attivazione e Pulizia

**Feature**: 003-log-management
**Branch**: `003-log-management`
**Input**: Design documents from `/specs/003-log-management/`

---

## Dependencies & Prerequisites

- ✅ Branch `002-user-roles` merged/available (RBAC system: `requireRole`, `isAdmin`, router guards)
- ✅ Database migrations 001–009 applied
- ✅ Seeds applied (impostazioni_officina row exists)

---

## Phase 1: Setup

**Purpose**: Database schema update

- [x] T001 Create migration `backend/migrations/20260301_010_add_log_attivi_to_impostazioni.js` with `ALTER TABLE impostazioni_officina ADD COLUMN log_attivi BOOLEAN NOT NULL DEFAULT TRUE`
- [x] T002 Run migration locally with `make migrate` and verify column added

---

## Phase 2: User Story 1 — Flag attivazione/disattivazione log (Priority: P1) 🎯 MVP

**Goal**: Admin può attivare/disattivare la registrazione dei log dalle Impostazioni. Quando disattivato, nessun nuovo log viene scritto.

**Independent Test**: Accedere come admin, disattivare il flag in Impostazioni, modificare un cliente, verificare che nessun log venga scritto. Riattivare e verificare che i log riprendano.

### Backend Implementation (US1)

- [x] T003 [P] [US1] Modify `backend/src/services/log-modifiche.js`: add guard at start of `logModifica` to query `log_attivi` from `impostazioni_officina` and return early if false
- [x] T004 [P] [US1] Modify `backend/src/routes/impostazioni.js`: extend Zod schema `impostazioniSchema` with `log_attivi: z.boolean().default(true)` and include it in PUT handler

### Frontend Implementation (US1)

- [x] T005 [US1] Modify `frontend/src/pages/ImpostazioniPage.vue`: add checkbox `form-check` with label "Attiva registrazione log modifiche" bound to `formData.log_attivi`, include in save payload

### Tests (US1)

- [x] T006 [P] [US1] Modify `backend/tests/unit/log-modifiche.test.js`: add test case for `logModifica` with `log_attivi = false` verifying no insert happens
- [x] T007 [P] [US1] Modify `backend/tests/integration/impostazioni.test.js`: add test for PUT `/api/impostazioni` with `log_attivi: false`, verify response includes field

**Checkpoint US1**: Con il flag disattivato, zero nuovi log vengono creati. Admin può toggle il flag in <10 secondi.

---

## Phase 3: User Story 2 — Cancellazione log per data (Priority: P1)

**Goal**: Admin può eliminare tutti i log precedenti a una data scelta. Conteggio prima della conferma. Cancellazione irreversibile.

**Independent Test**: Accedere come admin alla pagina Log, selezionare data di soglia, verificare conteggio, confermare cancellazione, verificare che i log precedenti siano stati rimossi.

### Backend Implementation (US2)

- [x] T008 [US2] Modify `backend/src/routes/log.js`: add `GET /count-before` endpoint with Zod validation `z.object({ data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })`, query `COUNT(*) FROM log_modifiche WHERE created_at < $data`, return `{ count: N }` (register BEFORE `/:entita/:entita_id`)
- [x] T009 [US2] Modify `backend/src/routes/log.js`: add `DELETE /before` endpoint with same validation, query `DELETE FROM log_modifiche WHERE created_at < $data RETURNING id`, return `{ deleted: rows.length }` (register BEFORE `/:entita/:entita_id`)

### Frontend Implementation (US2)

- [x] T010 [US2] Modify `frontend/src/services/log.js`: add `countLogsBefore(data)` function calling `GET /api/log/count-before?data=${data}`
- [x] T011 [US2] Modify `frontend/src/services/log.js`: add `purgeLogsBefore(data)` function calling `DELETE /api/log/before?data=${data}`
- [x] T012 [US2] Modify `frontend/src/pages/LogModifichePage.vue`: add "Pulizia Log" section at top with input date, button "Conta record", badge showing count, button "Elimina" enabled only if count > 0, Bootstrap modal for confirmation showing count

### Tests (US2)

- [x] T013 [P] [US2] Modify `backend/tests/integration/log.test.js`: add test for `GET /api/log/count-before` with inserted logs, verify count is correct
- [x] T014 [P] [US2] Modify `backend/tests/integration/log.test.js`: add test for `DELETE /api/log/before` verifying old logs deleted and recent logs preserved

**Checkpoint US2**: Admin può contare e cancellare log per data in <30 secondi con feedback visivo.

---

## Phase 4: User Story 3 — Restrizione accesso admin (Priority: P1)

**Goal**: Solo admin può vedere/accedere ai log. Utenti normali: voce menu nascosta, route guardata (403), API protetta (403).

**Independent Test**: Accedere come user, verificare voce Log nascosta nel menu, tentare URL `/log` e verificare redirect 403, chiamare `GET /api/log` e verificare 403.

### Backend Implementation (US3)

- [x] T015 [US3] Modify `backend/src/routes/log.js`: change `preHandler` from `[app.authenticate]` to `[app.authenticate, app.requireRole('admin')]` on all 4 endpoints (2 GET + count-before + before)

### Frontend Implementation (US3)

- [x] T016 [P] [US3] Modify `frontend/src/App.vue`: wrap `<router-link to="/log">` with `v-if="adminUser"` (same pattern as Utenti and Impostazioni)
- [x] T017 [P] [US3] Modify `frontend/src/router/index.js`: add `meta: { requiresAdmin: true }` to `/log` route definition

### Tests (US3)

- [x] T018 [P] [US3] Modify `backend/tests/integration/log.test.js`: add test with user token (non-admin) calling `GET /api/log` and verifying 403 response
- [x] T019 [P] [US3] Modify `backend/tests/integration/log.test.js`: add test with admin token calling all 4 endpoints and verifying 200 responses

**Checkpoint US3**: 100% dei route log protetti. User non può accedere ai log in alcun modo.

---

## Phase 5: Polish & Validation

**Purpose**: Cross-cutting concerns and final validation

- [x] T020 [P] Run backend test suite with `cd backend && pnpm test` and verify all tests pass
- [x] T021 [P] Run linter with `cd backend && pnpm run lint` and fix any issues
- [x] T022 [P] Run linter with `cd frontend && pnpm run lint` and fix any issues
- [x] T023 Manually follow quickstart.md scenarios and verify all 3 user stories work end-to-end
- [x] T024 [P] Update README.md section on log management feature (if needed)

---

## Dependencies & Execution Order

### Phase Dependencies

1. **Setup (Phase 1)**: No dependencies - start immediately
   - T001 → T002 (sequential)
2. **User Story 1 (Phase 2)**: Depends on T002 completion
   - Backend: T003, T004 can run in parallel
   - Frontend: T005 depends on T004 (schema must match)
   - Tests: T006, T007 can run in parallel after implementation
3. **User Story 2 (Phase 3)**: Depends on T002, independent of US1
   - Backend: T008 → T009 (sequential, T009 needs T008 pattern)
   - Frontend: T010, T011 can run in parallel; T012 depends on both
   - Tests: T013, T014 can run in parallel after implementation
4. **User Story 3 (Phase 4)**: Depends on T008, T009 (endpoints must exist)
   - Backend: T015 modifies all 4 endpoints
   - Frontend: T016, T017 can run in parallel
   - Tests: T018, T019 can run in parallel after implementation
5. **Polish (Phase 5)**: Depends on all user stories complete
   - T020, T021, T022, T024 can run in parallel
   - T023 must run last (validates everything)

### Story Completion Order

```text
Setup → US1 (MVP) → US2 → US3 → Polish
         ↓            ↓      ↓
       (can be delivered as increments)
```

### Parallel Opportunities per Story

**US1 parallel batch**:

```bash
# After T002 completes
T003 & T004 in parallel (different files)
→ T005 (depends on T004)
→ T006 & T007 in parallel (different test files)
```

**US2 parallel batch**:

```bash
# After T002 completes
T008 → T009
T010 & T011 in parallel (same file, different functions) → T012
→ T013 & T014 in parallel (same file, different tests)
```

**US3 parallel batch**:

```bash
# After T015 completes
T016 & T017 in parallel (different files)
→ T018 & T019 in parallel (same file, different tests)
```

---

## Implementation Strategy

### Suggested MVP Delivery

**Iteration 1** (MVP): User Story 1 only

- Delivers core requirement: toggle log recording on/off
- ~6 tasks (T001-T007)
- Testable independently
- Provides value: admin can control log verbosity

**Iteration 2**: Add User Story 2

- Adds maintenance capability: purge old logs
- ~7 tasks (T008-T014)
- Testable independently
- Provides value: database cleanup

**Iteration 3**: Add User Story 3

- Fixes security gap: admin-only access
- ~5 tasks (T015-T019)
- Testable independently
- Provides value: proper authorization

**Iteration 4**: Polish

- ~5 tasks (T020-T024)
- Ensures production readiness

### Risk Mitigation

- **Route order**: T008 and T009 MUST register `/count-before` and `/before` BEFORE `/:entita/:entita_id` in `log.js` (Fastify matches routes in registration order)
- **Breaking change**: T015 changes auth requirements on existing endpoints - coordinate with any API clients
- **Data safety**: T009 is destructive - ensure backup strategy before production deployment

---

## Task Summary

- **Total tasks**: 24
- **Setup**: 2 tasks
- **User Story 1 (MVP)**: 5 tasks (1 migration + 2 backend + 1 frontend + 2 tests)
- **User Story 2**: 7 tasks (2 backend endpoints + 3 frontend + 2 tests)
- **User Story 3**: 5 tasks (1 backend guard + 2 frontend + 2 tests)
- **Polish**: 5 tasks

**Parallel opportunities**: 12 tasks marked [P], ~50% parallelizable within phases

**Estimated effort**: ~1-2 days for full feature (all 3 stories + polish) for experienced developer familiar with codebase
