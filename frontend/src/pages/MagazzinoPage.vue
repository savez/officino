<script setup>
import { ref, onMounted, watch } from 'vue'
import AppPagination from '../components/AppPagination.vue'
import PezzoFormModal from '../components/PezzoFormModal.vue'
import BarcodeScannerModal from '../components/BarcodeScannerModal.vue'
import {
  fetchMagazzino,
  searchMagazzino,
  getMagazzinoByBarcode,
  deletePezzo,
  exportExcel,
  fetchAllCategorie,
} from '../services/magazzino'

// ── State ───────────────────────────────────────────────────────────

const pezzi = ref([])
const pagination = ref({ page: 1, totalPages: 1 })
const loading = ref(false)
const error = ref('')

// Filters
const searchQuery = ref('')
const categoriaFilter = ref('')
const sottoSogliaOnly = ref(false)

// Categorie for dropdown
const categorie = ref([])

// Modals
const showFormModal = ref(false)
const editPezzo = ref(null)
const showScannerModal = ref(false)

// ── Data Loading ────────────────────────────────────────────────────

async function loadCategorie() {
  try {
    categorie.value = await fetchAllCategorie()
  } catch {
    categorie.value = []
  }
}

async function loadData(page = 1) {
  loading.value = true
  error.value = ''

  try {
    const params = {
      page,
      per_page: 25,
    }

    if (categoriaFilter.value) {
      params.categoria_id = categoriaFilter.value
    }

    let result

    if (searchQuery.value.trim()) {
      result = await searchMagazzino(searchQuery.value.trim(), params)
    } else {
      if (sottoSogliaOnly.value) {
        params.sotto_soglia = true
      }
      result = await fetchMagazzino(params)
    }

    pezzi.value = result.data
    pagination.value = {
      page: result.pagination.page,
      totalPages: result.pagination.totalPages,
    }
  } catch (err) {
    error.value = 'Errore nel caricamento dei dati.'
    console.error(err)
  } finally {
    loading.value = false
  }
}

// ── Actions ─────────────────────────────────────────────────────────

function onSearch() {
  loadData(1)
}

function onPageChange(page) {
  loadData(page)
}

// Watch filter changes
watch([categoriaFilter, sottoSogliaOnly], () => {
  loadData(1)
})

function openCreate() {
  editPezzo.value = null
  showFormModal.value = true
}

function openEdit(pezzo) {
  editPezzo.value = { ...pezzo }
  showFormModal.value = true
}

function onFormSaved() {
  loadData(pagination.value.page)
}

async function onDelete(pezzo) {
  const ok = window.confirm(`Sei sicuro di voler eliminare "${pezzo.nome}"?`)
  if (!ok) return

  try {
    await deletePezzo(pezzo.id)
    loadData(pagination.value.page)
  } catch {
    alert('Errore durante l\'eliminazione.')
  }
}

async function onExportExcel() {
  try {
    await exportExcel()
  } catch {
    alert('Errore durante l\'esportazione.')
  }
}

// Barcode scanner
function openScanner() {
  showScannerModal.value = true
}

async function onBarcodeScanned(barcode) {
  try {
    const pezzo = await getMagazzinoByBarcode(barcode)
    if (pezzo) {
      editPezzo.value = { ...pezzo }
      showFormModal.value = true
    }
  } catch (err) {
    if (err.response?.status === 404) {
      // Pezzo not found — open create form pre-filled with barcode
      editPezzo.value = null
      showFormModal.value = true
      // Use nextTick-like approach: wait for modal to open, then we'll pass barcode
      // Actually, let's open with a special object
      editPezzo.value = { barcode }
      showFormModal.value = true
    } else {
      alert('Errore nella ricerca del barcode.')
    }
  }
}

function formatPrice(value) {
  if (value === null || value === undefined) return '-'
  return Number(value).toFixed(2) + ' \u20AC'
}

// ── Init ────────────────────────────────────────────────────────────

onMounted(() => {
  loadCategorie()
  loadData(1)
})
</script>

