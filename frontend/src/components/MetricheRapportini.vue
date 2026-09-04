<script setup>
import { computed } from 'vue';
import StatoRapportino from './StatoRapportino.vue';

// I tre stati riusano `StatoRapportino`, che e' l'unico posto in cui il colore
// di uno stato viene deciso. Ridichiararli qui darebbe la stessa schermata due
// tavolozze per la stessa cosa, ed e' esattamente cio' che la regola «un
// colore, un significato» esiste per impedire.
//
// «Senza lavorazioni» NON e' uno stato e non prende colore: e' un contenitore
// creato e mai compilato. Si distingue per forma — un filo tratteggiato — come
// gia' fanno i giorni vuoti nel pannello delle ore mancanti.
const props = defineProps({
  conteggi: {
    type: Object,
    required: true,
  },
});

const STATI = [
  { chiave: 'aperti', stato: 'aperto' },
  { chiave: 'chiusi', stato: 'chiuso' },
  { chiave: 'gestiti', stato: 'gestito' },
];

const voci = computed(() => STATI.map((s) => ({ ...s, numero: props.conteggi?.[s.chiave] ?? 0 })));

const vuoti = computed(() => props.conteggi?.senza_lavorazioni ?? 0);
const nessuno = computed(() => voci.value.every((v) => v.numero === 0) && vuoti.value === 0);
</script>

<template>
  <div class="card shadow-sm mb-4 of-metriche">
    <div class="card-header bg-white">
      <strong><i class="bi bi-clipboard-data me-2 text-primary"></i>Rapportini nel periodo</strong>
    </div>
    <div class="card-body">
      <p v-if="nessuno" class="text-body mb-0">Nessun rapportino nel periodo selezionato.</p>

      <div v-else class="of-metriche__griglia">
        <div v-for="v in voci" :key="v.chiave" class="of-metriche__voce">
          <span class="of-metriche__numero">{{ v.numero }}</span>
          <StatoRapportino :stato="v.stato" />
        </div>

        <div class="of-metriche__voce of-metriche__voce--vuoti">
          <span class="of-metriche__numero">{{ vuoti }}</span>
          <span class="of-metriche__etichetta">Senza lavorazioni</span>
        </div>
      </div>

      <p v-if="!nessuno" class="of-metriche__nota mb-0">
        I rapportini senza lavorazioni non hanno una data, quindi nessun periodo può escluderli:
        sono contati a parte e compaiono sempre. Sommandoli agli altri tre si ottiene il numero che
        mostra l'elenco dei rapportini.
      </p>
    </div>
  </div>
</template>
