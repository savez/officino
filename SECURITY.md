# Politica di sicurezza

## Versioni supportate

| Versione | Supportata |
|---|---|
| `2.x` (l'ultima pubblicata) | ✅ |
| `1.x` | ❌ |

Il progetto è mantenuto da una persona sola: viene corretta l'ultima versione,
non se ne mantengono di precedenti.

## Segnalare una vulnerabilità

**Non aprire una issue pubblica.**

Usa una GitHub Security Advisory privata, che vedete solo tu e il maintainer:

🔗 https://github.com/savez/officino/security/advisories/new

In alternativa, scrivi a [@savez](https://github.com/savez) su GitHub.

### Cosa serve nella segnalazione

- Descrizione della vulnerabilità
- Passi per riprodurla, con una proof-of-concept se ce l'hai
- Versione o commit interessato
- Impatto stimato

### Tempi

Best-effort, è un progetto personale open source:

- **Presa in carico**: entro 72 ore
- **Correzione o mitigazione**: entro 14 giorni per la gravità alta, best-effort
  per il resto

## Cosa gira sul repository

- **[Socket Security](https://socket.dev)** analizza le dipendenze a ogni pull
  request, con avvisi su rischi di supply chain, malware e cambi di
  comportamento fra versioni
- **CI** su ogni pull request: lint, test e build del frontend, lint e test
  unitari del backend
- **Dependabot** per gli advisory sulle dipendenze
- `main` è protetto: si modifica solo attraverso una pull request

I test di integrazione del backend non girano in CI — sei suite falliscono per
motivi preesistenti, descritti nella [issue dei difetti noti](https://github.com/savez/officino/issues/7). Non riguardano
autenticazione né permessi, che sono coperti dai test unitari e da
`permessi-ruolo`, `permessi-rapportino` e `utenti-rbac`, tutte verdi.

## Superficie di attacco

Officino **non è un servizio gestito da noi**: lo installi tu, sul tuo server,
con il tuo database. Questo cambia cosa è nostra responsabilità e cosa è tua.

**Nostra** — difetti nel codice: autenticazione, autorizzazione, validazione
degli input, gestione degli upload, generazione dei PDF, query.

**Tua**, e vanno fatte prima di mettere in esercizio l'applicazione:

- Cambiare `JWT_SECRET`: il valore in `.env.example` è un segnaposto, ed è
  pubblico
- Cambiare le credenziali delle utenze di esempio, o non caricare i dati di
  esempio del tutto. `demo@officino.app` / `admin123` è scritto in questo
  README e in ogni copia del repository
- Mettere una password vera sul database, e non esporlo su internet
- Servire l'applicazione in HTTPS: i token viaggiano nelle intestazioni
- Impostare `CORS_ORIGIN` sul dominio reale
- Fare i backup

## Divulgazione

Una volta confermato e corretto il problema:

1. Viene pubblicata una GitHub Security Advisory con i dettagli
2. Chi ha segnalato viene citato, se lo desidera
3. La correzione entra in una release, con riferimento all'advisory nelle note

## Licenza

MIT (vedi [LICENSE](LICENSE)). Nessuna garanzia, il software è fornito «così
com'è».
