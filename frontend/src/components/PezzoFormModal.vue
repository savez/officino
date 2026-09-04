<script setup>
import { ref, watch, computed } from 'vue'
import { createProdotto, updateProdotto } from '../services/catalogo'
import HelpTooltip from './HelpTooltip.vue'
import BarcodeScannerModal from './BarcodeScannerModal.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  pezzo: { type: Object, default: null },
  categorie: { type: Array, default: () => [] },
})

const emit = defineEmits(['close', 'saved'])

const isEdit = computed(() => !!props.pezzo?.id)
const title = computed(() => (isEdit.value ? 'Modifica Prodotto' : 'Nuovo Prodotto'))

const form = ref(emptyForm())
const errors = ref({})
const saving = ref(false)
const showScanner = ref(false)

/**
 * Handle a successful barcode scan. Silently overwrites the current
 * value of `form.barcode` (per spec acceptance scenario 3).
 *
 * @param {string} code Decoded barcode string from the scanner modal
 */
function onBarcodeScanned(code) {
  showScanner.value = false
  if (code) {
    form.value.barcode = code
  }
}

function emptyForm() {
  return {
    barcode: '',
    nome: '',
    marca: '',
    modello: '',
    categoria_id: '',
    prezzo_vendita: '',
    prezzo_acquisto: '',
  }
}

watch(
  () => props.show,
  (visible) => {
    if (visible) {
      errors.value = {}
      if (props.pezzo) {
        form.value = {
          barcode: props.pezzo.barcode || '',
          nome: props.pezzo.nome || '',
          marca: props.pezzo.marca || '',
          modello: props.pezzo.modello || '',
          categoria_id: props.pezzo.categoria_id || '',
          prezzo_vendita: props.pezzo.prezzo_vendita ?? '',
          prezzo_acquisto: props.pezzo.prezzo_acquisto ?? '',
        }
      } else {
        form.value = emptyForm()
      }
    }
  }
)

function validate() {
  const errs = {}
  if (!form.value.nome?.trim()) errs.nome = 'Il nome è obbligatorio.'
  if (form.value.prezzo_vendita === '' || form.value.prezzo_vendita === null) {
    errs.prezzo_vendita = 'Il prezzo di vendita è obbligatorio.'
  }
  errors.value = errs
  return Object.keys(errs).length === 0
}

async function onSubmit() {
  if (!validate()) return

  saving.value = true
  try {
    const payload = {
      ...form.value,
      categoria_id: form.value.categoria_id || null,
      prezzo_vendita: Number(form.value.prezzo_vendita) || 0,
      prezzo_acquisto: form.value.prezzo_acquisto !== '' ? Number(form.value.prezzo_acquisto) : null,
    }

    if (isEdit.value) {
      await updateProdotto(props.pezzo.id, payload)
    } else {
      await createProdotto(payload)
    }

    emit('saved')
    emit('close')
  } catch (err) {
    if (err.response?.data?.errors) {
      // Map server validation errors
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
    <div class="modal-dialog modal-lg modal-dialog-scrollable" style="max-height: 90vh">
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

            <div class="row g-3">
              <!-- Barcode -->
              <div class="col-12 col-md-6">
                <label class="form-label">
                  Barcode
                  <HelpTooltip text="Codice a barre EAN-13 o QR del prodotto. Usa 'Scansiona Barcode' per leggerlo con la fotocamera. Permette di trovare il prodotto rapidamente senza digitare." />
                </label>
                <div class="input-group">
                  <input
                    v-model="form.barcode"
                    type="text"
                    class="form-control"
                    :class="{ 'is-invalid': errors.barcode }"
                    placeholder="Codice a barre"
                    data-testid="barcode-input"
                  />
                  <button
                    type="button"
                    class="btn btn-outline-secondary"
                    title="Scansiona barcode"
                    data-testid="barcode-scan-btn"
                    @click="showScanner = true"
                  >
                    <i class="bi bi-upc-scan"></i>
                  </button>
                  <div v-if="errors.barcode" class="invalid-feedback">{{ errors.barcode }}</div>
                </div>
              </div>

              <!-- Nome -->
              <div class="col-12 col-md-6">
                <label class="form-label">Nome *</label>
                <input
                  v-model="form.nome"
                  type="text"
                  class="form-control"
                  :class="{ 'is-invalid': errors.nome }"
                  placeholder="Nome del prodotto"
                  required
                />
                <div v-if="errors.nome" class="invalid-feedback">{{ errors.nome }}</div>
              </div>

              <!-- Marca -->
              <div class="col-12 col-md-6">
                <label class="form-label">Marca</label>
                <input
                  v-model="form.marca"
                  type="text"
                  class="form-control"
                  placeholder="Marca"
                />
              </div>

              <!-- Modello -->
              <div class="col-12 col-md-6">
                <label class="form-label">Modello</label>
                <input
                  v-model="form.modello"
                  type="text"
                  class="form-control"
                  placeholder="Modello"
                />
              </div>

              <!-- Categoria -->
              <div class="col-12 col-md-6">
                <label class="form-label">Categoria</label>
                <select
                  v-model="form.categoria_id"
                  class="form-select"
                  :class="{ 'is-invalid': errors.categoria_id }"
                >
                  <option value="">-- Nessuna --</option>
                  <option v-for="cat in categorie" :key="cat.id" :value="cat.id">
                    {{ cat.nome }}
                  </option>
                </select>
                <div v-if="errors.categoria_id" class="invalid-feedback">{{ errors.categoria_id }}</div>
              </div>

              <!-- Prezzo Vendita -->
              <div class="col-12 col-md-6">
                <label class="form-label">Prezzo Vendita *</label>
                <div class="input-group">
                  <span class="input-group-text">&euro;</span>
                  <input
                    v-model="form.prezzo_vendita"
                    type="number"
                    step="0.01"
                    min="0"
                    class="form-control"
                    :class="{ 'is-invalid': errors.prezzo_vendita }"
                    required
                  />
                  <div v-if="errors.prezzo_vendita" class="invalid-feedback">{{ errors.prezzo_vendita }}</div>
                </div>
              </div>

              <!-- Prezzo Acquisto -->
              <div class="col-12 col-md-6">
                <label class="form-label">
                  Prezzo Acquisto
                  <HelpTooltip text="Prezzo di costo interno (non visibile ai clienti né nei PDF). Utile per calcolare il margine rispetto al Prezzo Vendita." />
                </label>
                <div class="input-group">
                  <span class="input-group-text">&euro;</span>
                  <input
                    v-model="form.prezzo_acquisto"
                    type="number"
                    step="0.01"
                    min="0"
                    class="form-control"
                  />
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
              <i class="bi bi-check-lg me-1"></i>{{ isEdit ? 'Salva Modifiche' : 'Crea Prodotto' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Barcode Scanner Modal -->
    <BarcodeScannerModal
      :show="showScanner"
      @close="showScanner = false"
      @scanned="onBarcodeScanned"
    />
  </div>
</template>
