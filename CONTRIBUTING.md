# Contribuire a Officino

Grazie per l'interesse. Officino è un gestionale per officine meccaniche, ed è
un progetto piccolo: le pull request e le issue sono benvenute, e le domande
anche.

Se cerchi un primo contributo, la issue dei **difetti noti** elenca problemi
circoscritti e già diagnosticati.

## Ambiente di sviluppo

Serve **Node 20**, **pnpm 10** e **PostgreSQL 15** — oppure Docker, se preferisci
non installare Postgres.

```bash
git clone https://github.com/<tuo-username>/officino.git
cd officino
cp .env.example .env          # rivedi le credenziali del database

cd backend  && pnpm install && cd ..
cd frontend && pnpm install && cd ..

cd backend && pnpm migrate && pnpm seed && cd ..
```

È un monorepo con due workspace indipendenti: `backend/` e `frontend/` hanno
ciascuno il proprio `package.json` e il proprio lockfile. `pnpm install` nella
radice **non** installa le dipendenze dei due workspace: vanno installate dentro
ciascuno, come sopra.

Poi, in due terminali:

```bash
make dev-backend              # API su :3000
make dev-frontend             # interfaccia su :5173
```

Le utenze di esempio sono `demo@officino.app` (admin) e `operaio@officino.app`
(operaio), password `admin123` per entrambe.

C'è anche un dev container pronto (`.devcontainer/`), se usi VS Code: porta con
sé Postgres già configurato.

## Il flusso

1. **Apri prima una issue** se la modifica è grossa — una funzionalità nuova, un
   refactor, un cambiamento non retrocompatibile. Per un fix piccolo e ovvio
   puoi andare dritto al punto 2.

2. Crea un branch da `main` aggiornato:

   ```bash
   git checkout main && git pull
   git checkout -b feat/<descrizione-breve>
   ```

   Prefissi: `feat/`, `fix/`, `chore/`, `docs/`, `test/`.

3. Scrivi il codice e i test. Prima di aprire la PR:

   ```bash
   make lint
   make test
   ```

   > **Hook automatici.** Il repository usa Husky. Al `git commit` parte
   > `lint-staged`, che passa ESLint (con `--fix`) e Prettier sui soli file in
   > stage. Non c'è validazione automatica del messaggio di commit: la
   > convenzione la applichi tu, e conta (vedi sotto).

4. Apri la pull request verso `main`. Il template ti chiede cosa cambia, perché,
   e come l'hai provato.

## Messaggi di commit

Il progetto usa [Conventional Commits](https://www.conventionalcommits.org/), e
non è una questione di stile: **semantic-release calcola la versione dai
messaggi**. Un tipo sbagliato produce una release sbagliata.

| Tipo | Effetto sulla versione |
|---|---|
| `feat:` | minor |
| `fix:`, `perf:`, `refactor:` | patch |
| `docs:`, `test:`, `chore:`, `ci:` | nessuna release |
| `feat!:` o footer `BREAKING CHANGE:` | major |

Al merge su `main` nasce il tag e viene pubblicata la release su GitHub, con le
note ricavate dai commit. Il rilascio **non scrive dentro il repository**: non
c'è un `CHANGELOG.md` da aggiornare, e il campo `version` nei tre `package.json`
si alza a mano con un commit `chore:` quando serve.

## Cosa succede alla tua PR

La CI gira su ogni pull request e deve essere verde. Esegue:

- **Frontend** — lint, test (Vitest) e build
- **Backend** — lint e test unitari (Jest)

I test di integrazione del backend **non girano in CI**: sei suite falliscono
già oggi, per quattro cause distinte fra loro, tutte precedenti a qualunque
contributo tuo. Sono descritte nella issue dei difetti noti. Se la tua PR ne
sistema una, riportala dentro `ci.yml` nello stesso commit.

Poi il maintainer ([@savez](https://github.com/savez)) revisiona. Può chiedere
modifiche; una volta approvata, viene mergiata.

## Stile

- **JavaScript, non TypeScript** — scelta consapevole
- Backend: Fastify con Knex, servizi puri dove la logica lo permette. Se una
  regola si può verificare senza database né HTTP, va in `backend/src/services/`
  e si testa in isolamento
- Frontend: Vue 3 con Composition API e `<script setup>`
- Stili: Bootstrap 5 compilato dai sorgenti, con i token in
  `frontend/src/stili/_token.scss`. Usa i token, non valori scritti a mano
- I commenti spiegano **perché**, non cosa. Un commento che ripete il codice è
  rumore; uno che dice perché una strada è stata scartata vale il suo spazio
- File piccoli, una responsabilità ciascuno

## Test

```bash
make test              # entrambe le suite
make test-backend      # solo backend
make test-frontend     # solo frontend
make test-unit         # solo i test unitari del backend
```

Il backend gira su SQLite in memoria, quindi i test non richiedono un database
attivo. Attenzione però: SQLite e PostgreSQL non si comportano allo stesso modo
su tutto — i booleani, per esempio, tornano come `0`/`1` invece di
`false`/`true`. È già la causa di una delle suite rosse.

## Domande

Apri una issue, oppure scrivi a [@savez](https://github.com/savez) su GitHub.
