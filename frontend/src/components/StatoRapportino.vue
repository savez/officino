<script setup>
import { computed } from 'vue'

/**
 * Rende lo stato di un rapportino.
 *
 * È l'UNICO posto in cui il colore di uno stato viene deciso. La promessa «un
 * colore, un significato» non si mantiene con la disciplina: basta una pagina
 * che sceglie da sé perché salti, e nessuno se ne accorge finché due schermate
 * non mostrano lo stesso stato in due modi.
 */
const props = defineProps({
  stato: { type: String, required: true },
  // `striscia` per la scheda, `etichetta` per la tabella e i titoli.
  forma: { type: String, default: 'etichetta' },
})

const STATI = {
  aperto: { colore: 'var(--of-ottone)', testo: 'Aperto' },
  chiuso: { colore: 'var(--of-abete)', testo: 'Concluso' },
  gestito: { colore: 'var(--of-ardesia)', testo: 'In nota di lavorazione' },
}

// Uno stato sconosciuto non rende nulla di colorato e mostra il valore grezzo:
// meglio un'etichetta strana che un colore sbagliato, che significherebbe
// un'altra cosa.
const noto = computed(() => Object.prototype.hasOwnProperty.call(STATI, props.stato))
const colore = computed(() => (noto.value ? STATI[props.stato].colore : 'var(--of-tenue)'))
const testo = computed(() => (noto.value ? STATI[props.stato].testo : props.stato))
const striscia = computed(() => props.forma === 'striscia')
</script>

<!--
  Il template ha UNA sola radice, e nessun commento al suo interno: un commento
  dentro <template> conta come nodo radice e rende il componente un frammento,
  con la conseguenza che gli strumenti di prova non leggono più né classi né
  attributi. I controlli che verificano il colore diventerebbero ciechi senza
  fallire, che è il modo peggiore in cui un test può rompersi.

  La striscia porta il colore; l'etichetta scritta la accompagna SEMPRE, perché
  lo stato non deve dipendere dal solo colore. Nella forma a striscia il testo
  non si vede ma viene annunciato.
-->
<template>
  <span
    :class="striscia ? 'of-striscia' : 'of-stato-testo'"
    :style="striscia ? { backgroundColor: colore } : { color: colore }"
    :role="striscia ? 'img' : null"
    :aria-label="striscia ? `Stato: ${testo}` : null"
    >{{ striscia ? '' : testo }}</span
  >
</template>
