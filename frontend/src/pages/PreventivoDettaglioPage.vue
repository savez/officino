<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PreventivoFormModal from '../components/PreventivoFormModal.vue'
import HelpIcon from '../components/HelpIcon.vue'
import { getPreventivo, cambiaStato, deletePreventivo, duplicaPreventivo, downloadPdf, exportPreventivo } from '../services/preventivi'

const route = useRoute()
const router = useRouter()

const preventivo = ref(null)
const loading = ref(false)
const error = ref('')

// Modal
const showFormModal = ref(false)

// PDF download
const downloadingPdf = ref(false)

// JSON export
const exportingJson = ref(false)

// ── Status config ───────────────────────────────────────────────────

const statoBadgeClass = {
  bozza: 'bg-secondary',
  approvato: 'bg-success',
  rifiutato: 'bg-danger',
  scaduto: 'bg-warning text-dark',
  fatturato: 'bg-info',
  cancellato: 'bg-dark',
}

const statoLabel = {
  bozza: 'Bozza',
  approvato: 'Approvato',
  rifiutato: 'Rifiutato',
  scaduto: 'Scaduto',
  fatturato: 'Fatturato',
  cancellato: 'Cancellato',
}

const isBozza = computed(() => preventivo.value?.stato === 'bozza')
const isApprovato = computed(() => preventivo.value?.stato === 'approvato')

// ── Data Loading ────────────────────────────────────────────────────

async function loadPreventivo() {
  loading.value = true
  error.value = ''

  try {
    preventivo.value = await getPreventivo(route.params.id)
  } catch (err) {
    if (err.response?.status === 404) {
      error.value = 'Preventivo non trovato.'
    } else {
      error.value = 'Errore nel caricamento del preventivo.'
    }
    console.error(err)
  } finally {
    loading.value = false
  }
}

// ── Actions ─────────────────────────────────────────────────────────

function openEdit() {
  showFormModal.value = true
}

function onFormSaved() {
  loadPreventivo()
}

async function onApprova() {
  const ok = window.confirm(
    `Sei sicuro di voler approvare il preventivo ${preventivo.value.numero}?`
  )
  if (!ok) return

  try {
    await cambiaStato(preventivo.value.id, 'approvato')
    await loadPreventivo()
  } catch {
    alert('Errore durante l\'approvazione del preventivo.')
  }
}

async function onRifiuta() {
  const ok = window.confirm(
    `Sei sicuro di voler rifiutare il preventivo ${preventivo.value.numero}?`
  )
  if (!ok) return

  try {
    await cambiaStato(preventivo.value.id, 'rifiutato')
    await loadPreventivo()
  } catch {
    alert('Errore durante il rifiuto del preventivo.')
  }
}

async function onFattura() {
  const ok = window.confirm(
    `Sei sicuro di voler segnare come fatturato il preventivo ${preventivo.value.numero}?`
  )
  if (!ok) return

  try {
    await cambiaStato(preventivo.value.id, 'fatturato')
    await loadPreventivo()
  } catch {
    alert('Errore durante il cambio stato a fatturato.')
  }
}

async function onCancella() {
  const ok = window.confirm(
    `Sei sicuro di voler cancellare il preventivo ${preventivo.value.numero}?\n\nIl preventivo verr\u00E0 segnato come cancellato (non eliminato).`
  )
  if (!ok) return

  try {
    await cambiaStato(preventivo.value.id, 'cancellato')
    await loadPreventivo()
  } catch {
    alert('Errore durante la cancellazione del preventivo.')
  }
}

async function onDuplica() {
  try {
    const result = await duplicaPreventivo(preventivo.value.id)
    router.push({ name: 'PreventivoDettaglio', params: { id: result.id } })
  } catch (err) {
    alert(err.response?.data?.error || 'Errore durante la duplicazione del preventivo.')
  }
}

async function onDelete() {
  const ok = window.confirm(
    `Sei sicuro di voler eliminare il preventivo ${preventivo.value.numero}?\nQuesta azione non \u00E8 reversibile.`
  )
  if (!ok) return

  try {
    await deletePreventivo(preventivo.value.id)
    router.push({ name: 'Preventivi' })
  } catch {
    alert('Errore durante l\'eliminazione del preventivo.')
  }
}

async function onDownloadPdf() {
  downloadingPdf.value = true
  try {
    await downloadPdf(preventivo.value.id)
  } catch (err) {
    alert('Errore durante la generazione del PDF.')
    console.error(err)
  } finally {
    downloadingPdf.value = false
  }
}

async function onExportJson() {
  exportingJson.value = true
  try {
    await exportPreventivo(preventivo.value.id)
  } catch (err) {
    alert('Errore durante l\'esportazione del preventivo.')
    console.error(err)
  } finally {
    exportingJson.value = false
  }
}

