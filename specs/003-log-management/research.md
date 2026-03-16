# Research: Gestione Log — Flag Attivazione e Pulizia

**Feature**: 003-log-management
**Date**: 2026-03-01
**Status**: Complete — nessun NEEDS CLARIFICATION residuo

---

## Decisione 1: Come controllare il flag `log_attivi` in `logModifica`

**Decision**: Guard inline all'inizio di `logModifica` — query diretta a `impostazioni_officina` prima dell'INSERT.

**Rationale**: La funzione `logModifica(db, params)` riceve già il db instance come primo argomento. Aggiungere un `SELECT log_attivi FROM impostazioni_officina LIMIT 1` all'inizio è la modifica minima, concentrata in un unico punto, senza cambiare la firma della funzione né richiedere middleware. Allineato con il principio KISS.

**Edge case gestito**: Se la query fallisce (tabella non ancora migrata, riga assente) o il campo è NULL → si assume `true` (log attivi). Comportamento non-breaking per installazioni pre-migrazione.

**Alternatives considered**:

- _Caching in-memory del flag_: respinto — introduce complessità (invalidazione cache, race condition tra richieste), non giustificata per volumi bassi.
- _Passare il flag come terzo argomento a `logModifica`_: respinto — obbligherebbe a modificare tutti i call-site (almeno 6 route diverse) anziché un solo punto.
- _Middleware Fastify che inietta il flag nel request context_: respinto — over-engineering per una semplice lettura booleana.

---

## Decisione 2: Struttura API per la cancellazione log per data

**Decision**: Due endpoint separati, entrambi admin-only:

1. `GET /api/log/count-before?data=YYYY-MM-DD` → `{ count: N }`
2. `DELETE /api/log/before?data=YYYY-MM-DD` → `{ deleted: N }`

**Rationale**: Separare il conteggio dalla cancellazione permette al frontend di mostrare prima quanti record saranno eliminati (requisito FR-006) e poi confermare. Un singolo endpoint DELETE con body `{ dry_run: true }` sarebbe meno idiomatico per REST. Due endpoint GET + DELETE è il pattern più chiaro e standard.

**Edge case gestito**: Se `count = 0`, il frontend mostra un messaggio informativo e non abilita la conferma (FR-S2-4 acceptance scenario). Il backend DELETE restituisce `{ deleted: 0 }` senza errore.

**Validazione data**: Il parametro `data` è obbligatorio, formato `YYYY-MM-DD`. Il backend valida con Zod e restituisce 400 se mancante o mal formattato. Non c'è limite superiore alla data (una data futura cancella tutto).

**Alternatives considered**:

- _Endpoint unico con query param `dry_run`_: respinto — semanticamente ambiguo, un GET non dovrebbe avere effetti collaterali condizionali.
- _Endpoint DELETE con risposta 204 (no body)_: respinto — il frontend deve sapere quanti record sono stati eliminati per il feedback (SC-003).

---

## Decisione 3: Migration per `log_attivi`

**Decision**: Nuova migration `20260301_010_add_log_attivi_to_impostazioni.js` con `ALTER TABLE ... ADD COLUMN log_attivi BOOLEAN NOT NULL DEFAULT TRUE`.

**Rationale**: Il numero sequenziale `010` segue il pattern esistente. Default `TRUE` garantisce compatibilità con installazioni esistenti (FR-012). L'UPDATE del seed non è necessario: la riga esistente riceverà il default automaticamente al momento della migration.

**Alternatives considered**:

- _Aggiungere il campo alla migration originale (007)_: respinto — le migration già eseguite non devono essere modificate.
- _Default NULL invece di TRUE_: respinto — richiederebbe gestione speciale del NULL in tutta la logica applicativa; TRUE è il comportamento atteso.

---

## Decisione 4: Protezione admin-only dei route log esistenti

**Decision**: Aggiungere `app.requireRole('admin')` al `preHandler` dei due GET esistenti e ai due nuovi endpoint, usando lo stesso pattern `adminOnly = [app.authenticate, app.requireRole('admin')]` già usato in `impostazioni.js`.

**Rationale**: Pattern già consolidato nel codebase (branch 002-user-roles). Copy-paste del pattern è la modifica più semplice e consistente.

**Security note**: Questa è una correzione di sicurezza. Attualmente `GET /api/log` e `GET /api/log/:entita/:entita_id` sono accessibili a qualsiasi utente autenticato, esponendo l'audit trail completo (chi ha modificato cosa, dettagli delle modifiche). Il fix è obbligatorio.

---

## Decisione 5: Frontend — UI cancellazione log nella pagina LogModifichePage

**Decision**: Sezione "Pulizia Log" in cima alla pagina (sopra i filtri) con: input `date` per la soglia, bottone "Conta record", mostra badge con il count, bottone "Elimina" abilitato solo se count > 0, modale di conferma Bootstrap nativa (no libreria aggiuntiva).

**Rationale**: Usa solo componenti Bootstrap già presenti nel progetto. Nessuna dipendenza aggiuntiva. Lo stesso pattern modale è già usato in altre pagine (PreventivoFormModal.vue).

**Alternatives considered**:

- _Finestra `confirm()` nativa del browser_: respinto — non mostra il conteggio, non è personalizzabile, UX povera.
- _Componente modale separato_: respinto — over-engineering per un'operazione accessoria.

---

## Decisione 6: Frontend — Toggle `log_attivi` nella pagina ImpostazioniPage

**Decision**: Checkbox Bootstrap (`form-check`) con label "Attiva registrazione log modifiche", aggiunto al form esistente. Il campo viene incluso nel body del PUT come campo booleano.

**Rationale**: Coerente con il form esistente. Checkbox è il controllo UI più adatto per un flag booleano. Nessun componente aggiuntivo.

**API note**: Il frontend invia `log_attivi: true/false` nel body del PUT `/api/impostazioni`. Lo schema Zod sul backend viene esteso con `log_attivi: z.boolean().default(true)`.
