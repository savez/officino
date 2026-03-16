# Feature Specification: Gestione Magazzino Semplice

**Feature Branch**: `001-magazzino-semplice`
**Created**: 2026-02-23
**Updated**: 2026-02-28
**Status**: Draft
**Input**: Vogliamo creare un programma semplice e veloce per gestire il magazzino dell'officina. Niente roba complicata: devi poter vedere cosa hai in magazzino, fare preventivi ai clienti e tenere tutto sotto controllo. Funzionerà dal computer, dal tablet e anche dal telefono.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Gestione Magazzino (Priority: P1)

L'utente può vedere, cercare e gestire i pezzi in magazzino da qualsiasi dispositivo. Può scansionare il barcode (formato EAN-13 o codice manuale) con scanner o fotocamera, cercare per nome/marca/modello/categoria, ricevere avvisi visivi quando un pezzo scende sotto la soglia ed esportare la lista in Excel.

Ogni pezzo ha un prezzo di vendita predefinito e, opzionalmente, un prezzo di acquisto. I pezzi sono organizzati per categorie (es. "Freni", "Elettrico", "Carrozzeria").

**Why this priority**: È la funzione base, senza questa il programma non serve.

**Independent Test**: Si testa caricando pezzi con categoria e prezzo, cercando/scansionando, verificando gli avvisi visivi e l'export Excel.

**Acceptance Scenarios**:

1. **Given** il magazzino contiene pezzi, **When** l'utente cerca per nome/barcode/categoria, **Then** trova subito il pezzo.
2. **Given** un pezzo scende sotto la soglia, **When** l'utente visualizza la lista magazzino, **Then** il pezzo è evidenziato con indicatore visivo (es. riga rossa / icona avviso).
3. **Given** ci sono pezzi in magazzino, **When** l'utente esporta, **Then** ottiene un file Excel con tutti i dati inclusi prezzi e categorie.
4. **Given** un pezzo senza barcode fisico, **When** l'utente lo aggiunge, **Then** può inserire un codice identificativo manuale.

---

### User Story 2 - Gestione Clienti (Priority: P1)

L'utente può creare, modificare, cercare e visualizzare i clienti dell'officina da una pagina dedicata. Ogni cliente ha nome, telefono, email, indirizzo, codice fiscale e/o P.IVA, e note.

**Why this priority**: Senza anagrafica clienti non si possono creare preventivi formali.

**Independent Test**: Si testa creando, modificando, cercando e visualizzando clienti.

**Acceptance Scenarios**:

1. **Given** la pagina clienti, **When** l'utente crea un nuovo cliente con i dati obbligatori, **Then** il cliente è salvato e visibile in lista.
2. **Given** clienti esistenti, **When** l'utente cerca per nome o P.IVA, **Then** trova il cliente.
3. **Given** un cliente esistente, **When** l'utente modifica i dati, **Then** le modifiche sono salvate.

---

### User Story 3 - Preventivi (Priority: P2)

