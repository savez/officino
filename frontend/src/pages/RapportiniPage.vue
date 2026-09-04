<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  getRapportini,
  cancellaRapportino,
  chiudiRapportino,
  riapriRapportino,
  stampaRapportini,
} from '../services/rapportini'
import { isAdmin, getCurrentUser } from '../services/auth'
import api from '../services/api'
import FiltroPeriodo from '../components/FiltroPeriodo.vue'
import RapportinoFormModal from '../components/RapportinoFormModal.vue'
import LavorazioneFormModal from '../components/LavorazioneFormModal.vue'
import RapportinoDettaglioModal from '../components/RapportinoDettaglioModal.vue'
import NotaLavorazioneFormModal from '../components/NotaLavorazioneFormModal.vue'
import ElencoRapportini from '../components/ElencoRapportini.vue'
import HelpIcon from '../components/HelpIcon.vue'
import HelpTooltip from '../components/HelpTooltip.vue'
import BloccoFiltri from '../components/BloccoFiltri.vue'

const admin = computed(() => isAdmin())
const utenteCorrente = computed(() => getCurrentUser() || {})

const rapportini = ref([])
const caricamento = ref(false)
const errore = ref('')
const pagina = ref(1)
const pagineTotali = ref(1)
const totale = ref(0)
const oreTotali = ref(0)

const filtroClienteId = ref('')
const filtroUtenteId = ref('')
const filtroStato = ref('')
const clienti = ref([])
const utenti = ref([])

const oggi = new Date()

