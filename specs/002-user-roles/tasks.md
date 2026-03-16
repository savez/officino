# Tasks: Role-Based Access Control (RBAC)

**Input**: Design documents from `/specs/002-user-roles/`
**Prerequisites**: plan.md (required), spec.md (required), data-model.md

**Tests**: Inclusi come richiesto dalla constitution (unit test obbligatori per ogni modulo).

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `backend/src/`, `frontend/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create role utilities and update seed data

- [x] T001 Create role constants and requireRole helper in backend/src/utils/roles.js
- [x] T002 [P] Register requireRole decorator in backend/src/app.js
- [x] T003 [P] Update seed data to set first user as admin in backend/seeds/001_sample_data.js
- [x] T004 [P] Add isAdmin() helper to frontend auth service in frontend/src/services/auth.js

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core authorization infrastructure that MUST be complete before user story work

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Add requireRole decorator to Fastify app instance in backend/src/app.js
- [x] T006 [P] Write unit test for requireRole helper in backend/tests/unit/roles.test.js

**Checkpoint**: Authorization infrastructure ready - user story implementation can begin

---

## Phase 3: User Story 1 - Regular User Access to Core Features (Priority: P1) 🎯 MVP

**Goal**: Regular users can access Magazzino, Categorie, Clienti, Preventivi but NOT Utenti or Impostazioni

**Independent Test**: Login as user with ruolo='user', verify access to core modules and denial to admin sections

### Implementation for User Story 1

- [x] T007 [US1] Protect utenti routes with requireRole('admin') preHandler in backend/src/routes/utenti.js (keep GET /all open)
- [x] T008 [US1] Protect impostazioni routes with requireRole('admin') preHandler in backend/src/routes/impostazioni.js
- [x] T009 [US1] Write integration test for regular user denied access to utenti endpoints in backend/tests/integration/utenti-rbac.test.js
- [x] T010 [P] [US1] Write integration test for regular user denied access to impostazioni endpoints in backend/tests/integration/impostazioni-rbac.test.js

**Checkpoint**: Backend enforces role restrictions - regular users get 403 on admin endpoints

---

## Phase 4: User Story 2 - Admin User Full Access (Priority: P1)

**Goal**: Admin users can access all features including Utenti management and Impostazioni

**Independent Test**: Login as user with ruolo='admin', verify full access to all modules

### Implementation for User Story 2

- [x] T011 [US2] Write integration test for admin user accessing utenti endpoints in backend/tests/integration/utenti-rbac.test.js
- [x] T012 [P] [US2] Write integration test for admin user accessing impostazioni endpoints in backend/tests/integration/impostazioni-rbac.test.js
- [x] T013 [US2] Add self-role-modification prevention in PUT /utenti/:id in backend/src/routes/utenti.js

**Checkpoint**: Backend allows admin full access and prevents self-role-modification

---

## Phase 5: User Story 3 - Role Permission Enforcement on Frontend (Priority: P1)

**Goal**: Frontend enforces role-based visibility for navigation and route access

**Independent Test**: Login as regular user, verify nav hides admin links and router blocks admin routes

### Implementation for User Story 3

- [x] T014 [US3] Add meta.requiresAdmin to utenti and impostazioni routes in frontend/src/router/index.js
- [x] T015 [US3] Add role-based beforeEach guard in frontend/src/router/index.js
- [x] T016 [US3] Add conditional rendering of nav items based on role in frontend/src/App.vue
- [x] T017 [P] [US3] Create 403 Forbidden page or redirect logic for unauthorized route access in frontend/src/pages/ForbiddenPage.vue

**Checkpoint**: Frontend hides admin sections for regular users and blocks direct URL access

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and edge case handling

- [x] T018 [P] Run all existing backend tests to verify no regressions
- [x] T019 [P] Run ESLint on all modified files
- [x] T020 Verify complete flow: login as user → denied admin pages → login as admin → full access
- [x] T021 Update seed data documentation in README.md with role info

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on T001 (roles.js) from Setup
- **US1 (Phase 3)**: Depends on Phase 2 completion (requireRole decorator available)
- **US2 (Phase 4)**: Depends on Phase 3 (routes already protected, add admin-specific tests)
- **US3 (Phase 5)**: Depends on Phase 1 T004 (isAdmin helper) - can run in parallel with Phase 3/4
- **Polish (Phase 6)**: Depends on all previous phases

### User Story Dependencies

- **User Story 1 (P1)**: Backend role enforcement → Can start after Phase 2
- **User Story 2 (P1)**: Admin access verification → Can start after US1 protections in place
- **User Story 3 (P1)**: Frontend enforcement → Can start after Phase 1 T004, independent of US1/US2

### Within Each User Story

- Tests can be written alongside implementation (same phase)
- Backend changes before frontend changes
- Route protection before UI changes

### Parallel Opportunities

- T002, T003, T004 can all run in parallel (different files)
- T009, T010 can run in parallel (different test files)
- T011, T012 can run in parallel (different test scopes)
- T018, T019 can run in parallel (lint vs test)
- Phase 3 (backend) and Phase 5 (frontend) can run in partial parallel

---

## Parallel Example: Setup Phase

```bash
# All setup tasks on different files:
Task T002: Register requireRole decorator in backend/src/app.js
Task T003: Update seed data in backend/seeds/001_sample_data.js
Task T004: Add isAdmin helper in frontend/src/services/auth.js
```

## Parallel Example: User Story 1

```bash
# Both integration tests on different endpoint groups:
Task T009: Test regular user denied on utenti endpoints
Task T010: Test regular user denied on impostazioni endpoints
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T004)
2. Complete Phase 2: Foundational (T005-T006)
3. Complete Phase 3: User Story 1 (T007-T010)
4. **STOP and VALIDATE**: Regular users blocked from admin endpoints
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Authorization infrastructure ready
2. Add User Story 1 → Backend enforces restrictions → Test independently (MVP!)
3. Add User Story 2 → Admin access verified → Test independently
4. Add User Story 3 → Frontend enforces restrictions → Test independently
5. Polish → Full regression test → Deploy

### Task Summary

| Phase                      | Tasks  | Parallel         |
| -------------------------- | ------ | ---------------- |
| Setup                      | 4      | 3 parallelizable |
| Foundational               | 2      | 1 parallelizable |
| US1 - Regular User         | 4      | 1 parallelizable |
| US2 - Admin Access         | 3      | 1 parallelizable |
| US3 - Frontend Enforcement | 4      | 1 parallelizable |
| Polish                     | 4      | 2 parallelizable |
| **Total**                  | **21** |                  |
