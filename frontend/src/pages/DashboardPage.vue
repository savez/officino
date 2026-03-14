<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { getCurrentUser, isAdmin } from '../services/auth'
import { getDashboardStats, exportOreExcel } from '../services/dashboard'
import HelpIcon from '../components/HelpIcon.vue'
import PreventiviDoughnutChart from '../components/charts/PreventiviDoughnutChart.vue'
import OrePerClienteBarChart from '../components/charts/OrePerClienteBarChart.vue'
import OrePerOperaioBarChart from '../components/charts/OrePerOperaioBarChart.vue'
import OreGestiteBarChart from '../components/charts/OreGestiteBarChart.vue'

const user = computed(() => getCurrentUser())
const admin = computed(() => isAdmin())
const loading = ref(true)
const error = ref('')

// Filtro mese/anno
const now = new Date()
const meseSelezionato = ref(now.getMonth() + 1) // 1-12
const annoSelezionato = ref(now.getFullYear())

const MESI = [
  { value: 1, label: 'Gennaio' },
  { value: 2, label: 'Febbraio' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Aprile' },
  { value: 5, label: 'Maggio' },
  { value: 6, label: 'Giugno' },
  { value: 7, label: 'Luglio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Settembre' },
  { value: 10, label: 'Ottobre' },
  { value: 11, label: 'Novembre' },
  { value: 12, label: 'Dicembre' },
]

const currentYear = now.getFullYear()
const ANNI = Array.from({ length: currentYear - 2023 }, (_, i) => 2024 + i).concat([currentYear + 1])

// Dati dashboard
const stats = ref(null)

const preventiviTotali = computed(() => stats.value?.preventivi?.totale ?? 0)
const preventiviAperti = computed(() => stats.value?.preventivi?.aperti ?? 0)
const preventiviChiusi = computed(() => stats.value?.preventivi?.chiusi ?? 0)
const oreTotali = computed(() => {
  const perCliente = stats.value?.ore?.per_cliente ?? []
  return perCliente.reduce((acc, c) => acc + c.ore_totali, 0).toFixed(1)
})
const perStato = computed(() => stats.value?.preventivi?.per_stato ?? {})
const perCliente = computed(() => stats.value?.ore?.per_cliente ?? [])
const perOperaio = computed(() => stats.value?.ore?.per_operaio ?? [])

async function loadStats() {
  loading.value = true
  error.value = ''
  try {
    stats.value = await getDashboardStats(meseSelezionato.value, annoSelezionato.value)
  } catch (err) {
    console.error('Errore caricamento dashboard:', err)
    error.value = 'Errore nel caricamento dei dati. Riprova.'
  } finally {
    loading.value = false
  }
}

watch([meseSelezionato, annoSelezionato], () => {
  loadStats()
})

async function onExportExcel() {
  try {
    await exportOreExcel(meseSelezionato.value, annoSelezionato.value)
  } catch (err) {
    console.error('Errore export:', err)
    error.value = 'Errore nel download del file. Riprova.'
  }
}

onMounted(() => {
  loadStats()
})
</script>

<template>
  <div>
    <!-- Intestazione -->
    <h2 class="mb-1">
      <i class="bi bi-speedometer2 me-2"></i>Dashboard
      <HelpIcon anchor="dashboard" />
    </h2>
    <p class="text-muted mb-4">
      Ciao{{ user?.nome ? ' ' + user.nome : '' }}, ecco il riepilogo dell'attivita.
    </p>

    <!-- Filtro mese/anno -->
    <div class="card mb-4 border-0 bg-light">
      <div class="card-body py-2">
        <div class="row g-2 align-items-center">
          <div class="col-auto">
            <label class="form-label mb-0 small fw-semibold text-muted">
              <i class="bi bi-calendar3 me-1"></i>Periodo
            </label>
          </div>
          <div class="col-auto">
            <select v-model.number="meseSelezionato" class="form-select form-select-sm">
              <option v-for="m in MESI" :key="m.value" :value="m.value">{{ m.label }}</option>
            </select>
          </div>
          <div class="col-auto">
            <select v-model.number="annoSelezionato" class="form-select form-select-sm">
              <option v-for="a in ANNI" :key="a" :value="a">{{ a }}</option>
            </select>
          </div>
           <div v-if="loading" class="col-auto">
             <div class="spinner-border spinner-border-sm text-primary" role="status">
               <span class="visually-hidden">Caricamento...</span>
             </div>
           </div>
           <div class="col-auto ms-auto">
             <button v-if="admin" class="btn btn-success btn-sm" @click="onExportExcel" :disabled="loading">
               <i class="bi bi-file-earmark-excel me-1"></i>Esporta Excel
             </button>
           </div>
         </div>
       </div>
     </div>

    <!-- Errore -->
    <div v-if="error" class="alert alert-danger">{{ error }}</div>

    <!-- Contenuto -->
    <div v-if="!loading || stats">

      <!-- KPI Card -->
      <div class="row g-3 mb-4">
        <!-- Preventivi totali -->
        <div class="col-6 col-md-3">
          <div class="card text-white bg-dark shadow-sm h-100">
            <div class="card-body text-center py-3">
              <div class="fs-1 fw-bold">{{ preventiviTotali }}</div>
              <div class="small opacity-75">Preventivi totali</div>
            </div>
          </div>
        </div>

        <!-- Preventivi aperti -->
        <div class="col-6 col-md-3">
          <div class="card text-dark bg-warning shadow-sm h-100">
            <div class="card-body text-center py-3">
              <div class="fs-1 fw-bold">{{ preventiviAperti }}</div>
              <div class="small opacity-75">Aperti</div>
              <div class="small opacity-50" style="font-size:0.7rem">bozza + approvato</div>
            </div>
          </div>
        </div>

        <!-- Preventivi chiusi -->
        <div class="col-6 col-md-3">
          <div class="card text-white bg-success shadow-sm h-100">
            <div class="card-body text-center py-3">
              <div class="fs-1 fw-bold">{{ preventiviChiusi }}</div>
              <div class="small opacity-75">Chiusi</div>
              <div class="small opacity-50" style="font-size:0.7rem">fatturato + rifiutato + altri</div>
            </div>
          </div>
        </div>

        <!-- Ore totali -->
        <div class="col-6 col-md-3">
          <div class="card text-white bg-primary shadow-sm h-100">
            <div class="card-body text-center py-3">
              <div class="fs-1 fw-bold">{{ oreTotali }}<span class="fs-5 ms-1 opacity-75">h</span></div>
              <div class="small opacity-75">Ore lavorate</div>
              <div class="small opacity-50" style="font-size:0.7rem">{{ admin ? 'tutti gli operai' : 'le tue ore' }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Grafico ore per operaio (solo admin) -->
      <div v-if="admin && stats" class="row g-4 mb-4">
        <div class="col-12">
          <div class="card shadow-sm">
            <div class="card-header bg-white">
              <strong><i class="bi bi-person-check me-2 text-success"></i>Ore per operaio</strong>
              <span class="badge bg-secondary ms-2">admin</span>
            </div>
            <div class="card-body">
              <OrePerOperaioBarChart :per-operaio="perOperaio" />
            </div>
          </div>
        </div>
      </div>

      <!-- Grafici riga 1: Doughnut + Barre ore per cliente -->
      <div class="row g-4 mb-4">
        <!-- Doughnut stati preventivi -->
        <div class="col-12 col-md-5">
          <div class="card shadow-sm h-100">
            <div class="card-header bg-white">
              <strong><i class="bi bi-pie-chart me-2 text-primary"></i>Preventivi per stato</strong>
            </div>
            <div class="card-body">
              <PreventiviDoughnutChart :per-stato="perStato" />
            </div>
          </div>
        </div>

        <!-- Barre orizzontali ore per cliente -->
        <div class="col-12 col-md-7">
          <div class="card shadow-sm h-100">
            <div class="card-header bg-white">
              <strong>
                <i class="bi bi-clock me-2 text-primary"></i>Ore per cliente
                <span v-if="!admin" class="badge bg-secondary ms-2" style="font-size:0.7rem">le tue ore</span>
              </strong>
            </div>
            <div class="card-body">
              <OrePerClienteBarChart :per-cliente="perCliente" />
            </div>
          </div>
        </div>
      </div>

      <!-- Grafico riga 2: Ore gestite vs non gestite (solo admin) -->
      <div v-if="admin" class="row g-4 mb-4">
        <div class="col-12">
          <div class="card shadow-sm">
            <div class="card-header bg-white">
              <strong>
                <i class="bi bi-bar-chart-steps me-2 text-success"></i>Ore: in nota di lavorazione vs non gestite
              </strong>
              <span class="badge bg-warning text-dark ms-2" style="font-size:0.7rem">admin</span>
            </div>
            <div class="card-body">
              <OreGestiteBarChart :per-cliente="perCliente" />
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- Placeholder loading iniziale -->
    <div v-else-if="loading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Caricamento...</span>
      </div>
    </div>
  </div>
</template>
