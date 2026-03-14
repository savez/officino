<script setup>
import { onMounted, ref } from 'vue'

defineProps({
  text: { type: String, required: true },
})

const el = ref(null)

onMounted(() => {
  if (el.value && window.bootstrap?.Tooltip) {
    new window.bootstrap.Tooltip(el.value)
  }
})
</script>

<template>
  <span
    ref="el"
    class="help-tooltip ms-1"
    data-bs-toggle="tooltip"
    data-bs-placement="top"
    :title="text"
    tabindex="0"
  >
    <i class="bi bi-question-circle-fill text-muted"></i>
  </span>
</template>

<style scoped>
.help-tooltip {
  cursor: help;
  font-size: 0.85rem;
  opacity: 0.65;
  transition: opacity 0.15s;
}
.help-tooltip:hover,
.help-tooltip:focus {
  opacity: 1;
}
</style>
