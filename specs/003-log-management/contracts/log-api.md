# API Contracts: Log Modifiche

**Feature**: 003-log-management
**Date**: 2026-03-01
**Base URL**: `/api/log`
**Authentication**: JWT Bearer token obbligatorio su tutti gli endpoint
**Authorization**: Ruolo `admin` richiesto su tutti gli endpoint

---

## Endpoint esistenti — modifica autorizzazione

### GET /api/log

Elenca i log di modifica con filtri opzionali e paginazione.

**Autorizzazione**: `admin` ← **PRIMA**: qualsiasi utente autenticato

**Query parameters**:
| Parametro | Tipo | Obbligatorio | Descrizione |
|-----------|------|-------------|-------------|
| page | integer | NO | Pagina corrente (default: 1) |
| per_page | integer | NO | Righe per pagina (default: 20) |
| entita | string | NO | Filtra per tipo entità |
| entita_id | integer | NO | Filtra per ID entità |
| utente_id | integer | NO | Filtra per utente |
| azione | string | NO | Filtra per tipo azione |
| data_da | string (YYYY-MM-DD) | NO | Filtra da data (inclusa) |
| data_a | string (YYYY-MM-DD) | NO | Filtra a data (inclusa, fino a 23:59:59) |

**Response 200**:

```json
{
  "data": [
    {
      "id": 1,
      "utente_id": 2,
      "entita": "pezzo_magazzino",
      "entita_id": 15,
      "azione": "modifica",
      "dettaglio": { "quantita": { "prima": 5, "dopo": 3 } },
      "created_at": "2026-02-28T10:30:00.000Z",
      "utente_nome": "Mario Rossi",
      "utente_email": "mario@example.com"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 42,
    "total_pages": 3
  }
}
```

**Response 401**: Token mancante o non valido
**Response 403**: Utente non admin

---

### GET /api/log/:entita/:entita_id

Elenca i log per una specifica entità.

**Autorizzazione**: `admin` ← **PRIMA**: qualsiasi utente autenticato

**Path parameters**:
| Parametro | Tipo | Descrizione |
|-----------|------|-------------|
| entita | string | Tipo entità (`preventivo`, `pezzo_magazzino`, `cliente`, `impostazioni`) |
| entita_id | integer | ID dell'entità |

**Query parameters**: `page`, `per_page` (stessi del GET principale)

**Response 200**: Struttura identica a `GET /api/log`

**Response 401**: Token mancante o non valido
**Response 403**: Utente non admin

---

## Nuovi endpoint

### GET /api/log/count-before

Conta i log con `created_at` precedente alla data di soglia. Usato dal frontend prima della conferma di cancellazione.

**Autorizzazione**: `admin`

**Query parameters**:
| Parametro | Tipo | Obbligatorio | Descrizione |
|-----------|------|-------------|-------------|
| data | string (YYYY-MM-DD) | **SI** | Data di soglia (esclusa: vengono contati i log con `created_at < data 00:00:00`) |

**Response 200**:

```json
{ "count": 37 }
```

**Response 400**:

```json
{
  "error": "Dati non validi",
  "details": { "fieldErrors": { "data": ["Data obbligatoria"] } }
}
```

**Response 401**: Token mancante o non valido
**Response 403**: Utente non admin

---

### DELETE /api/log/before

Elimina definitivamente tutti i log con `created_at < data 00:00:00`.

**Autorizzazione**: `admin`

**Query parameters**:
| Parametro | Tipo | Obbligatorio | Descrizione |
|-----------|------|-------------|-------------|
| data | string (YYYY-MM-DD) | **SI** | Data di soglia (stessa semantica di count-before) |

**Response 200**:

```json
{ "deleted": 37 }
```

**Response 400**:

```json
{
  "error": "Dati non validi",
  "details": { "fieldErrors": { "data": ["Data obbligatoria"] } }
}
```

**Response 401**: Token mancante o non valido
**Response 403**: Utente non admin

---

## Endpoint impostazioni — esteso

### PUT /api/impostazioni

Aggiornamento delle impostazioni officina. Campo `log_attivi` aggiunto al payload.

**Autorizzazione**: `admin` (invariato)

**Request body** — campo aggiunto:

```json
{
  "nome": "Officina Esempio",
  "partita_iva": "12345678901",
  "indirizzo": "Via Roma 1",
  "telefono": "0461123456",
  "email": "info@officina.it",
  "aliquota_iva_default": 22,
  "log_attivi": true
}
```

| Campo      | Tipo    | Obbligatorio | Validazione               |
| ---------- | ------- | ------------ | ------------------------- |
| log_attivi | boolean | NO           | Default: `true` se omesso |

**Response 200**: Oggetto impostazioni aggiornato incluso `log_attivi`.

**Response 400**: Errore di validazione Zod.

---

## Routing note

**Ordine registrazione route importante**: `GET /api/log/count-before` deve essere registrato PRIMA di `GET /api/log/:entita/:entita_id`, altrimenti Fastify interpreterebbe `count-before` come il parametro `:entita`. Stessa cosa per `DELETE /api/log/before`.
