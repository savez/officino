<script setup>
import { ref, computed, watch } from 'vue'
import { creaNota, aggiornaNota } from '../services/note-lavorazione'

const props = defineProps({
  show: { type: Boolean, default: false },
  righe: { type: Array, default: () => [] },
  nota: { type: Object, default: null },
})

const emit = defineEmits(['close', 'saved'])

const isEdit = computed(() => !!props.nota?.id)
const title = computed(() => (isEdit.value ? 'Modifica Nota di Lavorazione' : 'Nuova Nota di Lavorazione'))

const form = ref({
  testo: '',
  mostra_dettagli: true,
})
const errors = ref({})
const saving = ref(false)

const clienteNome = computed(() => {
  if (props.nota?.cliente_nome) return props.nota.cliente_nome
  if (props.righe.length > 0) return props.righe[0].cliente_nome
  return ''
})

const clienteId = computed(() => {
  if (props.nota?.cliente_id) return props.nota.cliente_id
  if (props.righe.length > 0) return props.righe[0].cliente_id
  return null
})

function calcolaOre(oraInizio, oraFine) {
  const [hi, mi] = oraInizio.split(':').map(Number)
  const [hf, mf] = oraFine.split(':').map(Number)
  return Math.round(((hf * 60 + mf - hi * 60 - mi) / 60) * 100) / 100
}

const oreTotali = computed(() => {
  return props.righe.reduce((sum, r) => sum + calcolaOre(r.ora_inizio, r.ora_fine), 0)
})

function formatDate(dateStr) {
  const d = new Date(dateStr)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

watch(
  () => props.show,
  (visible) => {
    if (visible) {
      errors.value = {}
      if (props.nota) {
        form.value = {
          testo: props.nota.testo || '',
          mostra_dettagli: props.nota.mostra_dettagli !== false,
        }
      } else {
        form.value = { testo: '', mostra_dettagli: true }
      }
    }
  }
)

async function onSubmit() {
  saving.value = true
  errors.value = {}
  try {
    const righeIds = props.righe.map((r) => r.id)

    if (isEdit.value) {
      await aggiornaNota(props.nota.id, {
        testo: form.value.testo || null,
        mostra_dettagli: form.value.mostra_dettagli,
        righe_ids: righeIds,
      })
    } else {
      await creaNota({
        cliente_id: clienteId.value,
        testo: form.value.testo || null,
        mostra_dettagli: form.value.mostra_dettagli,
        righe_ids: righeIds,
      })
    }

    emit('saved')
    emit('close')
  } catch (err) {
    errors.value = { general: err.response?.data?.error || 'Errore durante il salvataggio.' }
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
            <div v-if="errors.general" class="alert alert-danger">{{ errors.general }}</div>

            <!-- Cliente (readonly) -->
            <div class="mb-3">
              <label class="form-label">Cliente</label>
              <input type="text" class="form-control" :value="clienteNome" disabled />
            </div>

            <!-- Ore totali summary -->
            <div class="alert alert-info">
              <strong>{{ righe.length }}</strong> righe selezionate |
              <strong>{{ oreTotali }}h</strong> totali
            </div>

            <!-- Righe detail -->
            <div class="mb-3">
              <label class="form-label">Dettaglio righe</label>
              <table class="table table-sm table-bordered">
                <thead class="table-light">
                  <tr>
                    <th>Giorno</th>
                    <th>Orario</th>
                    <th>Ore</th>
                    <th>Operaio</th>
                    <th>Macchina</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="r in righe" :key="r.id">
                    <td>{{ formatDate(r.giorno) }}</td>
                    <td>{{ r.ora_inizio }} - {{ r.ora_fine }}</td>
                    <td>{{ calcolaOre(r.ora_inizio, r.ora_fine) }}h</td>
                    <td>{{ r.utente_nome }}</td>
                    <td>{{ r.macchina || '-' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Testo riassunto -->
            <div class="mb-3">
              <label class="form-label">Riassunto / Note</label>
              <textarea
                v-model="form.testo"
                class="form-control"
                rows="4"
                placeholder="Riassunto delle lavorazioni..."
              ></textarea>
            </div>

            <!-- Mostra dettagli -->
            <div class="form-check mb-3">
              <input
                v-model="form.mostra_dettagli"
                class="form-check-input"
                type="checkbox"
                id="mostraDettagli"
              />
              <label class="form-check-label" for="mostraDettagli">
                Mostra dettaglio righe nella stampa
              </label>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="emit('close')" :disabled="saving">
              <i class="bi bi-x-lg me-1"></i>Annulla
            </button>
            <button type="submit" class="btn btn-success" :disabled="saving">
              <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>
              <i class="bi bi-check-lg me-1"></i>{{ isEdit ? 'Salva Modifiche' : 'Crea Nota' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
