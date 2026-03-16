# Quickstart: Rapportini Giornalieri e Note di Lavorazione

**Branch**: `004-daily-work-reports` | **Date**: 2026-03-09

## Prerequisiti

- Node.js installato
- PostgreSQL in esecuzione
- pnpm installato
- Progetto già configurato (`.env` con DATABASE_URL)

## Setup

```bash
# 1. Checkout branch
git checkout 004-daily-work-reports

# 2. Installa dipendenze (se non già fatto)
cd backend && pnpm install && cd ..
cd frontend && pnpm install && cd ..

# 3. Esegui migrazioni (crea le 3 nuove tabelle)
make migrate

# 4. Avvia backend
make dev-backend

# 5. In un altro terminale, avvia frontend
make dev-frontend
```

## Verifica

1. **Login** come operaio (es. `marco@officina.it`)
2. Vai alla sezione **Rapportini** nel menu
3. Inserisci una riga: giorno, fascia oraria, cliente, macchina
4. Aggiungi un materiale cercando nel magazzino o scansionando un barcode
5. Salva e verifica che la riga appaia nell'elenco

6. **Login** come admin (es. `admin@officina.it`)
7. Vai a **Rapportini** → vedi tutte le righe di tutti gli operai
8. Filtra per cliente, seleziona righe, crea una **Nota di lavorazione**
9. Stampa la nota o i rapportini filtrati

## Nuovi file da implementare

### Backend
- `backend/migrations/20260309_012_create_note_lavorazione.js`
- `backend/migrations/20260309_013_create_righe_rapportino.js`
- `backend/migrations/20260309_014_create_materiali_rapportino.js`
- `backend/src/routes/rapportini.js`
- `backend/src/routes/note-lavorazione.js`
- `backend/src/services/pdf-rapportino.js`
- `backend/src/services/pdf-nota-lavorazione.js`

### Frontend
- `frontend/src/pages/RapportiniPage.vue`
- `frontend/src/pages/NoteLavorazionePage.vue`
- `frontend/src/components/RigaRapportinoFormModal.vue`
- `frontend/src/components/MaterialeSelector.vue`
- `frontend/src/components/NotaLavorazioneFormModal.vue`
- `frontend/src/services/rapportini.js`
- `frontend/src/services/note-lavorazione.js`

### File da modificare
- `frontend/src/router/index.js` — aggiungere rotte per rapportini e note
- `frontend/src/App.vue` — aggiungere voci menu navigazione
- `backend/src/app.js` — registrare nuovi route plugin
