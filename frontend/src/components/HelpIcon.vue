<script setup>
defineProps({
  anchor: { type: String, required: true },
})
</script>

<template>
  <router-link
    :to="{ name: 'Guida', hash: '#' + anchor }"
    class="help-icon ms-2 text-muted"
    title="Apri la guida per questa sezione"
    target="_self"
    @click.stop
  >
    <i class="bi bi-question-circle"></i>
  </router-link>
</template>

<style scoped>
.help-icon {
  font-size: 1rem;
  opacity: 0.6;
  text-decoration: none;
  vertical-align: middle;
  transition: opacity 0.15s;
}
.help-icon:hover {
  opacity: 1;
  color: #0d6efd !important;
}
</style>
