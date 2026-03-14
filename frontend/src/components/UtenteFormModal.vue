<script setup>
import { ref, watch, computed } from 'vue'
import { createUtente, updateUtente } from '../services/utenti'
import HelpTooltip from './HelpTooltip.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  utente: { type: Object, default: null },
})

const emit = defineEmits(['close', 'saved'])

const isEdit = computed(() => !!props.utente?.id)
const title = computed(() => (isEdit.value ? 'Modifica Utente' : 'Nuovo Utente'))

const form = ref(emptyForm())
const errors = ref({})
const saving = ref(false)

function emptyForm() {
  return {
    nome: '',
    email: '',
    password: '',
    ruolo: 'user',
    costo_orario: 0,
  }
}

watch(
  () => props.show,
  (visible) => {
    if (visible) {
      errors.value = {}
      if (props.utente) {
        form.value = {
          nome: props.utente.nome || '',
          email: props.utente.email || '',
          password: '',
          ruolo: props.utente.ruolo || 'user',
          costo_orario: props.utente.costo_orario ?? 0,
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
  if (!form.value.email?.trim()) errs.email = 'L\'email è obbligatoria.'
  if (form.value.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email)) {
    errs.email = 'Inserire un indirizzo email valido.'
  }
  if (!isEdit.value && !form.value.password) {
    errs.password = 'La password è obbligatoria per i nuovi utenti.'
  }
  if (form.value.password && form.value.password.length < 6) {
    errs.password = 'La password deve avere almeno 6 caratteri.'
  }
  errors.value = errs
  return Object.keys(errs).length === 0
}

async function onSubmit() {
  if (!validate()) return

  saving.value = true
  try {
    const payload = {
      nome: form.value.nome.trim(),
      email: form.value.email.trim(),
      ruolo: form.value.ruolo,
      costo_orario: Number(form.value.costo_orario) || 0,
    }

    // Only include password if provided
    if (form.value.password) {
      payload.password = form.value.password
    }

    if (isEdit.value) {
      await updateUtente(props.utente.id, payload)
    } else {
      await createUtente(payload)
    }

    emit('saved')
    emit('close')
  } catch (err) {
    if (err.response?.data?.details) {
      errors.value = { general: 'Dati non validi. Controlla i campi.' }
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
              <!-- Nome -->
              <div class="col-12 col-md-6">
                <label class="form-label">Nome *</label>
                <input
                  v-model="form.nome"
                  type="text"
                  class="form-control"
                  :class="{ 'is-invalid': errors.nome }"
                  placeholder="Nome dell'utente"
                  required
                />
                <div v-if="errors.nome" class="invalid-feedback">{{ errors.nome }}</div>
              </div>

              <!-- Email -->
              <div class="col-12 col-md-6">
                <label class="form-label">Email *</label>
                <input
                  v-model="form.email"
                  type="email"
                  class="form-control"
                  :class="{ 'is-invalid': errors.email }"
                  placeholder="email@esempio.it"
                  required
                />
                <div v-if="errors.email" class="invalid-feedback">{{ errors.email }}</div>
              </div>

              <!-- Password -->
              <div class="col-12 col-md-6">
                <label class="form-label">
                  Password {{ isEdit ? '(lascia vuoto per non modificare)' : '*' }}
                </label>
                <input
                  v-model="form.password"
                  type="password"
                  class="form-control"
                  :class="{ 'is-invalid': errors.password }"
                  placeholder="Minimo 6 caratteri"
                  :required="!isEdit"
                  autocomplete="new-password"
                />
                <div v-if="errors.password" class="invalid-feedback">{{ errors.password }}</div>
              </div>

              <!-- Ruolo -->
              <div class="col-12 col-md-3">
                <label class="form-label">
                  Ruolo
                  <HelpTooltip text="Utente: operaio, accede a Catalogo, Clienti, Preventivi e Rapportini. Admin: accesso completo incluso Utenti, Impostazioni e Note di Lavorazione." />
                </label>
                <select
                  v-model="form.ruolo"
                  class="form-select"
                  :class="{ 'is-invalid': errors.ruolo }"
                >
                  <option value="user">Utente</option>
                  <option value="admin">Admin</option>
                </select>
                <div v-if="errors.ruolo" class="invalid-feedback">{{ errors.ruolo }}</div>
              </div>

              <!-- Costo Orario -->
              <div class="col-12 col-md-3">
                <label class="form-label">
                  Costo Orario
                  <HelpTooltip text="Tariffa oraria dell'operaio in €/ora. Viene proposta automaticamente nel campo 'Costo Orario Manodopera' dei preventivi quando si seleziona questo operaio." />
                </label>
                <div class="input-group">
                  <span class="input-group-text">&euro;</span>
                  <input
                    v-model.number="form.costo_orario"
                    type="number"
                    step="0.01"
                    min="0"
                    class="form-control"
                    :class="{ 'is-invalid': errors.costo_orario }"
                  />
                  <div v-if="errors.costo_orario" class="invalid-feedback">{{ errors.costo_orario }}</div>
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
              <i class="bi bi-check-lg me-1"></i>{{ isEdit ? 'Salva Modifiche' : 'Crea Utente' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
