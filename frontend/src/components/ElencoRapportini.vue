<script setup>
import StatoRapportino from './StatoRapportino.vue'

/**
 * Rende un elenco di rapportini nelle DUE forme.
 *
 * Sotto la soglia dei 992px: schede-targhetta. Sopra: tabella. Non sono una
 * l'adattamento dell'altra — sono due disegni con un vocabolario comune. Un
 * disegno unico che si stira produce un compromesso che non serve bene nessuno
 * dei due usi.
 *
 * Cosa sopravvive alla soglia, ed è ciò che porta significato: la striscia di
 * stato, l'allineamento e il peso delle ore, i colori.
 *
 * Il costo di questa scelta è che gli stessi dati compaiono in due punti della
 * marcatura, e due punti divergono. Il controllo in
 * tests/components/ElencoRapportini.test.js verifica che mostrino gli stessi
 * record: senza, la divergenza si scoprirebbe quando un operaio vede una riga
 * che al PC non c'è.
 */
defineProps({
  rapportini: { type: Array, default: () => [] },
  admin: { type: Boolean, default: false },
  selezionati: { type: Array, default: () => [] },
  puoAggiungere: { type: Function, required: true },
  puoConcludere: { type: Function, required: true },
  puoRiaprire: { type: Function, required: true },
  puoEliminare: { type: Function, required: true },
  selezionabile: { type: Function, required: true },
  periodoLeggibile: { type: Function, required: true },
  formattaOre: { type: Function, required: true },
})

const emit = defineEmits([
  'aggiungi',
  'dettaglio',
  'concludi',
  'riapri',
  'elimina',
  'alterna',
])
</script>

<template>
  <div>
    <!-- ══ Sotto la soglia: schede-targhetta ══════════════════════════════ -->
    <div class="d-lg-none">
      <article v-for="r in rapportini" :key="`scheda-${r.id}`" class="of-targhetta">
        <StatoRapportino :stato="r.stato" forma="striscia" />

        <div class="of-targhetta__corpo">
          <p class="of-etichetta mb-1">{{ r.cliente_nome }}</p>

          <div class="d-flex align-items-start gap-3">
            <h3 class="of-targhetta__macchina flex-grow-1">{{ r.macchina }}</h3>
            <div class="text-end flex-shrink-0">
              <div class="of-ore of-ore--grandi">{{ formattaOre(r.totale_ore) }}</div>
              <div class="of-etichetta">ore</div>
            </div>
          </div>

          <p class="of-targhetta__meta" :class="{ 'fst-italic': !r.periodo }">
            {{ periodoLeggibile(r) }}
          </p>
          <p class="of-targhetta__meta mb-0">{{ r.utente_nome }}</p>

          <p class="mt-2 mb-0"><StatoRapportino :stato="r.stato" /></p>

          <!-- L'azione principale sta IN FONDO e a tutta larghezza: con una
               mano sola il pollice arriva lì. È il vincolo dominante, più
               della dimensione dei comandi. -->
          <div class="d-flex flex-column gap-2 mt-3">
            <button
              v-if="puoAggiungere(r)"
              class="btn btn-primary of-azione-primaria"
              @click="emit('aggiungi', r)"
            >
              Aggiungi lavorazione
            </button>

            <div class="d-flex gap-2 of-azioni-frequenti">
              <button
                class="btn btn-outline-secondary flex-fill of-azione-secondaria"
                @click="emit('dettaglio', r)"
              >
                Dettaglio
              </button>
              <button
                v-if="puoConcludere(r)"
                class="btn btn-outline-primary flex-fill of-azione-secondaria"
                @click="emit('concludi', r)"
              >
                Concludi
              </button>
              <button
                v-if="puoRiaprire(r)"
                class="btn btn-outline-secondary flex-fill of-azione-secondaria"
                @click="emit('riapri', r)"
              >
                Riapri
              </button>
            </div>

            <!-- Separata dalle altre: un comando distruttivo non confina con
                 quello che si usa più spesso. -->
            <button
              v-if="puoEliminare(r)"
              class="btn btn-outline-danger of-azione-secondaria mt-2"
              @click="emit('elimina', r)"
            >
              Elimina rapportino
            </button>
          </div>
        </div>
      </article>
    </div>

    <!-- ══ Sopra la soglia: tabella ═══════════════════════════════════════ -->
    <div class="d-none d-lg-block table-responsive">
      <table class="table of-tabella align-middle">
        <thead>
          <tr>
            <th class="of-cella-stato"></th>
            <th v-if="admin" style="width: 2rem"></th>
            <th>Periodo</th>
            <th>Macchinario</th>
            <th>Cliente</th>
            <th>Operaio</th>
            <th class="text-end">Ore</th>
            <th>Stato</th>
            <th class="text-end">Azioni</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rapportini" :key="`riga-${r.id}`">
            <!-- La striscia diventa la prima cella: stessa larghezza e stesso
                 colore che ha sulla scheda. È l'elemento che rende
                 riconoscibile la stessa cosa nelle due forme. -->
            <td class="of-cella-stato">
              <StatoRapportino :stato="r.stato" forma="striscia" />
            </td>
            <td v-if="admin">
              <input
                v-if="selezionabile(r)"
                type="checkbox"
                class="form-check-input"
                :checked="selezionati.includes(r.id)"
                @change="emit('alterna', r.id)"
              />
            </td>
            <td :class="{ 'text-muted fst-italic': !r.periodo }">{{ periodoLeggibile(r) }}</td>
            <td>{{ r.macchina }}</td>
            <td>{{ r.cliente_nome }}</td>
            <td>{{ r.utente_nome }}</td>
            <td class="text-end of-ore of-ore--riga">{{ formattaOre(r.totale_ore) }}</td>
            <td><StatoRapportino :stato="r.stato" /></td>
            <td class="text-end">
              <div class="btn-group btn-group-sm">
                <button
                  v-if="puoAggiungere(r)"
                  class="btn btn-outline-primary"
                  @click="emit('aggiungi', r)"
                >
                  Aggiungi lavorazione
                </button>
                <button class="btn btn-outline-secondary" @click="emit('dettaglio', r)">
                  Dettaglio
                </button>
                <button
                  v-if="puoConcludere(r)"
                  class="btn btn-outline-success"
                  @click="emit('concludi', r)"
                >
                  Concludi
                </button>
                <button
                  v-if="puoRiaprire(r)"
                  class="btn btn-outline-warning"
                  @click="emit('riapri', r)"
                >
                  Riapri
                </button>
                <button
                  v-if="puoEliminare(r)"
                  class="btn btn-outline-danger"
                  @click="emit('elimina', r)"
                >
                  Elimina
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
