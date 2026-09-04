<script setup>
import { computed } from 'vue';

const props = defineProps({
  oreMancanti: { type: Array, default: () => [] },
  admin: { type: Boolean, default: false },
});

const totaleOreMancanti = computed(() =>
  props.oreMancanti.reduce((somma, o) => somma + o.ore_mancanti_totali, 0)
);

const totaleGiorniVuoti = computed(() =>
  props.oreMancanti.reduce((somma, o) => somma + o.giorni_vuoti, 0)
);

/**
 * Formatta una data AAAA-MM-GG come "lun 4 mar".
 * @param {string} iso - data in formato AAAA-MM-GG
 * @returns {string} data leggibile
 */
function formattaGiorno(iso) {
  const [anno, mese, giorno] = iso.split('-').map(Number);
  return new Date(anno, mese - 1, giorno).toLocaleDateString('it-IT', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}
</script>

<template>
  <div class="card shadow-sm mb-4">
    <div class="card-header bg-white d-flex align-items-baseline justify-content-between gap-2">
      <h5 class="mb-0">
        {{ admin ? 'Ore mancanti per operaio' : 'Le tue ore mancanti' }}
      </h5>
      <span v-if="oreMancanti.length" class="of-ore of-ore--riga">
        {{ totaleOreMancanti.toFixed(1) }}<span class="of-etichetta ms-1">ore</span>
      </span>
    </div>

    <div class="card-body">
      <p v-if="!oreMancanti.length" class="text-body mb-0">
        Nessun giorno feriale sotto le 8 ore nel periodo selezionato.
      </p>

      <template v-else>
        <p v-if="totaleGiorniVuoti" class="of-targhetta__meta mb-3">
          {{ totaleGiorniVuoti }} giorni sono senza alcun rapportino: possono essere
          ferie, permessi o malattia, che il sistema non conosce.
        </p>

        <div v-for="operaio in oreMancanti" :key="operaio.utente_id" class="of-operaio">
          <div class="d-flex align-items-baseline justify-content-between gap-2">
            <strong>{{ operaio.utente_nome }}</strong>
            <span class="of-ore of-ore--riga">
              {{ operaio.ore_mancanti_totali.toFixed(1) }}<span class="of-etichetta ms-1">mancanti</span>
            </span>
          </div>

          <div class="of-giorni">
            <span
              v-for="g in operaio.giorni"
              :key="g.giorno"
              class="of-giorno"
              :class="{ 'of-giorno--vuoto': g.vuoto }"
              :title="
                g.vuoto
                  ? 'Nessun rapportino caricato'
                  : `${g.ore_caricate} ore su 8, ne mancano ${g.ore_mancanti}`
              "
            >
              {{ formattaGiorno(g.giorno) }}
              <b v-if="!g.vuoto" class="of-ore">{{ g.ore_caricate }}h</b>
              <span v-else class="of-giorno__nulla">nessuna ora</span>
            </span>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
