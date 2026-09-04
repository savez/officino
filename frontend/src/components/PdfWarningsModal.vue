<script setup>
/**
 * PdfWarningsModal — mostra all'admin l'elenco di righe e materiali con
 * valori a zero (costo orario o prezzo unitario) prima della generazione
 * del PDF della nota di lavorazione. L'utente deve confermare
 * esplicitamente per procedere (FR-066/FR-067).
 */
import { computed } from 'vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  warnings: {
    type: Object,
    default: () => ({
      has_warnings: false,
      lavorazioni_costo_orario_zero: [],
      materiali_prezzo_zero: [],
    }),
  },
})

const emit = defineEmits(['confirm', 'cancel'])

const lavorazioniZero = computed(() => props.warnings?.lavorazioni_costo_orario_zero || [])
const materialiZero = computed(() => props.warnings?.materiali_prezzo_zero || [])

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}
</script>

<template>
  <div v-if="show" class="modal d-block" tabindex="-1" style="background: rgba(0,0,0,0.5)">
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header bg-warning-subtle">
          <h5 class="modal-title">
            <i class="bi bi-exclamation-triangle me-2"></i>Valori a zero rilevati
          </h5>
          <button type="button" class="btn-close" @click="emit('cancel')"></button>
        </div>
        <div class="modal-body">
          <p>
            Sono presenti righe o materiali con valori a <strong>zero</strong> nella nota.
            Vuoi generare comunque il PDF?
          </p>

          <div v-if="lavorazioniZero.length > 0" class="mb-3" data-testid="lavorazioni-zero-section">
            <h6>Lavorazioni con costo orario a zero</h6>
            <ul class="list-group">
              <li
                v-for="r in lavorazioniZero"
                :key="`lavorazione-${r.lavorazione_id}`"
                class="list-group-item d-flex justify-content-between"
                data-testid="lavorazione-zero-item"
              >
                <span>
                  <strong>{{ formatDate(r.giorno) }}</strong>
                  <span class="text-muted ms-2">{{ r.macchina }}</span>
                  <span class="ms-2">{{ r.ore }}h</span>
                </span>
                <span class="text-muted">{{ r.utente_nome }}</span>
              </li>
            </ul>
          </div>

          <div v-if="materialiZero.length > 0" class="mb-3" data-testid="materiali-zero-section">
            <h6>Materiali con prezzo = 0</h6>
            <ul class="list-group">
              <li
                v-for="m in materialiZero"
                :key="`mat-${m.materiale_id}`"
                class="list-group-item d-flex justify-content-between"
                data-testid="materiale-zero-item"
              >
                <span>
                  {{ m.nome }}
                  <span v-if="m.fuori_catalogo" class="badge bg-secondary ms-2">fuori cat.</span>
                </span>
                <span class="text-muted">lavorazione #{{ m.lavorazione_id }}</span>
              </li>
            </ul>
          </div>
        </div>
        <div class="modal-footer">
          <button
            type="button"
            class="btn btn-outline-secondary"
            data-testid="pdf-warnings-cancel"
            @click="emit('cancel')"
          >
            Annulla
          </button>
          <button
            type="button"
            class="btn btn-warning"
            data-testid="pdf-warnings-confirm"
            @click="emit('confirm')"
          >
            Genera comunque il PDF
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
