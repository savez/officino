# Feature Specification: Role-Based Access Control (RBAC)

**Feature Branch**: `002-user-roles`  
**Created**: 2026-02-28  
**Status**: Draft  
**Input**: User description: "Utente può: gestire preventivi, gestire clienti, gestire magazzino, gestire categorie. Admin può fare tutto quello che fa un utente e in più può gestire gli utenti e le impostazioni."

## User Scenarios & Testing _(mandatory)_

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.

  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Regular User Access to Core Features (Priority: P1)

A regular user (non-admin) needs to perform daily warehouse and sales management tasks including creating and managing quotes, clients, inventory items, and product categories.

**Why this priority**: This is the core functionality for regular operational users. Most users will have this role, and the system must enforce their limited permissions correctly to maintain data integrity and security.

**Independent Test**: Can be fully tested by logging in as a regular user and verifying they can: create/edit/delete preventivi, gestire clienti, add/modify inventory items, and manage categories. System blocks access to admin-only features.

**Acceptance Scenarios**:

1. **Given** a user with role "Utente" is logged in, **When** they access the Magazzino page, **Then** they can view and manage all inventory items
2. **Given** a user with role "Utente" is logged in, **When** they access the Clienti page, **Then** they can create, edit, and delete client records
3. **Given** a user with role "Utente" is logged in, **When** they access the Preventivi page, **Then** they can create new quotes and modify existing ones
4. **Given** a user with role "Utente" is logged in, **When** they access the Categorie page, **Then** they can create and manage product categories
5. **Given** a user with role "Utente" is logged in, **When** they try to navigate to Utenti page (management), **Then** they are redirected or denied access with a clear message

---

### User Story 2 - Admin User Full Access (Priority: P1)

An admin user needs complete access to all features including user management and system settings, while maintaining ability to perform all regular user operations.

**Why this priority**: Admin users are critical for system administration. Equal priority to regular user story because admin functionality must be equally robust and secure.

**Independent Test**: Can be fully tested by logging in as an admin user and verifying they can: access all regular user features (preventivi, clienti, magazzino, categorie) plus access Utenti management and Impostazioni pages.

**Acceptance Scenarios**:

1. **Given** a user with role "Admin" is logged in, **When** they access the Utenti page, **Then** they can view all users, their roles, and create/edit/delete users
2. **Given** a user with role "Admin" is logged in, **When** they access the Impostazioni page, **Then** they can configure all system settings
3. **Given** a user with role "Admin" is logged in, **When** they access any core module (Magazzino, Clienti, Preventivi, Categorie), **Then** they have full access with all operations available
4. **Given** a user with role "Admin" logs in, **When** they view the navigation menu, **Then** they see all menu items including Utenti and Impostazioni

---

### User Story 3 - Role Permission Enforcement (Priority: P1)

System must programmatically enforce role-based permissions both on the backend API and frontend UI to prevent unauthorized access and maintain security.

**Why this priority**: Without proper enforcement, role restrictions are ineffective. This is a security-critical feature that must be implemented consistently across all layers.

**Independent Test**: Can be tested by: (a) attempting API calls with invalid role tokens, (b) verifying UI elements are hidden/disabled based on role, (c) checking backend returns 403 for unauthorized operations.

**Acceptance Scenarios**:

1. **Given** a regular user is logged in, **When** they attempt an API call to a protected endpoint (e.g., /api/utenti), **Then** the backend returns 403 Forbidden
2. **Given** the UI is rendered for a regular user, **When** the page loads, **Then** navigation links for admin-only sections (Utenti, Impostazioni) are not visible or are disabled
3. **Given** a regular user attempts to access /utenti directly via URL, **When** the page loads, **Then** they are redirected to a 403 error page or the dashboard
4. **Given** a session token contains role information, **When** the frontend makes API requests, **Then** the backend validates the role before processing

### Edge Cases

- What happens when a user's role is changed while they are logged in? (Should force re-login or refresh session)
- How does system handle a user with no role assigned?
- What happens if an admin deletes their own admin role? (Should prevent self-demotion or require confirmation)
- How are permissions handled during concurrent requests from the same user?

## Requirements _(mandatory)_

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: System MUST support two roles: "Utente" (regular user) and "Admin"
- **FR-002**: Utente role MUST grant permissions to: create/edit/delete preventivi, gestire clienti, manage magazzino, manage categorie
- **FR-003**: Admin role MUST inherit all Utente permissions
- **FR-004**: Admin role MUST grant permissions to: create/edit/delete utenti, modify system settings (impostazioni)
- **FR-005**: System MUST store role information in user records (database and session)
- **FR-006**: Backend API MUST validate user role before processing requests to protected endpoints
- **FR-007**: Backend API MUST return 403 Forbidden for requests from users lacking required permissions
- **FR-008**: Frontend MUST conditionally render UI elements based on user role (hide unauthorized sections)
- **FR-009**: Frontend navigation menu MUST only display pages/sections accessible to the user's role
- **FR-010**: Routes requiring admin access MUST be protected and redirect unauthorized users
- **FR-011**: System MUST prevent users from modifying their own role (role changes require another admin or system action)

### Key Entities _(include if feature involves data)_

- **Utente (User)**: Represents a person accessing the system. Key attributes: id, email, nome, cognome, ruolo (role). Relationship: each user has exactly one role.
- **Ruolo (Role)**: Defines a set of permissions. Key attributes: id, nome (e.g., "Utente", "Admin"), descrizione.
- **Permesso (Permission)**: Represents an allowed action. Key attributes: id, nome (e.g., "create_preventivo", "edit_client"), modulo (module/section).

## Success Criteria _(mandatory)_

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: A regular user cannot access user management or settings pages; attempting to do so results in a 403 error or redirect within 1 second
- **SC-002**: An admin user can access all sections of the application (preventivi, clienti, magazzino, categorie, utenti, impostazioni) and perform all CRUD operations
- **SC-003**: Backend API validates permissions for 100% of protected endpoints; unauthorized requests are rejected with a 403 status code
- **SC-004**: Role transitions (e.g., promoting a user to admin) take effect immediately on new API requests (within the current session or after re-login)
- **SC-005**: At least 95% of UI elements respect role-based visibility (no admin-only sections visible to regular users)
- **SC-006**: No user can modify their own role; any attempt to change one's role is rejected by the backend

## Assumptions

- Users can have only one role (not multiple concurrent roles)
- Roles are pre-defined and managed by admin users; new role types are not created by regular operations
- Session tokens/cookies store role information and are validated on each protected API request
- Password policies and authentication mechanisms are already in place (this feature focuses on authorization, not authentication)
- The existing Utenti page and Impostazioni page structure can be extended to enforce role-based access
- No custom role creation is required in this iteration (only "Utente" and "Admin" roles)

## Dependencies & Constraints

- Depends on existing authentication system (users must already be logged in)
- Requires database changes: add "ruolo" column to utenti table (if not already present)
- Must integrate with existing frontend router to apply role-based guards
- Must not break existing workflows for users who already have records in the system
