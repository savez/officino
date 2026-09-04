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
const manualPrezzo = ref(0)
let debounceTimer = null

/**
 * Normalize a numeric input (string or number) to a non-negative Number
 * rounded to 2 decimals. Used for prezzo_unitario.
 * @param {string|number} v
 * @returns {number}
 */
function toMoney(v) {
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100) / 100
}

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
    // US1/FR-011/FR-014: prefill prezzo_unitario from catalogo prezzo_vendita.
    // Snapshot — remains editable per-row, independent from future catalogo edits.
    emit('update:materiali', [
      ...props.materiali,
      {
        pezzo_id: pezzo.id,
        nome: pezzo.nome,
        quantita: 1,
        fuori_catalogo: false,
        prezzo_unitario: toMoney(pezzo.prezzo_vendita ?? 0),
      },
    ])
  }
  searchTerm.value = ''
  searchResults.value = []
}

function addManuale() {
  if (!manualNome.value.trim()) return
  // US1/FR-012: fuori catalogo accepts a manually entered prezzo_unitario,
  // default 0 (admin may complete it later in nota di lavorazione).
  emit('update:materiali', [
    ...props.materiali,
    {
      nome_manuale: manualNome.value.trim(),
      nome: manualNome.value.trim(),
      quantita: manualQuantita.value || 1,
      fuori_catalogo: true,
      prezzo_unitario: toMoney(manualPrezzo.value),
    },
  ])
  manualNome.value = ''
  manualQuantita.value = 1
  manualPrezzo.value = 0
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

/**
 * Update prezzo_unitario of a materiale at index, emitting the new array.
 * Coerced to >= 0 with 2 decimals.
 * @param {number} index
 * @param {string|number} prezzo
 */
function updatePrezzo(index, prezzo) {
  const val = toMoney(prezzo)
  const updated = props.materiali.map((m, i) => (i === index ? { ...m, prezzo_unitario: val } : m))
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
            data-testid="manual-nome-input"
          />
        </div>
        <div class="col-3">
          <input
            v-model.number="manualQuantita"
            type="number"
            class="form-control form-control-sm"
            min="1"
            placeholder="Qtà"
            data-testid="manual-quantita-input"
          />
        </div>
        <div class="col-3">
          <div class="input-group input-group-sm">
            <span class="input-group-text">&euro;</span>
            <input
              v-model.number="manualPrezzo"
              type="number"
              class="form-control"
              min="0"
              step="0.01"
              placeholder="Prezzo"
              data-testid="manual-prezzo-input"
            />
          </div>
        </div>
        <div class="col-auto">
          <button
            type="button"
            class="btn btn-sm btn-primary"
            data-testid="manual-add-btn"
            @click="addManuale"
            :disabled="!manualNome.trim()"
          >
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
            <th style="width: 120px">Prezzo unit. (&euro;)</th>
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
            <td>
              <input
                type="number"
                class="form-control form-control-sm"
                :value="mat.prezzo_unitario ?? 0"
                min="0"
                step="0.01"
                :data-testid="`prezzo-input-${index}`"
                @input="updatePrezzo(index, $event.target.value)"
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
