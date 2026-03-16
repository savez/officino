# Feature Specification: Rapportini Giornalieri e Note di Lavorazione

**Feature Branch**: `004-daily-work-reports`
**Created**: 2026-03-09
**Status**: Draft
**Input**: User description: "Rapportini giornalieri dei lavori con gestione righe per operaio, note di lavorazione per amministratore"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Operaio inserisce una riga di rapportino (Priority: P1)

L'operaio accede al sistema e inserisce una nuova riga di rapportino indicando: il giorno, la fascia oraria (ora inizio - ora fine), il cliente presso cui ha lavorato, la macchina su cui ha operato (es. trattore, sollevatore), eventuali materiali utilizzati e delle note libere. I materiali vengono selezionati dal magazzino tramite ricerca in tempo reale o scansione del barcode (fotocamera). L'operaio può anche inserire un prodotto non presente a magazzino direttamente dal rapportino. L'operaio non inserisce mai prezzi. La riga viene salvata a suo nome.

**Why this priority**: Senza l'inserimento delle righe da parte degli operai, l'intero flusso dei rapportini non ha dati su cui lavorare. È la funzionalità fondamentale.

**Independent Test**: Si può testare creando un utente operaio, inserendo una riga di rapportino e verificando che venga salvata correttamente con tutti i campi.

**Acceptance Scenarios**:

1. **Given** un operaio autenticato, **When** compila il form con giorno, fascia oraria (14:00-18:00), cliente, macchina, materiali e note, **Then** la riga viene salvata a suo nome ed è visibile nel suo elenco rapportini.
2. **Given** un operaio autenticato, **When** tenta di inserire una riga senza indicare il giorno o la fascia oraria, **Then** il sistema mostra un errore di validazione.
3. **Given** un operaio autenticato, **When** inserisce una riga con solo giorno, fascia oraria e cliente (senza materiali e note), **Then** la riga viene salvata correttamente perché materiali e note sono opzionali.
4. **Given** un operaio che deve aggiungere un materiale, **When** digita nel campo di ricerca, **Then** il sistema mostra in tempo reale i prodotti del magazzino corrispondenti.
5. **Given** un operaio che deve aggiungere un materiale, **When** fotografa il barcode di un prodotto, **Then** il sistema identifica il prodotto dal magazzino e lo seleziona automaticamente.
6. **Given** un operaio che ha usato un materiale non presente a magazzino, **When** inserisce manualmente nome e dettagli del prodotto, **Then** il prodotto viene aggiunto al rapportino come prodotto fuori magazzino.

---

### User Story 2 - Operaio seleziona materiali dal magazzino o li inserisce manualmente (Priority: P1)

Durante l'inserimento di una riga di rapportino, l'operaio può aggiungere uno o più materiali utilizzati. Può cercarli nel magazzino tramite ricerca testuale in tempo reale oppure fotografare il barcode del prodotto per selezionarlo velocemente. Se il materiale non è presente a magazzino, l'operaio può inserirlo manualmente come prodotto fuori magazzino indicando nome e quantità. L'operaio non vede mai i prezzi dei materiali.

**Why this priority**: I materiali sono parte integrante del rapportino e la facilità di inserimento (barcode, ricerca) è cruciale per l'adozione da parte degli operai sul campo.

**Independent Test**: Si può testare cercando un prodotto nel magazzino, scansionando un barcode e inserendo un prodotto manuale, verificando che tutti e tre i metodi funzionino.

**Acceptance Scenarios**:

1. **Given** un operaio che sta compilando una riga di rapportino, **When** digita almeno 2 caratteri nel campo materiale, **Then** il sistema mostra in tempo reale i prodotti del magazzino corrispondenti.
2. **Given** un operaio che sta compilando una riga di rapportino, **When** fotografa il barcode di un prodotto con la fotocamera, **Then** il sistema identifica il prodotto dal magazzino e lo aggiunge alla lista materiali.
3. **Given** un operaio che ha usato un materiale non a magazzino, **When** sceglie di inserire un prodotto manualmente indicando nome e quantità, **Then** il materiale viene aggiunto alla riga come prodotto fuori magazzino.
4. **Given** un operaio che aggiunge materiali, **When** visualizza la lista materiali della riga, **Then** non vede alcun prezzo, solo nome prodotto e quantità.
5. **Given** un operaio, **When** aggiunge più materiali alla stessa riga, **Then** tutti i materiali vengono salvati correttamente associati alla riga.

