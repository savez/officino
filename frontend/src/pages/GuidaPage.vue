<script setup>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { isAdmin } from '../services/auth'

const route = useRoute()
const admin = ref(isAdmin())

const sections = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'catalogo', label: 'Catalogo Prodotti' },
  { id: 'categorie', label: 'Categorie' },
  { id: 'clienti', label: 'Clienti' },
  { id: 'preventivi', label: 'Preventivi' },
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

        <!-- ── Dashboard ──────────────────────────────────────────── -->
        <section id="dashboard" class="mb-5">
          <h3 class="border-bottom pb-2"><i class="bi bi-speedometer2 me-2 text-primary"></i>Dashboard</h3>
          <p>
            La Dashboard è la schermata principale di Officino. Mostra statistiche e grafici
            sull'attività del periodo selezionato.
          </p>

          <h5>Filtro periodo</h5>
          <p>
            In cima alla dashboard sono presenti due selettori per filtrare i dati per <strong>mese</strong>
            e <strong>anno</strong>. Di default viene mostrato il mese corrente.
            Cambiando il periodo, tutti i dati e i grafici si aggiornano automaticamente.
          </p>

          <h5>Riepilogo KPI</h5>
          <p>Quattro card riepilogative mostrano i dati principali del periodo:</p>
          <ul>
            <li><strong>Preventivi totali</strong>: numero totale di preventivi creati nel periodo.</li>
            <li><strong>Aperti</strong>: preventivi in stato <em>bozza</em> o <em>approvato</em>.</li>
            <li><strong>Chiusi</strong>: preventivi in stato <em>fatturato</em>, <em>rifiutato</em>, <em>scaduto</em> o <em>cancellato</em>.</li>
            <li><strong>Ore lavorate</strong>: somma delle ore registrate nel periodo. Gli utenti vedono solo le proprie ore; gli admin vedono le ore di tutti gli operai.</li>
          </ul>

          <h5>Grafico: Preventivi per stato</h5>
          <p>
            Un grafico a ciambella mostra la distribuzione dei preventivi per stato (bozza, approvato,
            rifiutato, scaduto, fatturato, cancellato) nel periodo selezionato.
            Se non ci sono preventivi nel periodo, viene mostrato un messaggio informativo.
          </p>

          <h5>Grafico: Ore per cliente</h5>
          <p>
            Un grafico a barre orizzontali mostra le ore lavorate per ciascun cliente nel periodo,
            ordinate dalla più alta alla più bassa (top 10). Gli utenti normali vedono solo i
            clienti per cui hanno lavorato personalmente; gli admin vedono tutti i clienti.
          </p>

          <h5>Grafico: Ore gestite vs non gestite <span class="badge bg-warning text-dark" style="font-size:0.7rem">admin</span></h5>
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
            <li><strong>Dettaglio</strong>: elenco completo di tutte le righe di rapportino con giorno, operaio, cliente, ore e note.</li>
          </ul>
          <p>Il file include i dati del periodo selezionato (mese e anno).</p>
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
          <h3 class="border-bottom pb-2"><i class="bi bi-journal-text me-2 text-primary"></i>Rapportini</h3>
          <p>
            I rapportini registrano le ore di lavoro degli operai giorno per giorno,
            associandole a un cliente e al materiale usato.
          </p>

          <h5>Come registrare una riga di rapportino</h5>
          <ol>
            <li>Clicca <strong>"Nuova Riga"</strong>.</li>
            <li>Seleziona il <strong>giorno</strong> (default: oggi).</li>
            <li>Inserisci <strong>ora inizio</strong> e <strong>ora fine</strong> del lavoro.</li>
            <li>Seleziona il <strong>cliente</strong> per cui si è lavorato.</li>
            <li>
              Inserisci la <strong>macchina / attrezzatura</strong> su cui si è intervenuti
              (campo libero, es. "Trattore John Deere 6130R", "Escavatore CAT 320").
            </li>
            <li>
              Aggiungi i <strong>materiali</strong> utilizzati (opzionale):
              cerca nel catalogo o inserisci un materiale libero non in catalogo.
            </li>
            <li>Aggiungi <strong>note</strong> aggiuntive se necessario.</li>
          </ol>

          <h5>Materiali nel rapportino</h5>
          <p>
            Ogni riga può avere uno o più materiali utilizzati durante il lavoro.
            I materiali possono essere:
          </p>
          <ul>
            <li>
              <strong>Da catalogo</strong>: cerca il prodotto per nome nel campo di ricerca
              e selezionalo dall'elenco.
            </li>
            <li>
              <strong>Fuori catalogo</strong>: se il materiale non è in archivio,
              usa l'opzione "fuori catalogo" per inserire il nome manualmente.
              Non viene aggiunto al catalogo, è solo un riferimento testuale.
            </li>
          </ul>

          <h5>Stati delle righe</h5>
          <ul>
            <li>
              <span class="badge bg-secondary">Aperta</span>: la riga non è ancora
              stata collegata a una Nota di Lavorazione.
            </li>
            <li>
              <span class="badge bg-success">Gestita</span>: la riga è stata inclusa
              in una Nota di Lavorazione. Le righe gestite non possono essere
              cancellate dagli operai (solo dall'admin).
            </li>
          </ul>

          <h5>Creare una Nota di Lavorazione</h5>
          <p>
            Solo gli admin possono creare note di lavorazione dai rapportini.
            Per farlo:
          </p>
          <ol>
            <li>Seleziona una o più righe con la casella di spunta (solo righe <em>aperte</em>).</li>
            <li>Tutte le righe selezionate devono appartenere allo <strong>stesso cliente</strong>.</li>
            <li>Clicca <strong>"Crea Nota di Lavorazione"</strong>.</li>
          </ol>

          <h5>Badge ore totali</h5>
          <p>
            Nella barra in alto, una badge mostra il totale delle ore lavorate in base ai filtri
            attivi (periodo, cliente, operaio, stato). Se applichi dei filtri, il numero si aggiorna
            per mostrare solo le ore corrispondenti ai criteri selezionati.
          </p>

          <h5>Stampa rapportino</h5>
          <p>
            Il pulsante <strong>"Stampa"</strong> compare solo se è attivo un filtro per
            giornata o per cliente. Genera un PDF riepilogativo delle righe filtrate.
          </p>
        </section>

        <!-- ── Note di Lavorazione ────────────────────────────────── -->
        <section v-if="admin" id="note-lavorazione" class="mb-5">
          <h3 class="border-bottom pb-2">
            <i class="bi bi-clipboard-check me-2 text-primary"></i>Note di Lavorazione
            <span class="badge bg-warning text-dark ms-2" style="font-size: 0.7rem">Solo admin</span>
          </h3>
          <p>
            Le Note di Lavorazione sono documenti riepilogativi che raccolgono più righe
            di rapportino di uno stesso cliente in un unico documento stampabile.
          </p>
          <p>
            Sono utili per consegnare al cliente un riepilogo delle ore lavorate
            e dei materiali impiegati, come allegato o supporto alla fatturazione.
          </p>

          <h5>Struttura di una nota</h5>
          <ul>
            <li><strong>Cliente</strong>: il cliente a cui è intestata la nota.</li>
            <li><strong>Riassunto</strong>: testo libero opzionale con note descrittive.</li>
            <li>
              <strong>Righe collegate</strong>: le righe di rapportino incluse nella nota,
              con dettaglio di giorno, orario, operaio, macchina e materiali.
            </li>
            <li><strong>Ore totali</strong>: somma automatica delle ore delle righe collegate.</li>
          </ul>

          <h5>Azioni disponibili</h5>
          <ul>
            <li><strong>Stampa</strong>: genera un PDF della nota di lavorazione.</li>
            <li><strong>Modifica</strong>: permette di aggiungere o rimuovere righe e modificare il riassunto.</li>
            <li><strong>Elimina</strong>: elimina la nota. Le righe di rapportino tornano allo stato "Aperta".</li>
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
