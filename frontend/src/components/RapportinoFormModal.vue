<script setup>
import { ref, watch, onMounted } from 'vue'
import { creaRapportino } from '../services/rapportini'
import api from '../services/api'
import HelpTooltip from './HelpTooltip.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'saved'])

const form = ref(formVuoto())
const errore = ref('')
const salvataggio = ref(false)
const clienti = ref([])

// Avviso di possibile duplicato restituito dal server dopo la creazione.
// Compare DOPO, non prima: il rapportino viene creato comunque, perché
// l'avviso segnala una conseguenza e non la impedisce.
const avvisoDuplicato = ref(null)

function formVuoto() {
  return { cliente_id: '', macchina: '' }
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
  (visibile) => {
    if (visibile) {
      form.value = formVuoto()
      errore.value = ''
      avvisoDuplicato.value = null
    }
  },
)

async function salva() {
  errore.value = ''
  if (!form.value.cliente_id) {
    errore.value = 'Seleziona un cliente.'
    return
  }
  if (!form.value.macchina.trim()) {
    errore.value = 'Indica il macchinario: è ciò che distingue questo rapportino dagli altri.'
    return
  }

  salvataggio.value = true
  try {
    const creato = await creaRapportino({
      cliente_id: Number(form.value.cliente_id),
      macchina: form.value.macchina.trim(),
    })
    if (creato.avviso_duplicato) {
      // Non si chiude: chi ha creato per errore un doppione deve poterlo
      // vedere subito, non scoprirlo scorrendo l'elenco.
      avvisoDuplicato.value = creato.avviso_duplicato
      emit('saved', creato)
      return
    }
    emit('saved', creato)
    emit('close')
  } catch (err) {
    errore.value = err?.response?.data?.error || 'Non è stato possibile creare il rapportino.'
  } finally {
    salvataggio.value = false
  }
}
</script>

<template>
  <div v-if="show" class="modal fade show d-block" tabindex="-1" style="background: rgba(0,0,0,.5)">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Nuovo rapportino</h5>
          <button type="button" class="btn-close" @click="emit('close')"></button>
        </div>

        <div class="modal-body">
          <div v-if="avvisoDuplicato" class="alert alert-warning">
            <strong>Attenzione: ne esiste già uno aperto.</strong>
            <p class="mb-1">
              Hai già un rapportino aperto per questo cliente su
              «{{ avvisoDuplicato.macchina }}».
            </p>
            <p class="mb-0 small">
              Il nuovo rapportino è stato creato lo stesso. Se si tratta dello stesso
              macchinario, le ore si divideranno fra i due: valuta se eliminare questo e
              aggiungere la lavorazione a quello esistente.
            </p>
          </div>

          <div v-if="errore" class="alert alert-danger">{{ errore }}</div>

          <template v-if="!avvisoDuplicato">
            <div class="mb-3">
              <label class="form-label">Cliente</label>
              <select v-model="form.cliente_id" class="form-select">
                <option value="">Seleziona…</option>
                <option v-for="c in clienti" :key="c.id" :value="c.id">{{ c.nome }}</option>
              </select>
            </div>

            <div class="mb-3">
              <label class="form-label">
                Macchinario
                <HelpTooltip
                  text="Testo libero. Scrivilo sempre allo stesso modo: due scritture diverse creano due rapportini distinti e le ore si dividono fra i due."
                />
              </label>
              <input
                v-model="form.macchina"
                type="text"
                class="form-control"
                placeholder="Es. Trattore JD 6130R"
              />
            </div>

            <p class="text-muted small mb-0">
              Il rapportino nasce vuoto. Le lavorazioni si aggiungono dall'elenco, giorno
              per giorno.
            </p>
          </template>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="emit('close')">
            {{ avvisoDuplicato ? 'Chiudi' : 'Annulla' }}
          </button>
          <button
            v-if="!avvisoDuplicato"
            class="btn btn-primary"
            :disabled="salvataggio"
            @click="salva"
          >
            {{ salvataggio ? 'Creazione…' : 'Crea rapportino' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
