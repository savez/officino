# Data Model: Rapportini Giornalieri e Note di Lavorazione

**Branch**: `004-daily-work-reports` | **Date**: 2026-03-09

## Nuove Tabelle

### 1. `righe_rapportino`

Registra ogni attività lavorativa inserita da un operaio.

| Colonna | Tipo | Vincoli | Descrizione |
|---------|------|---------|-------------|
| `id` | `increments` | PK | ID auto-incrementante |
| `utente_id` | `integer unsigned` | FK → `utenti.id`, NOT NULL | Operaio che ha inserito la riga |
| `cliente_id` | `integer unsigned` | FK → `clienti.id`, NOT NULL | Cliente presso cui si è lavorato |
| `giorno` | `date` | NOT NULL | Data della lavorazione |
| `ora_inizio` | `time` | NOT NULL | Ora inizio attività |
| `ora_fine` | `time` | NOT NULL | Ora fine attività (deve essere > ora_inizio) |
| `macchina` | `string` | nullable | Macchina/attrezzatura (testo libero) |
| `note` | `text` | nullable | Note libere |
| `nota_lavorazione_id` | `integer unsigned` | FK → `note_lavorazione.id` ON DELETE SET NULL, nullable | Associazione alla nota (NULL = non gestita) |
| `created_at` | `timestamp` | auto | Data creazione |
| `updated_at` | `timestamp` | auto | Data ultimo aggiornamento |

**Indici**:
- `idx_righe_rapportino_utente` su `utente_id`
- `idx_righe_rapportino_cliente` su `cliente_id`
- `idx_righe_rapportino_giorno` su `giorno`
- `idx_righe_rapportino_nota` su `nota_lavorazione_id`

**Regole di business**:
- `ora_fine > ora_inizio` (validazione applicativa, non DB constraint)
- L'operaio può cancellare solo righe con `nota_lavorazione_id IS NULL`
- Stato "gestita" derivato: `nota_lavorazione_id IS NOT NULL`

---

### 2. `materiali_rapportino`

Materiali utilizzati in una riga di rapportino (0..N per riga).

| Colonna | Tipo | Vincoli | Descrizione |
|---------|------|---------|-------------|
| `id` | `increments` | PK | ID auto-incrementante |
| `riga_rapportino_id` | `integer unsigned` | FK → `righe_rapportino.id` ON DELETE CASCADE, NOT NULL | Riga a cui appartiene |
| `pezzo_id` | `integer unsigned` | FK → `pezzi_magazzino.id`, nullable | Prodotto magazzino (NULL se fuori magazzino) |
| `nome_manuale` | `string` | nullable | Nome prodotto fuori magazzino |
| `quantita` | `integer` | NOT NULL, DEFAULT 1 | Quantità utilizzata |
| `fuori_magazzino` | `boolean` | NOT NULL, DEFAULT false | Flag prodotto non a magazzino |
| `created_at` | `timestamp` | auto | Data creazione |

**Indici**:
- `idx_materiali_rapportino_riga` su `riga_rapportino_id`
- `idx_materiali_rapportino_pezzo` su `pezzo_id`

**Regole di business**:
- Se `fuori_magazzino = false` → `pezzo_id` è obbligatorio, `nome_manuale` è NULL
- Se `fuori_magazzino = true` → `pezzo_id` è NULL, `nome_manuale` è obbligatorio
- `quantita >= 1`
- Al salvataggio: se `fuori_magazzino = false`, decrementa `pezzi_magazzino.quantita` di `quantita`
- Alla cancellazione: se `fuori_magazzino = false`, ripristina `pezzi_magazzino.quantita` di `quantita`

---

### 3. `note_lavorazione`

Riepilogo di lavorazioni creato dall'amministratore per un singolo cliente.

| Colonna | Tipo | Vincoli | Descrizione |
|---------|------|---------|-------------|
| `id` | `increments` | PK | ID auto-incrementante |
| `cliente_id` | `integer unsigned` | FK → `clienti.id`, NOT NULL | Cliente della nota |
| `testo` | `text` | nullable | Riassunto/note libere dell'amministratore |
| `mostra_dettagli` | `boolean` | NOT NULL, DEFAULT true | Mostrare dettaglio righe nella stampa |
| `created_at` | `timestamp` | auto | Data creazione |
| `updated_at` | `timestamp` | auto | Data ultimo aggiornamento |