---

### User Story 3 - Operaio visualizza e cancella le proprie righe (Priority: P1)


L'operaio può vedere l'elenco delle proprie righe di rapportino e cancellarne una se necessario. Non può modificare una riga esistente: se ha sbagliato, la cancella e ne inserisce una nuova. L'operaio vede solo le proprie righe.

**Why this priority**: La possibilità di correggere errori (cancella e rifai) è essenziale per l'usabilità quotidiana.

**Independent Test**: Si può testare creando righe e verificando che l'operaio veda solo le sue e possa cancellarle.

**Acceptance Scenarios**:

1. **Given** un operaio con 3 righe inserite, **When** accede all'elenco rapportini, **Then** vede solo le sue 3 righe e non quelle di altri operai.
2. **Given** un operaio con una riga non gestita, **When** la cancella, **Then** la riga non è più visibile nel suo elenco.
3. **Given** un operaio, **When** tenta di modificare una riga esistente, **Then** il sistema non offre la possibilità di modifica (solo cancellazione).
4. **Given** un operaio con una riga marcata come "gestita", **When** tenta di cancellarla, **Then** il sistema impedisce la cancellazione e informa che solo l'amministratore può farlo.

---

### User Story 4 - Amministratore visualizza rapportini di tutti gli operai (Priority: P2)

L'amministratore può visualizzare le righe di rapportino di tutti gli operai. Può filtrare la vista per cliente o per operaio, per avere una panoramica completa dei lavori svolti.

**Why this priority**: L'amministratore deve poter consultare i dati prima di poterli gestire e trasformare in note di lavorazione.

**Independent Test**: Si può testare con dati di più operai e verificando che l'admin li veda tutti e possa filtrarli.

**Acceptance Scenarios**:

1. **Given** un amministratore autenticato, **When** accede alla sezione rapportini, **Then** vede le righe di tutti gli operai.
2. **Given** un amministratore, **When** filtra per un cliente specifico, **Then** vede solo le righe relative a quel cliente, di tutti gli operai.
3. **Given** un amministratore, **When** filtra per un operaio specifico, **Then** vede solo le righe di quell'operaio.

---

### User Story 5 - Amministratore marca righe come gestite e crea nota di lavorazione (Priority: P2)

L'amministratore seleziona una o più righe di rapportino e le marca come "gestite", associandole a una nuova nota di lavorazione. La nota di lavorazione è un riepilogo dei lavori svolti che l'amministratore può personalizzare.

**Why this priority**: Questo è il flusso principale di valore per l'amministratore: trasformare i dati grezzi in documenti strutturati.

**Independent Test**: Si può testare selezionando righe, creando una nota e verificando che le righe risultino marcate come gestite.

**Acceptance Scenarios**:

1. **Given** un amministratore con righe di rapportino non gestite, **When** seleziona 3 righe e crea una nota di lavorazione, **Then** le 3 righe vengono marcate come gestite e associate alla nota.
2. **Given** un amministratore durante la creazione della nota, **When** visualizza il dettaglio, **Then** può vedere il riepilogo delle ore totali lavorate dalle righe selezionate.
3. **Given** un amministratore, **When** crea la nota di lavorazione, **Then** può scegliere se mostrare i dettagli delle singole righe oppure scrivere solo un campo note con un riassunto libero delle lavorazioni.

---

### User Story 6 - Amministratore modifica nota di lavorazione (Priority: P3)

L'amministratore può modificare una nota di lavorazione esistente: cambiare il testo del riassunto, aggiungere o rimuovere righe di rapportino associate. La modifica dell'associazione aggiorna di conseguenza lo stato "gestita" delle righe.

**Why this priority**: Le note potrebbero necessitare di aggiornamenti dopo la creazione iniziale, ma è una funzionalità secondaria.

**Independent Test**: Si può testare modificando una nota esistente, aggiungendo/rimuovendo righe e verificando che le associazioni si aggiornino.

**Acceptance Scenarios**:

