# Data Model: Role-Based Access Control (RBAC)

**Feature**: 002-user-roles
**Date**: 2026-02-28

## Existing Entities (Modified)

### Utente (utenti table)

La tabella esiste già con la colonna `ruolo`. Nessuna migrazione strutturale necessaria.

**Schema attuale:**

| Column        | Type          | Constraints                  | Notes                       |
| ------------- | ------------- | ---------------------------- | --------------------------- |
| id            | serial        | PK, auto-increment           |                             |
| nome          | string        | NOT NULL                     |                             |
| email         | string        | NOT NULL, UNIQUE             |                             |
| password_hash | string        | NOT NULL                     |                             |
| **ruolo**     | **string**    | **NOT NULL, default='user'** | **Valori: 'user', 'admin'** |
| costo_orario  | decimal(10,2) | default=0                    |                             |
| created_at    | timestamp     | auto                         |                             |
| updated_at    | timestamp     | auto                         |                             |

**Cambiamento necessario:** Nessuna migrazione. Solo aggiornamento seed data per avere almeno un utente admin.

## Role Mapping

| Ruolo   | Moduli Accessibili                             | Endpoints Protetti                                       |
| ------- | ---------------------------------------------- | -------------------------------------------------------- |
| `user`  | Magazzino, Categorie, Clienti, Preventivi, Log | Tutti gli endpoint `/api/*` tranne Utenti e Impostazioni |
| `admin` | Tutto (inclusi Utenti e Impostazioni)          | Tutti gli endpoint `/api/*` senza restrizioni            |

## Endpoints by Role

| Endpoint                               | user | admin |
| -------------------------------------- | ---- | ----- |
| GET/POST/PUT/DELETE /api/magazzino/\*  | ✅   | ✅    |
| GET/POST/PUT/DELETE /api/categorie/\*  | ✅   | ✅    |
| GET/POST/PUT/DELETE /api/clienti/\*    | ✅   | ✅    |
| GET/POST/PUT/DELETE /api/preventivi/\* | ✅   | ✅    |
| GET /api/log/\*                        | ✅   | ✅    |
| GET /api/utenti/all                    | ✅   | ✅    |
| GET/POST/PUT/DELETE /api/utenti/\*     | ❌   | ✅    |
| GET/PUT/POST /api/impostazioni/\*      | ❌   | ✅    |

**Nota**: `GET /api/utenti/all` resta accessibile a tutti perché usato nei dropdown preventivi (selezione operaio).
