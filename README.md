# 🔧 Officino

**Gestione completa per officine meccaniche** - sistema web production-ready per tracciamento ore, preventivi, catalogo prodotti e reportistica.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-v20-green)](https://nodejs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue)](https://www.postgresql.org)
[![Vue.js](https://img.shields.io/badge/Vue.js-3-brightgreen)](https://vuejs.org)

---

## ✨ Caratteristiche

### 📊 Dashboard & Analytics
- **Dashboard intuitiva** con KPI in tempo reale
- **Grafici interattivi** per ore lavorate per operaio/cliente
- **Export Excel** con dettagli operazioni

### 📋 Rapportini (Timesheets)
- Registrazione ore giornaliere per operaio e cliente
- **Badge ore filtrate** per tracking rapido
- Associazione materiali e note lavoro
- Gestione stato righe (aperta/gestita)

### 💰 Preventivi
- Generazione automatica numeri progressivi
- Composizione flessibile (pezzi + manodopera + sconto)
- **PDF professionali** con logo officina
- Ciclo di vita completo (bozza → approvato → fatturato)
- Import/export JSON per backup e trasferimenti

### 📦 Catalogo Prodotti
- Gestione ricambi e materiali
- Barcode scanning (EAN-13/QR)
- Categorie personalizzabili
- Filtri e ricerca avanzata
- Export Excel catalogo

### 👥 Gestione Utenti
- Ruoli (operaio, admin)
- Costo orario personalizzato per operaio
- Log audit di tutte le modifiche
- Autenticazione JWT sicura

### 🔐 Note di Lavorazione
- Raccolta righe rapportino per cliente
- Generazione PDF riepilogativo
- Supporto fatturazione

---

## 🚀 Quick Start

### Prerequisiti
- **Node.js** 20+
- **pnpm** (o npm/yarn)
- **PostgreSQL** 15+ (o SQLite per sviluppo)
- **Docker** (opzionale, per deployment)

### Sviluppo Locale

#### 1. Clone il repo
```bash
git clone https://github.com/savez/officino.git
cd officino
```

#### 2. Installa dipendenze
```bash
pnpm install
cd backend && pnpm install && cd ../frontend && pnpm install && cd ..
```

#### 3. Setup database
```bash
# Crea file .env (vedi .env.example)
cp .env.example .env

# Avvia PostgreSQL (o configuralo nel .env)
# Esegui migrazioni
cd backend && pnpm migrate
```

#### 4. Seed database (opzionale)
```bash
cd backend && pnpm seed
```

#### 5. Avvia dev server
```bash
# Terminal 1: Backend
cd backend && pnpm dev

# Terminal 2: Frontend
cd frontend && pnpm dev
```

Visita **http://localhost:5173**

### Credenziali Demo
```
Email: demo@officino.app
Password: admin123
```

---

## 📦 Stack Tecnologico

### Backend
- **Fastify** - Framework HTTP ultrarapido
- **PostgreSQL / SQLite** - Database relazionale
- **Knex.js** - Query builder & migrazioni
- **Jest** - Testing framework
- **JWT** - Autenticazione sicura

### Frontend
- **Vue.js 3** - Framework reattivo
- **Vite** - Build tool ultraveloce
- **Bootstrap 5** - Componenti UI
- **Chart.js** - Grafici interattivi
- **Vitest** - Testing framework
- **Axios** - Client HTTP

### DevOps
- **Docker** - Containerizzazione
- **Docker Compose** - Orchestrazione locale
- **GitHub Actions** - CI/CD (Semantic Release)
- **Render** - Deployment (example guide)

---

## 🐳 Docker (Produzione)

### Build e avvia con Docker Compose
```bash
make prod
```

Oppure:
```bash
docker-compose -f docker/docker-compose.prod.yml up --build -d
```

Frontend: **http://localhost**  
Backend API: **http://localhost:3000/api**

---

## 🧪 Testing

### Backend
```bash
cd backend
pnpm test                # Tutti i test
pnpm test:watch         # Watch mode
pnpm test -- --testPathPattern=integration  # Solo integration tests
```

### Frontend
```bash
cd frontend
pnpm test               # Tutti i test
pnpm test:watch        # Watch mode
```

---

## 📚 Documentazione

### Guida Utente
Disponibile nell'applicazione: **Guida → Officino**

Copertine principali:
- **Dashboard** - KPI e analitiche
- **Rapportini** - Timesheets
- **Preventivi** - Gestione offerte
- **Catalogo** - Gestione ricambi
- **Utenti** - Ruoli e permessi

### Deploy

#### Con Render.com
Vedi [docs/deploy-render.md](./docs/deploy-render.md) per guida step-by-step

#### Con Docker locale
```bash
docker-compose -f docker/docker-compose.prod.yml up -d
```

#### Build manuale
```bash
# Backend
npm run build

# Frontend
cd frontend && pnpm build
```

---

## 🤝 Contributing

Contributi sono benvenuti! 

1. **Fork** il repository
2. Crea un **feature branch** (`git checkout -b feature/amazing-feature`)
3. Commit dei tuoi **cambiamenti** (`git commit -m 'feat: add amazing feature'`)
4. **Push** al branch (`git push origin feature/amazing-feature`)
5. Apri una **Pull Request**

### Convenzioni Commit
Usiamo [Conventional Commits](https://www.conventionalcommits.org/) per versionamento automatico.

Prefissi comuni:
- `feat:` - Nuova feature
- `fix:` - Bug fix
- `docs:` - Documentazione
- `refactor:` - Refactoring
- `test:` - Test
- `chore:` - Maintenance

---

## 📝 Licenza

MIT License - vedi [LICENSE](./LICENSE)

---

## 🎯 Roadmap

- [ ] Integrazione email per notifiche
- [ ] Fatturazione automatica
- [ ] App mobile
- [ ] Sincronizzazione con gestionali
- [ ] Multi-lingua (EN/IT)
- [ ] Dark mode

---

## 💬 Support

- **Issues** - Segnala bug o richiedi feature
- **Discussions** - Domande e suggerimenti
- **Email** - (aggiungi contatto se pubblico)

---

## 🙏 Ringraziamenti

Costruito con ❤️ per le officine che meritano strumenti moderni.

**Versione:** 1.1.0  
**Ultima build:** 2026  
**Status:** Production Ready ✅