1. **Given** una nota di lavorazione con 3 righe associate, **When** l'amministratore rimuove 1 riga, **Then** la riga rimossa torna allo stato "non gestita" e la nota ha 2 righe associate.
2. **Given** una nota di lavorazione, **When** l'amministratore aggiunge una nuova riga di rapportino, **Then** la riga viene marcata come "gestita" e associata alla nota.
3. **Given** una nota di lavorazione, **When** l'amministratore modifica il campo note/riassunto, **Then** il testo aggiornato viene salvato.

---

### User Story 7 - Stampa rapportini per giornata o cliente (Priority: P3)

L'amministratore può stampare un riepilogo delle righe di rapportino filtrate per una singola giornata o per un cliente specifico. Layout semplice: intestazione con nome cliente (o data giornata), elenco righe con dettagli e totale ore. Nessuna intestazione aziendale ufficiale.

**Why this priority**: La stampa è utile per documentazione cartacea e condivisione con i clienti, ma il flusso digitale funziona anche senza.

**Independent Test**: Si può testare filtrando per giornata o cliente e generando la stampa, verificando che il documento contenga intestazione corretta, righe filtrate e totale ore.

**Acceptance Scenarios**:

1. **Given** un amministratore che filtra per una giornata specifica, **When** avvia la stampa, **Then** il documento ha come intestazione la data della giornata, l'elenco delle righe di quel giorno e il totale ore.
2. **Given** un amministratore che filtra per un cliente specifico, **When** avvia la stampa, **Then** il documento ha come intestazione il nome del cliente, l'elenco delle righe di quel cliente e il totale ore.
3. **Given** un amministratore, **When** stampa le righe filtrate, **Then** il documento mostra per ogni riga: operaio, giorno, fascia oraria, macchina, materiali e note. Il layout è semplice, senza intestazione aziendale ufficiale.

---

### User Story 8 - Stampa nota di lavorazione (Priority: P3)

L'amministratore può stampare una nota di lavorazione. Layout semplice: intestazione con nome cliente, testo riassuntivo e, se l'amministratore ha scelto di mostrare i dettagli, l'elenco delle righe associate con le relative informazioni. Nessuna intestazione aziendale ufficiale.

**Why this priority**: Complementare alla stampa rapportini, permette di condividere il riepilogo lavorazioni con il cliente.

**Independent Test**: Si può testare creando una nota di lavorazione e stampandola, verificando intestazione cliente, contenuto e layout.

**Acceptance Scenarios**:

1. **Given** una nota di lavorazione con dettagli visibili, **When** l'amministratore avvia la stampa, **Then** il documento mostra intestazione cliente, riassunto e dettaglio delle righe associate.
2. **Given** una nota di lavorazione con solo riassunto (senza dettagli righe), **When** l'amministratore avvia la stampa, **Then** il documento mostra intestazione cliente e solo il testo riassuntivo.
3. **Given** una nota di lavorazione, **When** viene stampata, **Then** il layout è semplice, senza intestazione aziendale ufficiale.

---

### User Story 9 - Cancellazione rapportino con associazione a nota (Priority: P3)

Quando un operaio cancella una riga di rapportino che è associata a una nota di lavorazione, l'associazione viene automaticamente rimossa. La nota di lavorazione resta intatta ma senza quella riga.

**Why this priority**: Garantisce la coerenza dei dati, ma è uno scenario meno frequente.

**Independent Test**: Si può testare cancellando una riga associata a una nota e verificando che l'associazione venga rimossa.

**Acceptance Scenarios**:

1. **Given** una riga di rapportino associata a una nota di lavorazione, **When** l'operaio la cancella, **Then** la riga viene eliminata e l'associazione alla nota viene rimossa automaticamente.
2. **Given** una nota con 3 righe associate di cui 1 viene cancellata, **When** l'amministratore visualizza la nota, **Then** vede solo le 2 righe rimanenti.

---

### Edge Cases

