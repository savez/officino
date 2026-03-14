<script setup>
import { ref, onMounted } from 'vue'
import { getNote, getNota, cancellaNota, aggiornaNota, stampaNota } from '../services/note-lavorazione'
import { getRighe } from '../services/rapportini'
import api from '../services/api'
import NotaLavorazioneFormModal from '../components/NotaLavorazioneFormModal.vue'
import HelpIcon from '../components/HelpIcon.vue'

const note = ref([])
const loading = ref(false)
const error = ref('')
const page = ref(1)
const totalPages = ref(1)
const total = ref(0)

const filtroClienteId = ref('')
const clienti = ref([])

// Edit modal
const showEditModal = ref(false)
const editNota = ref(null)
const editRighe = ref([])

// Detail view
const detailNota = ref(null)
const loadingDetail = ref(false)

onMounted(async () => {
  await loadNote()
  try {
    const { data } = await api.get('/clienti/all')
    clienti.value = data
  } catch { /* ignore */ }
})

async function loadNote() {
  loading.value = true
  error.value = ''
  try {
    const params = { page: page.value, per_page: 20 }
    if (filtroClienteId.value) params.cliente_id = filtroClienteId.value

    const result = await getNote(params)
    note.value = result.data || []
    totalPages.value = result.pagination?.totalPages || 1
    total.value = result.pagination?.total || 0
  } catch {
    error.value = 'Errore nel caricamento delle note di lavorazione.'
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  page.value = 1
  loadNote()
}

function changePage(p) {
  page.value = p
  loadNote()
}

async function onViewDetail(nota) {
  loadingDetail.value = true
  try {
    detailNota.value = await getNota(nota.id)
  } catch {
    alert('Errore nel caricamento del dettaglio.')
  } finally {
    loadingDetail.value = false
  }
}

function closeDetail() {
  detailNota.value = null
}

async function onEdit(nota) {
  try {
    const detail = await getNota(nota.id)
    editNota.value = detail
    editRighe.value = detail.righe || []

    // Also load available unmanaged righe for same client
    const result = await getRighe({ cliente_id: nota.cliente_id, gestita: 'false', per_page: 100 })
    const availableRighe = result.data || []

    // Merge: current righe + available unmanaged
    editRighe.value = [...detail.righe, ...availableRighe]
    showEditModal.value = true
  } catch {
    alert('Errore nel caricamento della nota.')
  }
}

async function onDelete(nota) {
  if (!confirm('Sei sicuro di voler eliminare questa nota di lavorazione?')) return
  try {
    await cancellaNota(nota.id)
    detailNota.value = null
    await loadNote()
  } catch {
    alert('Errore durante la cancellazione.')
  }
}

async function onStampa(nota) {
  try {
    await stampaNota(nota.id)
  } catch {
    alert('Errore durante la generazione del PDF.')
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

function truncate(text, max = 60) {
  if (!text) return '-'
  return text.length > max ? text.substring(0, max) + '...' : text
}
</script>

<template>
  <div>
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h2>
        <i class="bi bi-clipboard-check me-2"></i>Note di Lavorazione
        <HelpIcon anchor="note-lavorazione" />
      </h2>
    </div>

    <!-- Filters -->
    <div class="card card-body bg-light mb-3">
      <div class="row g-2 align-items-end">
        <div class="col-12 col-md-4">
          <label class="form-label small">Cliente</label>
          <select v-model="filtroClienteId" class="form-select form-select-sm" @change="applyFilters">
            <option value="">Tutti</option>
            <option v-for="c in clienti" :key="c.id" :value="c.id">{{ c.nome }}</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Detail view -->
    <div v-if="detailNota" class="card mb-3">
      <div class="card-header d-flex justify-content-between align-items-center">
        <strong>{{ detailNota.cliente_nome }}</strong>
        <div class="d-flex gap-1">
          <button class="btn btn-sm btn-outline-primary" @click="onStampa(detailNota)">
            <i class="bi bi-printer"></i>
          </button>
          <button class="btn btn-sm btn-outline-secondary" @click="onEdit(detailNota)">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger" @click="onDelete(detailNota)">
            <i class="bi bi-trash"></i>
          </button>
          <button class="btn btn-sm btn-outline-dark" @click="closeDetail">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
      </div>
      <div class="card-body">
        <p v-if="detailNota.testo">{{ detailNota.testo }}</p>
        <p class="text-muted" v-else><em>Nessun riassunto</em></p>

        <div class="alert alert-info py-2">
          <strong>{{ detailNota.righe?.length || 0 }}</strong> righe |
          <strong>{{ detailNota.ore_totali }}h</strong> totali
        </div>

        <table v-if="detailNota.righe?.length" class="table table-sm table-bordered">
          <thead class="table-light">
            <tr>
              <th>Giorno</th>
              <th>Orario</th>
              <th>Ore</th>
              <th>Operaio</th>
              <th>Macchina</th>
              <th>Materiali</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in detailNota.righe" :key="r.id">
              <td>{{ formatDate(r.giorno) }}</td>
              <td>{{ r.ora_inizio }} - {{ r.ora_fine }}</td>
              <td>{{ r.ore }}h</td>
              <td>{{ r.utente_nome }}</td>
              <td>{{ r.macchina || '-' }}</td>
              <td>
                <span v-for="(m, i) in r.materiali" :key="i" class="badge bg-light text-dark me-1">
                  {{ m.nome }} x{{ m.quantita }}
                </span>
                <span v-if="!r.materiali?.length">-</span>
              </td>
              <td><small>{{ r.note || '-' }}</small></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-4">
      <span class="spinner-border"></span>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="alert alert-danger">{{ error }}</div>

    <!-- Empty -->
    <div v-else-if="note.length === 0" class="text-center text-muted py-4">
      Nessuna nota di lavorazione trovata.
    </div>

    <!-- Table -->
    <div v-else class="table-responsive">
      <table class="table table-hover table-sm">
        <thead class="table-light">
          <tr>
            <th>Cliente</th>
            <th>Riassunto</th>
            <th>Righe</th>
            <th>Ore tot.</th>
            <th>Data</th>
            <th style="width: 120px"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="n in note" :key="n.id" style="cursor: pointer" @click="onViewDetail(n)">
            <td>{{ n.cliente_nome }}</td>
            <td>{{ truncate(n.testo) }}</td>
            <td>{{ n.num_righe }}</td>
            <td>{{ n.ore_totali }}h</td>
            <td>{{ formatDate(n.created_at) }}</td>
            <td @click.stop>
              <div class="d-flex gap-1">
                <button class="btn btn-sm btn-outline-primary" @click="onStampa(n)" title="Stampa">
                  <i class="bi bi-printer"></i>
                </button>
                <button class="btn btn-sm btn-outline-secondary" @click="onEdit(n)" title="Modifica">
                  <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" @click="onDelete(n)" title="Elimina">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
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
        <li v-for="p in totalPages" :key="p" class="page-item" :class="{ active: p === page }">
          <button class="page-link" @click="changePage(p)">{{ p }}</button>
        </li>
        <li class="page-item" :class="{ disabled: page >= totalPages }">
          <button class="page-link" @click="changePage(page + 1)">&raquo;</button>
        </li>
      </ul>
    </nav>

    <p v-if="total > 0" class="text-muted small">Totale: {{ total }} note</p>

    <!-- Edit Modal -->
    <NotaLavorazioneFormModal
      v-if="showEditModal"
      :show="showEditModal"
      :nota="editNota"
      :righe="editRighe"
      @close="showEditModal = false"
      @saved="loadNote(); detailNota = null"
    />
  </div>
</template>
