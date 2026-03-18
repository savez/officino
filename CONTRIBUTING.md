# 🤝 Guida ai Contributi

Grazie per voler contribuire a **Officino**! Ogni contributo — bug fix, nuova feature, documentazione o semplice feedback — è prezioso e apprezzato.

---

## 📋 Indice

- [Codice di Condotta](#codice-di-condotta)
- [Come posso contribuire?](#come-posso-contribuire)
- [Setup dell'ambiente di sviluppo](#setup-dellambiente-di-sviluppo)
- [Workflow Git](#workflow-git)
- [Convenzioni di codice](#convenzioni-di-codice)
- [Convenzioni dei commit](#convenzioni-dei-commit)
- [Processo di Pull Request](#processo-di-pull-request)

---

## Codice di Condotta

Partecipando a questo progetto, accetti di rispettare il nostro [Codice di Condotta](./CODE_OF_CONDUCT.md). Trattati gli altri con rispetto e professionalità.

---

## Come posso contribuire?

### 🐛 Segnalare un Bug

1. **Cerca prima** nelle [Issues esistenti](https://github.com/savez/officino/issues) per evitare duplicati.
2. Se non trovi nulla di correlato, [apri una nuova issue](https://github.com/savez/officino/issues/new/choose) usando il template **Bug Report**.
3. Includi quanti più dettagli possibile: passi per riprodurre, comportamento atteso vs. attuale, log, screenshot.

### 🚀 Proporre una Feature

1. Controlla la [Roadmap nel README](./README.md#roadmap) e le [Issues esistenti](https://github.com/savez/officino/issues).
2. Apri una [discussione](https://github.com/savez/officino/discussions) per raccogliere feedback prima di implementare cambiamenti importanti.
3. Se la proposta è ben definita, crea una issue usando il template **Feature Request**.

### 📖 Migliorare la Documentazione

Correzioni di typo, chiarimenti, esempi aggiuntivi — ogni miglioramento alla documentazione è ben accetto. Puoi aprire direttamente una Pull Request per modifiche minori.

### 💻 Contribuire con Codice

Controlla le issue con le etichette [`good first issue`](https://github.com/savez/officino/labels/good%20first%20issue) o [`help wanted`](https://github.com/savez/officino/labels/help%20wanted) per trovare da dove iniziare.

---

## Setup dell'Ambiente di Sviluppo

### Prerequisiti

- **Node.js** 20+
- **pnpm** (`npm install -g pnpm`)
- **PostgreSQL** 15+ (o SQLite per sviluppo rapido)
- **Docker** (opzionale)

### Passi

```bash
# 1. Fork del repo su GitHub, poi clona il tuo fork
git clone https://github.com/<tuo-username>/officino.git
cd officino

# 2. Aggiungi il repo originale come remote upstream
git remote add upstream https://github.com/savez/officino.git

# 3. Installa le dipendenze
pnpm install
cd backend && pnpm install && cd ../frontend && pnpm install && cd ..

# 4. Configura le variabili d'ambiente
cp .env.example .env
# Modifica .env con i tuoi parametri locali

# 5. Esegui le migrazioni
cd backend && pnpm migrate

# 6. (Opzionale) Popola il database con dati demo
cd backend && pnpm seed

# 7. Avvia il server di sviluppo
# Terminal 1 – Backend
cd backend && pnpm dev
# Terminal 2 – Frontend
cd frontend && pnpm dev
```

L'applicazione sarà disponibile su **http://localhost:5173**.

---

## Workflow Git

Usiamo il modello **Feature Branch Workflow**:

```bash
# 1. Aggiorna il tuo main locale
git checkout main
git pull upstream main

# 2. Crea un branch descrittivo
git checkout -b feat/nome-funzionalita
# oppure
git checkout -b fix/descrizione-bug

# 3. Sviluppa e fai commit frequenti (vedi convenzioni sotto)
git commit -m "feat: aggiungi filtro per data sui rapportini"

# 4. Mantieni il branch aggiornato
git fetch upstream
git rebase upstream/main

# 5. Push e apri la PR
git push origin feat/nome-funzionalita
```

**Convenzioni per i nomi dei branch:**

| Tipo        | Pattern                        |
|-------------|-------------------------------|
| Feature     | `feat/<descrizione-breve>`    |
| Bug fix     | `fix/<descrizione-breve>`     |
| Documentazione | `docs/<descrizione-breve>` |
| Refactoring | `refactor/<descrizione-breve>`|
| Hotfix      | `hotfix/<descrizione-breve>`  |

---

## Convenzioni di Codice

### Generali

- Usa **TypeScript** o JS con JSDoc quando possibile nel backend.
- Il frontend usa **Vue 3 Composition API** con `<script setup>`.
- Mantieni funzioni piccole e con responsabilità singola.
- Nessun `console.log` nel codice committato (usa il logger di Fastify nel backend).

### Linting & Formattazione

Il progetto usa **ESLint** e **Prettier**. Prima di ogni commit:

```bash
# Lint
pnpm lint

# Formattazione automatica
pnpm format
```

I file di configurazione sono `.eslintignore` e `.prettierignore`.

### Testing

- Scrivi test per ogni nuova funzionalità o bug fix.
- **Backend**: Jest (`cd backend && pnpm test`)
- **Frontend**: Vitest (`cd frontend && pnpm test`)
- Cerca di mantenere la coverage esistente o migliorarla.

---

## Convenzioni dei Commit

Usiamo [**Conventional Commits**](https://www.conventionalcommits.org/it/) per il versionamento semantico automatico tramite Semantic Release.

### Formato

```
<tipo>[scope opzionale]: <descrizione breve>

[corpo opzionale]

[footer opzionale]
```

### Tipi principali

| Tipo       | Quando usarlo                              | Impatto versione |
|------------|--------------------------------------------|-----------------|
| `feat`     | Nuova funzionalità                         | `MINOR`         |
| `fix`      | Correzione bug                             | `PATCH`         |
| `docs`     | Solo documentazione                        | —               |
| `style`    | Formattazione, punto e virgola, ecc.       | —               |
| `refactor` | Refactoring (no fix, no feature)           | —               |
| `perf`     | Miglioramento delle performance            | `PATCH`         |
| `test`     | Aggiunta o modifica di test                | —               |
| `chore`    | Build, configurazione, dipendenze          | —               |
| `ci`       | Modifiche alla CI                          | —               |

> **Breaking change**: aggiungi `!` dopo il tipo (`feat!:`) oppure inserisci `BREAKING CHANGE:` nel footer. Questo incrementa la versione `MAJOR`.

### Esempi

```bash
feat(rapportini): aggiungi filtro per operaio nella lista giornaliera
fix(auth): correggi scadenza token JWT su sessioni lunghe
docs: aggiorna README con istruzioni Docker
feat!: rinomina endpoint /api/users in /api/operai
```

---

## Processo di Pull Request

1. **Assicurati che i test passino** localmente prima di aprire la PR.
2. **Usa il template PR** fornito e compila tutte le sezioni.
3. **Collega l'issue** correlata con `Closes #<numero>`.
4. Richiedi la review di almeno **un maintainer**.
5. Affronta i commenti di review in modo costruttivo.
6. Una volta approvata, il maintainer eseguirà il merge.

### Criteri di accettazione

- ✅ Tutti i test CI passano
- ✅ Almeno una review approvata
- ✅ Nessun conflitto con `main`
- ✅ Codice rispetta le convenzioni di stile
- ✅ Documentazione aggiornata (se necessario)

---

Grazie ancora per il tuo contributo! 🙏 Se hai domande, apri una [discussione](https://github.com/savez/officino/discussions) o commenta direttamente sull'issue.
