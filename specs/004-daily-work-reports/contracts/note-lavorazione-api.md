# API Contract: Note di Lavorazione

**Base path**: `/api/note-lavorazione`

## Endpoints

### `GET /api/note-lavorazione` — Lista note di lavorazione

**Auth**: JWT required, solo admin

**Query params**:

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `page` | integer | no | Pagina (default 1) |
| `perPage` | integer | no | Righe per pagina (default 20) |
| `cliente_id` | integer | no | Filtra per cliente |

**Response 200**:
```json
{
    "data": [
        {
            "id": 1,
            "cliente_id": 1,
            "cliente_nome": "Mario Rossi",
            "testo": "Manutenzione straordinaria trattore...",
            "mostra_dettagli": true,
            "ore_totali": 12.5,
            "num_righe": 3,
            "created_at": "2026-03-09T15:00:00Z",
            "updated_at": "2026-03-09T15:00:00Z"
        }
    ],
    "pagination": {
        "page": 1,
        "perPage": 20,
        "total": 1,
        "totalPages": 1
    }
}
```

---

### `GET /api/note-lavorazione/:id` — Dettaglio nota di lavorazione

**Auth**: JWT required, solo admin

**Response 200**:
```json
{
    "id": 1,
    "cliente_id": 1,
    "cliente_nome": "Mario Rossi",
    "testo": "Manutenzione straordinaria trattore...",
    "mostra_dettagli": true,
    "created_at": "2026-03-09T15:00:00Z",
    "updated_at": "2026-03-09T15:00:00Z",
    "righe": [
        {
            "id": 1,
            "utente_nome": "Marco",
            "giorno": "2026-03-09",
            "ora_inizio": "08:00",
            "ora_fine": "12:00",
            "ore": 4,
            "macchina": "Trattore John Deere",
            "note": "Sostituzione filtro olio",
            "materiali": [
                { "nome": "Filtro olio motore", "quantita": 1, "fuori_magazzino": false }
            ]
        }
    ],
    "ore_totali": 12.5
}
```

---

### `POST /api/note-lavorazione` — Crea nota di lavorazione

**Auth**: JWT required, solo admin

**Request body**:
```json
{
    "cliente_id": 1,
    "testo": "Manutenzione straordinaria trattore...",
    "mostra_dettagli": true,
    "righe_ids": [1, 2, 3]
}
```

**Validation (Zod)**:
- `cliente_id`: integer, required
- `testo`: string, optional
- `mostra_dettagli`: boolean, default true
- `righe_ids`: array of integers, required, min 1

**Business rules**:
- Tutte le righe in `righe_ids` devono avere `cliente_id` uguale al `cliente_id` della nota
- Nessuna riga in `righe_ids` può avere `nota_lavorazione_id` già valorizzato
- In transazione: crea nota + aggiorna `righe_rapportino.nota_lavorazione_id`

**Response 201**:
```json
{
    "id": 1,
    "message": "Nota di lavorazione creata"
}
```

**Errors**:
- `400`: Righe appartenenti a clienti diversi
- `400`: Righe già associate a un'altra nota
- `404`: Cliente o righe non trovate

---

### `PUT /api/note-lavorazione/:id` — Modifica nota di lavorazione

**Auth**: JWT required, solo admin

**Request body**:
```json
{
    "testo": "Testo aggiornato...",
    "mostra_dettagli": false,
    "righe_ids": [1, 2, 4]
}
```

**Business rules**:
- Le righe rimosse (presenti prima, assenti in `righe_ids`) tornano a `nota_lavorazione_id = NULL`
- Le righe aggiunte (assenti prima, presenti in `righe_ids`) vengono associate alla nota
- Le nuove righe devono avere lo stesso `cliente_id` e non essere associate ad altre note
- In transazione: aggiorna nota + aggiorna associazioni righe

**Response 200**:
```json
{
    "message": "Nota di lavorazione aggiornata"
}
```

**Errors**:
- `400`: Righe con cliente diverso o già associate ad altra nota
- `404`: Nota o righe non trovate

---

### `DELETE /api/note-lavorazione/:id` — Cancella nota di lavorazione

**Auth**: JWT required, solo admin

**Side effects**:
- Tutte le righe associate tornano a `nota_lavorazione_id = NULL` (gestito da ON DELETE SET NULL)
- Log audit

**Response 200**:
```json
{
    "message": "Nota di lavorazione eliminata"
}
```

---

### `GET /api/note-lavorazione/:id/stampa` — Stampa PDF nota di lavorazione

**Auth**: JWT required, solo admin

**Response 200**: `Content-Type: application/pdf`

Layout: intestazione cliente, testo riassuntivo. Se `mostra_dettagli = true`: tabella righe con operaio, giorno, fascia oraria, macchina, materiali, note. Totale ore sempre visibile.
