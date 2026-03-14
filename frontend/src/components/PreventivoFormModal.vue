<script setup>
import { ref, watch, computed } from 'vue'
import { createPreventivo, updatePreventivo } from '../services/preventivi'
import { getAllClienti } from '../services/clienti'
import { getAllUtenti } from '../services/utenti'
import { searchCatalogo, getCatalogoByBarcode } from '../services/catalogo'
import { calcolaPreventivo } from '../services/calcolo-preventivo'
import BarcodeScannerModal from './BarcodeScannerModal.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  preventivo: { type: Object, default: null },
})

const emit = defineEmits(['close', 'saved'])

const isEdit = computed(() => !!props.preventivo?.id)
const title = computed(() => (isEdit.value ? 'Modifica Preventivo' : 'Nuovo Preventivo'))

const form = ref(emptyForm())
const errors = ref({})
const saving = ref(false)

// Clienti dropdown
const clienti = ref([])
const loadingClienti = ref(false)

// Utenti/Operai dropdown
const utenti = ref([])
const loadingUtenti = ref(false)

// Pezzi search
const pezzoSearch = ref('')
const pezzoResults = ref([])
const searchingPezzi = ref(false)
let pezzoSearchTimeout = null

// Barcode scanner
const showBarcodeScanner = ref(false)

// Manual entry (fuori catalogo)
const showManualForm = ref(false)
const manualNome = ref('')
const manualPrezzo = ref(0)
const manualQuantita = ref(1)

function emptyForm() {
  return {
    cliente_id: '',
    operaio_id: '',
    data: todayISO(),
    manodopera_ore: 0,
    manodopera_costo_orario: 0,
    sconto_tipo: 'fisso',
    sconto_valore: 0,
    aliquota_iva: 22,
    note: '',
    pezzi: [],
  }
}

function todayISO() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// ── Live calculation ──────────────────────────────────────────────

const riepilogo = computed(() => {
  return calcolaPreventivo({
    pezzi: form.value.pezzi,
    manodopera_ore: form.value.manodopera_ore,
    manodopera_costo_orario: form.value.manodopera_costo_orario,
    sconto_tipo: form.value.sconto_tipo,
    sconto_valore: form.value.sconto_valore,
    aliquota_iva: form.value.aliquota_iva,
  })
})

// ── Watch open/close ──────────────────────────────────────────────

watch(
  () => props.show,
  async (visible) => {
    if (visible) {
      errors.value = {}
      pezzoSearch.value = ''
      pezzoResults.value = []

      // Load clienti and utenti for dropdowns
      await Promise.all([loadClienti(), loadUtenti()])

      if (props.preventivo?.id) {
        // Edit mode: populate from prop
        form.value = {
          cliente_id: props.preventivo.cliente_id || '',
          operaio_id: props.preventivo.operaio_id || '',
          data: props.preventivo.data ? props.preventivo.data.substring(0, 10) : todayISO(),
          manodopera_ore: props.preventivo.manodopera_ore ?? 0,
          manodopera_costo_orario: props.preventivo.manodopera_costo_orario ?? 0,
          sconto_tipo: props.preventivo.sconto_tipo || 'fisso',
          sconto_valore: props.preventivo.sconto_valore ?? 0,
          aliquota_iva: props.preventivo.aliquota_iva ?? 22,
          note: props.preventivo.note || '',
          pezzi: (props.preventivo.pezzi || []).map((p) => ({
            pezzo_id: p.pezzo_id || null,
            nome: p.fuori_catalogo ? (p.nome_manuale || '') : (p.nome || p.pezzo_nome || ''),
            marca: p.marca || p.pezzo_marca || '',
            quantita: p.quantita ?? 1,
            prezzo_unitario: p.prezzo_unitario ?? 0,
            note: p.note || '',
            fuori_catalogo: p.fuori_catalogo || false,
            nome_manuale: p.nome_manuale || '',
          })),
        }
      } else {
        form.value = emptyForm()
      }
    }
  }
)

async function loadClienti() {
  loadingClienti.value = true
  try {
    clienti.value = await getAllClienti()
  } catch {
    clienti.value = []
  } finally {
    loadingClienti.value = false
  }
}

async function loadUtenti() {
  loadingUtenti.value = true
  try {
    utenti.value = await getAllUtenti()
  } catch {
    utenti.value = []
  } finally {
    loadingUtenti.value = false
  }
}

