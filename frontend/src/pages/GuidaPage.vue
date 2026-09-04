<script setup>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { isAdmin } from '../services/auth'

const route = useRoute()
const admin = ref(isAdmin())

// L'elenco delle sezioni riservate era scritto a mano qui, e ha smesso di
// corrispondere alla realta' quando i permessi sono cambiati: la guida mostrava
// Clienti e Preventivi a chi non poteva piu' aprirli, con tanto di istruzioni
// su come creare un cliente.
//
// Il carattere riservato di ciascuna sezione va tenuto allineato al menu: sono
// i due punti che decidono cosa l'utente vede, e se divergono la guida descrive
// pagine che l'utente non trova. Un test lo verifica a ogni esecuzione
// (guida-permessi.test.js).
const sections = [
  { id: 'ruoli', label: 'Chi può fare cosa' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'catalogo', label: 'Catalogo Prodotti' },
  { id: 'categorie', label: 'Categorie' },
  { id: 'clienti', label: 'Clienti', adminOnly: true },
  { id: 'preventivi', label: 'Preventivi', adminOnly: true },
  { id: 'rapportini', label: 'Rapportini' },
  { id: 'note-lavorazione', label: 'Note di Lavorazione', adminOnly: true },
  { id: 'utenti', label: 'Utenti', adminOnly: true },
  { id: 'impostazioni', label: 'Impostazioni', adminOnly: true },
]

const visibleSections = sections.filter((s) => !s.adminOnly || admin.value)

onMounted(() => {
  if (route.hash) {
    const id = route.hash.replace('#', '')
    const el = document.getElementById(id)
    if (el) {
      setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    }
  }
})
</script>

