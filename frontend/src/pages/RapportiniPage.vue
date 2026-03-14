<script setup>
import { ref, computed, onMounted } from 'vue'
import { getRighe, cancellaRiga, stampaRapportini } from '../services/rapportini'
import { creaNota } from '../services/note-lavorazione'
import { isAdmin } from '../services/auth'
import api from '../services/api'
import RigaRapportinoFormModal from '../components/RigaRapportinoFormModal.vue'
import NotaLavorazioneFormModal from '../components/NotaLavorazioneFormModal.vue'
import HelpIcon from '../components/HelpIcon.vue'

const admin = computed(() => isAdmin())
const righe = ref([])
const loading = ref(false)
const error = ref('')
const page = ref(1)
const totalPages = ref(1)
const total = ref(0)
const oreTotali = ref(0)

// Filters
const filtroClienteId = ref('')
const filtroUtenteId = ref('')
const filtroGiorno = ref('')
const filtroGestita = ref('')
const clienti = ref([])
const utenti = ref([])

// Modals
const showFormModal = ref(false)
const showNotaModal = ref(false)

// Selection for creating nota
const selectedIds = ref([])

onMounted(async () => {
  await loadRighe()
  try {
    const { data: clientiData } = await api.get('/clienti/all')
    clienti.value = clientiData
  } catch { /* ignore */ }
  if (admin.value) {
    try {
      const { data: utentiData } = await api.get('/utenti')
      utenti.value = utentiData.data || utentiData
    } catch { /* ignore */ }
  }
})

