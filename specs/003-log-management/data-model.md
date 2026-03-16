# Data Model: Gestione Log — Flag Attivazione e Pulizia

**Feature**: 003-log-management
**Date**: 2026-03-01

---

## Entità modificate

### impostazioni_officina (estesa)

Tabella esistente. Viene aggiunta una sola colonna.

| Campo                | Tipo        | Nullable | Default  | Descrizione                                      |
| -------------------- | ----------- | -------- | -------- | ------------------------------------------------ |
| id                   | integer     | NO       | auto     | Chiave primaria                                  |
| nome                 | varchar     | NO       | —        | Nome officina                                    |
| partita_iva          | varchar     | YES      | NULL     | Partita IVA                                      |
| indirizzo            | varchar     | YES      | NULL     | Indirizzo                                        |
| telefono             | varchar     | YES      | NULL     | Telefono                                         |
| email                | varchar     | YES      | NULL     | Email                                            |
| logo_url             | varchar     | YES      | NULL     | Path relativo del logo                           |
| aliquota_iva_default | decimal     | NO       | 22       | Aliquota IVA %                                   |
| **log_attivi**       | **boolean** | **NO**   | **TRUE** | **Flag: abilita/disabilita scrittura log** ← NEW |
| created_at           | timestamp   | NO       | now()    | Data creazione                                   |
| updated_at           | timestamp   | NO       | now()    | Data ultima modifica                             |

**Migration**: `20260301_010_add_log_attivi_to_impostazioni.js`

```sql
ALTER TABLE impostazioni_officina
  ADD COLUMN log_attivi BOOLEAN NOT NULL DEFAULT TRUE;
```

**Invariant**: La tabella contiene sempre esattamente una riga (singleton). Il campo `log_attivi` governa globalmente la scrittura di tutti i log di modifica.

---

### log_modifiche (invariata)

Tabella esistente. Nessuna modifica allo schema.

| Campo      | Tipo      | Nullable | Default | Descrizione                                                                        |
| ---------- | --------- | -------- | ------- | ---------------------------------------------------------------------------------- |
| id         | integer   | NO       | auto    | Chiave primaria                                                                    |
| utente_id  | integer   | YES      | NULL    | FK → utenti.id (NULL se utente eliminato)                                          |
| entita     | varchar   | NO       | —       | Tipo entità (`preventivo`, `pezzo_magazzino`, `cliente`, `impostazioni`)           |
| entita_id  | integer   | NO       | —       | ID dell'entità modificata                                                          |
| azione     | varchar   | NO       | —       | Tipo azione (`creazione`, `modifica`, `eliminazione`, `cambio_stato`, `scalatura`) |
| dettaglio  | jsonb     | YES      | NULL    | Before/after values come `{ campo: { prima, dopo } }`                              |
| created_at | timestamp | NO       | now()   | Data e ora della modifica                                                          |

**Indici esistenti** (nessuna modifica):

- `(entita, entita_id)` — lookup per entità specifica
- `(utente_id)` — lookup per utente
- `(created_at DESC)` — ordinamento cronologico + range queries per purge

---

## Flussi di aggiornamento dati

### Flag log_attivi — scrittura

```
[PUT /api/impostazioni] → update impostazioni_officina SET log_attivi = $valore
```

- Effetto immediato: la prossima chiamata a `logModifica` leggerà il nuovo valore dal DB.
- I log già scritti non vengono toccati.

### Flag log_attivi — lettura (in logModifica)

```
logModifica(db, params):
  1. SELECT log_attivi FROM impostazioni_officina LIMIT 1
  2. Se log_attivi = false → return (nessun insert)
  3. Se log_attivi = true (o row assente, default sicuro) → INSERT INTO log_modifiche
```

### Purge log per data

```
[GET /api/log/count-before?data=D]  → SELECT COUNT(*) FROM log_modifiche WHERE created_at < D
[DELETE /api/log/before?data=D]     → DELETE FROM log_modifiche WHERE created_at < D
```

La data `D` è intesa come inizio della giornata: `created_at < '2026-03-01 00:00:00'` elimina tutti i log del 28 febbraio e precedenti.
