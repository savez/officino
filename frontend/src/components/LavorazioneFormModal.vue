<script setup>
import { ref, watch, computed } from 'vue'
import { aggiungiLavorazione, modificaLavorazione } from '../services/rapportini'
import MaterialeSelector from './MaterialeSelector.vue'
import HelpTooltip from './HelpTooltip.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  rapportino: { type: Object, default: null },
  // Quando valorizzata, il modale è in modifica invece che in inserimento.
  lavorazione: { type: Object, default: null },
})

const emit = defineEmits(['close', 'saved'])

// Soglia oltre la quale si chiede conferma. NON è un limite: il server accetta
// qualunque valore positivo a quarti d'ora. Serve a intercettare l'errore di
// battitura senza impedire una giornata davvero lunga.
const SOGLIA_AVVISO_ORE = 12

const form = ref(formVuoto())
const errore = ref('')
const salvataggio = ref(false)
const oreDaConfermare = ref(false)

const inModifica = computed(() => !!props.lavorazione?.id)
const titolo = computed(() => (inModifica.value ? 'Modifica lavorazione' : 'Nuova lavorazione'))

function oggi() {
  const d = new Date()
  const mese = String(d.getMonth() + 1).padStart(2, '0')
  const giorno = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mese}-${giorno}`
}

function formVuoto() {
  return { giorno: oggi(), ore: '', note: '', materiali: [] }
}

/**
 * Porta una lavorazione del server nella forma del modulo.
 * @param {object} l - lavorazione ricevuta dall'API
 * @returns {object} valori del modulo
 */
function daLavorazione(l) {
  return {
    giorno: l.giorno || oggi(),
    ore: l.ore ?? '',
    note: l.note || '',
    materiali: Array.isArray(l.materiali)
      ? l.materiali.map((m) => ({
          pezzo_id: m.pezzo_id ?? null,
          nome: m.nome || m.nome_manuale || '',
          nome_manuale: m.fuori_catalogo ? m.nome || m.nome_manuale || '' : undefined,
          quantita: m.quantita || 1,
          fuori_catalogo: !!m.fuori_catalogo,
          prezzo_unitario: Number(m.prezzo_unitario ?? 0),
        }))
      : [],
  }
}

watch(
  () => props.show,
  (visibile) => {
    if (visibile) {
      form.value = props.lavorazione ? daLavorazione(props.lavorazione) : formVuoto()
      errore.value = ''
      oreDaConfermare.value = false
    }
  },
)

const oreNumeriche = computed(() => Number(form.value.ore))

const oreOltreSoglia = computed(
  () => Number.isFinite(oreNumeriche.value) && oreNumeriche.value > SOGLIA_AVVISO_ORE,
)

function aggiornaMateriali(nuovi) {
  form.value.materiali = nuovi
}

/**
 * Controlla il valore delle ore prima di inviarlo.
 * @returns {string} messaggio d'errore, oppure stringa vuota
 */
function validaOre() {
  const ore = oreNumeriche.value
  if (!form.value.ore && form.value.ore !== 0) return 'Indica quante ore hai lavorato.'
  if (!Number.isFinite(ore) || ore <= 0) return 'Le ore devono essere maggiori di zero.'
  if (Math.round(ore * 100) % 25 !== 0) {
    return "Le ore vanno indicate a quarti d'ora: 0,25 — 0,5 — 0,75 — 1 e così via."
  }
  if (ore > 999.99) return 'Valore troppo grande: massimo 999,99 ore per lavorazione.'
  return ''
}

async function salva() {
  errore.value = ''

  if (!form.value.giorno) {
    errore.value = 'Indica il giorno.'
    return
  }

  const erroreOre = validaOre()
  if (erroreOre) {
    errore.value = erroreOre
    return
  }

  // L'avviso si mostra una volta sola: confermato, si procede.
  if (oreOltreSoglia.value && !oreDaConfermare.value) {
    oreDaConfermare.value = true
    return
  }

  salvataggio.value = true
  try {
    const payload = {
      giorno: form.value.giorno,
      ore: oreNumeriche.value,
      note: form.value.note || null,
      materiali: form.value.materiali.map((m) => ({
        pezzo_id: m.fuori_catalogo ? null : m.pezzo_id,
        nome_manuale: m.fuori_catalogo ? m.nome_manuale || m.nome : null,
        quantita: Number(m.quantita) || 1,
        fuori_catalogo: !!m.fuori_catalogo,
        prezzo_unitario: Number(m.prezzo_unitario) || 0,
      })),
    }

    if (inModifica.value) {
      await modificaLavorazione(props.rapportino.id, props.lavorazione.id, payload)
    } else {
      await aggiungiLavorazione(props.rapportino.id, payload)
    }
    emit('saved')
    emit('close')
  } catch (err) {
    errore.value = err?.response?.data?.error || 'Non è stato possibile salvare la lavorazione.'
  } finally {
    salvataggio.value = false
  }
}
</script>

<template>
  <div v-if="show" class="modal fade show d-block" tabindex="-1" style="background: rgba(0,0,0,.5)">
    <div class="modal-dialog modal-lg modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <div>
            <h5 class="modal-title mb-0">{{ titolo }}</h5>
            <small v-if="rapportino" class="text-muted">
              {{ rapportino.macchina }} — {{ rapportino.cliente_nome }}
            </small>
          </div>
          <button type="button" class="btn-close" @click="emit('close')"></button>
        </div>

        <div class="modal-body">
          <div v-if="errore" class="alert alert-danger">{{ errore }}</div>

          <div v-if="oreDaConfermare" class="alert alert-warning">
            <strong>{{ form.ore }} ore in una sola giornata.</strong>
            <p class="mb-0 small">
              È un valore alto: verifica che non sia un errore di battitura. Se è corretto,
              premi di nuovo Salva per confermare.
            </p>
          </div>

          <div class="row g-3">
            <div class="col-md-6">
              <label class="form-label">Giorno</label>
              <input v-model="form.giorno" type="date" class="form-control" />
            </div>

            <div class="col-md-6">
              <label class="form-label">
                Ore
                <HelpTooltip
                  text="Quante ore hai lavorato, a quarti d'ora: 0,25 — 0,5 — 0,75 — 1. Non serve indicare l'orario di inizio e fine."
                />
              </label>
              <input
                v-model="form.ore"
                type="number"
                inputmode="decimal"
                step="0.25"
                min="0.25"
                class="form-control"
                placeholder="Es. 4,5"
              />
            </div>

            <div class="col-12">
              <label class="form-label">Note</label>
              <textarea v-model="form.note" class="form-control" rows="2"></textarea>
            </div>

            <div class="col-12">
              <label class="form-label">Materiali utilizzati</label>
              <MaterialeSelector
                :materiali="form.materiali"
                @update:materiali="aggiornaMateriali"
              />
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="emit('close')">Annulla</button>
          <button class="btn btn-primary" :disabled="salvataggio" @click="salva">
            {{ salvataggio ? 'Salvataggio…' : oreDaConfermare ? 'Conferma e salva' : 'Salva' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
