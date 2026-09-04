<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { Tooltip } from '../bootstrap-js'

defineProps({
  text: { type: String, required: true },
})

const el = ref(null)
let istanza = null

onMounted(() => {
  if (!el.value) return
  // `focus` e' il trigger che conta: in officina si tocca, non si passa sopra.
  istanza = new Tooltip(el.value, { trigger: 'hover focus' })
})

onBeforeUnmount(() => {
  istanza?.dispose()
  istanza = null
})
</script>

<template>
  <button
    ref="el"
    type="button"
    class="help-tooltip ms-1"
    data-bs-placement="top"
    :title="text"
    :aria-label="text"
  >
    <i class="bi bi-question-circle-fill" aria-hidden="true"></i>
  </button>
</template>

<style scoped>
/* Un bersaglio che si possa centrare col pollice: l'icona da sola e' 14px. */
.help-tooltip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 0;
  background: none;
  color: var(--bs-secondary-color);
  cursor: help;
  line-height: 1;
  vertical-align: middle;
  transition: opacity 0.15s;
  opacity: 0.7;
}
.help-tooltip:hover,
.help-tooltip:focus-visible {
  opacity: 1;
}
</style>
