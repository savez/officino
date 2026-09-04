<script setup>
import { ref, watch, computed } from 'vue'
import { getRapportino, cancellaLavorazione } from '../services/rapportini'
import { isAdmin } from '../services/auth'
import StatoRapportino from './StatoRapportino.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  rapportinoId: { type: [Number, String], default: null },
})

const emit = defineEmits(['close', 'modifica-lavorazione', 'aggiungi-lavorazione', 'cambiato'])

const dettaglio = ref(null)
const caricamento = ref(false)
const errore = ref('')
const admin = computed(() => isAdmin())

// Il rapportino si modifica se e solo se è aperto. È la stessa regola che il
// server applica: qui serve a non mostrare pulsanti che verrebbero respinti.
const modificabile = computed(() => dettaglio.value?.stato === 'aperto')


watch(
  () => [props.show, props.rapportinoId],
  async ([visibile, id]) => {
    if (!visibile || !id) return
    await carica()
  },
  { immediate: true },
)

async function carica() {
  caricamento.value = true
  errore.value = ''
  try {
    dettaglio.value = await getRapportino(props.rapportinoId)
  } catch (err) {
    errore.value = err?.response?.data?.error || 'Non è stato possibile caricare il rapportino.'
    dettaglio.value = null
  } finally {
    caricamento.value = false
  }
}

async function elimina(lavorazione) {
  if (!confirm(`Eliminare la lavorazione del ${formattaGiorno(lavorazione.giorno)}?`)) return
  try {
    await cancellaLavorazione(props.rapportinoId, lavorazione.id)
    await carica()
    emit('cambiato')
  } catch (err) {
    errore.value = err?.response?.data?.error || "Non è stato possibile eliminare la lavorazione."
  }
}

function formattaGiorno(valore) {
  if (!valore) return '—'
  const d = new Date(valore)
  const giorno = String(d.getDate()).padStart(2, '0')
  const mese = String(d.getMonth() + 1).padStart(2, '0')
  return `${giorno}/${mese}/${d.getFullYear()}`
}

function formattaOre(n) {
  return (Number(n) || 0).toFixed(2).replace('.', ',')
}

function formattaEuro(n) {
  return (Number(n) || 0).toFixed(2)
}
</script>

<template>
  <div v-if="show" class="modal fade show d-block" tabindex="-1" style="background: rgba(0,0,0,.5)">
    <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
      <div class="modal-content">
        <div class="modal-header">
          <div>
            <h5 class="modal-title mb-0">
              {{ dettaglio ? dettaglio.macchina : 'Dettaglio rapportino' }}
            </h5>
            <small v-if="dettaglio" class="text-muted">
              {{ dettaglio.cliente_nome }} — {{ dettaglio.utente_nome }}
            </small>
          </div>
          <button type="button" class="btn-close" @click="emit('close')"></button>
        </div>

        <div class="modal-body">
          <div v-if="caricamento" class="text-center py-4">
            <div class="spinner-border" role="status"></div>
          </div>

          <div v-else-if="errore" class="alert alert-danger">{{ errore }}</div>

          <template v-else-if="dettaglio">
            <div class="d-flex flex-wrap gap-3 align-items-center mb-3">
              <StatoRapportino :stato="dettaglio.stato" />
              <span class="text-muted small">
                Totale ore: <strong>{{ formattaOre(dettaglio.totale_ore) }}</strong>
              </span>
              <span v-if="dettaglio.periodo" class="text-muted small">
                Periodo: {{ formattaGiorno(dettaglio.periodo.da) }} —
                {{ formattaGiorno(dettaglio.periodo.a) }}
              </span>
            </div>

            <div v-if="dettaglio.lavorazioni.length === 0" class="alert alert-light border">
              Nessuna lavorazione registrata. Finché è vuoto il rapportino non può essere
              concluso: aggiungi una lavorazione, oppure eliminalo se l'hai creato per errore.
            </div>

            <div v-for="l in dettaglio.lavorazioni" :key="l.id" class="card mb-2">
              <div class="card-body py-2">
                <div class="d-flex justify-content-between align-items-start">
                  <div>
                    <strong>{{ formattaGiorno(l.giorno) }}</strong>
                    <span class="ms-2">{{ formattaOre(l.ore) }} ore</span>
                    <div v-if="l.note" class="text-muted small mt-1">{{ l.note }}</div>
                  </div>
                  <div v-if="modificabile" class="btn-group btn-group-sm">
                    <button
                      class="btn btn-outline-secondary"
                      @click="emit('modifica-lavorazione', l)"
                    >
                      Modifica
                    </button>
                    <button class="btn btn-outline-danger" @click="elimina(l)">Elimina</button>
                  </div>
                </div>

                <ul v-if="l.materiali.length" class="list-unstyled mb-0 mt-2 small">
                  <li v-for="m in l.materiali" :key="m.id">
                    {{ m.quantita }} × {{ m.nome }}
                    <span v-if="m.fuori_catalogo" class="badge bg-light text-dark">fuori catalogo</span>
                    <span v-if="admin && m.prezzo_unitario !== undefined" class="text-muted">
                      — € {{ formattaEuro(m.totale_materiale) }}
                    </span>
                  </li>
                </ul>

                <div v-if="admin && l.totale_lavorazione !== undefined" class="text-end small mt-1">
                  <span class="text-muted">Manodopera € {{ formattaEuro(l.costo_manodopera) }}</span>
                  <span class="ms-2">
                    <strong>Totale € {{ formattaEuro(l.totale_lavorazione) }}</strong>
                  </span>
                </div>
              </div>
            </div>
          </template>
        </div>

        <div class="modal-footer">
          <button
            v-if="modificabile"
            class="btn btn-outline-primary"
            @click="emit('aggiungi-lavorazione', dettaglio)"
          >
            Aggiungi lavorazione
          </button>
          <button class="btn btn-secondary" @click="emit('close')">Chiudi</button>
        </div>
      </div>
    </div>
  </div>
</template>
