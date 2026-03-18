# 🔐 Security Policy

## Versioni supportate

Attualmente forniamo aggiornamenti di sicurezza per le seguenti versioni:

| Versione | Supportata          |
|----------|---------------------|
| `main`   | ✅ Sì               |
| < 1.0    | ❌ Non più supportata |

---

## Segnalare una Vulnerabilità

La sicurezza di Officino è una priorità. Se hai scoperto una vulnerabilità di sicurezza, ti chiediamo di segnalarla in modo **responsabile** — **non aprire una Issue pubblica**.

### Come segnalare

**Metodo preferito – GitHub Private Security Advisory:**

1. Vai su [Security → Advisories](https://github.com/savez/officino/security/advisories/new)
2. Clicca **"Report a vulnerability"**
3. Compila il modulo con tutti i dettagli

**In alternativa**, invia una email al maintainer del progetto (contatto disponibile nel profilo GitHub [@savez](https://github.com/savez)).

### Cosa includere nella segnalazione

- **Descrizione** dettagliata della vulnerabilità
- **Passi per riprodurla** (proof-of-concept, se disponibile)
- **Impatto potenziale** (quali dati/funzionalità sono a rischio)
- **Versione** di Officino in cui è presente il problema
- Eventuali **suggerimenti per la mitigazione**

---

## Tempi di risposta

| Evento                        | Tempo target   |
|-------------------------------|----------------|
| Conferma ricezione            | Entro 48 ore   |
| Valutazione iniziale          | Entro 5 giorni |
| Aggiornamento sullo stato     | Entro 10 giorni|
| Rilascio della patch (critica)| Entro 30 giorni|

---

## Politica di Divulgazione

Seguiamo il principio della **divulgazione responsabile coordinata**:

1. Il segnalatore invia la vulnerabilità in privato.
2. Il maintainer conferma e valuta la gravità.
3. Viene sviluppata e testata una patch.
4. La patch viene rilasciata in produzione.
5. Il pubblico viene informato tramite un **Security Advisory** su GitHub con i dettagli tecnici.

Accreditiamo i ricercatori nei Security Advisory, a meno che non richiedano l'anonimato.

---

## Scope

### In scope 🎯
- Vulnerabilità nell'applicazione Officino (backend Fastify, frontend Vue.js)
- Problemi di autenticazione/autorizzazione (JWT, ruoli)
- Injection SQL o NoSQL
- XSS, CSRF
- Esposizione di dati sensibili tramite API
- Dipendenze con vulnerabilità note

### Out of scope ❌
- Attacchi che richiedono accesso fisico al server
- Ingegneria sociale
- Vulnerabilità in sistemi di terze parti non correlati
- Bug non legati alla sicurezza (usa le Issue normali)

---

## Riconoscimenti

Ringraziamo tutti i ricercatori di sicurezza che contribuiscono a rendere Officino più sicuro. I contributori saranno citati nei Security Advisory (con il loro consenso).