<template>
  <div>
    <h2 class="mb-3">Magazzino</h2>

    <!-- Toolbar -->
    <div class="row g-2 mb-3">
      <!-- Search -->
      <div class="col-12 col-md-4">
        <form @submit.prevent="onSearch" class="input-group">
          <input
            v-model="searchQuery"
            type="text"
            class="form-control"
            placeholder="Cerca per nome, marca, modello..."
          />
          <button class="btn btn-outline-secondary" type="submit">
            <i class="bi bi-search"></i>
          </button>
        </form>
      </div>

      <!-- Categoria filter -->
      <div class="col-6 col-md-2">
        <select v-model="categoriaFilter" class="form-select">
          <option value="">Tutte le categorie</option>
          <option v-for="cat in categorie" :key="cat.id" :value="cat.id">
            {{ cat.nome }}
          </option>
        </select>
      </div>

      <!-- Sotto soglia toggle -->
      <div class="col-6 col-md-2 d-flex align-items-center">
        <div class="form-check">
          <input
            v-model="sottoSogliaOnly"
            type="checkbox"
            class="form-check-input"
            id="sottoSogliaCheck"
          />
          <label class="form-check-label text-nowrap" for="sottoSogliaCheck">
            Solo sotto soglia
          </label>
        </div>
      </div>

      <!-- Action buttons -->
      <div class="col-12 col-md-4 d-flex gap-2 flex-wrap justify-content-md-end">
        <button class="btn btn-outline-primary btn-sm" @click="openScanner">
          <i class="bi bi-upc-scan me-1"></i>Scansiona Barcode
        </button>
        <button class="btn btn-primary btn-sm" @click="openCreate">
          <i class="bi bi-plus-lg me-1"></i>Aggiungi Pezzo
        </button>
        <button class="btn btn-success btn-sm" @click="onExportExcel">
          <i class="bi bi-file-earmark-spreadsheet me-1"></i>Esporta Excel
        </button>
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
            <th class="d-none d-md-table-cell">Barcode</th>
            <th class="d-none d-md-table-cell">Marca</th>
            <th class="d-none d-lg-table-cell">Modello</th>
            <th class="d-none d-md-table-cell">Categoria</th>
            <th class="text-end">Qtà</th>
            <th class="text-end d-none d-sm-table-cell">Prezzo Vendita</th>
            <th class="text-end">Azioni</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="pezzi.length === 0">
            <td colspan="8" class="text-center text-muted py-4">
              Nessun pezzo trovato.
            </td>
          </tr>
          <tr
            v-for="p in pezzi"
            :key="p.id"
            :class="{ 'table-danger': p.sotto_soglia }"
          >
            <td>
              <a href="#" class="text-decoration-none" @click.prevent="openEdit(p)">
                {{ p.nome }}
              </a>
            </td>
            <td class="d-none d-md-table-cell">{{ p.barcode || '-' }}</td>
            <td class="d-none d-md-table-cell">{{ p.marca || '-' }}</td>
            <td class="d-none d-lg-table-cell">{{ p.modello || '-' }}</td>
            <td class="d-none d-md-table-cell">{{ p.categoria_nome || '-' }}</td>
            <td class="text-end">{{ p.quantita }}</td>
            <td class="text-end d-none d-sm-table-cell">{{ formatPrice(p.prezzo_vendita) }}</td>
            <td class="text-end text-nowrap">
              <button
                class="btn btn-outline-primary btn-sm me-1"
                title="Modifica"
                @click="openEdit(p)"
              >
                <i class="bi bi-pencil"></i>
              </button>
              <button
                class="btn btn-outline-danger btn-sm"
                title="Elimina"
                @click="onDelete(p)"
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
    <PezzoFormModal
      :show="showFormModal"
      :pezzo="editPezzo"
      :categorie="categorie"
      @close="showFormModal = false"
      @saved="onFormSaved"
    />

    <BarcodeScannerModal
      :show="showScannerModal"
      @close="showScannerModal = false"
      @scanned="onBarcodeScanned"
    />
  </div>
</template>
