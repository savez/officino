<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  da: { type: String, required: true },
  a: { type: String, required: true },
  disabled: { type: Boolean, default: false },
});

const emit = defineEmits(['update:periodo']);

const daLocale = ref(props.da);
const aLocale = ref(props.a);

watch(
  () => [props.da, props.a],
  ([nuovoDa, nuovoA]) => {
    daLocale.value = nuovoDa;
    aLocale.value = nuovoA;
  }
);

// Stesso limite del backend: qui serve a dare un messaggio subito, invece di
// far scoprire il rifiuto solo dopo il viaggio di rete.
const AMPIEZZA_MASSIMA_GIORNI = 400;

const SCORCIATOIE = [
  { valore: 'questo-mese', etichetta: 'Questo mese' },
  { valore: 'mese-scorso', etichetta: 'Mese scorso' },
  { valore: 'ultimi-30-giorni', etichetta: 'Ultimi 30 giorni' },
  { valore: 'quest-anno', etichetta: "Quest'anno" },
];

const errore = computed(() => {
  if (!daLocale.value || !aLocale.value) return 'Servono entrambe le date.';
  if (aLocale.value < daLocale.value) return 'La data finale è precedente a quella iniziale.';

  const giorni = Math.round((new Date(aLocale.value) - new Date(daLocale.value)) / 86400000) + 1;
  if (giorni > AMPIEZZA_MASSIMA_GIORNI) {
    return `Intervallo troppo ampio: ${giorni} giorni, il massimo è ${AMPIEZZA_MASSIMA_GIORNI}.`;
  }
  return '';
});

function applica() {
  if (errore.value) return;
  emit('update:periodo', { da: daLocale.value, a: aLocale.value });
}

/**
 * Formatta una data come AAAA-MM-GG nel fuso locale.
 *
 * Non si usa toISOString(): converte in UTC e in Italia farebbe slittare la
 * data al giorno precedente per tutta la sera.
 * @param {Date} d - data da formattare
 * @returns {string} data in formato AAAA-MM-GG
 */
function formatta(d) {
  const anno = d.getFullYear();
  const mese = String(d.getMonth() + 1).padStart(2, '0');
  const giorno = String(d.getDate()).padStart(2, '0');
  return `${anno}-${mese}-${giorno}`;
}

/**
 * Risolve una scorciatoia in un intervallo concreto.
 * @param {string} nome - nome della scorciatoia
 * @param {Date} oggi - data di riferimento
 * @returns {{da: string, a: string}} intervallo risolto
 */
function risolvi(nome, oggi) {
  const anno = oggi.getFullYear();
  const mese = oggi.getMonth();

  switch (nome) {
    case 'questo-mese':
      // Giorno 0 del mese successivo e' l'ultimo del mese corrente: evita di
      // dover conoscere la lunghezza dei mesi e gli anni bisestili.
      return { da: formatta(new Date(anno, mese, 1)), a: formatta(new Date(anno, mese + 1, 0)) };
    case 'mese-scorso':
      return { da: formatta(new Date(anno, mese - 1, 1)), a: formatta(new Date(anno, mese, 0)) };
    case 'ultimi-30-giorni':
      return { da: formatta(new Date(anno, mese, oggi.getDate() - 29)), a: formatta(oggi) };
    case 'quest-anno':
      return { da: formatta(new Date(anno, 0, 1)), a: formatta(oggi) };
    default:
      return null;
  }
}

/**
 * Applica una scorciatoia.
 *
 * Il componente risolve la scorciatoia in date concrete ed emette SEMPRE
 * { da, a }. In precedenza emetteva il nome della scorciatoia, lasciando a chi
 * lo usava il compito di inoltrarlo e di ri-sincronizzare le date dalla
 * risposta del server: un contratto che si e' rotto al primo riuso, lasciando
 * i campi vuoti e facendo comparire un messaggio d'errore.
 *
 * Il server continua a validare l'intervallo che riceve: qui si decide quale
 * periodo si intende, non se e' accettabile.
 * @param {string} valore - nome della scorciatoia
 */
function applicaScorciatoia(valore) {
  const intervallo = risolvi(valore, new Date());
  if (!intervallo) return;

  daLocale.value = intervallo.da;
  aLocale.value = intervallo.a;
  emit('update:periodo', intervallo);
}
</script>

<template>
  <div class="of-periodo">
    <!-- Sul telefono i due campi stanno su una riga da metà ciascuno, con
         l'etichetta sopra: prima andavano a capo a caso perché ogni pezzo era
         una colonna «auto» che cercava spazio per conto suo.
         Sul monitor tornano in linea, dove lo spazio c'è. -->
    <div class="of-periodo__date">
      <div class="of-periodo__campo">
        <label class="of-etichetta d-block mb-1">Dal</label>
        <input
          v-model="daLocale"
          type="date"
          class="form-control"
          :disabled="disabled"
          :class="{ 'is-invalid': errore }"
          @change="applica"
        />
      </div>

      <div class="of-periodo__campo">
        <label class="of-etichetta d-block mb-1">Al</label>
        <input
          v-model="aLocale"
          type="date"
          class="form-control"
          :disabled="disabled"
          :class="{ 'is-invalid': errore }"
          @change="applica"
        />
      </div>
    </div>

    <!-- Le scorciatoie vanno a capo per conto loro invece di comprimersi in un
         gruppo unico che sul telefono diventa illeggibile. -->
    <div class="of-periodo__scorciatoie" role="group" aria-label="Periodi rapidi">
      <button
        v-for="s in SCORCIATOIE"
        :key="s.valore"
        type="button"
        class="btn btn-outline-secondary"
        :disabled="disabled"
        @click="applicaScorciatoia(s.valore)"
      >
        {{ s.etichetta }}
      </button>
    </div>

    <slot />

    <div v-if="errore" class="text-danger small mt-2">{{ errore }}</div>
  </div>
</template>
