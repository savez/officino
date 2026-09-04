<script setup>
import { ref } from 'vue'

// Sul telefono un blocco filtri aperto e' piu' alto della prima scheda: si
// scorre per superarlo prima ancora di vedere un dato. Chiuso di partenza,
// si apre su richiesta. Sul monitor resta sempre aperto — sopra la soglia lo
// spazio non manca e nasconderlo sarebbe un clic in piu' per nulla, percio'
// l'interruttore stesso sparisce (`d-lg-none`).
//
// `attivi` arriva dalla pagina perche' solo lei sa quali dei suoi filtri sono
// impostati: chiuso, il conteggio e' l'unico modo per accorgersi che l'elenco
// che si sta guardando e' gia' ristretto.
defineProps({
  attivi: { type: Number, default: 0 },
  titolo: { type: String, default: 'Filtri' },
})

const aperti = ref(false)
</script>

<template>
  <div class="card mb-3 of-filtri" :class="{ 'of-filtri--aperti': aperti }">
    <button
      type="button"
      class="of-filtri__interruttore d-lg-none"
      :aria-expanded="aperti"
      @click="aperti = !aperti"
    >
      <span>{{ titolo }}</span>
      <span v-if="attivi" class="of-filtri__conteggio">{{ attivi }} attivi</span>
      <i class="bi" :class="aperti ? 'bi-chevron-up' : 'bi-chevron-down'" aria-hidden="true"></i>
    </button>

    <div class="card-body of-filtri__corpo">
      <slot />
    </div>
  </div>
</template>