function onOperaioChange() {
  const operaioId = Number(form.value.operaio_id)
  if (operaioId) {
    const operaio = utenti.value.find((u) => u.id === operaioId)
    if (operaio && operaio.costo_orario) {
      form.value.manodopera_costo_orario = Number(operaio.costo_orario)
    }
  }
}

// ── Pezzi search ──────────────────────────────────────────────────

function onPezzoSearchInput() {
  clearTimeout(pezzoSearchTimeout)
  const q = pezzoSearch.value.trim()
  if (q.length < 2) {
    pezzoResults.value = []
    return
  }
  pezzoSearchTimeout = setTimeout(async () => {
    searchingPezzi.value = true
    try {
      const result = await searchCatalogo(q, { per_page: 10 })
      pezzoResults.value = result.data || []
    } catch {
      pezzoResults.value = []
    } finally {
      searchingPezzi.value = false
    }
  }, 300)
}

function addPezzo(pezzo) {
  // Check if already added
  const existing = form.value.pezzi.find((p) => p.pezzo_id === pezzo.id)
  if (existing) {
    existing.quantita += 1
  } else {
    form.value.pezzi.push({
      pezzo_id: pezzo.id,
      nome: pezzo.nome,
      marca: pezzo.marca || '',
      quantita: 1,
      prezzo_unitario: pezzo.prezzo_vendita ?? 0,
      note: '',
    })
  }
  pezzoSearch.value = ''
  pezzoResults.value = []
}

function removePezzo(index) {
  form.value.pezzi.splice(index, 1)
}

// ── Barcode scanning ─────────────────────────────────────────────

async function onBarcodeScanned(code) {
  showBarcodeScanner.value = false
  try {
    const pezzo = await getCatalogoByBarcode(code)
    if (pezzo) {
      addPezzo(pezzo)
    }
  } catch {
    // Barcode not found - offer manual entry
    manualNome.value = `Barcode: ${code}`
    showManualForm.value = true
  }
}

// ── Manual entry (fuori catalogo) ────────────────────────────────

function addManuale() {
  if (!manualNome.value.trim()) return
  form.value.pezzi.push({
    pezzo_id: null,
    nome: manualNome.value.trim(),
    nome_manuale: manualNome.value.trim(),
    marca: '',
    quantita: manualQuantita.value || 1,
    prezzo_unitario: Number(manualPrezzo.value) || 0,
    note: '',
    fuori_catalogo: true,
  })
  manualNome.value = ''
  manualPrezzo.value = 0
  manualQuantita.value = 1
  showManualForm.value = false
}

// ── Validation ────────────────────────────────────────────────────

function validate() {
  const errs = {}
  if (!form.value.cliente_id) errs.cliente_id = 'Seleziona un cliente.'
  if (!form.value.data) errs.data = 'La data è obbligatoria.'
  if (form.value.pezzi.length === 0 && (!form.value.manodopera_ore || form.value.manodopera_ore <= 0)) {
    errs.pezzi = 'Aggiungi almeno un pezzo o delle ore di manodopera.'
  }
  errors.value = errs
  return Object.keys(errs).length === 0
}

// ── Submit ────────────────────────────────────────────────────────

async function onSubmit() {
  if (!validate()) return

  saving.value = true
  try {
    const payload = {
      cliente_id: Number(form.value.cliente_id),
      operaio_id: form.value.operaio_id ? Number(form.value.operaio_id) : null,
      data: form.value.data,
      manodopera_ore: Number(form.value.manodopera_ore) || 0,
      manodopera_costo_orario: Number(form.value.manodopera_costo_orario) || 0,
      sconto_tipo: form.value.sconto_tipo,
      sconto_valore: Number(form.value.sconto_valore) || 0,
      aliquota_iva: Number(form.value.aliquota_iva) || 22,
      note: form.value.note || '',
      pezzi: form.value.pezzi.map((p) => {
        if (p.fuori_catalogo) {
          return {
            nome_manuale: p.nome_manuale || p.nome,
            quantita: Number(p.quantita) || 1,
            prezzo_unitario: Number(p.prezzo_unitario) || 0,
            note: p.note || '',
            fuori_catalogo: true,
          }
        }
        return {
          pezzo_id: p.pezzo_id,
          quantita: Number(p.quantita) || 1,
          prezzo_unitario: Number(p.prezzo_unitario) || 0,
          note: p.note || '',
        }
      }),
    }

    if (isEdit.value) {
      await updatePreventivo(props.preventivo.id, payload)
    } else {
      await createPreventivo(payload)
    }

    emit('saved')
    emit('close')
  } catch (err) {
    if (err.response?.data?.errors) {
      const serverErrors = err.response.data.errors
      const mapped = {}
      for (const e of serverErrors) {
        mapped[e.field || 'general'] = e.message || e.msg || 'Errore di validazione'
      }
      errors.value = mapped
    } else if (err.response?.data?.error) {
      errors.value = { general: err.response.data.error }
    } else {
      errors.value = { general: 'Errore durante il salvataggio.' }
    }
  } finally {
    saving.value = false
  }
}

