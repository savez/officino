<script setup>
import { ref, computed, watch } from 'vue'
import { creaNota, aggiornaNota, getRiassunto } from '../services/note-lavorazione'
import { getRapportino } from '../services/rapportini'

/**
 * La data odierna in formato AAAA-MM-GG.
 * @returns {string}
 */
function oggi() {
  const d = new Date()
  const mese = String(d.getMonth() + 1).padStart(2, '0')
  const giorno = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mese}-${giorno}`
}

const props = defineProps({
  show: { type: Boolean, default: false },
  rapportini: { type: Array, default: () => [] },
  nota: { type: Object, default: null },
})

const emit = defineEmits(['close', 'saved'])

const isEdit = computed(() => !!props.nota?.id)

const errors = ref({})
const saving = ref(false)

/**
 * Stato modificabile per lavorazione. Rispecchia le lavorazioni dei rapportini
 * `costo_orario_applicato` and per-materiale `prezzo_unitario` for the
 * "modifiche_costi" payload built at submit.
 *
 * @typedef {Object} RigaEdit
 * @property {number} id
 * @property {number} ore_lavorate
 * @property {number} costo_orario_applicato      live-editable
 * @property {number} costo_orario_applicato_orig original snapshot
 * @property {Array<{ id:number, nome:string, quantita:number, fuori_catalogo:boolean,
 *                    prezzo_unitario:number, prezzo_unitario_orig:number }>} materiali
 */
const lavorazioniEdit = ref([])

const title = computed(() => (isEdit.value ? 'Modifica Nota di Lavorazione' : 'Nuova Nota di Lavorazione'))

const form = ref({
  testo: '',
  data_riferimento: oggi(),
  mostra_dettaglio_materiali: true,
  mostra_dettaglio_manodopera: false,
  totale_materiali_override: null,
  totale_manodopera_override: null,
  totale_override: null,
  divisione: 'unita',
})

/**
 * Converte un campo del modulo in numero, oppure in null se e' vuoto.
 *
 * Zero deve restare zero: e' un totale imposto - un intervento in garanzia -
 * ed e' diverso da "nessun totale imposto".
 * @param {*} valore - contenuto del campo
 * @returns {number|null}
 */
function numeroOppureNull(valore) {
  if (valore === null || valore === undefined || valore === '') return null
  const n = Number(valore)
  return Number.isFinite(n) ? n : null
}

// La stessa regola che il server applica: un totale imposto spegne il
// dettaglio corrispondente, e quello complessivo li spegne entrambi.
//
// E' duplicata qui perche' durante la composizione la nota non e' ancora
// salvata e non c'e' una risposta del server da usare. Un test enumera gli
// stessi casi del controllo lato server e verifica che le due diano lo stesso
// esito: senza, divergerebbero senza che nessuno se ne accorga.
const dettagliAmmessi = computed(() => {
  if (numeroOppureNull(form.value.totale_override) !== null) {
    return { materiali: false, manodopera: false }
  }
  return {
    materiali: numeroOppureNull(form.value.totale_materiali_override) === null,
    manodopera: numeroOppureNull(form.value.totale_manodopera_override) === null,
  }
})

// Spegne l'interruttore quando il suo override viene impostato: lasciarlo
// acceso e disabilitato manderebbe al server una richiesta che verrebbe
// respinta.
watch(
  () => dettagliAmmessi.value,
  (ammessi) => {
    if (!ammessi.materiali) form.value.mostra_dettaglio_materiali = false
    if (!ammessi.manodopera) form.value.mostra_dettaglio_manodopera = false
  },
  { deep: true },
)

// La domanda su come presentare gli interventi ha senso solo con piu' di un
// rapportino: con uno solo, unione e divisione danno lo stesso documento.
const chiediDivisione = computed(() => (props.rapportini || []).length > 1)

// ── Riassunto precompilato ──────────────────────────────────────────────────
// Il testo lo genera il server. Qui si tiene traccia dell'ultimo generato per
// sapere se quello attuale e' stato scritto a mano: perdere un testo scritto e'
// un danno silenzioso, che si scopre a documento gia' consegnato.
const ultimoGenerato = ref('')
const rigenerazioneInCorso = ref(false)

const riassuntoModificato = computed(
  () => (form.value.testo || '').trim() !== (ultimoGenerato.value || '').trim(),
)

/**
 * Chiede al server il riassunto per i rapportini selezionati.
 * @returns {Promise<string>}
 */
async function chiediRiassunto() {
  const ids = (props.rapportini || []).map((r) => r.id)
  if (ids.length === 0) return ''
  try {
    return await getRiassunto(ids)
  } catch {
    return ''
  }
}

/**
 * Rigenera il riassunto, ma SOLO se quello attuale non e' stato toccato.
 * @returns {Promise<void>}
 */
async function rigeneraSeIntatto() {
  const generato = await chiediRiassunto()
  if (!riassuntoModificato.value) form.value.testo = generato
  ultimoGenerato.value = generato
}

/**
 * Rigenera su richiesta esplicita, avvisando se si sta per sostituire un testo
 * scritto a mano.
 * @returns {Promise<void>}
 */
async function rigeneraSuRichiesta() {
  if (
    riassuntoModificato.value &&
    !confirm('Il riassunto è stato modificato a mano. Sostituirlo con le note delle lavorazioni?')
  ) {
    return
  }
  rigenerazioneInCorso.value = true
  try {
    const generato = await chiediRiassunto()
    form.value.testo = generato
    ultimoGenerato.value = generato
  } finally {
    rigenerazioneInCorso.value = false
  }
}


const clienteNome = computed(() => {
  if (props.nota?.cliente_nome) return props.nota.cliente_nome
  if (props.rapportini.length > 0) return props.rapportini[0].cliente_nome
  return ''
})

const clienteId = computed(() => {
  if (props.nota?.cliente_id) return props.nota.cliente_id
  if (props.rapportini.length > 0) return props.rapportini[0].cliente_id
  return null
})


/**
 * Round a number to 2 decimals using bankers-friendly half-up.
 * @param {number} n
 * @returns {number}
 */
function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

/**
 * Format a number as a 2-decimal display string.
 * @param {number} n
 * @returns {string}
 */
function fmt(n) {
  return (Number(n) || 0).toFixed(2)
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

const oreTotali = computed(() =>
  lavorazioniEdit.value.reduce((s, r) => s + r.ore_lavorate, 0),
)

/**
 * Per-riga subtotale materiali (live).
 * @param {RigaEdit} r
 */
function subtotaleMateriali(r) {
  return round2(
    (r.materiali || []).reduce(
      (s, m) => s + (Number(m.prezzo_unitario) || 0) * (Number(m.quantita) || 0),
      0,
    ),
  )
}

/**
 * Per-riga costo manodopera (live).
 * @param {RigaEdit} r
 */
function costoManodopera(r) {
  return round2((Number(r.costo_orario_applicato) || 0) * (Number(r.ore_lavorate) || 0))
}

/**
 * Per-riga totale (live).
 * @param {RigaEdit} r
 */
function totaleRiga(r) {
  return round2(subtotaleMateriali(r) + costoManodopera(r))
}

const totaleMateriali = computed(() =>
  round2(lavorazioniEdit.value.reduce((s, r) => s + subtotaleMateriali(r), 0)),
)
const totaleManodopera = computed(() =>
  round2(lavorazioniEdit.value.reduce((s, r) => s + costoManodopera(r), 0)),
)
const totaleCalcolato = computed(() =>
  round2(totaleMateriali.value + totaleManodopera.value),
)

const overrideAttivo = computed(
  () => form.value.totale_override !== null && form.value.totale_override !== '',
)

const overrideDiscrepanza = computed(() => {
  if (!overrideAttivo.value) return false
  return round2(Number(form.value.totale_override)) !== totaleCalcolato.value
})

/**
 * Build the `modifiche_costi[]` payload diffing live values vs original
 * snapshots loaded into `lavorazioniEdit`. See contract NotaUpdateInput.
 * @returns {Array<object>}
 */
function buildModificheCosti() {
  const out = []
  for (const r of lavorazioniEdit.value) {
    if (round2(r.costo_orario_applicato) !== round2(r.costo_orario_applicato_orig)) {
      out.push({
        tipo: 'lavorazione_costo_orario',
        lavorazione_id: r.id,
        costo_orario_applicato: round2(r.costo_orario_applicato),
      })
    }
    for (const m of r.materiali || []) {
      if (round2(m.prezzo_unitario) !== round2(m.prezzo_unitario_orig)) {
        out.push({
          tipo: 'materiale_prezzo',
          materiale_id: m.id,
          prezzo_unitario: round2(m.prezzo_unitario),
        })
      }
    }
  }
  return out
}

/**
 * Popola `lavorazioniEdit` dai rapportini selezionati, fotografando i
 * original prices/costs so diffs at submit time are correct.
 */
async function ricostruisciLavorazioni() {
  // L'elenco dei rapportini non porta con sé le lavorazioni: vanno chieste.
  // Sono poche — quelle selezionate — e chiederle qui evita di appesantire
  // l'elenco per tutti quando serve solo a chi compila una nota.
  const dettagli = await Promise.all(
    (props.rapportini || []).map((r) => getRapportino(r.id).catch(() => null)),
  )

  lavorazioniEdit.value = dettagli.filter(Boolean).flatMap((rapportino) =>
    (rapportino.lavorazioni || []).map((l) => {
      const costo = Number(l.costo_orario_applicato) || 0
      return {
        id: l.id,
        rapportino_id: rapportino.id,
        // Il macchinario sta sul rapportino: portarlo qui serve a distinguere
        // le lavorazioni di interventi diversi dentro la stessa nota.
        macchina: rapportino.macchina,
        utente_nome: rapportino.utente_nome,
        giorno: l.giorno,
        ore_lavorate: Number(l.ore) || 0,
        costo_orario_applicato: costo,
        costo_orario_applicato_orig: costo,
        materiali: (l.materiali || []).map((m) => {
          const p = Number(m.prezzo_unitario) || 0
          return {
            id: m.id,
            nome: m.nome,
            quantita: Number(m.quantita) || 0,
            fuori_catalogo: !!m.fuori_catalogo,
            prezzo_unitario: p,
            prezzo_unitario_orig: p,
          }
        }),
      }
    }),
  )
}

watch(
  () => props.show,
  (visible) => {
    if (visible) {
      errors.value = {}
      if (props.nota) {
        form.value = {
          testo: props.nota.testo || '',
          data_riferimento: (props.nota.data_riferimento || oggi()).slice(0, 10),
          mostra_dettaglio_materiali: Boolean(props.nota.mostra_dettaglio_materiali),
          mostra_dettaglio_manodopera: Boolean(props.nota.mostra_dettaglio_manodopera),
          totale_materiali_override: props.nota.totale_materiali_override ?? null,
          totale_manodopera_override: props.nota.totale_manodopera_override ?? null,
          totale_override: props.nota.totale_override ?? null,
          divisione: props.nota.divisione || 'unita',
        }
      } else {
        form.value = {
          testo: '',
          data_riferimento: oggi(),
          mostra_dettaglio_materiali: true,
          mostra_dettaglio_manodopera: false,
          totale_materiali_override: null,
          totale_manodopera_override: null,
          totale_override: null,
          divisione: 'unita',
        }
      }
      ricostruisciLavorazioni()
      // All'apertura in creazione il riassunto parte generato; in modifica il
      // testo salvato resta, e `ultimoGenerato` serve solo a capire se e' stato
      // scritto a mano.
      chiediRiassunto().then((generato) => {
        ultimoGenerato.value = generato
        if (!props.nota && !form.value.testo) form.value.testo = generato
      })
    }
  },
  { immediate: true }
)

watch(
  () => props.rapportini,
  () => {
    if (!props.show) return
    ricostruisciLavorazioni()
    // Rigenera SOLO cio' che non e' stato toccato. Un testo scritto a mano che
    // sparisce e' un danno silenzioso: si scopre a documento consegnato.
    rigeneraSeIntatto()
  },
  { deep: false },
)

/**
 * Submit handler: builds the create/update payload according to
 * il contratto della feature 022 (data di riferimento, due interruttori,
 * modifiche_costi[]) and calls the appropriate service.
 * @returns {Promise<void>}
 */
async function onSubmit() {
  errors.value = {}

  const override =
    form.value.totale_override === null || form.value.totale_override === ''
      ? null
      : Number(form.value.totale_override)

  if (override !== null && (Number.isNaN(override) || override < 0)) {
    errors.value = { totale_override: 'Il totale override deve essere ≥ 0.' }
    return
  }

  saving.value = true
  try {
    const rapportiniIds = props.rapportini.map((r) => r.id)

    if (isEdit.value) {
      await aggiornaNota(props.nota.id, {
        testo: form.value.testo || null,
        data_riferimento: form.value.data_riferimento,
        mostra_dettaglio_materiali: form.value.mostra_dettaglio_materiali,
        mostra_dettaglio_manodopera: form.value.mostra_dettaglio_manodopera,
        totale_materiali_override: numeroOppureNull(form.value.totale_materiali_override),
        totale_manodopera_override: numeroOppureNull(form.value.totale_manodopera_override),
        totale_override: override,
        divisione: form.value.divisione,
        rapportini_ids: rapportiniIds,
        modifiche_costi: buildModificheCosti(),
      })
    } else {
      await creaNota({
        cliente_id: clienteId.value,
        testo: form.value.testo || null,
        data_riferimento: form.value.data_riferimento,
        mostra_dettaglio_materiali: form.value.mostra_dettaglio_materiali,
        mostra_dettaglio_manodopera: form.value.mostra_dettaglio_manodopera,
        totale_materiali_override: numeroOppureNull(form.value.totale_materiali_override),
        totale_manodopera_override: numeroOppureNull(form.value.totale_manodopera_override),
        totale_override: override,
        divisione: form.value.divisione,
        rapportini_ids: rapportiniIds,
      })
    }

    emit('saved')
    emit('close')
  } catch (err) {
    errors.value = { general: err.response?.data?.error || 'Errore durante il salvataggio.' }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div
    v-if="show"
    class="modal fade show d-block"
    tabindex="-1"
    role="dialog"
    style="background-color: rgba(0, 0, 0, 0.5)"
    @click.self="emit('close')"
  >
    <div class="modal-dialog modal-xl modal-dialog-scrollable" style="max-height: 90vh">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">{{ title }}</h5>
          <button type="button" class="btn-close" @click="emit('close')"></button>
        </div>

        <form @submit.prevent="onSubmit" class="d-flex flex-column overflow-hidden">
          <div class="modal-body overflow-auto">
            <div v-if="errors.general" class="alert alert-danger">{{ errors.general }}</div>

            <!-- Cliente (readonly) -->
            <div class="mb-3">
              <label class="form-label">Cliente</label>
              <input type="text" class="form-control" :value="clienteNome" disabled />
            </div>

            <!-- Summary -->
            <div class="alert alert-info">
              <strong>{{ lavorazioniEdit.length }}</strong> righe selezionate |
              <strong>{{ oreTotali }}h</strong> totali
            </div>

            <!-- Costi panel (US5) -->
            <div class="mb-3" data-testid="nota-costi-panel">
              <label class="form-label">Dettaglio costi righe</label>
              <div
                v-for="r in lavorazioniEdit"
                :key="r.id"
                class="card mb-2"
                :data-testid="`riga-${r.id}`"
              >
                <div class="card-body p-2">
                  <div class="row g-2 align-items-center mb-2">
                    <div class="col-md-3 small">
                      <strong>{{ formatDate(r.giorno) }}</strong>
                      <span class="text-muted ms-1 d-block">{{ r.macchina }}</span>
                    </div>
                    <div class="col-md-3 small">
                      <i class="bi bi-person me-1"></i>{{ r.utente_nome }}
                    </div>
                    <div class="col-md-2 small">
                      <i class="bi bi-clock me-1"></i>{{ r.ore_lavorate }}h
                    </div>
                    <div class="col-md-4">
                      <div class="input-group input-group-sm">
                        <span class="input-group-text">Costo orario</span>
                        <input
                          v-model.number="r.costo_orario_applicato"
                          type="number"
                          inputmode="decimal"
                          step="0.01"
                          min="0"
                          class="form-control"
                          :data-testid="`riga-${r.id}-costo-orario`"
                        />
                        <span class="input-group-text">€/h</span>
                      </div>
                    </div>
                  </div>

                  <table v-if="r.materiali.length > 0" class="table table-sm mb-2">
                    <thead>
                      <tr class="small text-muted">
                        <th>Materiale</th>
                        <th style="width: 80px">Q.tà</th>
                        <th style="width: 140px">Prezzo unit. €</th>
                        <th style="width: 120px" class="text-end">Totale €</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="m in r.materiali" :key="m.id">
                        <td>
                          {{ m.nome }}
                          <span v-if="m.fuori_catalogo" class="badge bg-warning text-dark ms-1">
                            fuori cat.
                          </span>
                        </td>
                        <td>{{ m.quantita }}</td>
                        <td>
                          <input
                            v-model.number="m.prezzo_unitario"
                            type="number"
                            inputmode="decimal"
                            step="0.01"
                            min="0"
                            class="form-control form-control-sm"
                            :data-testid="`materiale-${m.id}-prezzo`"
                          />
                        </td>
                        <td class="text-end">
                          {{ fmt((Number(m.prezzo_unitario) || 0) * (Number(m.quantita) || 0)) }}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div class="row small text-end">
                    <div class="col-12 col-md-4">
                      Subtotale materiali:
                      <strong :data-testid="`riga-${r.id}-subtotale-materiali`">
                        € {{ fmt(subtotaleMateriali(r)) }}
                      </strong>
                    </div>
                    <div class="col-12 col-md-4">
                      Manodopera:
                      <strong :data-testid="`riga-${r.id}-manodopera`">
                        € {{ fmt(costoManodopera(r)) }}
                      </strong>
                    </div>
                    <div class="col-12 col-md-4">
                      Totale riga:
                      <strong :data-testid="`riga-${r.id}-totale`">
                        € {{ fmt(totaleRiga(r)) }}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Totali globali -->
            <div class="card bg-light mb-3">
              <div class="card-body py-2">
                <div class="row text-end">
                  <div class="col-md-4 small">
                    Totale materiali:
                    <strong data-testid="totale-materiali">€ {{ fmt(totaleMateriali) }}</strong>
                  </div>
                  <div class="col-md-4 small">
                    Totale manodopera:
                    <strong data-testid="totale-manodopera">€ {{ fmt(totaleManodopera) }}</strong>
                  </div>
                  <div class="col-md-4">
                    Totale calcolato:
                    <strong data-testid="totale-calcolato">€ {{ fmt(totaleCalcolato) }}</strong>
                  </div>
                </div>
              </div>
            </div>

            <!-- Cosa mostrare nel documento: due scelte indipendenti -->
            <div class="mb-3">
              <label class="form-label d-block">Cosa mostrare nel documento</label>
              <div class="form-check">
                <input
                  id="dettMateriali"
                  v-model="form.mostra_dettaglio_materiali"
                  class="form-check-input"
                  type="checkbox"
                  :disabled="!dettagliAmmessi.materiali"
                  data-testid="dettaglio-materiali"
                />
                <label class="form-check-label" for="dettMateriali">
                  Dettaglio dei materiali, col suo totale
                </label>
              </div>
              <div class="form-check">
                <input
                  id="dettManodopera"
                  v-model="form.mostra_dettaglio_manodopera"
                  class="form-check-input"
                  type="checkbox"
                  :disabled="!dettagliAmmessi.manodopera"
                  data-testid="dettaglio-manodopera"
                />
                <label class="form-check-label" for="dettManodopera">
                  Dettaglio della manodopera, col suo totale
                </label>
              </div>
              <div
                v-if="!dettagliAmmessi.materiali || !dettagliAmmessi.manodopera"
                class="form-text"
                data-testid="motivo-dettagli-spenti"
              >
                Un totale imposto a mano spegne il dettaglio corrispondente: le sue righe non
                sommerebbero a quel valore.
              </div>
            </div>

            <!-- Totali imposti di sezione -->
            <div class="row g-2 mb-3">
              <div class="col-md-6">
                <label class="form-label">Totale materiali imposto</label>
                <input
                  v-model="form.totale_materiali_override"
                  type="number"
                  inputmode="decimal"
                  step="0.01"
                  min="0"
                  class="form-control"
                  placeholder="lascia vuoto per il calcolato"
                  data-testid="override-materiali"
                />
              </div>
              <div class="col-md-6">
                <label class="form-label">Totale manodopera imposto</label>
                <input
                  v-model="form.totale_manodopera_override"
                  type="number"
                  inputmode="decimal"
                  step="0.01"
                  min="0"
                  class="form-control"
                  placeholder="lascia vuoto per il calcolato"
                  data-testid="override-manodopera"
                />
              </div>
            </div>

            <!-- Unione o divisione, solo con piu' di un rapportino -->
            <div v-if="chiediDivisione" class="mb-3" data-testid="scelta-divisione">
              <label class="form-label d-block">Come presentare gli interventi</label>
              <div class="form-check form-check-inline">
                <input
                  id="divUnita"
                  v-model="form.divisione"
                  class="form-check-input"
                  type="radio"
                  value="unita"
                  data-testid="divisione-unita"
                />
                <label class="form-check-label" for="divUnita">Tutto insieme</label>
              </div>
              <div class="form-check form-check-inline">
                <input
                  id="divMacchinario"
                  v-model="form.divisione"
                  class="form-check-input"
                  type="radio"
                  value="per_macchinario"
                  data-testid="divisione-macchinario"
                />
                <label class="form-check-label" for="divMacchinario">
                  Diviso per macchinario
                </label>
              </div>
            </div>

            <!-- Totale override -->
            <div class="mb-3">
              <label class="form-label">
                Totale override (lascia vuoto per usare il totale calcolato)
              </label>
              <div class="input-group">
                <span class="input-group-text">€</span>
                <input
                  v-model.number="form.totale_override"
                  type="number"
                  inputmode="decimal"
                  step="0.01"
                  min="0"
                  class="form-control"
                  :class="{ 'is-invalid': errors.totale_override }"
                  data-testid="totale-override"
                  placeholder="(nessun override)"
                />
                <span
                  v-if="overrideAttivo"
                  class="input-group-text bg-info text-white"
                  data-testid="override-attivo-badge"
                >Override attivo</span>
                <span
                  v-if="overrideDiscrepanza"
                  class="input-group-text bg-warning text-dark"
                  data-testid="override-discrepanza-badge"
                >Discrepanza</span>
              </div>
              <div v-if="errors.totale_override" class="invalid-feedback d-block">
                {{ errors.totale_override }}
              </div>
            </div>

            <!-- Data di riferimento -->
            <div class="mb-3">
              <label class="form-label">Data di riferimento</label>
              <input
                v-model="form.data_riferimento"
                type="date"
                class="form-control"
                data-testid="data-riferimento"
              />
              <div class="form-text">
                La data a cui il lavoro si riferisce, non quella in cui stai preparando il
                documento. Compare nel titolo.
              </div>
            </div>

            <!-- Testo riassunto -->
            <div class="mb-3">
              <div class="d-flex justify-content-between align-items-center">
                <label class="form-label mb-0">Riassunto / Note</label>
                <button
                  type="button"
                  class="btn btn-sm btn-outline-secondary"
                  :disabled="rigenerazioneInCorso"
                  data-testid="rigenera-riassunto"
                  @click="rigeneraSuRichiesta"
                >
                  <i class="bi bi-arrow-clockwise me-1"></i>Rigenera dalle note
                </button>
              </div>
              <textarea
                v-model="form.testo"
                class="form-control mt-1"
                rows="4"
                placeholder="Riassunto delle lavorazioni..."
              ></textarea>
              <div class="form-text">
                Precompilato con le note che gli operai hanno scritto, raggruppate per giorno.
                <span v-if="riassuntoModificato" data-testid="riassunto-modificato">
                  L'hai modificato: non verrà più rigenerato da solo.
                </span>
              </div>
            </div>

          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="emit('close')" :disabled="saving">
              <i class="bi bi-x-lg me-1"></i>Annulla
            </button>
            <button type="submit" class="btn btn-success" :disabled="saving">
              <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>
              <i class="bi bi-check-lg me-1"></i>{{ isEdit ? 'Salva Modifiche' : 'Crea Nota' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