<template>
  <div>
    <h2 class="mb-1"><i class="bi bi-book me-2"></i>Guida a Officino</h2>
    <p class="text-muted mb-4">
      Guida completa all'uso dell'applicazione. Clicca su una sezione per navigare direttamente.
    </p>

    <div class="row g-4">
      <!-- Indice laterale (desktop) -->
      <div class="col-md-3 d-none d-md-block">
        <div class="card sticky-top" style="top: 1rem">
          <div class="card-header">
            <strong><i class="bi bi-list-ul me-1"></i>Indice</strong>
          </div>
          <div class="list-group list-group-flush">
            <a
              v-for="s in visibleSections"
              :key="s.id"
              :href="'#' + s.id"
              class="list-group-item list-group-item-action py-2 small"
            >
              {{ s.label }}
              <span v-if="s.adminOnly" class="badge bg-warning text-dark ms-1" style="font-size: 0.65rem">admin</span>
            </a>
          </div>
        </div>
      </div>

      <!-- Indice mobile (accordion) -->
      <div class="col-12 d-md-none">
        <details class="border rounded p-2 mb-2">
          <summary class="fw-semibold py-1"><i class="bi bi-list-ul me-1"></i>Indice sezioni</summary>
          <ul class="list-unstyled mt-2 ms-2">
            <li v-for="s in visibleSections" :key="s.id" class="mb-1">
              <a :href="'#' + s.id" class="text-decoration-none small">
                {{ s.label }}
                <span v-if="s.adminOnly" class="badge bg-warning text-dark ms-1" style="font-size: 0.65rem">admin</span>
              </a>
            </li>
          </ul>
        </details>
      </div>

      <!-- Contenuto guida -->
      <div class="col-12 col-md-9">

        <!-- ── Chi può fare cosa ──────────────────────────────────── -->
        <section id="ruoli" class="mb-5">
          <h3 class="border-bottom pb-2">
            <i class="bi bi-person-badge me-2 text-primary"></i>Chi può fare cosa
          </h3>
          <p>
            Officino ha due ruoli: <strong>Utente</strong> (l'operaio) e
            <strong>Admin</strong>. Il ruolo decide quali voci compaiono nel menu e quali
            operazioni sono permesse.
          </p>

          <h5>L'operaio</h5>
          <p>Vede cinque voci di menu e su queste può lavorare:</p>
          <ul>
            <li>
              <strong>Home</strong>: la dashboard con i <em>propri</em> dati — le proprie ore,
              i propri clienti, i propri giorni sotto le 8 ore. Non vede mai i dati dei
              colleghi.
            </li>
            <li>
              <strong>Catalogo Prodotti</strong>: può consultare, aggiungere, modificare ed
              eliminare articoli. È chi lavora a tenere aggiornato il magazzino.
            </li>
            <li>
              <strong>Categorie</strong>: stesse possibilità del catalogo.
            </li>
            <li>
              <strong>Rapportini</strong>: crea rapportini a proprio nome e vi aggiunge
              lavorazioni finché non li dichiara conclusi. Dopo la conclusione servono le mani
              di un amministratore per riaprirli. Vede soltanto i propri rapportini.
            </li>
            <li><strong>Guida</strong>: questa pagina.</li>
          </ul>

          <div class="alert alert-info py-2">
            <strong>I clienti non sono nel menu, ma servono lo stesso.</strong>
            Compilando un rapportino l'operaio sceglie il cliente da un elenco completo: può
            <em>leggere</em> l'anagrafica, e questo continua a funzionare come prima. Quello
            che non può fare è crearla o modificarla — l'anagrafica clienti la gestisce
            l'amministratore.
          </div>

          <h5>L'amministratore</h5>
          <p>
            Vede e può fare tutto quanto sopra, e in più gestisce
            <strong>Clienti</strong>, <strong>Preventivi</strong>,
            <strong>Note di Lavorazione</strong>, <strong>Utenti</strong> e
            <strong>Impostazioni</strong>. Sulla dashboard vede i dati di tutti gli operai e
            può filtrarli per singola persona.
          </p>

          <h5>Se una voce non compare</h5>
          <p>
            Non è un guasto: significa che quell'area è riservata all'amministratore. Anche
            questa guida si adegua al ruolo, e mostra soltanto le sezioni che riguardano ciò
            che si può fare.
          </p>
        </section>

        <!-- ── Dashboard ──────────────────────────────────────────── -->
        <section id="dashboard" class="mb-5">
          <h3 class="border-bottom pb-2"><i class="bi bi-speedometer2 me-2 text-primary"></i>Dashboard</h3>
          <p>
            La Dashboard è la schermata principale di Officino. Mostra statistiche e grafici
            sull'attività del periodo selezionato.
          </p>

          <h5>Filtro periodo</h5>
          <p>
            In cima alla dashboard si sceglie un <strong>intervallo di date</strong> indicando
            la data iniziale e quella finale, estremi inclusi. Sono disponibili anche scorciatoie
            per i periodi ricorrenti: <em>questo mese</em>, <em>mese scorso</em>,
            <em>ultimi 30 giorni</em> e <em>quest'anno</em>. All'apertura viene proposto il mese
            corrente. Cambiando il periodo, tutti i dati e i grafici si aggiornano
            automaticamente, e anche l'esportazione in Excel segue lo stesso intervallo.
          </p>

          <h5>Filtro operaio</h5>
          <p>
            Gli amministratori possono restringere l'intera dashboard a un singolo operaio.
            L'elenco comprende chi ha rapportini nel periodo scelto. Selezionando
            <em>Tutti gli operai</em> si torna alla vista complessiva. Gli altri utenti vedono
            sempre e solo i propri dati.
          </p>

          <h5>Ore mancanti</h5>
          <p>
            Un pannello segnala i <strong>giorni feriali</strong> in cui sono state caricate meno
            di 8 ore, così le ore mancanti si vedono quando la giornata è ancora fresca invece
            di emergere a fine mese. Sabato e domenica non vengono mai segnalati, e nemmeno i
            giorni non ancora arrivati.
          </p>
          <p>
            I giorni <strong>parzialmente compilati</strong> sono distinti da quelli
            <strong>completamente vuoti</strong>: i primi sono di solito ore dimenticate, i
            secondi quasi sempre assenze. Il sistema non conosce ferie, permessi e festività,
            quindi un giorno di ferie appare comunque come vuoto.
          </p>
          <p>
            Gli amministratori vedono tutti gli operai; gli altri utenti vedono soltanto i
            propri giorni, come promemoria per completare i rapportini.
          </p>

          <h5>Ore lavorate</h5>
          <p>
            Una card riporta la <strong>somma delle ore</strong> registrate nel periodo. Gli
            utenti vedono le proprie; gli amministratori vedono quelle di tutti gli operai,
            oppure di uno solo se il filtro operaio è attivo.
          </p>

          <h5>Rapportini nel periodo <span class="text-muted">(solo amministratori)</span></h5>
          <p>
            Quanti rapportini ci sono e in quale stato si trovano: <strong>aperti</strong>,
            <strong>conclusi</strong> e <strong>in nota di lavorazione</strong>. Sono contati i
            rapportini che hanno almeno una lavorazione nel periodo scelto, quindi uno iniziato
            a gennaio e chiuso a marzo compare anche filtrando febbraio.
          </p>
          <p>
            Accanto ai tre stati c'è una quarta voce, <strong>senza lavorazioni</strong>, e vale
            la pena capire perché sta a parte. Un rapportino appena creato non contiene ancora
            nulla, quindi <em>non ha date</em>: nessun periodo può escluderlo, e contarlo fra gli
            aperti significherebbe contarlo ogni mese, per sempre, anche quando in quel mese non
            è successo niente. Per questo è tenuto fuori dal conteggio del periodo e mostrato per
            conto suo — anche quando vale zero.
          </p>
          <p>
            Sommando i quattro numeri si ottiene esattamente il totale che mostra l'elenco dei
            rapportini per lo stesso periodo e lo stesso filtro. Se non coincidono, uno dei due
            sta sbagliando.
          </p>

          <h5>Note di lavorazione <span class="text-muted">(solo amministratori)</span></h5>
          <p>
            Quante note sono state emesse nel periodo e per quale <strong>importo
            complessivo</strong>. Una nota appartiene al periodo in base alla sua
            <strong>data di riferimento</strong>, cioè quella stampata sul documento consegnato
            al cliente — non alla data in cui è stata creata.
          </p>
          <p>
            L'importo è la somma di ciò che i documenti espongono davvero, <strong>compresi i
            totali imposti a mano</strong>: è la cifra che i clienti hanno visto, non un
            ricalcolo dai dettagli.
          </p>
          <p>
            Quando è attivo il <strong>filtro per operaio</strong> l'importo non viene mostrato.
            Non è una dimenticanza: una nota raccoglie i rapportini di un cliente e può contenere
            il lavoro di più persone, quindi il totale del documento non è la quota di chi lo ha
            in parte prodotto. Il numero delle note resta, e conta quelle a cui quell'operaio ha
            contribuito con almeno un rapportino.
          </p>

          <h5>Grafico: Ore per cliente</h5>
          <p>
            Un grafico a barre orizzontali mostra le ore lavorate per ciascun cliente nel periodo,
            ordinate dalla più alta alla più bassa (top 10). Gli utenti normali vedono solo i
            clienti per cui hanno lavorato personalmente; gli admin vedono tutti i clienti.
          </p>

          <h5>Grafico: Ore gestite vs non gestite <span class="text-muted">(solo amministratori)</span></h5>
          <p>
            Visibile solo agli amministratori. Mostra per ogni cliente la suddivisione tra:
          </p>
          <ul>
            <li><strong>In nota di lavorazione</strong> (verde): ore già associate a una nota di lavorazione.</li>
            <li><strong>Non gestite</strong> (arancione): ore registrate ma non ancora associate a nessuna nota.</li>
          </ul>
          <p>Questo grafico aiuta a capire quante ore devono ancora essere fatturate al cliente.</p>

          <h5>Grafico: Ore per operaio <span class="badge bg-warning text-dark" style="font-size:0.7rem">admin</span></h5>
          <p>
            Visibile solo agli amministratori. Mostra un grafico a barre verticali con le ore lavorate
            da ogni operaio nel periodo selezionato. Aiuta a monitorare la produttività e il carico di lavoro
            di ciascun membro del team.
          </p>

          <h5>Esporta Excel <span class="badge bg-warning text-dark" style="font-size:0.7rem">admin</span></h5>
          <p>
            Visibile solo agli amministratori. Il pulsante <strong>"Esporta Excel"</strong> scarica un file Excel
            con tre fogli:
          </p>
          <ul>
            <li><strong>Ore per Operaio</strong>: riepilogo totale delle ore per ogni operaio.</li>
            <li><strong>Ore per Cliente</strong>: riepilogo totale delle ore per ogni cliente.</li>
            <li>
              <strong>Dettaglio</strong>: elenco completo delle lavorazioni con giorno,
              operaio, cliente, macchinario, ore e note. Non contiene più le colonne di ora
              inizio e ora fine: la fascia oraria non viene più registrata.
            </li>
          </ul>
          <p>
            Il file copre esattamente l'intervallo di date selezionato a schermo, e rispetta
            anche il filtro per operaio: se ne stai guardando uno solo, esporti quello.
          </p>
        </section>

        <!-- ── Catalogo Prodotti ──────────────────────────────────── -->
        <section id="catalogo" class="mb-5">
          <h3 class="border-bottom pb-2"><i class="bi bi-box-seam me-2 text-primary"></i>Catalogo Prodotti</h3>
          <p>
            Il Catalogo è l'archivio di tutti i ricambi e prodotti dell'officina.
            Ogni prodotto può essere inserito nei preventivi.
          </p>

          <h5>Campi del prodotto</h5>
          <div class="table-responsive">
            <table class="table table-sm table-bordered">
              <thead class="table-light">
                <tr><th>Campo</th><th>Obbligatorio</th><th>Descrizione</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td>Nome</td><td>Sì</td>
                  <td>Nome descrittivo del pezzo o prodotto.</td>
                </tr>
                <tr>
                  <td>Barcode</td><td>No</td>
                  <td>
                    Codice a barre EAN-13 o QR del prodotto. Permette di trovare il prodotto
                    scansionando il codice con la fotocamera tramite il pulsante
                    <strong>"Scansiona Barcode"</strong>. Se il prodotto non è ancora
                    in catalogo, lo scanner pre-compila il form con il barcode letto.
                  </td>
                </tr>
                <tr>
                  <td>Marca</td><td>No</td>
                  <td>Produttore del pezzo (es. Bosch, NGK, Gates).</td>
                </tr>
                <tr>
                  <td>Modello</td><td>No</td>
                  <td>Codice modello o riferimento del produttore.</td>
                </tr>
                <tr>
                  <td>Categoria</td><td>No</td>
                  <td>Categoria di appartenenza. Gestibile nella sezione Categorie.</td>
                </tr>
                <tr>
                  <td>Prezzo Vendita</td><td>Sì</td>
                  <td>Prezzo al cliente. Usato nei preventivi come prezzo unitario di default.</td>
                </tr>
                <tr>
                  <td>Prezzo Acquisto</td><td>No</td>
                  <td>
                    Prezzo di costo del prodotto (uso interno). Non compare nei preventivi
                    né nei PDF generati. Utile per calcolare il margine.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <h5>Funzionalità</h5>
          <ul>
            <li>
              <strong>Ricerca</strong>: cerca per nome, marca o modello. La ricerca è testuale
              e filtra in tempo reale premendo Invio o il pulsante di ricerca.
            </li>
            <li>
              <strong>Filtro per categoria</strong>: mostra solo i prodotti di una categoria specifica.
            </li>
            <li>
              <strong>Scansiona Barcode</strong>: apre la fotocamera per leggere un codice a barre.
              Se il prodotto è già in catalogo viene aperto in modifica; altrimenti si apre
              il form di creazione con il barcode pre-compilato.
            </li>
            <li>
              <strong>Esporta Excel</strong>: scarica l'intero catalogo in formato Excel (.xlsx).
            </li>
          </ul>
        </section>

        <!-- ── Categorie ──────────────────────────────────────────── -->
        <section id="categorie" class="mb-5">
          <h3 class="border-bottom pb-2"><i class="bi bi-tag me-2 text-primary"></i>Categorie</h3>
          <p>
            Le categorie permettono di organizzare i prodotti del catalogo in gruppi.
            Ogni prodotto può essere assegnato a una categoria (opzionale).
          </p>
          <ul>
            <li><strong>Nome</strong>: obbligatorio e univoco.</li>
            <li><strong>Descrizione</strong>: testo libero opzionale.</li>
          </ul>
          <div class="alert alert-warning py-2">
            <i class="bi bi-exclamation-triangle me-1"></i>
            Non è possibile eliminare una categoria se ha prodotti associati.
            Riassegna prima i prodotti a un'altra categoria.
          </div>
        </section>

        <!-- ── Clienti ────────────────────────────────────────────── -->
        <section id="clienti" class="mb-5">
          <h3 class="border-bottom pb-2"><i class="bi bi-people me-2 text-primary"></i>Clienti</h3>
          <p>
            L'anagrafica dei clienti dell'officina. I clienti vengono collegati ai preventivi
            e ai rapportini.
          </p>

          <h5>Campi del cliente</h5>
          <ul>
            <li><strong>Nome</strong>: obbligatorio. Può essere il nome di una persona o di un'azienda.</li>
            <li><strong>Telefono, Email</strong>: contatti opzionali.</li>
            <li><strong>Indirizzo</strong>: indirizzo completo opzionale.</li>
            <li><strong>Codice Fiscale / Partita IVA</strong>: dati fiscali opzionali, compaiono nei PDF dei preventivi.</li>
            <li><strong>Note</strong>: campo libero per annotazioni interne.</li>
          </ul>

          <h5>Archiviazione</h5>
          <p>
            Un cliente può essere <strong>archiviato</strong> invece di essere eliminato.
            I clienti archiviati non compaiono nelle liste dropdown (es. nei preventivi)
            ma i loro dati storici rimangono intatti. Per vederli, attiva il toggle
            <em>"Mostra archiviati"</em> nella barra di ricerca.
          </p>
          <div class="alert alert-warning py-2">
            <i class="bi bi-exclamation-triangle me-1"></i>
            Non è possibile eliminare un cliente che ha preventivi associati.
            Usa l'archiviazione in questo caso.
          </div>
        </section>

        <!-- ── Preventivi ─────────────────────────────────────────── -->
        <section id="preventivi" class="mb-5">
          <h3 class="border-bottom pb-2"><i class="bi bi-file-earmark-text me-2 text-primary"></i>Preventivi</h3>
          <p>
            I preventivi sono i documenti commerciali emessi verso i clienti.
            Ogni preventivo ha un numero progressivo assegnato automaticamente.
          </p>

          <h5>Ciclo di vita degli stati</h5>
          <p>Un preventivo può trovarsi in uno dei seguenti stati:</p>
          <div class="table-responsive mb-3">
            <table class="table table-sm table-bordered">
              <thead class="table-light">
                <tr><th>Stato</th><th>Significato</th><th>Azioni disponibili</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td><span class="badge bg-secondary">Bozza</span></td>
                  <td>Preventivo in preparazione, non ancora inviato al cliente.</td>
                  <td>Modifica, Approva, Rifiuta, Elimina, Duplica, PDF, Export</td>
                </tr>
                <tr>
                  <td><span class="badge bg-success">Approvato</span></td>
                  <td>Il cliente ha accettato il preventivo.</td>
                  <td>Fattura, Cancella, Duplica, PDF, Export</td>
                </tr>
                <tr>
                  <td><span class="badge bg-danger">Rifiutato</span></td>
                  <td>Il cliente ha rifiutato il preventivo.</td>
                  <td>Duplica, PDF, Export</td>
                </tr>
                <tr>
                  <td><span class="badge bg-warning text-dark">Scaduto</span></td>
                  <td>Il preventivo è scaduto (assegnato manualmente o da sistema).</td>
                  <td>Duplica, PDF, Export</td>
                </tr>
                <tr>
                  <td><span class="badge bg-info">Fatturato</span></td>
                  <td>Il preventivo è stato fatturato al cliente.</td>
                  <td>Duplica, PDF, Export</td>
                </tr>
                <tr>
                  <td><span class="badge bg-dark">Cancellato</span></td>
                  <td>Il preventivo è stato annullato (resta nell'archivio).</td>
                  <td>Duplica, PDF, Export</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h5>Composizione del preventivo</h5>
          <ul>
            <li>
              <strong>Pezzi</strong>: prodotti del catalogo aggiunti al preventivo con quantità
              e prezzo unitario (modificabile rispetto al prezzo di catalogo).
              È possibile aggiungere anche <strong>pezzi fuori catalogo</strong> inserendo
              nome e prezzo manualmente senza che il prodotto esista in archivio.
            </li>
            <li>
              <strong>Manodopera</strong>: ore lavorate e costo orario dell'operaio.
              Il campo operaio è opzionale.
            </li>
            <li>
              <strong>Sconto</strong>: applicabile come percentuale o valore fisso sull'imponibile.
            </li>
            <li>
              <strong>IVA</strong>: aliquota configurabile (default impostato in Impostazioni).
            </li>
          </ul>

          <h5>Riepilogo economico</h5>
          <p>
            Imponibile = somma pezzi + manodopera.<br>
            Imponibile netto = imponibile - sconto.<br>
            Totale = imponibile netto + IVA.
          </p>

          <h5>Export e Import</h5>
          <ul>
            <li>
              <strong>Genera PDF</strong>: scarica il preventivo in formato PDF con logo
              dell'officina, dati cliente e riepilogo economico.
            </li>
            <li>
              <strong>Export JSON</strong>: esporta il preventivo in un file JSON
              per archiviazione o trasferimento.
            </li>
            <li>
              <strong>Importa preventivo</strong>: carica un file JSON precedentemente
              esportato per creare una copia del preventivo.
            </li>
            <li>
              <strong>Duplica</strong>: crea una nuova bozza identica al preventivo selezionato.
            </li>
          </ul>
        </section>

        <!-- ── Rapportini ─────────────────────────────────────────── -->
        <section id="rapportini" class="mb-5">
          <h3 class="border-bottom pb-2">
            <i class="bi bi-journal-text me-2 text-primary"></i>Rapportini
          </h3>
          <p>
            Un <strong>rapportino</strong> raccoglie tutto il lavoro svolto da un operaio su
            <strong>un solo macchinario</strong> per <strong>un solo cliente</strong>. Dentro
            ci stanno le <strong>lavorazioni</strong>: una per ogni giornata, con il numero di
            ore e i materiali usati.
          </p>
          <p>
            Un intervento che dura tre giorni è quindi <em>un</em> rapportino con tre
            lavorazioni, non tre voci separate da ritrovare e sommare a mano.
          </p>

          <h5>Registrare il lavoro di oggi</h5>
          <ol>
            <li>
              Se il rapportino per quel macchinario esiste già, cercalo nell'elenco e clicca
              <strong>"Aggiungi lavorazione"</strong>: cliente e macchinario non vanno
              reinseriti.
            </li>
            <li>
              Altrimenti clicca <strong>"Nuovo rapportino"</strong>, indica
              <strong>cliente</strong> e <strong>macchinario</strong>, e poi aggiungi la prima
              lavorazione.
            </li>
            <li>
              Nella lavorazione indica il <strong>giorno</strong> — proposto a oggi — e il
              <strong>numero di ore</strong>. Non serve più l'orario di inizio e fine: basta
              sapere quante ore hai fatto su quella macchina.
            </li>
            <li>
              Aggiungi i <strong>materiali</strong> usati e le <strong>note</strong>, se
              servono.
            </li>
          </ol>

          <h5>Come si indicano le ore</h5>
          <p>
            Le ore si scrivono a <strong>quarti d'ora</strong>: 0,25 — 0,5 — 0,75 — 1 — 1,25 e
            così via. Un valore come 4,3 non viene accettato perché non è un multiplo di un
            quarto d'ora.
          </p>
          <p>
            Sopra le <strong>12 ore in una singola lavorazione</strong> compare un avviso, che
            si può confermare. Non è un blocco: serve a intercettare un errore di battitura. Il
            limite riguarda la singola lavorazione, non il totale della giornata: se lavori su
            due macchinari lo stesso giorno le due somme restano separate e nessun avviso
            compare.
          </p>

          <h5>Il macchinario</h5>
          <p>
            È un <strong>testo libero</strong> — per esempio "Trattore John Deere 6130R" o
            "Escavatore CAT 320". Conviene scriverlo <strong>sempre allo stesso modo</strong>:
            due scritture diverse creano due rapportini distinti e le ore si dividono fra i
            due.
          </p>
          <p>
            Quando crei un rapportino su un macchinario per cui ne hai già uno aperto con lo
            stesso cliente, compare un avviso — anche se cambiano maiuscole e spazi. Il
            rapportino viene creato lo stesso: la scelta resta tua. L'avviso non compare per
            clienti diversi, perché lo stesso modello di macchina presso due aziende sono due
            interventi distinti.
          </p>

          <h5>Concludere un rapportino</h5>
          <p>
            Quando il lavoro sulla macchina è finito, clicca <strong>"Concludi"</strong>. Da
            quel momento il rapportino non è più modificabile e l'amministratore lo trova fra
            quelli disponibili per la nota di lavorazione.
          </p>
          <p>
            Un rapportino <strong>senza lavorazioni non si può concludere</strong>: un
            intervento senza ore non è un intervento. Se l'hai creato per errore — per esempio
            sbagliando il nome del macchinario — puoi eliminarlo finché è vuoto.
          </p>

          <h5>Gli stati</h5>
          <ul>
            <li>
              <span class="badge bg-success">Aperto</span>: si aggiungono, modificano ed
              eliminano lavorazioni.
            </li>
            <li>
              <span class="badge bg-secondary">Concluso</span>: dichiarato finito
              dall'operaio. <strong>Non è più modificabile da nessuno</strong>, neanche
              dall'amministratore: per correggerlo va prima riaperto. Solo un amministratore
              può riaprirlo.
            </li>
            <li>
              <span class="badge bg-info text-dark">In nota di lavorazione</span>: incluso in
              una nota. Per intervenire va prima dissociato dalla nota; a quel punto torna
              <em>concluso</em>, non aperto.
            </li>
          </ul>

          <h5>Eliminare un rapportino</h5>
          <ul>
            <li>
              L'operaio elimina un proprio rapportino solo se è <strong>aperto e vuoto</strong>.
            </li>
            <li>
              L'amministratore lo elimina anche se contiene lavorazioni, con una conferma che
              dichiara quante ne verranno perse.
            </li>
            <li>
              Un rapportino concluso o in nota non si elimina: va prima riaperto o dissociato.
            </li>
          </ul>

          <h5>Filtrare l'elenco</h5>
          <p>
            Il filtro per <strong>intervallo di date</strong> mostra i rapportini che hanno
            <strong>almeno una lavorazione</strong> nel periodo scelto. Vuol dire che un
            rapportino iniziato a gennaio e chiuso a marzo compare anche filtrando febbraio:
            non è un errore, è il modo in cui il filtro guarda gli interventi lunghi.
          </p>
          <p>
            L'intervallo si combina con i filtri per <strong>cliente</strong>,
            <strong>operaio</strong> e <strong>stato</strong>. I totali si riferiscono a tutto
            il periodo filtrato, non alla sola pagina visualizzata.
          </p>
          <p>
            Nella colonna <strong>Periodo</strong> compare l'intervallo coperto dalle
            lavorazioni, non un giorno singolo: un rapportino ne copre più d'uno. Un rapportino
            appena creato mostra "nessuna lavorazione".
          </p>
          <p>
            Un rapportino <strong>ancora senza lavorazioni compare sempre</strong>, qualunque
            periodo sia impostato: non avendo una data, nessun intervallo può escluderlo.
            Altrimenti sparirebbe appena creato e non ci si potrebbe più aggiungere la prima
            lavorazione.
          </p>

          <h5>Materiali</h5>
          <p>
            I materiali stanno sulla <strong>singola lavorazione</strong>, non sul rapportino:
            servono a sapere cosa è stato usato quel giorno. Possono venire dal
            <strong>catalogo</strong> oppure essere inseriti a mano come
            <strong>fuori catalogo</strong>, e in quel caso restano un semplice riferimento
            testuale che non entra in archivio.
          </p>

          <h5>Dettaglio e stampa</h5>
          <p>
            Il pulsante <strong>"Dettaglio"</strong> apre l'elenco delle lavorazioni del
            rapportino con i rispettivi materiali.
          </p>
          <p>
            La <strong>stampa</strong> segue esattamente i filtri mostrati a schermo: il PDF
            copre lo stesso periodo e lo stesso cliente che si stanno guardando, e li riporta
            nell'intestazione. Serve almeno un filtro — un intervallo di date oppure un
            cliente — altrimenti si stamperebbe l'intero storico dell'officina.
          </p>
        </section>

        <!-- ── Note di Lavorazione ────────────────────────────────── -->
        <section v-if="admin" id="note-lavorazione" class="mb-5">
          <h3 class="border-bottom pb-2">
            <i class="bi bi-clipboard-check me-2 text-primary"></i>Note di Lavorazione
            <span class="badge bg-warning text-dark ms-2" style="font-size: 0.7rem">Solo admin</span>
          </h3>
          <p>
            La Nota di Lavorazione è il documento che si consegna al cliente. Raccoglie uno o
            più <strong>rapportini conclusi</strong> dello stesso cliente e produce un PDF
            stampabile.
          </p>

          <h5>Data di riferimento</h5>
          <p>
            Ogni nota ha una <strong>data di riferimento</strong>, che si indica compilandola e
            che compare nel titolo del documento: <em>«Nota di lavorazione per Azienda Rossi
            del 31/08/2026»</em>.
          </p>
          <p>
            È la data a cui il lavoro <strong>si riferisce</strong>, non quella in cui stai
            preparando il documento. Se emetti oggi una nota per lavori di fine mese scorso,
            indichi quella. Viene proposta a oggi e resta modificabile anche dopo.
          </p>

          <h5>Il riassunto è già scritto</h5>
          <p>
            Il campo del riassunto arriva <strong>già compilato</strong> con le note che gli
            operai hanno scritto nelle singole lavorazioni, raggruppate per giorno. Non serve
            ricopiarle: sono già lì.
          </p>
          <p>
            Puoi modificarlo o cancellarlo e scriverne uno tuo. <strong>Da quel momento non
            viene più rigenerato da solo</strong>, nemmeno se aggiungi o togli rapportini: il
            tuo testo non si perde. Se vuoi ripartire da capo c'è il pulsante
            <strong>«Rigenera dalle note»</strong>, che avvisa prima di sostituire quello che
            hai scritto.
          </p>
          <p class="text-muted small">
            Il rovescio: se modifichi il testo e poi aggiungi un rapportino, il riassunto non
            parlerà di quell'intervento. Conviene rileggerlo prima di stampare.
          </p>

          <h5>Cosa mostrare nel documento</h5>
          <p>
            Due scelte <strong>indipendenti</strong>: il dettaglio dei materiali e quello della
            manodopera. Puoi attivarli entrambi, uno solo, o nessuno dei due. Ciascuno porta
            con sé il proprio totale.
          </p>
          <ul>
            <li>
              <strong>Dettaglio materiali</strong>: l'elenco dei pezzi con quantità, prezzo
              unitario e importo di riga.
            </li>
            <li>
              <strong>Dettaglio manodopera</strong>: le ore lavorate, una riga per giorno e
              macchinario, con l'importo complessivo della manodopera. Il documento
              <strong>non riporta la tariffa oraria</strong> né un importo accanto alle singole
              ore.
            </li>
          </ul>
          <p>
            Il <strong>totale complessivo</strong> c'è sempre, in tutte le combinazioni.
          </p>

          <h5>Correggere gli importi</h5>
          <p>Ci sono tre modi, e vanno distinti:</p>
          <ul>
            <li>
              <strong>Correggere un singolo materiale</strong>: cambi il prezzo di quella
              riga, e quel valore vale da lì in avanti.
            </li>
            <li>
              <strong>Imporre il totale dei materiali</strong> o quello della
              <strong>manodopera</strong>: scrivi la cifra che vuoi far comparire.
            </li>
            <li>
              <strong>Imporre il totale complessivo</strong>: decidi l'importo finale
              dell'intero documento.
            </li>
          </ul>
          <p>
            <strong>Imporre un totale spegne il dettaglio corrispondente</strong>, e
            l'interruttore diventa non selezionabile. Non è una limitazione arbitraria: un
            elenco di righe che non somma alla cifra mostrata renderebbe il documento
            contraddittorio davanti al cliente. Il totale complessivo imposto spegne
            <strong>entrambi</strong> i dettagli, per lo stesso motivo.
          </p>
          <p>
            Togliendo il totale imposto il dettaglio torna disponibile, e i totali tornano
            quelli calcolati — comprese le correzioni fatte sulle singole righe, che restano
            valide anche mentre l'importo imposto le copre.
          </p>
          <p class="text-muted small">
            Le <strong>ore</strong> non si toccano mai dalla nota: raccontano il lavoro svolto.
            Un importo imposto cambia quanto chiedi, non quanto è stato lavorato — quindi ore e
            prezzo possono non essere più in rapporto fra loro, ed è voluto.
          </p>

          <h5>Un documento o più sezioni</h5>
          <p>
            Se la nota raccoglie <strong>più di un rapportino</strong>, ti viene chiesto come
            presentarli: tutto insieme, oppure <strong>diviso per macchinario</strong>.
            Dividendo, il documento ha una sezione per macchinario coi propri totali, più il
            totale complessivo in fondo — utile quando il cliente vuole sapere quanto è costato
            ciascuna macchina.
          </p>
          <p>
            La divisione è <strong>per macchinario</strong>, non per rapportino: due rapportini
            sullo stesso macchinario finiscono nella stessa sezione. Con un solo rapportino la
            domanda non compare, perché le due scelte darebbero lo stesso documento.
          </p>
          <p class="text-muted small">
            Un totale imposto vale per l'<em>intera nota</em>: compare una volta sola in fondo,
            e le sezioni mostrano soltanto i totali che non sono stati imposti.
          </p>

          <h5>Avvisi prima della stampa</h5>
          <p>
            Prima di generare il PDF vengono segnalate le lavorazioni con costo orario a zero e
            i materiali senza prezzo, così non finiscono nel documento per distrazione.
            L'avviso <strong>non compare</strong> per una voce di cui hai imposto il totale:
            quel valore non finirà nel documento, quindi non c'è nulla da correggere.
          </p>

          <h5>Azioni disponibili</h5>
          <ul>
            <li><strong>Stampa</strong>: genera il PDF della nota.</li>
            <li>
              <strong>Modifica</strong>: permette di aggiungere o rimuovere rapportini,
              cambiare la data di riferimento e rivedere tutto il resto.
            </li>
            <li>
              <strong>Elimina</strong>: elimina la nota. I rapportini collegati tornano allo
              stato <em>Concluso</em> — non aperto: per renderli di nuovo modificabili serve una
              riapertura esplicita.
            </li>
          </ul>
        </section>

        <!-- ── Utenti ─────────────────────────────────────────────── -->
        <section v-if="admin" id="utenti" class="mb-5">
          <h3 class="border-bottom pb-2">
            <i class="bi bi-person-gear me-2 text-primary"></i>Utenti
            <span class="badge bg-warning text-dark ms-2" style="font-size: 0.7rem">Solo admin</span>
          </h3>
          <p>
            Gestisce gli account degli operai e degli amministratori dell'officina.
          </p>

          <h5>Campi utente</h5>
          <div class="table-responsive">
            <table class="table table-sm table-bordered">
              <thead class="table-light">
                <tr><th>Campo</th><th>Obbligatorio</th><th>Descrizione</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td>Nome</td><td>Sì</td>
                  <td>Nome visualizzato nei rapportini e nei preventivi.</td>
                </tr>
                <tr>
                  <td>Email</td><td>Sì</td>
                  <td>Indirizzo email usato per il login. Deve essere univoco.</td>
                </tr>
                <tr>
                  <td>Password</td><td>Sì (creazione)</td>
                  <td>
                    Password di accesso. In modifica lasciare vuoto per non cambiarla.
                  </td>
                </tr>
                <tr>
                  <td>Ruolo</td><td>Sì</td>
                  <td>
                    <strong>Utente</strong>: operaio. Accede a Catalogo, Clienti, Preventivi,
                    Rapportini.<br>
                    <strong>Admin</strong>: accesso completo incluso Utenti, Impostazioni,
                    Note di Lavorazione.
                  </td>
                </tr>
                <tr>
                  <td>Costo Orario</td><td>No</td>
                  <td>
                    Tariffa oraria dell'operaio in €/ora. Viene proposta come valore
                    default nel campo "Costo Orario Manodopera" dei preventivi quando
                    l'operaio viene selezionato.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- ── Impostazioni ───────────────────────────────────────── -->
        <section v-if="admin" id="impostazioni" class="mb-5">
          <h3 class="border-bottom pb-2">
            <i class="bi bi-gear me-2 text-primary"></i>Impostazioni
            <span class="badge bg-warning text-dark ms-2" style="font-size: 0.7rem">Solo admin</span>
          </h3>
          <p>
            Configura i dati identificativi dell'officina. Queste informazioni compaiono
            nell'intestazione dei PDF generati (preventivi e note di lavorazione).
          </p>

          <h5>Dati officina</h5>
          <ul>
            <li><strong>Nome</strong>: obbligatorio. Viene mostrato come intestazione nei PDF.</li>
            <li><strong>Partita IVA</strong>: compare nei PDF dei preventivi.</li>
            <li><strong>Indirizzo</strong>: indirizzo completo dell'officina.</li>
            <li><strong>Telefono / Email</strong>: recapiti mostrati nei PDF.</li>
            <li>
              <strong>Aliquota IVA predefinita</strong>: percentuale IVA applicata di default
              ai nuovi preventivi (modificabile preventivo per preventivo).
            </li>
          </ul>

          <h5>Logo officina</h5>
          <p>
            Carica un'immagine (PNG, JPEG o WebP) da usare come logo nei PDF.
            Il logo compare nell'angolo in alto a sinistra dell'intestazione dei preventivi.
          </p>
          <ul>
            <li>Dimensione consigliata: larghezza massima 300px, sfondo trasparente o bianco.</li>
            <li>Il logo viene sostituito caricando una nuova immagine.</li>
            <li>Per rimuoverlo clicca "Elimina Logo".</li>
          </ul>
        </section>

        <!-- Nota per utenti non admin -->
        <div v-if="!admin" class="alert alert-info">
          <i class="bi bi-info-circle me-1"></i>
          Alcune sezioni della guida (Note di Lavorazione, Utenti, Impostazioni) sono visibili
          solo agli amministratori.
        </div>

        <!-- Link di ritorno -->
        <div class="mt-4 pt-3 border-top">
          <router-link to="/" class="btn btn-outline-secondary btn-sm">
            <i class="bi bi-arrow-left me-1"></i>Torna alla Dashboard
          </router-link>
        </div>

      </div>
    </div>
  </div>
</template>