function goBack() {
  router.push({ name: 'Preventivi' })
}

// ── Formatting ──────────────────────────────────────────────────────

function formatCurrency(value) {
  if (value === null || value === undefined) return '-'
  return Number(value).toFixed(2) + ' \u20AC'
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`
}

// ── Init ────────────────────────────────────────────────────────────

onMounted(() => {
  loadPreventivo()
})
</script>

<template>
  <div>
    <!-- Back button -->
    <button class="btn btn-outline-secondary btn-sm mb-3" @click="goBack">
      <i class="bi bi-arrow-left me-1"></i>Torna ai Preventivi
    </button>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Caricamento...</span>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="alert alert-danger">{{ error }}</div>

    <!-- Content -->
    <div v-else-if="preventivo">
      <!-- Header -->
      <div class="d-flex flex-wrap justify-content-between align-items-start mb-4">
        <div>
          <h2 class="mb-1">
            Preventivo {{ preventivo.numero }}
            <span class="badge ms-2" :class="statoBadgeClass[preventivo.stato] || 'bg-secondary'">
              {{ statoLabel[preventivo.stato] || preventivo.stato }}
            </span>
            <HelpIcon anchor="preventivi" />
          </h2>
          <p class="text-muted mb-0">Data: {{ formatDate(preventivo.data) }}</p>
        </div>
        <div class="d-flex gap-2 flex-wrap mt-2 mt-md-0">
          <button
            v-if="isBozza"
            class="btn btn-outline-primary btn-sm"
            @click="openEdit"
          >
            <i class="bi bi-pencil me-1"></i>Modifica
          </button>
          <button
            v-if="isBozza"
            class="btn btn-success btn-sm"
            @click="onApprova"
          >
            <i class="bi bi-check-circle me-1"></i>Approva
          </button>
          <button
            v-if="isBozza"
            class="btn btn-outline-danger btn-sm"
            @click="onRifiuta"
          >
            <i class="bi bi-x-circle me-1"></i>Rifiuta
          </button>
          <button
            v-if="isApprovato"
            class="btn btn-info btn-sm"
            @click="onFattura"
          >
            <i class="bi bi-receipt me-1"></i>Fattura
          </button>
          <button
            v-if="isApprovato"
            class="btn btn-outline-dark btn-sm"
            @click="onCancella"
          >
            <i class="bi bi-slash-circle me-1"></i>Cancella
          </button>
          <button
            class="btn btn-outline-secondary btn-sm"
            @click="onDuplica"
          >
            <i class="bi bi-copy me-1"></i>Duplica
          </button>
          <button
            v-if="isBozza"
            class="btn btn-danger btn-sm"
            @click="onDelete"
          >
            <i class="bi bi-trash me-1"></i>Elimina
          </button>
          <button
            class="btn btn-outline-secondary btn-sm"
            :disabled="downloadingPdf"
            @click="onDownloadPdf"
          >
            <span v-if="downloadingPdf" class="spinner-border spinner-border-sm me-1" role="status"></span>
            <i class="bi bi-file-pdf me-1"></i>{{ downloadingPdf ? 'Generazione...' : 'Genera PDF' }}
          </button>
          <button
            class="btn btn-outline-secondary btn-sm"
            :disabled="exportingJson"
            @click="onExportJson"
          >
            <span v-if="exportingJson" class="spinner-border spinner-border-sm me-1" role="status"></span>
            <i class="bi bi-download me-1"></i>{{ exportingJson ? 'Esportazione...' : 'Esporta JSON' }}
          </button>
        </div>
      </div>

      <!-- Cliente info -->
      <div class="card mb-4">
        <div class="card-header">
          <h6 class="mb-0">Cliente</h6>
        </div>
        <div class="card-body">
          <div class="row">
            <div class="col-12 col-md-4">
              <strong>Nome:</strong> {{ preventivo.cliente_nome || '-' }}
            </div>
            <div class="col-12 col-md-4">
              <strong>Codice Fiscale:</strong> {{ preventivo.cliente_codice_fiscale || '-' }}
            </div>
            <div class="col-12 col-md-4">
              <strong>Partita IVA:</strong> {{ preventivo.cliente_partita_iva || '-' }}
            </div>
          </div>
        </div>
      </div>

      <!-- Pezzi -->
      <div class="card mb-4">
        <div class="card-header">
          <h6 class="mb-0">Pezzi</h6>
        </div>
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table table-sm table-striped align-middle mb-0">
              <thead class="table-light">
                <tr>
                  <th>Nome</th>
                  <th class="d-none d-md-table-cell">Marca / Modello</th>
                  <th class="text-end">Quantit&agrave;</th>
                  <th class="text-end">Prezzo Unit.</th>
                  <th class="text-end">Subtotale</th>
                  <th class="d-none d-md-table-cell">Note</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!preventivo.pezzi || preventivo.pezzi.length === 0">
                  <td colspan="6" class="text-center text-muted py-3">
                    Nessun pezzo presente.
                  </td>
                </tr>
                <tr v-for="(p, i) in preventivo.pezzi" :key="i">
                  <td>
                    {{ p.fuori_catalogo ? p.nome_manuale : (p.nome || p.pezzo_nome || '-') }}
                    <span v-if="p.fuori_catalogo" class="badge bg-warning text-dark ms-1">fuori cat.</span>
                  </td>
                  <td class="d-none d-md-table-cell">
                    {{ [p.marca || p.pezzo_marca, p.modello || p.pezzo_modello].filter(Boolean).join(' / ') || '-' }}
                  </td>
                  <td class="text-end">{{ p.quantita }}</td>
                  <td class="text-end">{{ formatCurrency(p.prezzo_unitario) }}</td>
                  <td class="text-end">{{ formatCurrency((p.quantita || 0) * (p.prezzo_unitario || 0)) }}</td>
                  <td class="d-none d-md-table-cell">{{ p.note || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Manodopera -->
      <div class="card mb-4">
        <div class="card-header">
          <h6 class="mb-0">Manodopera</h6>
        </div>
        <div class="card-body">
          <div class="row">
            <div v-if="preventivo.operaio_nome" class="col-12 col-md-3">
              <strong>Operaio:</strong> {{ preventivo.operaio_nome }}
            </div>
            <div class="col-6 col-md-3">
              <strong>Ore:</strong> {{ preventivo.manodopera_ore ?? 0 }}
            </div>
            <div class="col-6 col-md-3">
              <strong>Costo Orario:</strong> {{ formatCurrency(preventivo.manodopera_costo_orario) }}
            </div>
            <div class="col-12 col-md-3">
              <strong>Totale Manodopera:</strong> {{ formatCurrency(preventivo.manodopera_totale) }}
            </div>
          </div>
        </div>
      </div>

      <!-- Riepilogo -->
      <div class="card mb-4">
        <div class="card-header">
          <h6 class="mb-0">Riepilogo Economico</h6>
        </div>
        <div class="card-body">
          <div class="row justify-content-end">
            <div class="col-12 col-md-5 col-lg-4">
              <table class="table table-sm table-borderless mb-0">
                <tbody>
                  <tr>
                    <td class="text-muted">Imponibile:</td>
                    <td class="text-end fw-semibold">{{ formatCurrency(preventivo.imponibile) }}</td>
                  </tr>
                  <tr v-if="preventivo.sconto_calcolato > 0">
                    <td class="text-muted">
                      Sconto
                      <small>({{ preventivo.sconto_tipo === 'percentuale' ? preventivo.sconto_valore + '%' : 'fisso' }})</small>:
                    </td>
                    <td class="text-end text-danger">- {{ formatCurrency(preventivo.sconto_calcolato) }}</td>
                  </tr>
                  <tr>
                    <td class="text-muted">Imponibile Netto:</td>
                    <td class="text-end fw-semibold">{{ formatCurrency(preventivo.imponibile_netto) }}</td>
                  </tr>
                  <tr>
                    <td class="text-muted">IVA ({{ preventivo.aliquota_iva ?? 22 }}%):</td>
                    <td class="text-end">{{ formatCurrency(preventivo.iva) }}</td>
                  </tr>
                  <tr class="border-top">
                    <td class="fw-bold fs-5">Totale:</td>
                    <td class="text-end fw-bold fs-5">{{ formatCurrency(preventivo.totale) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- Note -->
      <div v-if="preventivo.note" class="card mb-4">
        <div class="card-header">
          <h6 class="mb-0">Note</h6>
        </div>
        <div class="card-body">
          <p class="mb-0" style="white-space: pre-wrap">{{ preventivo.note }}</p>
        </div>
      </div>

      <!-- Timestamps -->
      <div class="text-muted small">
        <span v-if="preventivo.created_at">Creato: {{ formatDateTime(preventivo.created_at) }}</span>
        <span v-if="preventivo.updated_at" class="ms-3">Aggiornato: {{ formatDateTime(preventivo.updated_at) }}</span>
      </div>
    </div>

    <!-- Edit Modal -->
    <PreventivoFormModal
      :show="showFormModal"
      :preventivo="preventivo"
      @close="showFormModal = false"
      @saved="onFormSaved"
    />
  </div>
</template>