**Indici**:
- `idx_note_lavorazione_cliente` su `cliente_id`

**Regole di business**:
- Tutte le `righe_rapportino` associate devono avere lo stesso `cliente_id`
- La cancellazione di una nota imposta `nota_lavorazione_id = NULL` sulle righe associate (ON DELETE SET NULL già configurato in `righe_rapportino`)

---

## Tabelle Esistenti Modificate

Nessuna modifica strutturale alle tabelle esistenti. Le relazioni si appoggiano su FK verso `utenti`, `clienti` e `pezzi_magazzino` senza alterarne lo schema.

---

## Entity Relationship Diagram (testuale)

```
utenti (1) ←──── (N) righe_rapportino     "un operaio ha molte righe"
clienti (1) ←──── (N) righe_rapportino    "un cliente ha molte righe"
clienti (1) ←──── (N) note_lavorazione    "un cliente ha molte note"

righe_rapportino (1) ←──── (N) materiali_rapportino   "una riga ha molti materiali"
righe_rapportino (N) ────→ (1) note_lavorazione       "molte righe in una nota"

pezzi_magazzino (1) ←──── (N) materiali_rapportino    "un pezzo usato in molti rapportini"
```

---

## Migrazioni Knex

### Migration 012: `create_righe_rapportino`

```javascript
exports.up = async (knex) => {
    await knex.schema.createTable('righe_rapportino', (table) => {
        table.increments('id').primary();
        table.integer('utente_id').unsigned().notNullable()
            .references('id').inTable('utenti');
        table.integer('cliente_id').unsigned().notNullable()
            .references('id').inTable('clienti');
        table.date('giorno').notNullable();
        table.time('ora_inizio').notNullable();
        table.time('ora_fine').notNullable();
        table.string('macchina');
        table.text('note');
        table.integer('nota_lavorazione_id').unsigned()
            .references('id').inTable('note_lavorazione').onDelete('SET NULL');
        table.timestamps(true, true);

        table.index('utente_id', 'idx_righe_rapportino_utente');
        table.index('cliente_id', 'idx_righe_rapportino_cliente');
        table.index('giorno', 'idx_righe_rapportino_giorno');
        table.index('nota_lavorazione_id', 'idx_righe_rapportino_nota');
    });
};

exports.down = async (knex) => {
    await knex.schema.dropTableIfExists('righe_rapportino');
};
```

### Migration 013: `create_materiali_rapportino`

```javascript
exports.up = async (knex) => {
    await knex.schema.createTable('materiali_rapportino', (table) => {
        table.increments('id').primary();
        table.integer('riga_rapportino_id').unsigned().notNullable()
            .references('id').inTable('righe_rapportino').onDelete('CASCADE');
        table.integer('pezzo_id').unsigned()
            .references('id').inTable('pezzi_magazzino');
        table.string('nome_manuale');
        table.integer('quantita').notNullable().defaultTo(1);
        table.boolean('fuori_magazzino').notNullable().defaultTo(false);
        table.timestamp('created_at').defaultTo(knex.fn.now());

        table.index('riga_rapportino_id', 'idx_materiali_rapportino_riga');
        table.index('pezzo_id', 'idx_materiali_rapportino_pezzo');
    });
};

exports.down = async (knex) => {
    await knex.schema.dropTableIfExists('materiali_rapportino');
};
```

### Migration 014: `create_note_lavorazione`

```javascript
exports.up = async (knex) => {
    await knex.schema.createTable('note_lavorazione', (table) => {
        table.increments('id').primary();
        table.integer('cliente_id').unsigned().notNullable()
            .references('id').inTable('clienti');
        table.text('testo');
        table.boolean('mostra_dettagli').notNullable().defaultTo(true);
        table.timestamps(true, true);

        table.index('cliente_id', 'idx_note_lavorazione_cliente');
    });
};

exports.down = async (knex) => {
    await knex.schema.dropTableIfExists('note_lavorazione');
};
```

**Nota sull'ordine delle migrazioni**: `note_lavorazione` (014) deve essere creata PRIMA di `righe_rapportino` (012) perché quest'ultima ha una FK verso `note_lavorazione`. L'ordine corretto di esecuzione è: **014 → 012 → 013**. I nomi dei file vanno rinumerati di conseguenza:

- `20260309_012_create_note_lavorazione.js`
- `20260309_013_create_righe_rapportino.js`
- `20260309_014_create_materiali_rapportino.js`
