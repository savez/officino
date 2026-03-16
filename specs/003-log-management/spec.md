# Feature Specification: Gestione Log — Flag Attivazione e Pulizia

**Feature Branch**: `003-log-management`
**Created**: 2026-02-28
**Status**: Draft
**Input**: User description: "Implementare un flag in impostazioni che permette di attivare o meno i log. Funzione per cancellare i log più vecchi di una certa data. I log li può vedere solo l'admin."

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Flag attivazione/disattivazione log (Priority: P1) 🎯 MVP

L'amministratore dell'officina vuole poter attivare o disattivare la registrazione dei log di modifica direttamente dalla pagina Impostazioni. Quando il flag è disattivato, il sistema smette di registrare nuove voci di log. Quando viene riattivato, il sistema riprende a registrare normalmente. I log già esistenti non vengono cancellati dalla disattivazione.

**Why this priority**: Senza questo flag non è possibile controllare se le operazioni di audit vengono scritte, che è la funzionalità centrale richiesta.

**Independent Test**: Accedere come admin, entrare in Impostazioni, disattivare il flag, eseguire un'operazione tracciata (es. modifica cliente), verificare che nessun nuovo log venga scritto. Riattivare il flag e verificare che i log riprendano.

**Acceptance Scenarios**:

1. **Given** l'admin è nella pagina Impostazioni e il flag log è attivo, **When** disattiva il flag e salva, **Then** il sistema conferma il salvataggio e le operazioni successive non generano nuove voci di log.
2. **Given** il flag log è disattivato, **When** l'admin lo riattiva e salva, **Then** le operazioni successive vengono nuovamente registrate nel log.
3. **Given** il flag log è disattivato, **When** un utente qualsiasi modifica un pezzo di magazzino, **Then** nessuna voce di log viene creata per quell'operazione.
4. **Given** il flag log è disattivato e ci sono log storici, **When** l'admin visualizza la pagina Log, **Then** i log esistenti sono ancora visibili e consultabili.

---

### User Story 2 — Cancellazione log per data (Priority: P1)

L'amministratore vuole poter eliminare tutti i log di modifica anteriori a una data scelta, per mantenere il database pulito e performante nel tempo. La cancellazione deve essere irreversibile e richiedere una conferma esplicita prima di procedere.

**Why this priority**: La pulizia dei dati storici è essenziale per la manutenzione operativa del sistema e complementa il flag di attivazione.

**Independent Test**: Accedere come admin alla pagina Log, selezionare una data di soglia, confermare la cancellazione e verificare che i log precedenti a quella data siano stati rimossi e quelli successivi siano ancora presenti.

**Acceptance Scenarios**:

1. **Given** l'admin è nella pagina Log Modifiche, **When** seleziona una data di soglia e conferma la cancellazione, **Then** tutti i log con data di creazione precedente alla data scelta vengono eliminati definitivamente.
2. **Given** l'admin ha selezionato una data di soglia, **When** preme il pulsante di cancellazione, **Then** il sistema mostra una finestra di conferma che indica il numero di log che saranno eliminati, prima di procedere.
3. **Given** l'admin annulla la conferma di cancellazione, **Then** nessun log viene eliminato.
4. **Given** non esistono log precedenti alla data scelta, **When** l'admin conferma la cancellazione, **Then** il sistema informa che non ci sono log da eliminare.

---

### User Story 3 — Restrizione accesso log solo agli admin (Priority: P1)

Solo gli utenti con ruolo admin possono accedere alla consultazione dei log di modifica. Gli utenti normali non devono vedere la voce "Log" nel menu di navigazione e non devono poter accedere ai dati di log nemmeno tramite chiamate API dirette.

**Why this priority**: Si tratta di una correzione di sicurezza. Attualmente i log sono accessibili a qualsiasi utente autenticato, esponendo informazioni potenzialmente sensibili sulle operazioni degli altri utenti.

**Independent Test**: Accedere come utente con ruolo 'user', verificare che la voce "Log" nel menu sia nascosta, tentare di accedere direttamente all'URL /log e verificare il redirect alla pagina 403, chiamare GET /api/log e verificare la risposta 403.

**Acceptance Scenarios**:

1. **Given** un utente con ruolo 'user' è autenticato, **When** guarda il menu di navigazione, **Then** la voce "Log" non è visibile.
2. **Given** un utente con ruolo 'user' tenta di navigare a /log direttamente dalla barra degli indirizzi, **Then** viene reindirizzato alla pagina 403 Accesso Negato.
3. **Given** un utente con ruolo 'user' effettua una richiesta GET /api/log, **Then** riceve una risposta HTTP 403 con messaggio di errore.
4. **Given** un utente con ruolo 'admin' è autenticato, **When** guarda il menu di navigazione, **Then** la voce "Log" è visibile e funzionante.
5. **Given** un utente con ruolo 'admin' accede a /api/log, **Then** riceve i dati dei log normalmente.

