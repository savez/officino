<script setup>
import { computed } from 'vue';

const props = defineProps({
  note: {
    type: Object,
    required: true,
  },
});

const numero = computed(() => props.note?.numero ?? 0);

// `null` non e' zero. Il server lo usa quando un filtro per operaio rende
// l'importo non attribuibile: distinguere i due casi e' l'intero motivo per cui
// la chiave arriva valorizzata a `null` invece di essere assente.
const importoAssente = computed(() => props.note?.importo === null);
const importo = computed(() =>
  importoAssente.value
    ? null
    : new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(
        props.note?.importo ?? 0
      )
);
</script>

<template>
  <div class="card shadow-sm mb-4 of-metriche">
    <div class="card-header bg-white">
      <strong><i class="bi bi-file-earmark-text me-2 text-primary"></i>Note di lavorazione</strong>
    </div>
    <div class="card-body">
      <div class="of-metriche__griglia">
        <div class="of-metriche__voce">
          <span class="of-metriche__numero">{{ numero }}</span>
          <span class="of-metriche__etichetta">
            {{ numero === 1 ? 'emessa nel periodo' : 'emesse nel periodo' }}
          </span>
        </div>

        <div v-if="!importoAssente" class="of-metriche__voce">
          <span class="of-metriche__numero of-metriche__numero--importo">{{ importo }}</span>
          <span class="of-metriche__etichetta">totale del periodo</span>
        </div>
      </div>

      <!-- Un valore che sparisce senza spiegazione si legge come un guasto. -->
      <p v-if="importoAssente" class="of-metriche__nota mb-0">
        L'importo non è mostrato perché è attivo un filtro per operaio. Una nota raccoglie i
        rapportini di un cliente e può contenere il lavoro di più persone: il totale del documento
        non è la quota di chi lo ha in parte prodotto.
      </p>
    </div>
  </div>
</template>
