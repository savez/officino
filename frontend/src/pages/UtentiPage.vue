<script setup>
import { ref, onMounted } from 'vue'
import AppPagination from '../components/AppPagination.vue'
import UtenteFormModal from '../components/UtenteFormModal.vue'
import { getUtenti, deleteUtente } from '../services/utenti'
import HelpIcon from '../components/HelpIcon.vue'

// ── State ───────────────────────────────────────────────────────────

const utenti = ref([])
const pagination = ref({ page: 1, totalPages: 1 })
const loading = ref(false)
const error = ref('')
const successMessage = ref('')

// Modals
const showFormModal = ref(false)
const editUtente = ref(null)

// ── Data Loading ────────────────────────────────────────────────────

async function loadData(page = 1) {
  loading.value = true
  error.value = ''

  try {
    const result = await getUtenti({ page, per_page: 25 })
    utenti.value = result.data
    pagination.value = {
      page: result.pagination.page,
      totalPages: result.pagination.totalPages,
    }
  } catch (err) {
    error.value = 'Errore nel caricamento degli utenti.'
    console.error(err)
  } finally {
    loading.value = false
  }
}

// ── Actions ─────────────────────────────────────────────────────────

function openCreate() {
  editUtente.value = null
  showFormModal.value = true
}

function openEdit(utente) {
  editUtente.value = { ...utente }
  showFormModal.value = true
}

function onFormSaved() {
  successMessage.value = editUtente.value ? 'Utente aggiornato con successo!' : 'Utente creato con successo!'
  loadData(pagination.value.page)
}

function onPageChange(page) {
  loadData(page)
}

async function onDelete(utente) {
  const ok = window.confirm(
    `Sei sicuro di voler eliminare l'utente "${utente.nome}" (${utente.email})?\n\nQuesta azione non \u00E8 reversibile.`
  )
  if (!ok) return

  try {
    await deleteUtente(utente.id)
    successMessage.value = `Utente "${utente.nome}" eliminato con successo.`
    loadData(pagination.value.page)
  } catch (err) {
    if (err.response?.data?.error) {
      alert(err.response.data.error)
    } else {
      alert('Errore durante l\'eliminazione dell\'utente.')
    }
  }
}

function formatCurrency(value) {
  if (value === null || value === undefined) return '-'
  return Number(value).toFixed(2) + ' \u20AC'
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`
}

const ruoloLabel = {
  user: 'Utente',
  admin: 'Admin',
}

const ruoloBadgeClass = {
  user: 'bg-primary',
  admin: 'bg-warning text-dark',
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
        <i class="bi bi-person-gear me-2"></i>Gestione Utenti
        <HelpIcon anchor="utenti" />
      </h2>
      <button class="btn btn-primary" @click="openCreate">
        <i class="bi bi-person-plus me-1"></i>Nuovo Utente
      </button>
    </div>

    <!-- Success -->
    <div v-if="successMessage" class="alert alert-success alert-dismissible fade show">
      {{ successMessage }}
      <button type="button" class="btn-close" @click="successMessage = ''"></button>
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
            <th>Email</th>
            <th>Ruolo</th>
            <th class="text-end d-none d-md-table-cell">Costo Orario</th>
            <th class="d-none d-lg-table-cell">Creato il</th>
            <th class="text-end">Azioni</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="utenti.length === 0">
            <td colspan="6" class="text-center text-muted py-4">
              Nessun utente trovato.
            </td>
          </tr>
          <tr v-for="u in utenti" :key="u.id">
            <td class="fw-semibold">{{ u.nome }}</td>
            <td>{{ u.email }}</td>
            <td>
              <span class="badge" :class="ruoloBadgeClass[u.ruolo] || 'bg-secondary'">
                {{ ruoloLabel[u.ruolo] || u.ruolo }}
              </span>
            </td>
            <td class="text-end d-none d-md-table-cell">{{ formatCurrency(u.costo_orario) }}</td>
            <td class="d-none d-lg-table-cell">{{ formatDateTime(u.created_at) }}</td>
            <td class="text-end text-nowrap">
              <div class="btn-group btn-group-sm">
                <button
                  class="btn btn-outline-primary"
                  title="Modifica"
                  @click="openEdit(u)"
                >
                  <i class="bi bi-pencil me-1"></i>Modifica
                </button>
                <button
                  class="btn btn-outline-danger"
                  title="Elimina"
                  @click="onDelete(u)"
                >
                  <i class="bi bi-trash me-1"></i>Elimina
                </button>
              </div>
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
    <UtenteFormModal
      :show="showFormModal"
      :utente="editUtente"
      @close="showFormModal = false"
      @saved="onFormSaved"
    />
  </div>
</template>