---

### Edge Cases

- Cosa succede se il flag log viene disattivato mentre un'operazione di scrittura log è in corso? Il sistema deve gestire il caso senza errori, semplicemente scartando il log.
- Cosa succede se un admin imposta come data di soglia una data futura? Il sistema deve eliminare tutti i log (essendo tutti antecedenti alla data futura) dopo conferma esplicita.
- Cosa succede se la tabella impostazioni non ha ancora il campo flag log (in fase di migrazione)? Il default deve essere "log attivi" per non interrompere il funzionamento corrente.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Il sistema DEVE permettere all'admin di attivare e disattivare la registrazione dei log tramite un flag booleano nelle impostazioni dell'officina.
- **FR-002**: Il flag di attivazione log DEVE essere visibile e modificabile nella pagina Impostazioni, all'interno del form esistente.
- **FR-003**: Quando il flag log è disattivato, il sistema DEVE smettere di registrare qualsiasi nuova voce nella tabella log_modifiche, senza generare errori.
- **FR-004**: La disattivazione del flag NON DEVE cancellare i log storici già registrati.
- **FR-005**: L'admin DEVE poter selezionare una data di soglia nella pagina Log e cancellare tutti i log precedenti a quella data.
- **FR-006**: Prima della cancellazione dei log, il sistema DEVE mostrare un conteggio dei record da eliminare e richiedere una conferma esplicita.
- **FR-007**: La cancellazione dei log DEVE essere un'operazione irreversibile; una volta confermata, i dati vengono rimossi definitivamente.
- **FR-008**: I route API di lettura log (GET /api/log, GET /api/log/:entita/:entita_id) DEVONO essere accessibili solo agli utenti con ruolo admin.
- **FR-009**: Il route API di cancellazione log DEVE essere accessibile solo agli utenti con ruolo admin.
- **FR-010**: La voce "Log" nel menu di navigazione del frontend DEVE essere visibile solo agli utenti admin.
- **FR-011**: Il route frontend /log DEVE essere protetto e reindirizzare gli utenti non-admin alla pagina 403.
- **FR-012**: Il valore di default del flag log per nuove installazioni DEVE essere "attivo" (true), per garantire compatibilità con il comportamento attuale.

### Key Entities

- **Impostazione Officina (estensione)**: Entità esistente che viene estesa con un nuovo attributo booleano per il controllo di attivazione dei log. Relazione: governa il comportamento di scrittura della tabella Log Modifiche.
- **Log Modifica (esistente)**: Voce di audit trail che registra chi ha fatto cosa e quando. Ogni voce include: utente associato, tipo entità, ID entità, tipo azione, dettaglio modifiche, data creazione.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: L'admin può attivare/disattivare il flag log in meno di 10 secondi dalla pagina Impostazioni.
- **SC-002**: Con il flag disattivato, zero nuove voci di log vengono create indipendentemente dal numero di operazioni eseguite.
- **SC-003**: L'admin può selezionare una data e cancellare i log obsoleti in meno di 30 secondi, con feedback visivo sull'esito.
- **SC-004**: Un utente con ruolo 'user' non riesce ad accedere in alcun modo ai dati di log (né via interfaccia, né via API diretta).
- **SC-005**: 100% dei nuovi endpoint e route di log risultano protetti con controllo ruolo admin.
- **SC-006**: La funzionalità di cancellazione log mostra il conteggio esatto dei record da eliminare prima della conferma nel 100% dei casi.

## Assumptions

- Il sistema RBAC (ruoli admin/user) implementato nel branch 002-user-roles è già disponibile e funzionante (decorator `requireRole`, helper `isAdmin`, guardie router frontend).
- Il campo flag verrà aggiunto alla tabella `impostazioni_officina` esistente tramite una nuova migration, con valore di default `true`.
- La funzione di log esistente (`logModifica`) viene richiamata già in modo centralizzato nelle route; il check del flag può essere integrato in un unico punto.
- La cancellazione log non necessita di un soft-delete: è una rimozione fisica definitiva dalla tabella.

## Dependencies

- **Branch 002-user-roles**: Necessario per il decorator `requireRole('admin')`, l'helper `isAdmin()` nel frontend, e la guardia `beforeEach` del router.
- **Tabella impostazioni_officina**: Deve essere già creata e popolata con almeno una riga (garantito dalla migration/seed esistente).
- **Tabella log_modifiche**: Deve essere già creata (garantito dalla migration 008).
