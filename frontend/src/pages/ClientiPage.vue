<script setup>
import { ref, onMounted, watch } from 'vue'
import AppPagination from '../components/AppPagination.vue'
import ClienteFormModal from '../components/ClienteFormModal.vue'
import {
  getClienti,
  searchClienti,
  archiviaCliente,
  ripristinaCliente,
  deleteCliente,
} from '../services/clienti'
import HelpIcon from '../components/HelpIcon.vue'

// ── State ───────────────────────────────────────────────────────────

const clienti = ref([])
const pagination = ref({ page: 1, totalPages: 1 })
const loading = ref(false)
const error = ref('')

// Filters
const searchQuery = ref('')
const mostraArchiviati = ref(false)

// Modals
const showFormModal = ref(false)
const editCliente = ref(null)

// Debounce
let searchTimeout = null

// ── Data Loading ────────────────────────────────────────────────────

async function loadData(page = 1) {
  loading.value = true
  error.value = ''

  try {
    const params = {
      page,
      per_page: 25,
    }

    if (mostraArchiviati.value) {
      params.archiviati = 'true'
    }

    let result

    if (searchQuery.value.trim()) {
      result = await searchClienti({ q: searchQuery.value.trim(), ...params })
    } else {
      result = await getClienti(params)
    }

    clienti.value = result.data
    pagination.value = {
      page: result.pagination.page,
      totalPages: result.pagination.totalPages,
    }
  } catch (err) {
    error.value = 'Errore nel caricamento dei clienti.'
    console.error(err)
  } finally {
    loading.value = false
  }
}

// ── Actions ─────────────────────────────────────────────────────────

function onSearchInput() {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    if (searchQuery.value.trim().length >= 1 || searchQuery.value.trim().length === 0) {
      loadData(1)
    }
  }, 300)
}

function onSearch() {
  clearTimeout(searchTimeout)
  loadData(1)
}

function onPageChange(page) {
  loadData(page)
}

// Watch filter changes
watch(mostraArchiviati, () => {
  loadData(1)
})

function openCreate() {
  editCliente.value = null
  showFormModal.value = true
}

function openEdit(cliente) {
  editCliente.value = { ...cliente }
  showFormModal.value = true
}

function onFormSaved() {
  loadData(pagination.value.page)
}

async function onArchivia(cliente) {
  const ok = window.confirm(`Sei sicuro di voler archiviare "${cliente.nome}"?`)
  if (!ok) return

  try {
    await archiviaCliente(cliente.id)
    loadData(pagination.value.page)
  } catch {
    alert('Errore durante l\'archiviazione.')
  }
}

async function onRipristina(cliente) {
  try {
    await ripristinaCliente(cliente.id)
    loadData(pagination.value.page)
  } catch {
    alert('Errore durante il ripristino.')
  }
}

async function onDelete(cliente) {
  const ok = window.confirm(
    `Sei sicuro di voler eliminare definitivamente "${cliente.nome}"?\nQuesta azione non è reversibile.`
  )
  if (!ok) return

  try {
    await deleteCliente(cliente.id)
    loadData(pagination.value.page)
  } catch (err) {
    if (err.response?.status === 409) {
      alert(
        'Impossibile eliminare questo cliente perché ha dei preventivi associati.\n' +
        'Puoi archiviarlo invece di eliminarlo.'
      )
    } else {
      alert('Errore durante l\'eliminazione.')
    }
  }
}

// ── Init ────────────────────────────────────────────────────────────

onMounted(() => {
  loadData(1)
})
</script>

<template>
  <div>
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h2 class="mb-0">
        <i class="bi bi-people me-2"></i>Gestione Clienti
        <HelpIcon anchor="clienti" />
      </h2>
      <button class="btn btn-primary" @click="openCreate">
        <i class="bi bi-person-plus me-1"></i>Nuovo Cliente
      </button>
    </div>

    <!-- Toolbar -->
    <div class="row g-2 mb-3">
      <!-- Search -->
      <div class="col-12 col-md-6">
        <form @submit.prevent="onSearch" class="input-group">
          <input
            v-model="searchQuery"
            type="text"
            class="form-control"
            placeholder="Cerca per nome, email, telefono, codice fiscale..."
            @input="onSearchInput"
          />
          <button class="btn btn-outline-secondary" type="submit">
            <i class="bi bi-search"></i>
          </button>
        </form>
      </div>

      <!-- Mostra archiviati toggle -->
      <div class="col-12 col-md-3 d-flex align-items-center">
        <div class="form-check">
          <input
            v-model="mostraArchiviati"
            type="checkbox"
            class="form-check-input"
            id="mostraArchiviatiCheck"
          />
          <label class="form-check-label text-nowrap" for="mostraArchiviatiCheck">
            Mostra archiviati
          </label>
        </div>
      </div>
    </div>

    <!-- Error -->
    <div v-if="error" class="alert alert-danger">{{ error }}</div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-4">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Caricamento...</span>
      </div>
    </div>

    <!-- Table -->
    <div v-else class="table-responsive">
      <table class="table table-striped table-hover align-middle">
        <thead class="table-dark">
          <tr>
            <th>Nome</th>
            <th class="d-none d-md-table-cell">Telefono</th>
            <th class="d-none d-md-table-cell">Email</th>
            <th class="d-none d-lg-table-cell">CF / P.IVA</th>
            <th>Stato</th>
            <th class="text-end">Azioni</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="clienti.length === 0">
            <td colspan="6" class="text-center text-muted py-4">
              Nessun cliente trovato.
            </td>
          </tr>
          <tr
            v-for="c in clienti"
            :key="c.id"
            :class="{ 'text-muted text-decoration-line-through': c.archiviato }"
          >
            <td>
              <a href="#" class="text-decoration-none" @click.prevent="openEdit(c)">
                {{ c.nome }}
              </a>
            </td>
            <td class="d-none d-md-table-cell">{{ c.telefono || '-' }}</td>
            <td class="d-none d-md-table-cell">{{ c.email || '-' }}</td>
            <td class="d-none d-lg-table-cell">
              {{ c.codice_fiscale || c.partita_iva || '-' }}
            </td>
            <td>
              <span
                class="badge"
                :class="c.archiviato ? 'bg-secondary' : 'bg-success'"
              >
                {{ c.archiviato ? 'Archiviato' : 'Attivo' }}
              </span>
            </td>
            <td class="text-end text-nowrap">
              <button
                class="btn btn-outline-primary btn-sm me-1"
                title="Modifica"
                @click="openEdit(c)"
              >
                <i class="bi bi-pencil"></i>
              </button>
              <button
                v-if="!c.archiviato"
                class="btn btn-outline-warning btn-sm me-1"
                title="Archivia"
                @click="onArchivia(c)"
              >
                <i class="bi bi-archive"></i>
              </button>
              <button
                v-else
                class="btn btn-outline-success btn-sm me-1"
                title="Ripristina"
                @click="onRipristina(c)"
              >
                <i class="bi bi-arrow-counterclockwise"></i>
              </button>
              <button
                class="btn btn-outline-danger btn-sm"
                title="Elimina"
                @click="onDelete(c)"
              >
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <AppPagination
      :page="pagination.page"
      :total-pages="pagination.totalPages"
      @update:page="onPageChange"
    />

    <!-- Modals -->
    <ClienteFormModal
      :show="showFormModal"
      :cliente="editCliente"
      @close="showFormModal = false"
      @saved="onFormSaved"
    />
  </div>
</template>
