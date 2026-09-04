# Officino

Gestionale per officine meccaniche: si registra il lavoro svolto, se ne misura
il costo e se ne ricava un documento da consegnare al cliente.

[![Licenza: MIT](https://img.shields.io/badge/Licenza-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![Node 20](https://img.shields.io/badge/Node-20-green)
![PostgreSQL 15](https://img.shields.io/badge/PostgreSQL-15-blue)
![Vue 3](https://img.shields.io/badge/Vue-3-brightgreen)

## Come funziona

Il pezzo centrale è il **rapportino**: un contenitore delle lavorazioni che un
operaio ha svolto **su un solo macchinario per un solo cliente**. Dentro ci
finiscono le singole lavorazioni, con le ore e i materiali impiegati.

Un rapportino attraversa tre stati:

| Stato | Significato |
|---|---|
| `aperto` | ci si sta ancora lavorando, l'operaio può modificarlo |
| `chiuso` | l'operaio lo dichiara concluso |
| `gestito` | è confluito in una nota di lavorazione |

Lo stato **non è una colonna**: si deriva da `chiuso_il` e da
`nota_lavorazione_id`. Una colonna scritta accanto a quei due campi
rappresenterebbe due volte lo stesso fatto, e basterebbe un endpoint che
aggiorna l'una e non l'altra per avere un rapportino gestito senza nota. Con la
derivazione la contraddizione non è rappresentabile.

I rapportini chiusi confluiscono in una **nota di lavorazione**, il documento
che va al cliente: raccoglie le lavorazioni di un periodo, ne calcola i totali e
produce un PDF. Prima di stampare, un controllo di coerenza segnala le note che
non tornano — righe con costo orario a zero, materiali senza prezzo — e chiede
conferma esplicita per procedere.

## Cosa c'è

**Rapportini** — registrazione delle ore per macchinario e cliente, materiali
con prezzo unitario, costo orario per riga, filtri per periodo, avviso in caso
di rapportino duplicato, PDF del singolo rapportino.

**Note di lavorazione** — costruite dai rapportini chiusi, con data di
riferimento propria, riassunto delle lavorazioni composto dal server,
possibilità di correggere i costi, unione o divisione per macchinario, e un PDF
con dettagli di manodopera e materiali attivabili separatamente.

**Dashboard** — misura il lavoro svolto, non i preventivi. Metriche distinte per
ruolo, ore per operaio e per cliente, pannello dei giorni con ore mancanti
(feriali sotto le 8 ore), filtri per periodo. Una invariante tiene insieme le
due viste: il totale della dashboard coincide sempre con quello dell'elenco
rapportini per lo stesso periodo.

**Preventivi** — numerazione progressiva automatica, composizione con pezzi a
catalogo e fuori catalogo, manodopera e sconto, ciclo bozza → approvato →
fatturato, PDF con il logo dell'officina.

**Magazzino e catalogo** — due sezioni distinte: le giacenze da una parte, il
catalogo dei ricambi dall'altra, con categorie, ricerca, lettura di codici a
barre (EAN-13 e QR) ed export Excel.

**Clienti, utenti e permessi** — due ruoli, `user` e `admin`. Sono riservate
agli admin cinque sezioni: clienti, note di lavorazione, utenti, impostazioni e
registro modifiche. Dashboard, rapportini, preventivi e catalogo restano
accessibili a tutti, e ogni operaio vede e modifica i propri rapportini. Ogni
modifica finisce in un registro consultabile.

**Guida integrata** — descritta nell'applicazione e allineata ai permessi di chi
la legge. Alcuni test verificano proprio questo: che la guida descriva il
comportamento reale invece di determinarlo, così una divergenza fra le due si
vede subito.

## Avvio rapido

Serve Node 20+, pnpm e PostgreSQL 15+ (Docker è comodo ma non obbligatorio).

```bash
git clone https://github.com/savez/officino.git
cd officino

cp .env.example .env          # rivedere le credenziali del database

cd backend  && pnpm install && cd ..
cd frontend && pnpm install && cd ..

cd backend && pnpm migrate && pnpm seed && cd ..
```

Poi, in due terminali:

```bash
make dev-backend              # API su :3000
make dev-frontend             # interfaccia su :5173
```

L'applicazione risponde su **http://localhost:5173**. I dati di esempio creano
due utenze:

| Ruolo | Email | Password |
|---|---|---|
| admin | `demo@officino.app` | `admin123` |
| operaio | `operaio@officino.app` | `admin123` |

Sono credenziali di dimostrazione: vanno cambiate prima di qualunque uso reale,
insieme a `JWT_SECRET` nel `.env`.

## Comandi

```bash
make dev-backend       # API in sviluppo
make dev-frontend      # interfaccia in sviluppo
make migrate           # applica le migrazioni
make seed              # carica i dati di esempio
make test              # esegue entrambe le suite
make lint              # backend e frontend
make build             # build di produzione del frontend
make prod              # stack completo con Docker Compose
make db-shell          # psql sul database
```

## Stack

**Backend** — Fastify, PostgreSQL (SQLite in memoria per i test), Knex per query
e migrazioni, JWT per l'autenticazione, PDFKit per i documenti, Zod per la
validazione, Jest per i test.

**Frontend** — Vue 3 con Vite, Bootstrap 5 compilato dai sorgenti con un proprio
sistema di token, Chart.js per i grafici, html5-qrcode per i codici a barre,
Vitest per i test.

**Infrastruttura** — Docker e Docker Compose, dev container pronto per VS Code,
GitHub Actions con semantic-release.

## Deploy

C'è una guida per [Render.com](./docs/deploy-render.md), con `render.yaml` già
predisposto. Gli indirizzi da compilare sono marcati `<YOUR_BACKEND_URL>` e
`<YOUR_FRONTEND_URL>`.

Per un deploy con Docker:

```bash
make prod              # oppure: docker compose -f docker/docker-compose.prod.yml up -d --build
```

Il seed parte da solo al primo avvio se il database è vuoto
(`backend/src/seed-if-empty.js`).

## Test

```bash
make test              # entrambe le suite
```

Il backend gira su SQLite in memoria, quindi i test non richiedono un database
attivo. Il frontend usa Vitest con jsdom.

> **Nota onesta sullo stato attuale:** sei suite di integrazione del backend
> falliscono. Cercano la tabella `pezzi_magazzino`, rinominata in `catalogo` da
> una migrazione, e non sono mai state aggiornate. Ci sono anche due errori di
> lint in `backend/src/services/log-modifiche.js`. Sono problemi noti e
> circoscritti, non toccano il codice in esercizio, e sono un buon punto di
> partenza per un primo contributo.

## Contribuire

Le pull request sono benvenute. Il progetto usa
[Conventional Commits](https://www.conventionalcommits.org/) — `feat:`, `fix:`,
`docs:`, `refactor:`, `test:`, `chore:` — perché la versione la calcola
semantic-release dai messaggi di commit.

Prima di aprire una PR conviene far girare `make test` e `make lint`.

## Licenza

MIT — vedi [LICENSE](./LICENSE).
