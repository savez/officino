# Database Structure Proposal: magazzino-semplice

**Updated**: 2026-02-27

## Tabella: utenti
- id (PK, serial)
- nome (varchar, not null) -- nome visualizzato nei log e preventivi
- email (unique, not null)
- password_hash (not null)
- ruolo (varchar, default 'user') -- riservato per sviluppi futuri, nessun permesso gestito in v1
- costo_orario (numeric, default 0) -- costo orario di default per manodopera nei preventivi
- created_at (timestamp)
- updated_at (timestamp)

## Tabella: categorie
- id (PK, serial)
- nome (varchar, unique, not null)
- descrizione (text)
- created_at (timestamp)
- updated_at (timestamp)

## Tabella: pezzi_magazzino
- id (PK, serial)
- barcode (varchar, unique) -- EAN-13 o codice manuale, nullable se non presente
- nome (varchar, not null)
- marca (varchar)
- modello (varchar)
- categoria_id (FK -> categorie.id, nullable) -- se la categoria viene eliminata, resta null
- quantita (integer, not null, default 0)
- soglia_avviso (integer, default 1)
- prezzo_vendita (numeric, not null) -- prezzo di vendita predefinito, IVA esclusa
- prezzo_acquisto (numeric) -- opzionale, per calcolo margine
- created_at (timestamp)
- updated_at (timestamp)

## Tabella: clienti
- id (PK, serial)
- nome (varchar, not null)
- telefono (varchar)
- email (varchar)
- indirizzo (text)
- codice_fiscale (varchar)
- partita_iva (varchar)
- note (text)
- archiviato (boolean, default false) -- soft delete: clienti con preventivi non si eliminano, si archiviano
- created_at (timestamp)
- updated_at (timestamp)

## Tabella: impostazioni_officina
- id (PK, serial) -- una sola riga attiva
- nome (varchar, not null)
- partita_iva (varchar)
- indirizzo (text)
- telefono (varchar)
- email (varchar)
- logo_url (varchar) -- path al file logo
- aliquota_iva_default (numeric, default 22) -- aliquota IVA predefinita
- created_at (timestamp)
- updated_at (timestamp)

## Tabella: preventivi
- id (PK, serial)
- numero (varchar, unique, not null) -- formato ANNO/NUM progressivo
- cliente_id (FK -> clienti.id, not null)
- utente_id (FK -> utenti.id, not null) -- chi ha creato il preventivo
- data (date, not null)
- stato (varchar, not null, default 'bozza') -- bozza | approvato | rifiutato | scaduto | fatturato
- manodopera_ore (numeric, default 0)
- manodopera_costo_orario (numeric, default 0) -- modificabile per singolo preventivo
- manodopera_totale (numeric) -- ore x costo_orario, calcolato lato applicazione (service layer)
- sconto_tipo (varchar, default 'fisso') -- 'fisso' | 'percentuale'
- sconto_valore (numeric, default 0) -- importo fisso o percentuale
- sconto_calcolato (numeric, default 0) -- importo fisso risultante (se percentuale, viene calcolato)
- aliquota_iva (numeric, default 22) -- aliquota IVA applicata a questo preventivo
- imponibile (numeric) -- somma prezzi pezzi + manodopera
- imponibile_netto (numeric) -- imponibile - sconto_calcolato
- iva (numeric) -- imponibile_netto x aliquota_iva / 100
- totale (numeric) -- imponibile_netto + iva
- note (text)
- created_at (timestamp)
- updated_at (timestamp)

## Tabella: preventivo_pezzi
- id (PK, serial)
- preventivo_id (FK -> preventivi.id, on delete cascade)
- pezzo_id (FK -> pezzi_magazzino.id)
- quantita (integer, not null)
- prezzo_unitario (numeric, not null) -- precompilato da pezzi_magazzino.prezzo_vendita, modificabile
- note (text)

## Tabella: log_modifiche
- id (PK, serial)
- utente_id (FK -> utenti.id)
- entita (varchar, not null) -- 'preventivo' | 'pezzo_magazzino' | 'cliente' | 'impostazioni'
- entita_id (integer, not null) -- ID del record modificato
- azione (varchar, not null) -- 'creazione' | 'modifica' | 'eliminazione' | 'cambio_stato' | 'scalatura'
- dettaglio (jsonb) -- dettagli della modifica (valori prima/dopo)
- created_at (timestamp, not null, default now())

---

## Relazioni

- `pezzi_magazzino.categoria_id` → `categorie.id` (many-to-one, nullable, SET NULL on delete)
- `preventivi.cliente_id` → `clienti.id` (many-to-one, not null)
- `preventivi.utente_id` → `utenti.id` (many-to-one, not null)
- `preventivo_pezzi.preventivo_id` → `preventivi.id` (many-to-one, CASCADE on delete)
- `preventivo_pezzi.pezzo_id` → `pezzi_magazzino.id` (many-to-one)
- `log_modifiche.utente_id` → `utenti.id` (many-to-one)

## Note di design

- **Prezzi IVA esclusa**: tutti i prezzi (vendita, acquisto, preventivo) sono IVA esclusa. L'IVA viene applicata solo sul totale del preventivo.
- **Sconto**: può essere inserito come importo fisso o percentuale. In entrambi i casi, `sconto_calcolato` contiene l'importo fisso risultante che appare sul preventivo/PDF.
- **Manodopera**: una sola voce per preventivo (ore x costo orario). Il costo orario è precompilato dall'utente ma modificabile.
- **Barcode**: formato principale EAN-13, ma accetta anche codici manuali. Il campo è nullable per pezzi senza barcode fisico.
- **Categorie**: se eliminata, i pezzi restano con `categoria_id = null`.
- **Clienti soft delete**: i clienti con preventivi collegati non possono essere eliminati fisicamente, vengono archiviati (`archiviato = true`). I clienti archiviati non appaiono nelle liste di selezione ma i loro preventivi restano accessibili.
- **Preventivo modificabile solo in bozza**: una volta approvato/rifiutato/scaduto/fatturato, il preventivo è bloccato e non modificabile.
- **Paginazione**: tutte le liste (magazzino, clienti, preventivi) sono paginate lato API (es. 25/50 per pagina).
- **Log**: registra operazioni su preventivi e magazzino con dettagli in formato JSON.
- **Impostazioni officina**: una sola riga nel DB, modificabile dall'utente per personalizzare intestazione PDF.
- **Campi calcolati**: `manodopera_totale`, `sconto_calcolato`, `imponibile`, `imponibile_netto`, `iva`, `totale` sono calcolati nel service layer (non generated columns PostgreSQL) per compatibilità con Knex.
- **Ruoli**: campo `ruolo` presente ma non utilizzato in v1 (nessun sistema di permessi).

---

# Security & Policy Checklist (task separato)

- [ ] Audit permessi utente DB: nessun superuser, solo grant minimi
- [ ] Password sempre hashate (bcrypt/argon2)
- [ ] JWT con scadenza breve e refresh token sicuro
- [ ] Rate limit su login e API sensibili
- [ ] CORS e helmet attivi lato backend
- [ ] Validazione input su tutte le API (zod/ajv)
- [ ] Nessun dato sensibile nei log
- [ ] Aggiornamento dipendenze automatico (dependabot/snyk)
- [ ] Backup automatico DB e restore testato
- [ ] Policy privacy: dati cliente mai esportati senza consenso
- [ ] Upload logo: validazione tipo file, dimensione max, sanitizzazione nome
