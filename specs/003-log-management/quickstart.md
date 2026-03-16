# Quickstart: Gestione Log — Flag Attivazione e Pulizia

**Feature**: 003-log-management
**Date**: 2026-03-01

---

## Prerequisiti

- Branch `002-user-roles` deve essere già mergiato (il sistema RBAC è necessario)
- Database aggiornato con le migration precedenti (001–009)

---

## Setup: Applicare la migration

```bash
make migrate
```

Questo aggiunge la colonna `log_attivi BOOLEAN DEFAULT TRUE` alla tabella `impostazioni_officina`.

---

## Funzionalità 1: Attivare/disattivare i log

1. Accedere come utente **admin**
2. Navigare a **Impostazioni**
3. Scorrere fino alla sezione "Registrazione Log"
4. Usare il toggle "Attiva registrazione log modifiche"
5. Cliccare **Salva impostazioni**

Quando il flag è **disattivato**: qualsiasi operazione (modifica pezzo, cliente, preventivo) non genererà nuove voci di log.
Quando il flag è **attivato** (default): il comportamento è identico al precedente.

---

## Funzionalità 2: Cancellare log obsoleti

1. Accedere come utente **admin**
2. Navigare a **Log Modifiche**
3. Nella sezione "Pulizia Log" in cima alla pagina:
   - Selezionare una **data di soglia** (es: `2026-01-01`)
   - Cliccare **Conta record** — viene mostrato il numero di log che saranno eliminati
4. Se il conteggio è > 0, cliccare **Elimina** e confermare nella finestra di dialogo
5. Il sistema conferma quanti log sono stati eliminati

> **Attenzione**: la cancellazione è **irreversibile**. Tutti i log con data antecedente alla data scelta vengono rimossi definitivamente.

---

## Funzionalità 3: Accesso log admin-only

- Gli utenti con ruolo **user** non vedono la voce "Log" nel menu
- Se un utente `user` tenta di accedere direttamente a `/log`, viene reindirizzato alla pagina **403 Accesso Negato**
- Le chiamate API a `/api/log` senza ruolo admin ricevono risposta **HTTP 403**

---

## Sviluppo: eseguire i test

```bash
# Backend: tutti i test
make test

# Solo i test del modulo log
cd backend && pnpm test -- --testPathPattern=log
```

---

## Note per il deploy

1. Eseguire `make migrate` sulla produzione **prima** di deployare il nuovo codice
2. Il valore di default `TRUE` garantisce che i log continuino a essere scritti senza per le installazioni esistenti senza azione richiesta