async function loadRighe() {
  loading.value = true
  error.value = ''
  try {
    const params = { page: page.value, per_page: 20 }
    if (filtroClienteId.value) params.cliente_id = filtroClienteId.value
    if (filtroUtenteId.value) params.utente_id = filtroUtenteId.value
    if (filtroGiorno.value) params.giorno = filtroGiorno.value
    if (filtroGestita.value) params.gestita = filtroGestita.value

    const result = await getRighe(params)
    righe.value = result.data || []
    totalPages.value = result.pagination?.totalPages || 1
    total.value = result.pagination?.total || 0
    oreTotali.value = result.ore_totali_filtrate || 0
  } catch (err) {
    error.value = 'Errore nel caricamento dei rapportini.'
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  page.value = 1
  selectedIds.value = []
  loadRighe()
}

function resetFilters() {
  filtroClienteId.value = ''
  filtroUtenteId.value = ''
  filtroGiorno.value = ''
  filtroGestita.value = ''
  applyFilters()
}

function changePage(p) {
  page.value = p
  loadRighe()
}

async function onCancella(riga) {
  if (!confirm('Sei sicuro di voler cancellare questa riga?')) return
  try {
    await cancellaRiga(riga.id)
    await loadRighe()
  } catch (err) {
    alert(err.response?.data?.error || 'Errore durante la cancellazione.')
  }
}

function calcolaOre(oraInizio, oraFine) {
  const [hi, mi] = oraInizio.split(':').map(Number)
  const [hf, mf] = oraFine.split(':').map(Number)
  return Math.round(((hf * 60 + mf - hi * 60 - mi) / 60) * 100) / 100
}

function formatDate(dateStr) {
  const d = new Date(dateStr)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

// Selection logic
function toggleSelect(id) {
  const idx = selectedIds.value.indexOf(id)
  if (idx >= 0) {
    selectedIds.value.splice(idx, 1)
  } else {
    selectedIds.value.push(id)
  }
}

function isSelected(id) {
  return selectedIds.value.includes(id)
}

const selectedRighe = computed(() => righe.value.filter((r) => selectedIds.value.includes(r.id)))

const selectedSameCliente = computed(() => {
  if (selectedRighe.value.length === 0) return true
  const clienteId = selectedRighe.value[0].cliente_id
  return selectedRighe.value.every((r) => r.cliente_id === clienteId)
})

const canCreateNota = computed(() => {
  return (
    admin.value &&
    selectedIds.value.length > 0 &&
    selectedSameCliente.value &&
    selectedRighe.value.every((r) => !r.nota_lavorazione_id)
  )
})

function openNotaModal() {
  if (!canCreateNota.value) return
  showNotaModal.value = true
}

async function onStampa() {
  const params = {}
  if (filtroGiorno.value) params.giorno = filtroGiorno.value
  if (filtroClienteId.value) params.cliente_id = filtroClienteId.value
  if (!params.giorno && !params.cliente_id) {
    alert('Seleziona un filtro per giornata o cliente per stampare.')
    return
  }
  try {
    await stampaRapportini(params)
  } catch {
    alert('Errore durante la generazione del PDF.')
  }
}
</script>

<template>
  <div>
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h2>
        <i class="bi bi-journal-text me-2"></i>Rapportini
        <HelpIcon anchor="rapportini" />
      </h2>
      <div class="d-flex gap-2">
        <button
          v-if="admin && (filtroGiorno || filtroClienteId)"
          class="btn btn-outline-secondary"
          @click="onStampa"
        >
          <i class="bi bi-printer me-1"></i>Stampa
        </button>
        <button class="btn btn-primary" @click="showFormModal = true">
          <i class="bi bi-plus-lg me-1"></i>Nuova Riga
        </button>
      </div>
    </div>

    <!-- Filters -->
    <div class="card card-body bg-light mb-3">
      <div class="row g-2 align-items-end">
        <div class="col-12 col-md-3">
          <label class="form-label small">Giorno</label>
          <input v-model="filtroGiorno" type="date" class="form-control form-control-sm" />
        </div>
        <div class="col-12 col-md-3">
          <label class="form-label small">Cliente</label>
          <select v-model="filtroClienteId" class="form-select form-select-sm">
            <option value="">Tutti</option>
            <option v-for="c in clienti" :key="c.id" :value="c.id">{{ c.nome }}</option>
          </select>
        </div>
        <div v-if="admin" class="col-12 col-md-2">
          <label class="form-label small">Operaio</label>
          <select v-model="filtroUtenteId" class="form-select form-select-sm">
            <option value="">Tutti</option>
            <option v-for="u in utenti" :key="u.id" :value="u.id">{{ u.nome }}</option>
          </select>
        </div>
        <div class="col-12 col-md-2">
          <label class="form-label small">Stato</label>
          <select v-model="filtroGestita" class="form-select form-select-sm">
            <option value="">Tutti</option>
            <option value="false">Non gestite</option>
            <option value="true">Gestite</option>
          </select>
        </div>
        <div class="col-auto d-flex gap-1">
          <button class="btn btn-sm btn-primary" @click="applyFilters">
            <i class="bi bi-search"></i>
          </button>
          <button class="btn btn-sm btn-outline-secondary" @click="resetFilters">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
      </div>
    </div>

    <!-- Create Nota button -->
    <div v-if="admin && selectedIds.length > 0" class="mb-3">
      <button
        class="btn btn-success"
        :disabled="!canCreateNota"
        @click="openNotaModal"
      >
        <i class="bi bi-clipboard-check me-1"></i>Crea Nota di Lavorazione ({{ selectedIds.length }} righe)
      </button>
      <small v-if="!selectedSameCliente" class="text-danger ms-2">
        Le righe selezionate devono essere dello stesso cliente.
      </small>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-4">
      <span class="spinner-border"></span>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="alert alert-danger">{{ error }}</div>

    <!-- Empty -->
    <div v-else-if="righe.length === 0" class="text-center text-muted py-4">
      Nessuna riga di rapportino trovata.
    </div>

    <!-- Table -->
    <div v-else class="table-responsive">
      <table class="table table-hover table-sm">
        <thead class="table-light">
          <tr>
            <th v-if="admin" style="width: 30px"></th>
            <th>Giorno</th>
            <th>Orario</th>
            <th>Ore</th>
            <th v-if="admin">Operaio</th>
            <th>Cliente</th>
            <th>Macchina</th>
            <th>Materiali</th>
            <th>Note</th>
            <th>Stato</th>
            <th style="width: 60px"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="riga in righe" :key="riga.id">
            <td v-if="admin">
              <input
                v-if="!riga.nota_lavorazione_id"
                type="checkbox"
                class="form-check-input"
                :checked="isSelected(riga.id)"
                @change="toggleSelect(riga.id)"
              />
            </td>
            <td>{{ formatDate(riga.giorno) }}</td>
            <td>{{ riga.ora_inizio }} - {{ riga.ora_fine }}</td>
            <td>{{ calcolaOre(riga.ora_inizio, riga.ora_fine) }}h</td>
            <td v-if="admin">{{ riga.utente_nome }}</td>
            <td>{{ riga.cliente_nome }}</td>
            <td>{{ riga.macchina || '-' }}</td>
            <td>
              <span v-if="riga.materiali && riga.materiali.length > 0">
                <span
                  v-for="(m, i) in riga.materiali"
                  :key="i"
                  class="badge bg-light text-dark me-1"
                >{{ m.nome }} x{{ m.quantita }}</span>
              </span>
              <span v-else class="text-muted">-</span>
            </td>
            <td>
              <small>{{ riga.note || '-' }}</small>
            </td>
            <td>
              <span v-if="riga.nota_lavorazione_id" class="badge bg-success">Gestita</span>
              <span v-else class="badge bg-secondary">Aperta</span>
            </td>
            <td>
              <button
                v-if="!riga.nota_lavorazione_id || admin"
                class="btn btn-sm btn-outline-danger"
                title="Cancella"
                @click="onCancella(riga)"
              >
                <i class="bi bi-trash"></i>
              </button>
              <span
                v-else
                class="text-muted small"
                title="Solo l'amministratore può cancellare righe gestite"
              >
                <i class="bi bi-lock"></i>
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <nav v-if="totalPages > 1" class="d-flex justify-content-center">
      <ul class="pagination pagination-sm">
        <li class="page-item" :class="{ disabled: page <= 1 }">
          <button class="page-link" @click="changePage(page - 1)">&laquo;</button>
        </li>
        <li
          v-for="p in totalPages"
          :key="p"
          class="page-item"
          :class="{ active: p === page }"
        >
          <button class="page-link" @click="changePage(p)">{{ p }}</button>
        </li>
        <li class="page-item" :class="{ disabled: page >= totalPages }">
          <button class="page-link" @click="changePage(page + 1)">&raquo;</button>
        </li>
      </ul>
    </nav>

    <p class="text-muted small">
      Totale: {{ total }} righe
      <span class="badge bg-primary ms-2">
        <i class="bi bi-clock me-1"></i>{{ oreTotali }} h totali
      </span>
    </p>

    <!-- Form Modal -->
    <RigaRapportinoFormModal
      :show="showFormModal"
      @close="showFormModal = false"
      @saved="loadRighe"
    />

    <!-- Nota Modal -->
    <NotaLavorazioneFormModal
      v-if="showNotaModal"
      :show="showNotaModal"
      :righe="selectedRighe"
      @close="showNotaModal = false"
      @saved="selectedIds = []; loadRighe()"
    />
  </div>
</template>