- Cosa succede se un operaio inserisce una fascia oraria con ora fine precedente all'ora inizio? Il sistema deve rifiutare l'inserimento con un messaggio di errore.
- Cosa succede se tutte le righe associate a una nota vengono cancellate? La nota resta esistente ma senza righe associate; l'amministratore può decidere se cancellarla manualmente o aggiungere nuove righe.
- Cosa succede se un operaio inserisce righe con fasce orarie sovrapposte nello stesso giorno? Il sistema deve permetterlo (l'operaio potrebbe aver bisogno di registrare attività parallele, oppure correggerà cancellando e reinserendo).
- Cosa succede se l'amministratore tenta di associare a una nota una riga già gestita (associata a un'altra nota)? Il sistema deve segnalare che la riga è già associata a un'altra nota e impedire la doppia associazione.
- Cosa succede se il barcode scansionato non corrisponde a nessun prodotto in magazzino? Il sistema deve informare l'operaio e offrire la possibilità di inserire il prodotto manualmente come fuori magazzino.
- Cosa succede se l'operaio inserisce un prodotto fuori magazzino con lo stesso nome di uno già a magazzino? Il sistema deve permetterlo (sono entità distinte), ma può suggerire il prodotto esistente.

## Clarifications

### Session 2026-03-09

- Q: Quando un operaio seleziona un materiale dal magazzino in un rapportino, la quantità in stock deve essere decrementata automaticamente? → A: Sì, decremento automatico al salvataggio della riga. Ripristino alla cancellazione.
- Q: Una nota di lavorazione è sempre relativa a un singolo cliente? → A: Sì, una nota per un solo cliente. L'admin può selezionare solo righe dello stesso cliente.
- Q: Un operaio può cancellare una riga già marcata come "gestita"? → A: No, solo righe non gestite. Le righe gestite possono essere rimosse solo dall'amministratore.
- Q: L'operaio deve specificare la quantità per ogni materiale aggiunto? → A: Sì, quantità obbligatoria con default 1. Serve per il decremento corretto dello stock.
- Q: Il campo macchina/attrezzatura deve essere testo libero o lista predefinita? → A: Testo libero.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Il sistema DEVE permettere a un operaio di inserire una riga di rapportino con i seguenti campi: giorno (obbligatorio), ora inizio (obbligatorio), ora fine (obbligatorio), cliente (obbligatorio), macchina/attrezzatura (opzionale), materiali utilizzati (opzionale), note (opzionale).
- **FR-002**: Il sistema NON DEVE permettere l'inserimento o la visualizzazione di prezzi nelle righe di rapportino.
- **FR-002a**: Il sistema DEVE permettere la selezione dei materiali dal magazzino tramite ricerca testuale in tempo reale.
- **FR-002b**: Il sistema DEVE permettere la selezione dei materiali dal magazzino tramite scansione del barcode con fotocamera del dispositivo.
- **FR-002c**: Il sistema DEVE permettere l'inserimento manuale di un prodotto non presente a magazzino, indicando almeno nome e quantità.
- **FR-002c2**: Per ogni materiale aggiunto (da magazzino o fuori magazzino), l'operaio DEVE specificare la quantità utilizzata (default: 1).
- **FR-002d**: Una riga di rapportino PUÒ contenere più materiali (sia da magazzino che fuori magazzino).
- **FR-002e**: Quando un operaio salva una riga con materiali da magazzino, il sistema DEVE decrementare automaticamente la quantità in stock (pezzi_magazzino.quantita) per ciascun materiale utilizzato.
- **FR-002f**: Quando una riga di rapportino viene cancellata, il sistema DEVE ripristinare automaticamente la quantità in stock dei materiali da magazzino associati.
- **FR-003**: Il sistema NON DEVE permettere la modifica di righe di rapportino esistenti. L'unica azione possibile è la cancellazione.
- **FR-004**: Ogni operaio DEVE poter visualizzare solo le righe inserite a proprio nome e cancellare solo quelle non ancora marcate come "gestite".
- **FR-004a**: Solo l'amministratore PUÒ rimuovere righe già marcate come "gestite".
- **FR-005**: L'amministratore DEVE poter visualizzare le righe di rapportino di tutti gli operai.
- **FR-006**: L'amministratore DEVE poter filtrare le righe per cliente e per operaio.
- **FR-007**: L'amministratore DEVE poter selezionare una o più righe dello stesso cliente e marcarle come "gestite" associandole a una nota di lavorazione.
- **FR-008**: Una riga di rapportino PUÒ essere associata a una sola nota di lavorazione alla volta.
- **FR-008a**: Una nota di lavorazione DEVE essere associata a un singolo cliente. L'amministratore può selezionare solo righe relative allo stesso cliente.
- **FR-009**: La nota di lavorazione DEVE contenere un campo note/riassunto editabile dall'amministratore.
- **FR-010**: L'amministratore DEVE poter scegliere se mostrare nella nota i dettagli delle singole righe o solo il riassunto.
- **FR-011**: Durante la creazione/modifica della nota, il sistema DEVE mostrare il totale delle ore lavorate calcolato dalle righe selezionate.
- **FR-012**: L'amministratore DEVE poter modificare le note di lavorazione (testo e associazione righe).
- **FR-013**: Quando una riga di rapportino viene cancellata, il sistema DEVE rimuovere automaticamente l'eventuale associazione alla nota di lavorazione.
- **FR-014**: Il sistema DEVE validare che l'ora fine sia successiva all'ora inizio nella stessa riga.
- **FR-015**: Una riga già associata a una nota NON DEVE poter essere associata a un'altra nota senza prima rimuovere l'associazione precedente.
- **FR-016**: L'amministratore DEVE poter stampare un riepilogo delle righe di rapportino filtrate per singola giornata o per cliente, con layout semplice: intestazione giornata/cliente, dettaglio righe e totale ore. Nessuna intestazione aziendale ufficiale.
- **FR-017**: L'amministratore DEVE poter stampare una nota di lavorazione con layout semplice: intestazione cliente, riassunto e opzionalmente dettaglio righe associate. Nessuna intestazione aziendale ufficiale.