// ── Formatting ────────────────────────────────────────────────────

function formatCurrency(value) {
  const n = Number(value) || 0
  return n.toFixed(2) + ' \u20AC'
}
</script>

<template>
  <div
    v-if="show"
    class="modal fade show d-block"
    tabindex="-1"
    role="dialog"
    style="background-color: rgba(0, 0, 0, 0.5)"
    @click.self="emit('close')"
  >
    <div class="modal-dialog modal-xl modal-dialog-scrollable" style="max-height: 90vh">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">{{ title }}</h5>
          <button type="button" class="btn-close" @click="emit('close')"></button>
        </div>

        <form @submit.prevent="onSubmit" class="d-flex flex-column overflow-hidden">
          <div class="modal-body overflow-auto">
            <!-- General error -->
            <div v-if="errors.general" class="alert alert-danger">
              {{ errors.general }}
            </div>

            <!-- ── Cliente e Data ─────────────────────────── -->
            <div class="row g-3 mb-4">
              <div class="col-12 col-md-6">
                <label class="form-label">Cliente *</label>
                <select
                  v-model="form.cliente_id"
                  class="form-select"
                  :class="{ 'is-invalid': errors.cliente_id }"
                  :disabled="loadingClienti"
                >
                  <option value="">-- Seleziona cliente --</option>
                  <option v-for="c in clienti" :key="c.id" :value="c.id">
                    {{ c.nome }}
                  </option>
                </select>
                <div v-if="errors.cliente_id" class="invalid-feedback">{{ errors.cliente_id }}</div>
              </div>

              <div class="col-12 col-md-3">
                <label class="form-label">Data *</label>
                <input
                  v-model="form.data"
                  type="date"
                  class="form-control"
                  :class="{ 'is-invalid': errors.data }"
                />
                <div v-if="errors.data" class="invalid-feedback">{{ errors.data }}</div>
              </div>

              <div class="col-12 col-md-3">
                <label class="form-label">Operaio</label>
                <select
                  v-model="form.operaio_id"
                  class="form-select"
                  :disabled="loadingUtenti"
                  @change="onOperaioChange"
                >
                  <option value="">-- Nessuno --</option>
                  <option v-for="u in utenti" :key="u.id" :value="u.id">
                    {{ u.nome }}
                  </option>
                </select>
              </div>
            </div>

            <!-- ── Pezzi ─────────────────────────────────── -->
            <h6 class="border-bottom pb-2 mb-3">Pezzi</h6>
            <div v-if="errors.pezzi" class="alert alert-warning py-2">{{ errors.pezzi }}</div>

            <!-- Search -->
            <div class="mb-3 position-relative">
              <div class="input-group">
                <input
                  v-model="pezzoSearch"
                  type="text"
                  class="form-control"
                  placeholder="Cerca prodotto per nome, marca, modello..."
                  @input="onPezzoSearchInput"
                />
                <button
                  type="button"
                  class="btn btn-outline-secondary"
                  title="Scansiona barcode"
                  @click="showBarcodeScanner = true"
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
                <span v-if="searchingPezzi" class="input-group-text">
                  <span class="spinner-border spinner-border-sm"></span>
                </span>
              </div>
              <!-- Dropdown results -->
              <ul
                v-if="pezzoResults.length > 0"
                class="list-group position-absolute w-100 shadow"
                style="z-index: 1050; max-height: 250px; overflow-y: auto"
              >
                <li
                  v-for="p in pezzoResults"
                  :key="p.id"
                  class="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                  style="cursor: pointer"
                  @click="addPezzo(p)"
                >
                  <div>
                    <strong>{{ p.nome }}</strong>
                    <small v-if="p.marca" class="text-muted ms-2">{{ p.marca }}</small>
                    <small v-if="p.modello" class="text-muted ms-1">{{ p.modello }}</small>
                  </div>
                  <span class="badge bg-primary">{{ formatCurrency(p.prezzo_vendita) }}</span>
                </li>
              </ul>
            </div>

            <!-- Manual entry form (fuori catalogo) -->
            <div v-if="showManualForm" class="card card-body bg-light mb-3">
              <p class="small text-muted mb-2">Prodotto fuori catalogo:</p>
              <div class="row g-2 align-items-end">
                <div class="col">
                  <label class="form-label small">Nome prodotto</label>
                  <input
                    v-model="manualNome"
                    type="text"
                    class="form-control form-control-sm"
                    placeholder="Nome prodotto"
                  />
                </div>
                <div class="col-2">
                  <label class="form-label small">Prezzo</label>
                  <div class="input-group input-group-sm">
                    <span class="input-group-text">&euro;</span>
                    <input
                      v-model.number="manualPrezzo"
                      type="number"
                      step="0.01"
                      min="0"
                      class="form-control form-control-sm"
                    />
                  </div>
                </div>
                <div class="col-2">
                  <label class="form-label small">Quantit&agrave;</label>
                  <input
                    v-model.number="manualQuantita"
                    type="number"
                    class="form-control form-control-sm"
                    min="1"
                  />
                </div>
                <div class="col-auto">
                  <button
                    type="button"
                    class="btn btn-sm btn-primary"
                    @click="addManuale"
                    :disabled="!manualNome.trim()"
                  >
                    Aggiungi
                  </button>
                </div>
              </div>
            </div>

            <!-- Pezzi table -->
            <div v-if="form.pezzi.length > 0" class="table-responsive mb-3">
              <table class="table table-sm table-bordered align-middle mb-0">
                <thead class="table-light">
                  <tr>
                    <th>Pezzo</th>
                    <th class="d-none d-md-table-cell">Marca</th>
                    <th style="width: 100px">Quantit&agrave;</th>
                    <th style="width: 130px">Prezzo Unit.</th>
                    <th style="width: 110px" class="text-end">Subtotale</th>
                    <th class="d-none d-md-table-cell">Note</th>
                    <th style="width: 50px"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(riga, i) in form.pezzi" :key="i">
                    <td>
                      {{ riga.nome }}
                      <span v-if="riga.fuori_catalogo" class="badge bg-warning text-dark ms-1">fuori cat.</span>
                    </td>
                    <td class="d-none d-md-table-cell">{{ riga.marca || '-' }}</td>
                    <td>
                      <input
                        v-model.number="riga.quantita"
                        type="number"
                        min="1"
                        class="form-control form-control-sm"
                      />
                    </td>
                    <td>
                      <div class="input-group input-group-sm">
                        <span class="input-group-text">&euro;</span>
                        <input
                          v-model.number="riga.prezzo_unitario"
                          type="number"
                          step="0.01"
                          min="0"
                          class="form-control form-control-sm"
                        />
                      </div>
                    </td>
                    <td class="text-end">
                      {{ formatCurrency((riga.quantita || 0) * (riga.prezzo_unitario || 0)) }}
                    </td>
                    <td class="d-none d-md-table-cell">
                      <input
                        v-model="riga.note"
                        type="text"
                        class="form-control form-control-sm"
                        placeholder="Note..."
                      />
                    </td>
                    <td class="text-center">
                      <button
                        type="button"
                        class="btn btn-outline-danger btn-sm"
                        title="Rimuovi"
                        @click="removePezzo(i)"
                      >
                        &times;
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-else class="text-muted small">Nessun prodotto aggiunto. Usa la ricerca sopra per aggiungere prodotti.</p>

            <!-- ── Manodopera ────────────────────────────── -->
            <h6 class="border-bottom pb-2 mb-3 mt-4">Manodopera</h6>
            <div class="row g-3 mb-3">
              <div class="col-6 col-md-3">
                <label class="form-label">Ore</label>
                <input
                  v-model.number="form.manodopera_ore"
                  type="number"
                  step="0.5"
                  min="0"
                  class="form-control"
                />
              </div>
              <div class="col-6 col-md-3">
                <label class="form-label">Costo Orario (&euro;)</label>
                <div class="input-group">
                  <span class="input-group-text">&euro;</span>
                  <input
                    v-model.number="form.manodopera_costo_orario"
                    type="number"
                    step="0.01"
                    min="0"
                    class="form-control"
                  />
                </div>
              </div>
              <div class="col-12 col-md-3 d-flex align-items-end">
                <div>
                  <label class="form-label text-muted">Totale Manodopera</label>
                  <div class="fw-bold">{{ formatCurrency(riepilogo.manodopera_totale) }}</div>
                </div>
              </div>
            </div>

            <!-- ── Sconto ────────────────────────────────── -->
            <h6 class="border-bottom pb-2 mb-3 mt-4">Sconto</h6>
            <div class="row g-3 mb-3">
              <div class="col-12 col-md-4">
                <label class="form-label">Tipo Sconto</label>
                <div>
                  <div class="form-check form-check-inline">
                    <input
                      v-model="form.sconto_tipo"
                      class="form-check-input"
                      type="radio"
                      value="fisso"
                      id="scontoFisso"
                    />
                    <label class="form-check-label" for="scontoFisso">Fisso (&euro;)</label>
                  </div>
                  <div class="form-check form-check-inline">
                    <input
                      v-model="form.sconto_tipo"
                      class="form-check-input"
                      type="radio"
                      value="percentuale"
                      id="scontoPercentuale"
                    />
                    <label class="form-check-label" for="scontoPercentuale">Percentuale (%)</label>
                  </div>
                </div>
              </div>
              <div class="col-6 col-md-3">
                <label class="form-label">Valore Sconto</label>
                <div class="input-group">
                  <input
                    v-model.number="form.sconto_valore"
                    type="number"
                    step="0.01"
                    min="0"
                    class="form-control"
                  />
                  <span class="input-group-text">
                    {{ form.sconto_tipo === 'percentuale' ? '%' : '\u20AC' }}
                  </span>
                </div>
              </div>
            </div>

            <!-- ── IVA ───────────────────────────────────── -->
            <div class="row g-3 mb-3">
              <div class="col-6 col-md-3">
                <label class="form-label">Aliquota IVA (%)</label>
                <div class="input-group">
                  <input
                    v-model.number="form.aliquota_iva"
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    class="form-control"
                  />
                  <span class="input-group-text">%</span>
                </div>
              </div>
            </div>

            <!-- ── Note ──────────────────────────────────── -->
            <div class="mb-4">
              <label class="form-label">Note</label>
              <textarea
                v-model="form.note"
                class="form-control"
                rows="3"
                placeholder="Note aggiuntive..."
              ></textarea>
            </div>

            <!-- ── Riepilogo ─────────────────────────────── -->
            <div class="card bg-light">
              <div class="card-body">
                <h6 class="card-title mb-3">Riepilogo</h6>
                <div class="row">
                  <div class="col-6 col-md-4">
                    <table class="table table-sm table-borderless mb-0">
                      <tbody>
                        <tr>
                          <td class="text-muted">Imponibile:</td>
                          <td class="text-end fw-semibold">{{ formatCurrency(riepilogo.imponibile) }}</td>
                        </tr>
                        <tr>
                          <td class="text-muted">Sconto:</td>
                          <td class="text-end text-danger">- {{ formatCurrency(riepilogo.sconto_calcolato) }}</td>
                        </tr>
                        <tr>
                          <td class="text-muted">Imponibile Netto:</td>
                          <td class="text-end fw-semibold">{{ formatCurrency(riepilogo.imponibile_netto) }}</td>
                        </tr>
                        <tr>
                          <td class="text-muted">IVA ({{ form.aliquota_iva }}%):</td>
                          <td class="text-end">{{ formatCurrency(riepilogo.iva) }}</td>
                        </tr>
                        <tr class="border-top">
                          <td class="fw-bold fs-5">Totale:</td>
                          <td class="text-end fw-bold fs-5">{{ formatCurrency(riepilogo.totale) }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="emit('close')" :disabled="saving">
              <i class="bi bi-x-lg me-1"></i>Annulla
            </button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>
              <i class="bi bi-check-lg me-1"></i>{{ isEdit ? 'Salva Modifiche' : 'Crea Preventivo' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Barcode Scanner Modal -->
    <BarcodeScannerModal
      :show="showBarcodeScanner"
      @close="showBarcodeScanner = false"
      @scanned="onBarcodeScanned"
    />
  </div>
</template>