L'utente può creare preventivi scegliendo cliente, operaio (facoltativo) e pezzi dal magazzino. Per ogni pezzo il prezzo di vendita predefinito viene caricato automaticamente, ma è modificabile nel preventivo. L'utente può selezionare un operaio (utente dell'officina) che eseguirà il lavoro: selezionando l'operaio, il suo costo orario viene precompilato automaticamente nella sezione manodopera (ma resta modificabile). L'utente può aggiungere manodopera (una voce: ore x costo orario, costo modificabile per singolo preventivo) e applicare uno sconto (importo fisso oppure percentuale, che viene convertito in importo fisso e mostrato nel preventivo).

Tutti i prezzi sono IVA esclusa. L'aliquota IVA viene applicata sul totale del preventivo. Il preventivo mostra: imponibile, sconto, imponibile netto, IVA, totale.

Il numero preventivo è generato automaticamente (formato ANNO/NUMERO). Quando il cliente approva, i pezzi vengono scalati dal magazzino.

**Stati del preventivo**: bozza → approvato → fatturato. Un preventivo può anche essere rifiutato, scaduto o cancellato.

**Cancellazione**: Un preventivo approvato può essere cancellato (soft delete: passa allo stato "cancellato" ma non viene eliminato dal sistema). I preventivi in bozza possono essere eliminati fisicamente.

**Duplicazione**: Qualsiasi preventivo può essere duplicato. La copia viene creata in stato bozza con data odierna, nuovo numero progressivo e tutti i dati (pezzi, manodopera, sconto, operaio) copiati dall'originale.

**Why this priority**: Permette di collegare magazzino e lavoro reale, velocizza la gestione clienti.

**Independent Test**: Si testa creando preventivi, verificando calcoli (prezzi, sconto, IVA), la numerazione, i passaggi di stato e la scalatura automatica dei pezzi.

**Acceptance Scenarios**:

1. **Given** un nuovo preventivo, **When** l'utente seleziona cliente e pezzi, **Then** il preventivo viene creato con numero progressivo e prezzi precompilati dal magazzino.
2. **Given** un preventivo in bozza, **When** l'utente applica uno sconto del 10%, **Then** lo sconto calcolato appare come importo fisso e il totale si aggiorna (imponibile - sconto + IVA).
3. **Given** un preventivo approvato, **When** si conferma, **Then** i pezzi vengono scalati dal magazzino.
4. **Given** un preventivo in bozza, **When** l'utente lo segna come rifiutato, **Then** lo stato cambia e i pezzi non vengono scalati.
5. **Given** un preventivo approvato, **When** l'utente genera il PDF, **Then** il PDF contiene intestazione officina, dettaglio pezzi, manodopera, sconto, IVA e totale.
6. **Given** un preventivo in qualsiasi stato, **When** l'utente clicca "Duplica", **Then** viene creato un nuovo preventivo in bozza con tutti i dati copiati, data odierna e nuovo numero.
7. **Given** un preventivo approvato, **When** l'utente clicca "Cancella", **Then** il preventivo passa allo stato "cancellato" (soft delete, non eliminato).
8. **Given** un nuovo preventivo, **When** l'utente seleziona un operaio, **Then** il costo orario dell'operaio viene precompilato nella sezione manodopera.
9. **Given** la lista preventivi (anche con pochi elementi o viewport ridotta), **When** l'utente apre le azioni di riga, **Then** le azioni sono visualizzate in un modale completo e non risultano tagliate.

---

### User Story 4 - Ricerca e Backup Preventivi (Priority: P3)

L'utente può cercare i preventivi per numero, cliente o anno. Può esportare/importare preventivi per backup o trasferimento.

**Why this priority**: Facilita la gestione storica e la sicurezza dei dati.

**Independent Test**: Si testa cercando preventivi e provando export/import file.

**Acceptance Scenarios**:

1. **Given** esistono preventivi, **When** l'utente cerca per numero/cliente/anno, **Then** trova il preventivo giusto.
2. **Given** un preventivo, **When** viene esportato/importato, **Then** il dato è integro e accessibile.

---

### User Story 5 - Esportazione PDF Preventivo (Priority: P2)

L'utente può generare un PDF del preventivo da stampare o inviare al cliente. Il PDF include l'intestazione dell'officina (nome, P.IVA, indirizzo, logo) configurabile dal DB, il dettaglio pezzi con prezzi, manodopera, sconto, IVA e totale.

**Why this priority**: I preventivi devono poter essere consegnati ai clienti in formato professionale.

**Independent Test**: Si testa generando PDF e verificando che tutti i dati siano presenti e formattati.

**Acceptance Scenarios**:

1. **Given** un preventivo completo, **When** l'utente clicca "Genera PDF", **Then** viene scaricato un PDF con intestazione officina e tutti i dettagli.
2. **Given** dati officina configurati, **When** l'utente modifica i dati officina, **Then** i nuovi PDF riflettono i dati aggiornati.

---

### User Story 6 - Impostazioni Officina (Priority: P2)

L'utente può configurare i dati dell'officina (nome, P.IVA, indirizzo, telefono, email, logo) da una pagina impostazioni. Questi dati vengono usati nell'intestazione dei PDF dei preventivi.

**Why this priority**: Necessario per generare preventivi professionali personalizzati.

**Independent Test**: Si testa modificando i dati officina e verificando che appaiano nei PDF generati.

**Acceptance Scenarios**:

1. **Given** la pagina impostazioni, **When** l'utente inserisce/modifica i dati officina, **Then** i dati sono salvati.
2. **Given** dati officina salvati, **When** si genera un PDF preventivo, **Then** l'intestazione mostra i dati corretti.

---

### User Story 7 - Log Modifiche (Priority: P3)

Il sistema registra automaticamente le modifiche significative su preventivi e magazzino (creazione, modifica, cambio stato, aggiunta/rimozione pezzi). Il log include chi ha fatto la modifica, quando e cosa è cambiato.

**Why this priority**: Permette tracciabilità e audit delle operazioni.

**Independent Test**: Si testa eseguendo operazioni e verificando che il log le registri correttamente.

**Acceptance Scenarios**:

1. **Given** un utente modifica un preventivo, **When** la modifica è salvata, **Then** il log registra utente, data/ora e dettaglio modifica.
2. **Given** un utente modifica la quantità di un pezzo in magazzino, **When** la modifica è salvata, **Then** il log registra l'operazione.

### User Story 8 - Gestione Utenti (Priority: P2)

L'utente può gestire gli account degli utenti dell'officina da una pagina dedicata. Ogni utente ha nome, email, password, ruolo (user/admin) e costo orario associato. Il costo orario viene utilizzato per precompilare la manodopera nei preventivi quando l'utente viene selezionato come operaio.

**Why this priority**: Necessario per gestire gli operai dell'officina e associare il giusto costo orario ai preventivi.

**Independent Test**: Si testa creando, modificando e eliminando utenti, e verificando che il costo orario venga precompilato nei preventivi.

**Acceptance Scenarios**:

1. **Given** la pagina utenti, **When** l'utente crea un nuovo utente con nome, email e password, **Then** l'utente è salvato e visibile in lista.
2. **Given** un utente esistente, **When** si modifica il costo orario, **Then** il nuovo costo orario viene usato nei nuovi preventivi.
3. **Given** un utente con preventivi associati, **When** si tenta di eliminarlo, **Then** il sistema blocca l'eliminazione e mostra un messaggio.
4. **Given** l'utente corrente, **When** tenta di eliminare se stesso, **Then** il sistema blocca l'operazione.

---

### Edge Cases

- Cosa succede se si scansiona un barcode non presente? Mostra messaggio chiaro e suggerisce aggiunta.
- Se il database non è raggiungibile, mostra errore e suggerisce riprovare.
- Se si approva un preventivo ma un pezzo non ha quantità sufficiente in magazzino, il sistema avvisa e blocca l'approvazione.
- Se si elimina una categoria, i pezzi associati restano senza categoria (campo nullable).
- Se l'aliquota IVA cambia, i preventivi già creati mantengono l'IVA con cui sono stati generati.
- Un preventivo approvato/rifiutato/scaduto/fatturato/cancellato non è modificabile. Solo i preventivi in bozza possono essere editati.
- Un preventivo approvato può essere cancellato (soft delete → stato "cancellato") ma non eliminato fisicamente. Solo i preventivi in bozza possono essere eliminati fisicamente.
- Qualsiasi preventivo può essere duplicato come nuova bozza, indipendentemente dal suo stato.
- Un cliente con preventivi collegati non può essere eliminato: viene archiviato (soft delete). I clienti archiviati non appaiono nelle selezioni ma i preventivi esistenti restano accessibili.
- Un utente con preventivi associati (come creatore o operaio) non può essere eliminato. Un utente non può eliminare se stesso.
- Tutte le liste (magazzino, clienti, preventivi, utenti) sono paginate per garantire performance su dataset grandi.
- Nella lista preventivi, il pannello azioni deve restare sempre completamente visibile (anche con poche righe in tabella o su schermi piccoli).

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Il sistema deve permettere la ricerca e visualizzazione dei pezzi in magazzino da qualsiasi dispositivo.
- **FR-002**: Deve essere possibile scansionare barcode (EAN-13 o codice manuale) tramite scanner o fotocamera.
- **FR-003**: L'utente deve ricevere avvisi visivi (indicatore nella lista magazzino) quando un pezzo scende sotto la soglia.
- **FR-004**: Esportazione del magazzino in formato Excel (con prezzi e categorie).
- **FR-005**: Ogni pezzo ha un prezzo di vendita predefinito e un prezzo di acquisto opzionale.
- **FR-006**: I pezzi sono organizzati per categorie configurabili.
- **FR-007**: Gestione anagrafica clienti completa (CRUD) con codice fiscale e P.IVA.
- **FR-008**: Creazione di preventivi con selezione cliente, operaio (facoltativo, con costo orario precompilato), pezzi (prezzo precompilato ma modificabile), manodopera (1 voce: ore x costo orario modificabile) e sconto (fisso o percentuale, mostrato come importo fisso).
- **FR-009**: Tutti i prezzi sono IVA esclusa. L'IVA viene applicata sul totale. Il preventivo mostra: imponibile, sconto, imponibile netto, IVA, totale.
- **FR-010**: Numerazione automatica dei preventivi (formato ANNO/NUMERO).
- **FR-011**: Stati preventivo: bozza, approvato, rifiutato, scaduto, fatturato, cancellato. Lo stato "cancellato" è un soft delete raggiungibile da "approvato".
- **FR-012**: Alla conferma (approvazione) di un preventivo, i pezzi vengono scalati dal magazzino (con verifica disponibilità).
- **FR-013**: Ricerca preventivi per numero, cliente o anno.
- **FR-014**: Esportazione e importazione di preventivi tramite file.
- **FR-015**: Generazione PDF del preventivo con intestazione officina personalizzabile.
- **FR-016**: Pagina impostazioni per configurare dati officina (nome, P.IVA, indirizzo, telefono, email, logo).
- **FR-017**: Ogni utente deve avere accesso personale e sicuro (email + password).
- **FR-018**: Il sistema deve funzionare anche su PC/tablet/telefono poco potenti.
- **FR-019**: I dati devono essere salvati su database affidabile.
- **FR-020**: Log automatico delle modifiche su preventivi e magazzino (chi, quando, cosa).
- **FR-021**: Il sistema non gestisce permessi per ruolo nella prima versione (tutti gli utenti hanno le stesse funzionalità).
- **FR-022**: I preventivi sono modificabili solo in stato bozza. Una volta approvati/rifiutati/scaduti/fatturati/cancellati sono bloccati.
- **FR-023**: I clienti con preventivi collegati vengono archiviati (soft delete) e non eliminati fisicamente.
- **FR-024**: Tutte le liste sono paginate lato API (es. 25/50 elementi per pagina).
- **FR-025**: Duplicazione preventivi: qualsiasi preventivo può essere duplicato come nuova bozza con data odierna e nuovo numero progressivo.
- **FR-026**: Gestione utenti completa (CRUD) con nome, email, password, ruolo e costo orario. Gli utenti con preventivi associati non possono essere eliminati.
- **FR-027**: Selezione operaio nel preventivo: selezionando un utente come operaio, il suo costo orario viene precompilato nella manodopera (resta modificabile manualmente).
- **FR-028**: Nella lista preventivi, le azioni per singola riga devono essere accessibili tramite modale dedicato, così da evitare clipping/tagli del menu in contesti responsive o con poche righe mostrate.

### Key Entities

- **PezzoMagazzino**: articolo in magazzino (barcode, nome, marca, modello, quantità, soglia_avviso, prezzo_vendita, prezzo_acquisto, categoria)
- **Categoria**: categoria dei pezzi (nome, descrizione)
- **Cliente**: anagrafica cliente (nome, telefono, email, indirizzo, codice_fiscale, partita_iva, note)
- **Preventivo**: documento con numero, cliente, operaio (facoltativo), lista pezzi (con prezzo modificabile), manodopera (ore, costo orario precompilato da operaio), sconto, IVA, stato (bozza/approvato/rifiutato/scaduto/fatturato/cancellato), data
- **ImpostazioniOfficina**: dati officina per intestazione PDF (nome, P.IVA, indirizzo, telefono, email, logo)
- **LogModifica**: registro modifiche (utente, entità, azione, dettaglio, timestamp)
- **Utente**: accesso personale con nome, email, credenziali, ruolo (user/admin), costo orario. Pagina dedicata per la gestione CRUD degli utenti. Il costo orario viene usato per precompilare la manodopera nei preventivi quando l'utente è selezionato come operaio

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: L'utente trova e visualizza un pezzo in magazzino in meno di 5 secondi.
- **SC-002**: Gli avvisi visivi di soglia vengono mostrati correttamente il 100% delle volte nella lista magazzino.
- **SC-003**: Il 95% dei preventivi viene creato senza errori, con numerazione corretta e calcoli (sconto, IVA, totale) accurati.
- **SC-004**: Export/import file funzionano senza perdita dati nel 100% dei casi testati.
- **SC-005**: Il sistema è utilizzabile da PC, tablet e telefono con interfaccia adattiva.
- **SC-006**: Il PDF del preventivo contiene tutti i dati corretti (intestazione, pezzi, manodopera, sconto, IVA, totale).
- **SC-007**: Il log delle modifiche registra il 100% delle operazioni significative.
- **SC-008**: Le azioni di riga in lista preventivi risultano sempre complete e cliccabili (0 casi di menu tagliato nei test UI su desktop/tablet/mobile).
