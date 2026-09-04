<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import BloccoFiltri from '../components/BloccoFiltri.vue'
import AppPagination from '../components/AppPagination.vue'
import PezzoFormModal from '../components/PezzoFormModal.vue'
import BarcodeScannerModal from '../components/BarcodeScannerModal.vue'
import {
  fetchCatalogo,
  searchCatalogo,
  getCatalogoByBarcode,
  deleteProdotto,
  exportExcel,
  fetchAllCategorie,
} from '../services/catalogo'
import HelpIcon from '../components/HelpIcon.vue'

// ── State ───────────────────────────────────────────────────────────

const prodotti = ref([])
const pagination = ref({ page: 1, totalPages: 1 })
const loading = ref(false)
const error = ref('')

// Filters
const searchQuery = ref('')
const categoriaFilter = ref('')
const filtriAttivi = computed(
  () => [searchQuery.value, categoriaFilter.value].filter(Boolean).length,
)

// Categorie for dropdown
const categorie = ref([])

// Modals
const showFormModal = ref(false)
const editProdotto = ref(null)
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
      result = await searchCatalogo(searchQuery.value.trim(), params)
    } else {
      result = await fetchCatalogo(params)
    }

    prodotti.value = result.data
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
watch([categoriaFilter], () => {
  loadData(1)
})

function openCreate() {
  editProdotto.value = null
  showFormModal.value = true
}

function openEdit(prodotto) {
  editProdotto.value = { ...prodotto }
  showFormModal.value = true
}

function onFormSaved() {
  loadData(pagination.value.page)
}

async function onDelete(prodotto) {
  const ok = window.confirm(`Sei sicuro di voler eliminare "${prodotto.nome}"?`)
  if (!ok) return

  try {
    await deleteProdotto(prodotto.id)
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
    const prodotto = await getCatalogoByBarcode(barcode)
    if (prodotto) {
      editProdotto.value = { ...prodotto }
      showFormModal.value = true
    }
  } catch (err) {
    if (err.response?.status === 404) {
      editProdotto.value = { barcode }
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
    <h2 class="mb-3">
      <i class="bi bi-box-seam me-2"></i>Catalogo Prodotti
      <HelpIcon anchor="catalogo" />
    </h2>

    <!-- Le azioni stanno sopra e restano sempre visibili: «Aggiungi Prodotto»
         e' il motivo principale per cui si apre questa pagina, e chiuderlo
         dentro l'accordion dei filtri lo renderebbe un tocco piu' lontano
         senza alcun guadagno di spazio. -->
    <div class="d-flex gap-2 flex-wrap mb-3">
      <button class="btn btn-outline-primary btn-sm" @click="openScanner">
        <i class="bi bi-upc-scan me-1"></i>Scansiona Barcode
      </button>
      <button class="btn btn-primary btn-sm" @click="openCreate">
        <i class="bi bi-plus-lg me-1"></i>Aggiungi Prodotto
      </button>
      <button class="btn btn-success btn-sm" @click="onExportExcel">
        <i class="bi bi-file-earmark-spreadsheet me-1"></i>Esporta Excel
      </button>
    </div>

    <BloccoFiltri :attivi="filtriAttivi">
      <div class="row g-2 align-items-end">
        <!-- Ricerca testuale -->
        <div class="col-12 col-md-5">
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

        <!-- Categoria -->
        <div class="col-12 col-md-4">
          <select v-model="categoriaFilter" class="form-select">
            <option value="">Tutte le categorie</option>
            <option v-for="cat in categorie" :key="cat.id" :value="cat.id">
              {{ cat.nome }}
            </option>
          </select>
        </div>
      </div>
    </BloccoFiltri>

    <!-- Error -->
    <div v-if="error" class="alert alert-danger">{{ error }}</div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-4">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Caricamento...</span>
      </div>
    </div>

    <!-- Table -->
    <!-- Sotto la soglia: schede. Ogni prodotto si legge intero, senza
         scorrimento laterale e senza colonne nascoste. -->
    <div v-else-if="prodotti.length === 0" class="of-vuoto">
      <p class="mb-2">Nessun prodotto in catalogo.</p>
      <p class="mb-0 small">Aggiungi un prodotto per poterlo poi usare nei rapportini.</p>
    </div>

    <div v-else class="d-lg-none">
      <article v-for="p in prodotti" :key="`scheda-${p.id}`" class="of-targhetta">
        <div class="of-targhetta__corpo">
          <p class="of-etichetta mb-1">{{ p.categoria_nome || 'Senza categoria' }}</p>
          <h3 class="of-targhetta__macchina">{{ p.nome }}</h3>
          <p class="of-targhetta__meta mb-0">
            {{ [p.marca, p.modello].filter(Boolean).join(' · ') || 'Nessun dettaglio' }}
          </p>
          <p class="of-targhetta__meta mb-0">{{ p.barcode || 'Senza barcode' }}</p>
          <p class="of-ore of-ore--riga mt-2 mb-0">{{ formatPrice(p.prezzo_vendita) }}</p>

          <div class="d-flex flex-column gap-2 mt-3">
            <button class="btn btn-primary of-azione-primaria" @click="openEdit(p)">
              Modifica prodotto
            </button>
            <button class="btn btn-outline-danger of-azione-secondaria mt-2" @click="onDelete(p)">
              Elimina prodotto
            </button>
          </div>
        </div>
      </article>
    </div>

    <div v-if="prodotti.length > 0" class="d-none d-lg-block table-responsive">
      <table class="table table-striped table-hover align-middle">
        <thead class="table-dark">
          <tr>
            <th>Nome</th>
            <th class="d-none d-md-table-cell">Barcode</th>
            <th class="d-none d-md-table-cell">Marca</th>
            <th class="d-none d-lg-table-cell">Modello</th>
            <th class="d-none d-md-table-cell">Categoria</th>
            <th class="text-end d-none d-sm-table-cell">Prezzo Vendita</th>
            <th class="text-end">Azioni</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="prodotti.length === 0">
            <td colspan="7" class="text-center text-muted py-4">
              Nessun prodotto trovato.
            </td>
          </tr>
          <tr
            v-for="p in prodotti"
            :key="p.id"
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
      :pezzo="editProdotto"
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
