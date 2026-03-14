<script setup>
import { ref, watch, onMounted } from 'vue'
import { creaRiga } from '../services/rapportini'
import api from '../services/api'
import MaterialeSelector from './MaterialeSelector.vue'
import HelpTooltip from './HelpTooltip.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'saved'])

const form = ref(emptyForm())
const errors = ref({})
const saving = ref(false)
const clienti = ref([])

function emptyForm() {
  const today = new Date().toISOString().split('T')[0]
  return {
    cliente_id: '',
    giorno: today,
    ora_inizio: '',
    ora_fine: '',
    macchina: '',
    note: '',
    materiali: [],
  }
}

onMounted(async () => {
  try {
    const { data } = await api.get('/clienti/all')
    clienti.value = data
  } catch {
    clienti.value = []
  }
})

watch(
  () => props.show,
  (visible) => {
    if (visible) {
      errors.value = {}
      form.value = emptyForm()
    }
  }
)

function validate() {
  const errs = {}
  if (!form.value.cliente_id) errs.cliente_id = 'Cliente obbligatorio.'
  if (!form.value.giorno) errs.giorno = 'Giorno obbligatorio.'
  if (!form.value.ora_inizio) errs.ora_inizio = 'Ora inizio obbligatoria.'
  if (!form.value.ora_fine) errs.ora_fine = 'Ora fine obbligatoria.'
  if (form.value.ora_inizio && form.value.ora_fine && form.value.ora_fine <= form.value.ora_inizio) {
    errs.ora_fine = 'Ora fine deve essere successiva a ora inizio.'
  }
  errors.value = errs
  return Object.keys(errs).length === 0
}

async function onSubmit() {
  if (!validate()) return

  saving.value = true
  try {
    const payload = {
      cliente_id: Number(form.value.cliente_id),
      giorno: form.value.giorno,
      ora_inizio: form.value.ora_inizio,
      ora_fine: form.value.ora_fine,
      macchina: form.value.macchina.trim() || null,
      note: form.value.note.trim() || null,
      materiali: form.value.materiali.map((m) => {
        if (m.fuori_catalogo) {
          return {
            nome_manuale: m.nome_manuale || m.nome,
            quantita: m.quantita,
            fuori_catalogo: true,
          }
        }
        return {
          pezzo_id: m.pezzo_id,
          quantita: m.quantita,
        }
      }),
    }

    await creaRiga(payload)
    emit('saved')
    emit('close')
  } catch (err) {
    if (err.response?.data?.error) {
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
          <h5 class="modal-title">Nuova Riga Rapportino</h5>
          <button type="button" class="btn-close" @click="emit('close')"></button>
        </div>

        <form @submit.prevent="onSubmit" class="d-flex flex-column overflow-hidden">
          <div class="modal-body overflow-auto">
            <div v-if="errors.general" class="alert alert-danger">
              {{ errors.general }}
            </div>

            <div class="row g-3">
              <!-- Giorno -->
              <div class="col-12 col-md-4">
                <label class="form-label">Giorno *</label>
                <input
                  v-model="form.giorno"
                  type="date"
                  class="form-control"
                  :class="{ 'is-invalid': errors.giorno }"
                  required
                />
                <div v-if="errors.giorno" class="invalid-feedback">{{ errors.giorno }}</div>
              </div>

              <!-- Ora inizio -->
              <div class="col-6 col-md-4">
                <label class="form-label">Ora inizio *</label>
                <input
                  v-model="form.ora_inizio"
                  type="time"
                  class="form-control"
                  :class="{ 'is-invalid': errors.ora_inizio }"
                  required
                />
                <div v-if="errors.ora_inizio" class="invalid-feedback">{{ errors.ora_inizio }}</div>
              </div>

              <!-- Ora fine -->
              <div class="col-6 col-md-4">
                <label class="form-label">Ora fine *</label>
                <input
                  v-model="form.ora_fine"
                  type="time"
                  class="form-control"
                  :class="{ 'is-invalid': errors.ora_fine }"
                  required
                />
                <div v-if="errors.ora_fine" class="invalid-feedback">{{ errors.ora_fine }}</div>
              </div>

              <!-- Cliente -->
              <div class="col-12">
                <label class="form-label">Cliente *</label>
                <select
                  v-model="form.cliente_id"
                  class="form-select"
                  :class="{ 'is-invalid': errors.cliente_id }"
                  required
                >
                  <option value="" disabled>Seleziona cliente</option>
                  <option v-for="c in clienti" :key="c.id" :value="c.id">{{ c.nome }}</option>
                </select>
                <div v-if="errors.cliente_id" class="invalid-feedback">{{ errors.cliente_id }}</div>
              </div>

              <!-- Macchina -->
              <div class="col-12">
                <label class="form-label">
                  Macchina / Attrezzatura
                  <HelpTooltip text="Descrivi su quale veicolo o attrezzatura hai lavorato. Campo libero: es. 'Trattore John Deere 6130R', 'Escavatore CAT 320', 'Autocarro Iveco Daily'." />
                </label>
                <input
                  v-model="form.macchina"
                  type="text"
                  class="form-control"
                  placeholder="Es. Trattore John Deere, Sollevatore CAT..."
                />
              </div>

              <!-- Materiali -->
              <div class="col-12">
                <div class="d-flex align-items-center mb-1">
                  <span class="form-label mb-0">Materiali utilizzati</span>
                  <HelpTooltip text="Aggiungi i ricambi o materiali usati durante il lavoro. Cerca nel catalogo oppure usa 'fuori catalogo' per inserire un materiale non in archivio (es. consumabili generici)." />
                </div>
                <MaterialeSelector v-model:materiali="form.materiali" />
              </div>

              <!-- Note -->
              <div class="col-12">
                <label class="form-label">Note</label>
                <textarea
                  v-model="form.note"
                  class="form-control"
                  rows="2"
                  placeholder="Note aggiuntive"
                ></textarea>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="emit('close')" :disabled="saving">
              <i class="bi bi-x-lg me-1"></i>Annulla
            </button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>
              <i class="bi bi-check-lg me-1"></i>Inserisci Riga
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