function formattaData(d) {
  const mese = String(d.getMonth() + 1).padStart(2, '0')
  const giorno = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mese}-${giorno}`
}

const periodoIniziale = () => ({
  da: formattaData(new Date(oggi.getFullYear(), oggi.getMonth(), 1)),
  a: formattaData(new Date(oggi.getFullYear(), oggi.getMonth() + 1, 0)),
})

const periodo = ref(periodoIniziale())

// Chiuso di partenza sul telefono; su monitor lo stile lo tiene sempre aperto.

// Il conteggio dice se sotto c'e' qualcosa che sta restringendo l'elenco: senza,
// un filtro dimenticato spiega un elenco vuoto solo dopo averlo riaperto.
const filtriAttivi = computed(
  () =>
    [filtroClienteId.value, filtroUtenteId.value, filtroStato.value].filter(Boolean).length,
)

const mostraFormRapportino = ref(false)
const mostraFormLavorazione = ref(false)
const mostraDettaglio = ref(false)
const mostraFormNota = ref(false)
const rapportinoAttivo = ref(null)
const lavorazioneInModifica = ref(null)
const dettaglioId = ref(null)

const selezionati = ref([])


onMounted(async () => {
  await caricaRapportini()
  try {
    const { data } = await api.get('/clienti/all')
    clienti.value = data
  } catch {
    /* l'elenco clienti è un contorno: se manca, i filtri restano usabili */
  }
  if (admin.value) {
    try {
      const { data } = await api.get('/utenti')
      utenti.value = data.data || data
    } catch {
      /* idem */
    }
  }
})

// Cambiando filtro in fretta le risposte possono tornare fuori ordine: senza
// questo contatore vincerebbe l'ultima ARRIVATA invece dell'ultima CHIESTA, e
// la tabella mostrerebbe righe di un periodo già abbandonato.
let richiestaCorrente = 0

async function caricaRapportini() {
  const miaRichiesta = ++richiestaCorrente
  caricamento.value = true
  errore.value = ''
  try {
    const params = { page: pagina.value, per_page: 20 }
    if (filtroClienteId.value) params.cliente_id = filtroClienteId.value
    if (filtroUtenteId.value) params.utente_id = filtroUtenteId.value
    if (filtroStato.value) params.stato = filtroStato.value
    if (periodo.value.da) params.da = periodo.value.da
    if (periodo.value.a) params.a = periodo.value.a

    const risultato = await getRapportini(params)
    if (miaRichiesta !== richiestaCorrente) return

    rapportini.value = risultato.data || []
    pagineTotali.value = risultato.pagination?.totalPages || 1
    totale.value = risultato.pagination?.total || 0
    oreTotali.value = risultato.ore_totali_filtrate || 0
  } catch (err) {
    if (miaRichiesta !== richiestaCorrente) return
    errore.value = err?.response?.data?.error || 'Errore nel caricamento dei rapportini.'
  } finally {
    if (miaRichiesta === richiestaCorrente) caricamento.value = false
  }
}

// Il cambio di periodo riporta a pagina 1: senza, restringendo l'intervallo
// mentre si è a pagina 5 la tabella apparirebbe vuota pur essendoci righe.
function onPeriodoChange(nuovo) {
  periodo.value = nuovo
  applicaFiltri()
}

function applicaFiltri() {
  pagina.value = 1
  selezionati.value = []
  caricaRapportini()
}

function azzeraFiltri() {
  filtroClienteId.value = ''
  filtroUtenteId.value = ''
  filtroStato.value = ''
  periodo.value = periodoIniziale()
  applicaFiltri()
}

function cambiaPagina(p) {
  pagina.value = p
  caricaRapportini()
}

function formattaGiorno(valore) {
  if (!valore) return '—'
  const d = new Date(valore)
  const giorno = String(d.getDate()).padStart(2, '0')
  const mese = String(d.getMonth() + 1).padStart(2, '0')
  return `${giorno}/${mese}/${d.getFullYear()}`
}

/**
 * Il periodo coperto da un rapportino, oppure la ragione per cui non ce n'è uno.
 *
 * Una cella vuota si legge come un difetto di caricamento; questo dice che il
 * rapportino esiste e attende la prima lavorazione.
 * @param {object} r - rapportino
 * @returns {string} testo da mostrare
 */
function periodoLeggibile(r) {
  if (!r.periodo) return 'nessuna lavorazione'
  if (r.periodo.da === r.periodo.a) return formattaGiorno(r.periodo.da)
  return `${formattaGiorno(r.periodo.da)} — ${formattaGiorno(r.periodo.a)}`
}

function formattaOre(n) {
  return (Number(n) || 0).toFixed(2).replace('.', ',')
}

function eAutore(r) {
  return r.utente_id === utenteCorrente.value?.id
}

function puoAggiungere(r) {
  return r.stato === 'aperto' && (admin.value || eAutore(r))
}

function puoConcludere(r) {
  return r.stato === 'aperto' && eAutore(r) && r.numero_lavorazioni > 0
}

function puoRiaprire(r) {
  return r.stato === 'chiuso' && admin.value
}

function puoEliminare(r) {
  if (r.stato !== 'aperto') return false
  if (admin.value) return true
  return eAutore(r) && r.numero_lavorazioni === 0
}

function apriNuovoRapportino() {
  mostraFormRapportino.value = true
}

function apriAggiungiLavorazione(r) {
  rapportinoAttivo.value = r
  lavorazioneInModifica.value = null
  mostraFormLavorazione.value = true
}

function apriDettaglio(r) {
  dettaglioId.value = r.id
  mostraDettaglio.value = true
}

function apriModificaLavorazione(lavorazione) {
  rapportinoAttivo.value = rapportini.value.find((r) => r.id === dettaglioId.value) || null
  lavorazioneInModifica.value = lavorazione
  mostraDettaglio.value = false
  mostraFormLavorazione.value = true
}

function onDettaglioAggiungi(dettaglio) {
  rapportinoAttivo.value = dettaglio
  lavorazioneInModifica.value = null
  mostraDettaglio.value = false
  mostraFormLavorazione.value = true
}

async function onLavorazioneSalvata() {
  await caricaRapportini()
}

async function concludi(r) {
  if (!confirm(`Dichiarare concluso il rapportino su «${r.macchina}»? Non potrai più modificarlo.`))
    return
  try {
    await chiudiRapportino(r.id)
    await caricaRapportini()
  } catch (err) {
    errore.value = err?.response?.data?.error || 'Non è stato possibile concludere il rapportino.'
  }
}

async function riapri(r) {
  try {
    await riapriRapportino(r.id)
    await caricaRapportini()
  } catch (err) {
    errore.value = err?.response?.data?.error || 'Non è stato possibile riaprire il rapportino.'
  }
}

async function elimina(r) {
  // La conferma dichiara quante lavorazioni si perdono: cancellare ore
  // registrate non deve poter accadere per un clic distratto.
  const avvertimento =
    r.numero_lavorazioni > 0
      ? `Il rapportino su «${r.macchina}» contiene ${r.numero_lavorazioni} lavorazioni, che verranno eliminate. Procedere?`
      : `Eliminare il rapportino su «${r.macchina}»?`
  if (!confirm(avvertimento)) return

  try {
    await cancellaRapportino(r.id)
    await caricaRapportini()
  } catch (err) {
    errore.value = err?.response?.data?.error || "Non è stato possibile eliminare il rapportino."
  }
}

function alterna(id) {
  const i = selezionati.value.indexOf(id)
  if (i >= 0) selezionati.value.splice(i, 1)
  else selezionati.value.push(id)
}

function eSelezionato(id) {
  return selezionati.value.includes(id)
}

const rapportiniSelezionati = computed(() =>
  rapportini.value.filter((r) => selezionati.value.includes(r.id)),
)

const stessoCliente = computed(() => {
  if (rapportiniSelezionati.value.length === 0) return true
  const clienteId = rapportiniSelezionati.value[0].cliente_id
  return rapportiniSelezionati.value.every((r) => r.cliente_id === clienteId)
})

// Solo i rapportini CONCLUSI entrano in una nota: uno ancora aperto potrebbe
// ricevere altre ore dopo che la nota è stata compilata.
const puoCreareNota = computed(
  () =>
    admin.value &&
    selezionati.value.length > 0 &&
    stessoCliente.value &&
    rapportiniSelezionati.value.every((r) => r.stato === 'chiuso'),
)

function selezionabile(r) {
  return admin.value && r.stato === 'chiuso'
}

async function onNotaSalvata() {
  mostraFormNota.value = false
  selezionati.value = []
  await caricaRapportini()
}

async function stampa() {
  try {
    const params = {}
    if (periodo.value.da) params.da = periodo.value.da
    if (periodo.value.a) params.a = periodo.value.a
    if (filtroClienteId.value) params.cliente_id = filtroClienteId.value
    await stampaRapportini(params)
  } catch (err) {
    errore.value = err?.response?.data?.error || 'Non è stato possibile generare la stampa.'
  }
}
</script>

<template>
  <div class="container-fluid py-3">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h2 class="mb-0">
        Rapportini
<HelpIcon anchor="rapportini" />
      </h2>
      <div class="d-flex gap-2">
        <button v-if="admin" class="btn btn-outline-secondary" @click="stampa">Stampa</button>
        <button class="btn btn-primary" @click="apriNuovoRapportino">Nuovo rapportino</button>
      </div>
    </div>

    <div v-if="errore" class="alert alert-danger">{{ errore }}</div>

    <BloccoFiltri :attivi="filtriAttivi">
        <div class="row g-3 align-items-end">
          <div class="col-12">
            <label class="of-etichetta d-block mb-2">
              Periodo
              <!-- Il significato del filtro non e' ovvio e va detto, ma da
                   paragrafo occupava quattro righe in cima alla schermata del
                   telefono. Come suggerimento resta raggiungibile e non
                   ingombra. -->
              <HelpTooltip
                text="Sono elencati i rapportini con almeno una lavorazione nel periodo scelto: uno iniziato a gennaio e chiuso a marzo compare anche filtrando febbraio. I rapportini ancora senza lavorazioni compaiono sempre, perché non avendo una data nessun periodo può escluderli."
              />
            </label>
            <FiltroPeriodo :da="periodo.da" :a="periodo.a" @update:periodo="onPeriodoChange" />
          </div>

          <div class="col-6 col-lg-3">
            <label class="form-label">Cliente</label>
            <select v-model="filtroClienteId" class="form-select" @change="applicaFiltri">
              <option value="">Tutti</option>
              <option v-for="c in clienti" :key="c.id" :value="c.id">{{ c.nome }}</option>
            </select>
          </div>

          <div v-if="admin" class="col-6 col-lg-3">
            <label class="form-label">Operaio</label>
            <select v-model="filtroUtenteId" class="form-select" @change="applicaFiltri">
              <option value="">Tutti</option>
              <option v-for="u in utenti" :key="u.id" :value="u.id">{{ u.nome }}</option>
            </select>
          </div>

          <div class="col-6 col-lg-3">
            <label class="form-label">Stato</label>
            <select v-model="filtroStato" class="form-select" @change="applicaFiltri">
              <option value="">Tutti</option>
              <option value="aperto">Aperti</option>
              <option value="chiuso">Conclusi</option>
              <option value="gestito">In nota di lavorazione</option>
            </select>
          </div>

          <div class="col-6 col-lg-3">
            <label class="form-label d-none d-lg-block">&nbsp;</label>
            <button class="btn btn-outline-secondary w-100" @click="azzeraFiltri">
              Azzera filtri
            </button>
          </div>
        </div>
    </BloccoFiltri>

    <div class="d-flex justify-content-between align-items-center mb-2">
      <span class="text-muted">
        {{ totale }} {{ totale === 1 ? 'rapportino' : 'rapportini' }} — {{ formattaOre(oreTotali) }} ore nel periodo
      </span>
      <button
        v-if="admin"
        class="btn btn-sm btn-success"
        :disabled="!puoCreareNota"
        @click="mostraFormNota = true"
      >
        Crea nota di lavorazione ({{ selezionati.length }})
      </button>
    </div>

    <div v-if="admin && selezionati.length > 0 && !stessoCliente" class="alert alert-warning py-2">
      I rapportini selezionati sono di clienti diversi: una nota di lavorazione riguarda un
      cliente solo.
    </div>

    <div v-if="caricamento" class="text-center py-5">
      <div class="spinner-border" role="status"></div>
    </div>

    <div v-else-if="rapportini.length === 0" class="of-vuoto">
      <p class="mb-2">Nessun rapportino nel periodo selezionato.</p>
      <p class="mb-0 small">
        Crea un rapportino per il macchinario su cui stai lavorando, poi aggiungici le ore
        giorno per giorno.
      </p>
    </div>

    <ElencoRapportini
      v-else
      :rapportini="rapportini"
      :admin="admin"
      :selezionati="selezionati"
      :puo-aggiungere="puoAggiungere"
      :puo-concludere="puoConcludere"
      :puo-riaprire="puoRiaprire"
      :puo-eliminare="puoEliminare"
      :selezionabile="selezionabile"
      :periodo-leggibile="periodoLeggibile"
      :formatta-ore="formattaOre"
      @aggiungi="apriAggiungiLavorazione"
      @dettaglio="apriDettaglio"
      @concludi="concludi"
      @riapri="riapri"
      @elimina="elimina"
      @alterna="alterna"
    />


    <nav v-if="pagineTotali > 1" class="mt-3">
      <ul class="pagination justify-content-center">
        <li class="page-item" :class="{ disabled: pagina === 1 }">
          <button class="page-link" @click="cambiaPagina(pagina - 1)">Precedente</button>
        </li>
        <li class="page-item disabled">
          <span class="page-link">{{ pagina }} di {{ pagineTotali }}</span>
        </li>
        <li class="page-item" :class="{ disabled: pagina === pagineTotali }">
          <button class="page-link" @click="cambiaPagina(pagina + 1)">Successiva</button>
        </li>
      </ul>
    </nav>

    <RapportinoFormModal
      :show="mostraFormRapportino"
      @close="mostraFormRapportino = false"
      @saved="caricaRapportini"
    />

    <LavorazioneFormModal
      :show="mostraFormLavorazione"
      :rapportino="rapportinoAttivo"
      :lavorazione="lavorazioneInModifica"
      @close="mostraFormLavorazione = false"
      @saved="onLavorazioneSalvata"
    />

    <RapportinoDettaglioModal
      :show="mostraDettaglio"
      :rapportino-id="dettaglioId"
      @close="mostraDettaglio = false"
      @modifica-lavorazione="apriModificaLavorazione"
      @aggiungi-lavorazione="onDettaglioAggiungi"
      @cambiato="caricaRapportini"
    />

    <NotaLavorazioneFormModal
      v-if="admin"
      :show="mostraFormNota"
      :rapportini="rapportiniSelezionati"
      @close="mostraFormNota = false"
      @saved="onNotaSalvata"
    />
  </div>
</template>
