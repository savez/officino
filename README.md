# Officino — landing

Questo branch serve **solo** a pubblicare la pagina di presentazione del
progetto su GitHub Pages: <https://savez.github.io/officino/>

Il codice dell'applicazione sta su `main`, e qui non c'è.

## Perché è un branch orfano

`landing` non condivide storia con `main`. È una scelta, non un incidente: con
storie non correlate git rifiuta da sé un merge fra i due, quindi la regola «i
due branch non si uniscono mai» è strutturale invece di essere affidata a un
documento che poi invecchia.

## Cosa c'è

| File | A cosa serve |
|---|---|
| `index.html` | La pagina intera. CSS, JS e SVG sono inline: nessuna dipendenza, nessun build, nessun base-path da azzeccare |
| `favicon.svg` | Copia di `frontend/public/favicon.svg` su `main` |
| `banner.svg` | Copia di `docs/banner.svg` su `main`, usata come `og:image` |
| `.github/workflows/deploy-landing.yml` | Build assente, deploy su Pages via artefatto Actions |

Colori e tipografia non sono una palette a parte: vengono da
`frontend/src/stili/_token.scss` su `main`, dove i rapporti di contrasto sono
misurati e verificati da un test. L'unico scostamento è la coda del gradiente
dell'eroe, `#1a6449` invece del `#1c6b50` del banner, perché su quel verde il
testo secondario scendeva a 4,35:1.

## Impostazioni del repo, che nessun file registra

Il deploy dipende da tre cose che vivono nelle impostazioni di GitHub e non nel
codice. Se un giorno il sito smette di pubblicarsi, si guarda qui prima che nel
workflow.

| Dove | Valore |
|---|---|
| Settings → Pages → Source | **GitHub Actions** (`build_type: workflow`). Con «Deploy from a branch» il workflow carica un artefatto che non viene mai pubblicato, e non fallisce: passa in verde senza pubblicare nulla |
| Environment `github-pages` → deployment branches | deve includere **`landing`**. Alla creazione conteneva solo `main`, e il primo deploy passò per bypass da admin, non perché fosse permesso |
| Ruleset `landing` | blocca `deletion` e `non_fast_forward`, **senza bypass per nessuno**. Non serve a tenere fuori gli altri — a quello basta essere l'unico collaboratore — ma a impedire che il proprietario cancelli o riavvolga il branch per sbaglio |

Due cose imparate configurandolo, entrambe controintuitive:

- **`update` fra le regole blocca anche il proprietario.** Serve a vietare i
  push diretti, ma un repo di utente non ha ruoli assegnati: l'owner ha l'admin
  implicito, quindi il bypass su `RepositoryRole: admin` non lo copre e il push
  torna `Cannot update this protected ref`.
- **Con quel bypass attivo le regole non vincolavano nulla.** Un force-push e una
  cancellazione passavano entrambi, annunciati da `Bypassed rule violations`. Le
  regole mordono solo da quando `bypass_actors` è vuoto: ora `deletion` e
  `non_fast_forward` sono rifiutati, mentre un push in avanti passa.

```bash
gh api repos/savez/officino/pages --jq .build_type                                  # workflow
gh api repos/savez/officino/environments/github-pages/deployment-branch-policies \
  --jq '.branch_policies[].name'                                                    # landing, main
```

## Come si modifica

```bash
git switch landing
python3 -m http.server 8080     # http://localhost:8080
```

Un push su `landing` rideploya. Per rideployare senza modifiche c'è
`workflow_dispatch` nella pagina Actions.

## Cosa non fare

- **Non unire `landing` a `main`, né `main` a `landing`.**
- Non aggiungere `.nojekyll`: il deploy via artefatto Actions salta Jekyll del
  tutto, il file non servirebbe a nulla.
- Non introdurre un build step senza una ragione: oggi il deploy è checkout →
  upload → publish, e ci mette una ventina di secondi.