### Key Entities

- **Riga Rapportino**: Rappresenta un'attività lavorativa svolta da un operaio. Attributi: giorno, ora inizio, ora fine, cliente, macchina/attrezzatura, note, operaio (autore), stato gestione (gestita/non gestita). Appartiene a un operaio, può essere associata a una nota di lavorazione. Contiene zero o più materiali utilizzati.
- **Materiale Utilizzato**: Materiale associato a una riga di rapportino. Può essere un prodotto del magazzino (con riferimento al prodotto) o un prodotto fuori magazzino (inserito manualmente). Attributi: prodotto (riferimento magazzino o nome manuale), quantità (obbligatoria, default 1), flag fuori magazzino. Per i materiali da magazzino, la quantità determina il decremento dello stock.
- **Nota di Lavorazione**: Riepilogo di lavorazioni creato dall'amministratore per un singolo cliente. Attributi: cliente (obbligatorio), testo riassuntivo, flag mostra dettagli, data creazione. Contiene un insieme di righe di rapportino associate, tutte relative allo stesso cliente.
- **Operaio**: Utente con ruolo operaio che può inserire e cancellare le proprie righe di rapportino.
- **Amministratore**: Utente con ruolo amministratore che può visualizzare tutti i rapportini, creare e modificare note di lavorazione.
- **Cliente**: Entità già esistente nel sistema, riferimento al cliente presso cui è stato svolto il lavoro.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un operaio può inserire una riga di rapportino completa in meno di 1 minuto.
- **SC-002**: L'amministratore può creare una nota di lavorazione selezionando righe e scrivendo il riassunto in meno di 3 minuti.
- **SC-003**: L'amministratore può trovare tutte le righe di un cliente specifico in meno di 10 secondi tramite i filtri.
- **SC-004**: Il 100% delle righe cancellate rimuove automaticamente l'associazione alla nota senza intervento manuale.
- **SC-005**: Il totale ore viene calcolato correttamente per qualsiasi combinazione di righe selezionate.

## Assumptions

- Il sistema di autenticazione e i ruoli (operaio, amministratore) sono già esistenti nel progetto.
- L'entità "Cliente" è già presente nel sistema.
- Il campo "macchina/attrezzatura" è testo libero (trattore, sollevatore, etc.).
- I materiali vengono selezionati dal magazzino esistente (ricerca in tempo reale o barcode) oppure inseriti manualmente come prodotti fuori magazzino.
- L'inserimento di un prodotto fuori magazzino dal rapportino NON lo aggiunge automaticamente al magazzino (resta un dato del rapportino).
- L'inserimento di un materiale da magazzino nel rapportino decrementa automaticamente lo stock; la cancellazione della riga lo ripristina.
- La stampa è prevista sia per le righe di rapportino (per giornata/cliente) sia per le note di lavorazione. Layout semplice con intestazione cliente, senza intestazione aziendale ufficiale.
- Le fasce orarie sono nell'arco della stessa giornata (non si gestiscono turni notturni a cavallo di due giorni).
