<script setup>
import { ref, watch, computed } from 'vue'
import { createCliente, updateCliente } from '../services/clienti'

const props = defineProps({
  show: { type: Boolean, default: false },
  cliente: { type: Object, default: null },
})

const emit = defineEmits(['close', 'saved'])

const isEdit = computed(() => !!props.cliente?.id)
const title = computed(() => (isEdit.value ? 'Modifica Cliente' : 'Nuovo Cliente'))

const form = ref(emptyForm())
const errors = ref({})
const saving = ref(false)

function emptyForm() {
  return {
    nome: '',
    telefono: '',
    email: '',
    indirizzo: '',
    codice_fiscale: '',
    partita_iva: '',
    note: '',
  }
}

watch(
  () => props.show,
  (visible) => {
    if (visible) {
      errors.value = {}
      if (props.cliente) {
        form.value = {
          nome: props.cliente.nome || '',
          telefono: props.cliente.telefono || '',
          email: props.cliente.email || '',
          indirizzo: props.cliente.indirizzo || '',
          codice_fiscale: props.cliente.codice_fiscale || '',
          partita_iva: props.cliente.partita_iva || '',
          note: props.cliente.note || '',
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
  if (form.value.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email)) {
    errs.email = 'Inserire un indirizzo email valido.'
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
      telefono: form.value.telefono.trim() || null,
      email: form.value.email.trim() || null,
      indirizzo: form.value.indirizzo.trim() || null,
      codice_fiscale: form.value.codice_fiscale.trim() || null,
      partita_iva: form.value.partita_iva.trim() || null,
      note: form.value.note.trim() || null,
    }

    if (isEdit.value) {
      await updateCliente(props.cliente.id, payload)
    } else {
      await createCliente(payload)
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
              <div class="col-12">
                <label class="form-label">Nome *</label>
                <input
                  v-model="form.nome"
                  type="text"
                  class="form-control"
                  :class="{ 'is-invalid': errors.nome }"
                  placeholder="Nome o ragione sociale"
                  required
                />
                <div v-if="errors.nome" class="invalid-feedback">{{ errors.nome }}</div>
              </div>

              <!-- Telefono -->
              <div class="col-12 col-md-6">
                <label class="form-label">Telefono</label>
                <input
                  v-model="form.telefono"
                  type="tel"
                  class="form-control"
                  :class="{ 'is-invalid': errors.telefono }"
                  placeholder="Numero di telefono"
                />
                <div v-if="errors.telefono" class="invalid-feedback">{{ errors.telefono }}</div>
              </div>

              <!-- Email -->
              <div class="col-12 col-md-6">
                <label class="form-label">Email</label>
                <input
                  v-model="form.email"
                  type="email"
                  class="form-control"
                  :class="{ 'is-invalid': errors.email }"
                  placeholder="indirizzo@email.com"
                />
                <div v-if="errors.email" class="invalid-feedback">{{ errors.email }}</div>
              </div>

              <!-- Indirizzo -->
              <div class="col-12">
                <label class="form-label">Indirizzo</label>
                <textarea
                  v-model="form.indirizzo"
                  class="form-control"
                  :class="{ 'is-invalid': errors.indirizzo }"
                  rows="2"
                  placeholder="Via, numero civico, CAP, città"
                ></textarea>
                <div v-if="errors.indirizzo" class="invalid-feedback">{{ errors.indirizzo }}</div>
              </div>

              <!-- Codice Fiscale -->
              <div class="col-12 col-md-6">
                <label class="form-label">Codice Fiscale</label>
                <input
                  v-model="form.codice_fiscale"
                  type="text"
                  class="form-control"
                  :class="{ 'is-invalid': errors.codice_fiscale }"
                  placeholder="Codice fiscale"
                />
                <div v-if="errors.codice_fiscale" class="invalid-feedback">{{ errors.codice_fiscale }}</div>
              </div>

              <!-- Partita IVA -->
              <div class="col-12 col-md-6">
                <label class="form-label">Partita IVA</label>
                <input
                  v-model="form.partita_iva"
                  type="text"
                  class="form-control"
                  :class="{ 'is-invalid': errors.partita_iva }"
                  placeholder="Partita IVA"
                />
                <div v-if="errors.partita_iva" class="invalid-feedback">{{ errors.partita_iva }}</div>
              </div>

              <!-- Note -->
              <div class="col-12">
                <label class="form-label">Note</label>
                <textarea
                  v-model="form.note"
                  class="form-control"
                  :class="{ 'is-invalid': errors.note }"
                  rows="3"
                  placeholder="Note aggiuntive"
                ></textarea>
                <div v-if="errors.note" class="invalid-feedback">{{ errors.note }}</div>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="emit('close')" :disabled="saving">
              <i class="bi bi-x-lg me-1"></i>Annulla
            </button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>
              <i class="bi bi-check-lg me-1"></i>{{ isEdit ? 'Salva Modifiche' : 'Crea Cliente' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
