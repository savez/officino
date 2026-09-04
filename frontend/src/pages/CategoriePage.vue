<script setup>
import { ref, onMounted } from 'vue'
import AppPagination from '../components/AppPagination.vue'
import {
  fetchCategorie,
  createCategoria,
  updateCategoria,
  deleteCategoria,
} from '../services/catalogo'
import HelpIcon from '../components/HelpIcon.vue'

// ── State ───────────────────────────────────────────────────────────

const categorie = ref([])
const pagination = ref({ page: 1, totalPages: 1 })
const loading = ref(false)
const error = ref('')

// Form state
const showModal = ref(false)
const editingCategoria = ref(null)
const form = ref({ nome: '', descrizione: '' })
const formErrors = ref({})
const saving = ref(false)

// ── Data Loading ────────────────────────────────────────────────────

async function loadData(page = 1) {
  loading.value = true
  error.value = ''

  try {
    const result = await fetchCategorie({ page, per_page: 25 })
    categorie.value = result.data
    pagination.value = {
      page: result.pagination.page,
      totalPages: result.pagination.totalPages,
    }
  } catch {
    error.value = 'Errore nel caricamento delle categorie.'
  } finally {
    loading.value = false
  }
}

function onPageChange(page) {
  loadData(page)
}

// ── Modal ───────────────────────────────────────────────────────────

function openCreate() {
  editingCategoria.value = null
  form.value = { nome: '', descrizione: '' }
  formErrors.value = {}
  showModal.value = true
}

function openEdit(cat) {
  editingCategoria.value = cat
  form.value = { nome: cat.nome || '', descrizione: cat.descrizione || '' }
  formErrors.value = {}
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editingCategoria.value = null
}

function validate() {
  const errs = {}
  if (!form.value.nome?.trim()) errs.nome = 'Il nome è obbligatorio.'
  formErrors.value = errs
  return Object.keys(errs).length === 0
}

async function onSubmit() {
  if (!validate()) return

  saving.value = true
  try {
    const payload = {
      nome: form.value.nome.trim(),
      descrizione: form.value.descrizione.trim(),
    }

    if (editingCategoria.value) {
      await updateCategoria(editingCategoria.value.id, payload)
    } else {
      await createCategoria(payload)
    }

    closeModal()
    loadData(pagination.value.page)
  } catch (err) {
    if (err.response?.data?.error) {
      formErrors.value = { general: err.response.data.error }
    } else {
      formErrors.value = { general: 'Errore durante il salvataggio.' }
    }
  } finally {
    saving.value = false
  }
}

// ── Delete ──────────────────────────────────────────────────────────

async function onDelete(cat) {
  const ok = window.confirm(`Sei sicuro di voler eliminare la categoria "${cat.nome}"?`)
  if (!ok) return

  try {
    await deleteCategoria(cat.id)
    loadData(pagination.value.page)
  } catch (err) {
    if (err.response?.data?.error) {
      alert(err.response.data.error)
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
        <i class="bi bi-tag me-2"></i>Categorie
        <HelpIcon anchor="categorie" />
      </h2>
      <button class="btn btn-primary btn-sm" @click="openCreate">
        <i class="bi bi-plus-lg me-1"></i>Aggiungi Categoria
      </button>
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
    <div v-else-if="categorie.length === 0" class="of-vuoto">
      <p class="mb-2">Nessuna categoria.</p>
      <p class="mb-0 small">Le categorie servono a raggruppare i prodotti del catalogo.</p>
    </div>

    <div v-else class="d-lg-none">
      <article v-for="cat in categorie" :key="`scheda-${cat.id}`" class="of-targhetta">
        <div class="of-targhetta__corpo">
          <h3 class="of-targhetta__macchina">{{ cat.nome }}</h3>
          <p class="of-targhetta__meta mb-0">{{ cat.descrizione || 'Senza descrizione' }}</p>

          <div class="d-flex flex-column gap-2 mt-3">
            <button class="btn btn-primary of-azione-primaria" @click="openEdit(cat)">
              Modifica categoria
            </button>
            <button class="btn btn-outline-danger of-azione-secondaria mt-2" @click="onDelete(cat)">
              Elimina categoria
            </button>
          </div>
        </div>
      </article>
    </div>

    <div v-if="categorie.length > 0" class="d-none d-lg-block table-responsive">
      <table class="table table-striped table-hover align-middle">
        <thead class="table-dark">
          <tr>
            <th>Nome</th>
            <th class="d-none d-md-table-cell">Descrizione</th>
            <th class="text-end">Azioni</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="categorie.length === 0">
            <td colspan="3" class="text-center text-muted py-4">
              Nessuna categoria trovata.
            </td>
          </tr>
          <tr v-for="cat in categorie" :key="cat.id">
            <td>
              <a href="#" class="text-decoration-none" @click.prevent="openEdit(cat)">
                {{ cat.nome }}
              </a>
            </td>
            <td class="d-none d-md-table-cell">{{ cat.descrizione || '-' }}</td>
            <td class="text-end text-nowrap">
              <button
                class="btn btn-outline-primary btn-sm me-1"
                @click="openEdit(cat)"
              >
                <i class="bi bi-pencil"></i>
              </button>
              <button
                class="btn btn-outline-danger btn-sm"
                @click="onDelete(cat)"
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

    <!-- Modal -->
    <div
      v-if="showModal"
      class="modal fade show d-block"
      tabindex="-1"
      role="dialog"
      style="background-color: rgba(0, 0, 0, 0.5)"
      @click.self="closeModal"
    >
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              {{ editingCategoria ? 'Modifica Categoria' : 'Nuova Categoria' }}
            </h5>
            <button type="button" class="btn-close" @click="closeModal"></button>
          </div>

          <form @submit.prevent="onSubmit">
            <div class="modal-body">
              <!-- General error -->
              <div v-if="formErrors.general" class="alert alert-danger">
                {{ formErrors.general }}
              </div>

              <div class="mb-3">
                <label class="form-label">Nome *</label>
                <input
                  v-model="form.nome"
                  type="text"
                  class="form-control"
                  :class="{ 'is-invalid': formErrors.nome }"
                  placeholder="Nome della categoria"
                  required
                />
                <div v-if="formErrors.nome" class="invalid-feedback">
                  {{ formErrors.nome }}
                </div>
              </div>

              <div class="mb-3">
                <label class="form-label">Descrizione</label>
                <textarea
                  v-model="form.descrizione"
                  class="form-control"
                  rows="3"
                  placeholder="Descrizione (opzionale)"
                ></textarea>
              </div>
            </div>

            <div class="modal-footer">
              <button
                type="button"
                class="btn btn-secondary"
                @click="closeModal"
                :disabled="saving"
              >
                <i class="bi bi-x-lg me-1"></i>Annulla
              </button>
              <button type="submit" class="btn btn-primary" :disabled="saving">
                <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>
                <i class="bi bi-check-lg me-1"></i>{{ editingCategoria ? 'Salva Modifiche' : 'Crea Categoria' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>
