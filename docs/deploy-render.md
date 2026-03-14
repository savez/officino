# Deploy su Render.com

Guida per pubblicare Magazzino Trentino su Render.com (piano free) con database esterno su Neon.tech.

## Architettura

```
Browser
  │
  ▼
[Render Static Site - Frankfurt]       ← Frontend Vue 3 (dist/)
  ├── /* → index.html (SPA)
  ├── /api/* → rewrite a magazzino-api
  └── /uploads/* → rewrite a magazzino-api
        │
        ▼
[Render Web Service - Frankfurt]       ← Backend Fastify (Node 20)
  ├── PORT assegnato da Render
  ├── preDeployCommand: knex migrate
  └── Logo in base64 nel DB
        │
        ▼
[Neon.tech PostgreSQL - Frankfurt]     ← DB free, no scadenza, SSL
```

## Prerequisiti

- Account [Render](https://render.com)
- Account [Neon.tech](https://neon.tech)
- Repository GitHub connesso a Render

## 1. Setup Database (Neon.tech)

> Il Postgres free di Render scade dopo 30 giorni. Neon.tech offre 0.5 GB gratis senza scadenza.

1. Creare account su [neon.tech](https://neon.tech)
2. Nuovo progetto: `magazzino-trentino`
3. Region: **EU (Frankfurt)**
4. Database: `magazzino`
5. Copiare il **DATABASE_URL** (connection string con `?sslmode=require`)

## 2. Deploy via Blueprint

1. Render Dashboard → **New → Blueprint**
2. Connettere il repository GitHub, branch `main`
3. Render rileva `render.yaml` e mostra i servizi da creare
4. Impostare le variabili `sync: false` nella Dashboard:

| Variabile | Servizio | Valore |
|---|---|---|
| `DATABASE_URL` | magazzino-api | Connection string Neon |
| `CORS_ORIGIN` | magazzino-api | `https://magazzino-frontend.onrender.com` |

5. Cliccare **Apply** → il deploy parte automaticamente

## 3. Seed iniziale

Il seed viene eseguito automaticamente al primo avvio tramite `seed-if-empty.js`, che controlla se la tabella `utenti` è vuota. Se il DB è già popolato, il seed viene saltato.

## 4. Verifica

1. Visitare `https://magazzino-frontend.onrender.com`
2. Il primo caricamento è lento (~1 min per il cold start del backend)
3. Login: `admin@officina.it` / `admin123`
4. Verificare:
   - Impostazioni → caricare un logo → deve persistere dopo refresh
   - Preventivi → generare un PDF → il logo deve apparire
   - Attendere 15+ min (spin-down) → rivisitare → il logo deve restare

## Variabili d'ambiente

### Backend (Web Service)

| Variabile | Valore | Note |
|---|---|---|
| `NODE_ENV` | `production` | Impostato in render.yaml |
| `DATABASE_URL` | `postgresql://...` | Connection string Neon |
| `DB_SSL` | `true` | Impostato in render.yaml |
| `JWT_SECRET` | (auto-generato) | Generato da Render |
| `JWT_EXPIRES_IN` | `15m` | Impostato in render.yaml |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Impostato in render.yaml |
| `LOG_LEVEL` | `warn` | Impostato in render.yaml |
| `CORS_ORIGIN` | `https://magazzino-frontend.onrender.com` | Da impostare manualmente |

### Frontend (Static Site)

| Variabile | Valore | Note |
|---|---|---|
| `VITE_API_BASE_URL` | `/api` | Impostato in render.yaml |

## Limiti del piano free

- **Backend**: spin-down dopo 15 min di inattività, cold start ~1 min
- **Database (Neon)**: 0.5 GB storage, scale-to-zero quando inattivo
- **Logo**: salvato come base64 nel database (filesystem effimero su Render)
- **Static Site**: servito via CDN, nessun limite rilevante

## Dominio personalizzato (opzionale)

1. Render Dashboard → `magazzino-frontend` → **Settings → Custom Domains**
2. Aggiungere il dominio e configurare il DNS (CNAME)
3. Aggiornare `CORS_ORIGIN` sul backend con il nuovo dominio
