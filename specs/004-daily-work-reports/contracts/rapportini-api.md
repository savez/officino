# API Contract: Rapportini

**Base path**: `/api/rapportini`

## Endpoints

### `GET /api/rapportini` — Lista righe rapportino

**Auth**: JWT required
**Behavior**:
- Operaio (`ruolo: user`): restituisce solo le proprie righe
- Admin (`ruolo: admin`): restituisce tutte le righe, supporta filtri

**Query params**:

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `page` | integer | no | Pagina (default 1) |
| `perPage` | integer | no | Righe per pagina (default 20) |
| `cliente_id` | integer | no | Filtra per cliente (solo admin) |
| `utente_id` | integer | no | Filtra per operaio (solo admin) |
| `giorno` | date (YYYY-MM-DD) | no | Filtra per giornata |
| `gestita` | boolean | no | Filtra per stato gestione |

**Response 200**:
```json
{
    "data": [
        {
            "id": 1,
            "utente_id": 2,
            "utente_nome": "Marco",
            "cliente_id": 1,
            "cliente_nome": "Mario Rossi",
            "giorno": "2026-03-09",
            "ora_inizio": "08:00",
            "ora_fine": "12:00",
            "macchina": "Trattore John Deere",
            "note": "Sostituzione filtro olio",
            "nota_lavorazione_id": null,
            "materiali": [
                {
                    "id": 1,
                    "pezzo_id": 5,
                    "nome": "Filtro olio motore",
                    "quantita": 1,
                    "fuori_magazzino": false
                }
            ],
            "created_at": "2026-03-09T10:30:00Z"
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

### `POST /api/rapportini` — Inserisci riga rapportino

**Auth**: JWT required (qualsiasi ruolo)
**Note**: La riga viene salvata con `utente_id` dell'utente autenticato.

**Request body**:
```json
{
    "cliente_id": 1,
    "giorno": "2026-03-09",
    "ora_inizio": "14:00",
    "ora_fine": "18:00",
    "macchina": "Sollevatore CAT",
    "note": "Riparazione impianto idraulico",
    "materiali": [
        { "pezzo_id": 3, "quantita": 2 },
        { "nome_manuale": "Guarnizione speciale", "quantita": 1, "fuori_magazzino": true }
    ]
}
```

**Validation (Zod)**:
- `cliente_id`: integer, required
- `giorno`: date string (YYYY-MM-DD), required
- `ora_inizio`: time string (HH:mm), required
- `ora_fine`: time string (HH:mm), required, must be > ora_inizio
- `macchina`: string, optional
- `note`: string, optional
- `materiali`: array, optional. Each item:
  - Se `fuori_magazzino !== true`: `pezzo_id` required, `quantita` integer >= 1 (default 1)
  - Se `fuori_magazzino === true`: `nome_manuale` required, `quantita` integer >= 1 (default 1)

**Side effects**:
- Per ogni materiale da magazzino: `pezzi_magazzino.quantita -= materiale.quantita` (in transazione)
- Log audit: `logModifica(db, { entita: 'riga_rapportino', azione: 'creazione', ... })`

**Response 201**:
```json
{
    "id": 1,
    "message": "Riga rapportino inserita"
}
```

**Errors**:
- `400`: Validazione fallita (ora_fine <= ora_inizio, campi mancanti)
- `400`: Stock insufficiente per un materiale (`"Stock insufficiente per: Filtro olio"`)
- `404`: Cliente o pezzo non trovato

---

### `DELETE /api/rapportini/:id` — Cancella riga rapportino

**Auth**: JWT required
**Behavior**:
- Operaio: può cancellare solo le proprie righe con `nota_lavorazione_id IS NULL`
- Admin: può cancellare qualsiasi riga

**Side effects**:
- Ripristino stock: per ogni materiale da magazzino, `pezzi_magazzino.quantita += materiale.quantita`
- Se la riga era associata a una nota: l'associazione viene rimossa (SET NULL nel DB)
- Log audit: `logModifica(db, { entita: 'riga_rapportino', azione: 'eliminazione', ... })`

**Response 200**:
```json
{
    "message": "Riga rapportino eliminata"
}
```

**Errors**:
- `403`: Operaio tenta di cancellare riga gestita (`"Non puoi cancellare una riga già gestita"`)
- `403`: Operaio tenta di cancellare riga di un altro utente
- `404`: Riga non trovata

---

### `GET /api/rapportini/stampa` — Stampa PDF rapportini

**Auth**: JWT required, solo admin

**Query params**:

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `giorno` | date | condizionale | Filtra per giornata (almeno uno tra giorno e cliente_id) |
| `cliente_id` | integer | condizionale | Filtra per cliente (almeno uno tra giorno e cliente_id) |

**Response 200**: `Content-Type: application/pdf`

Layout: intestazione cliente o giornata, tabella righe (operaio, giorno, fascia oraria, macchina, materiali, note), totale ore.
