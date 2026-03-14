<script setup>
import { ref } from 'vue'
import { searchCatalogo, getCatalogoByBarcode } from '../services/catalogo'

const props = defineProps({
  materiali: { type: Array, default: () => [] },
})

const emit = defineEmits(['update:materiali'])

const searchTerm = ref('')
const searchResults = ref([])
const searching = ref(false)
const showScanner = ref(false)
const showManualForm = ref(false)
const manualNome = ref('')
const manualQuantita = ref(1)
let debounceTimer = null

async function onSearch() {
  const term = searchTerm.value.trim()
  if (term.length < 2) {
    searchResults.value = []
    return
  }

  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(async () => {
    searching.value = true
    try {
      const result = await searchCatalogo(term, { per_page: 10 })
      searchResults.value = result.data || []
    } catch {
      searchResults.value = []
    } finally {
      searching.value = false
    }
  }, 300)
}

function addMateriale(pezzo) {
  const existing = props.materiali.find((m) => !m.fuori_catalogo && m.pezzo_id === pezzo.id)
  if (existing) {
    const updated = props.materiali.map((m) =>
      !m.fuori_catalogo && m.pezzo_id === pezzo.id
        ? { ...m, quantita: m.quantita + 1 }
        : m
    )
    emit('update:materiali', updated)
  } else {
    emit('update:materiali', [
      ...props.materiali,
      {
        pezzo_id: pezzo.id,
        nome: pezzo.nome,
        quantita: 1,
        fuori_catalogo: false,
      },
    ])
  }
  searchTerm.value = ''
  searchResults.value = []
}

function addManuale() {
  if (!manualNome.value.trim()) return
  emit('update:materiali', [
    ...props.materiali,
    {
      nome_manuale: manualNome.value.trim(),
      nome: manualNome.value.trim(),
      quantita: manualQuantita.value || 1,
      fuori_catalogo: true,
    },
  ])
  manualNome.value = ''
  manualQuantita.value = 1
  showManualForm.value = false
}

function removeMateriale(index) {
  const updated = [...props.materiali]
  updated.splice(index, 1)
  emit('update:materiali', updated)
}

function updateQuantita(index, qty) {
  const val = Math.max(1, parseInt(qty) || 1)
  const updated = props.materiali.map((m, i) => (i === index ? { ...m, quantita: val } : m))
  emit('update:materiali', updated)
}

async function onBarcodeScanned(code) {
  showScanner.value = false
  try {
    const pezzo = await getCatalogoByBarcode(code)
    if (pezzo) {
      addMateriale(pezzo)
    }
  } catch {
    // Barcode not found - offer manual entry
    manualNome.value = `Barcode: ${code}`
    showManualForm.value = true
  }
}
</script>

<template>
  <div>
    <label class="form-label">Materiali utilizzati</label>

    <!-- Search bar -->
    <div class="input-group mb-2">
      <input
        v-model="searchTerm"
        type="text"
        class="form-control"
        placeholder="Cerca materiale nel catalogo..."
        @input="onSearch"
      />
      <button
        type="button"
        class="btn btn-outline-secondary"
        title="Scansiona barcode"
        @click="showScanner = true"
      >
        <i class="bi bi-upc-scan"></i>
      </button>
      <button
        type="button"
        class="btn btn-outline-secondary"
        title="Inserisci manualmente"
        @click="showManualForm = !showManualForm"
      >
        <i class="bi bi-plus-lg"></i>
      </button>
    </div>

    <!-- Search results dropdown -->
    <div v-if="searchResults.length > 0" class="list-group mb-2" style="max-height: 200px; overflow-y: auto">
      <button
        v-for="pezzo in searchResults"
        :key="pezzo.id"
        type="button"
        class="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
        @click="addMateriale(pezzo)"
      >
        <span>{{ pezzo.nome }} <small class="text-muted">{{ pezzo.marca || '' }}</small></span>
      </button>
    </div>

    <div v-if="searching" class="text-muted small mb-2">
      <span class="spinner-border spinner-border-sm me-1"></span>Ricerca...
    </div>

    <!-- Manual entry form -->
    <div v-if="showManualForm" class="card card-body bg-light mb-2">
      <p class="small text-muted mb-2">Prodotto fuori catalogo:</p>
      <div class="row g-2">
        <div class="col">
          <input
            v-model="manualNome"
            type="text"
            class="form-control form-control-sm"
            placeholder="Nome prodotto"
          />
        </div>
        <div class="col-3">
          <input
            v-model.number="manualQuantita"
            type="number"
            class="form-control form-control-sm"
            min="1"
            placeholder="Qtà"
          />
        </div>
        <div class="col-auto">
          <button type="button" class="btn btn-sm btn-primary" @click="addManuale" :disabled="!manualNome.trim()">
            Aggiungi
          </button>
        </div>
      </div>
    </div>

    <!-- Selected materials list -->
    <div v-if="materiali.length > 0">
      <table class="table table-sm table-bordered mb-0">
        <thead class="table-light">
          <tr>
            <th>Materiale</th>
            <th style="width: 80px">Qtà</th>
            <th style="width: 40px"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(mat, index) in materiali" :key="index">
            <td>
              {{ mat.nome || mat.nome_manuale }}
              <span v-if="mat.fuori_catalogo" class="badge bg-warning text-dark ms-1">fuori cat.</span>
            </td>
            <td>
              <input
                type="number"
                class="form-control form-control-sm"
                :value="mat.quantita"
                min="1"
                @input="updateQuantita(index, $event.target.value)"
              />
            </td>
            <td class="text-center">
              <button type="button" class="btn btn-sm btn-outline-danger" @click="removeMateriale(index)">
                <i class="bi bi-x"></i>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Barcode Scanner Modal -->
    <BarcodeScannerModal
      :show="showScanner"
      @close="showScanner = false"
      @scanned="onBarcodeScanned"
    />
  </div>
</template>

<script>
import BarcodeScannerModal from './BarcodeScannerModal.vue'

export default {
  components: { BarcodeScannerModal },
}
</script>
